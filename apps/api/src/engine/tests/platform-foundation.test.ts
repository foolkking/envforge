import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { PlatformDatabase } from "../../platform/postgres.js";
import { FoundationService, PlatformAuthorizationError, PlatformConflictError, PlatformPreconditionError } from "../../platform/service.js";
import { assertNoSensitiveKeys, canonicalHash, canonicalJson, uuidV7 } from "../../platform/foundation.js";
import { dispatchOnce } from "../../platform/dispatcher.js";
import { ArtifactCorruptionError, ArtifactService, LocalArtifactProvider, S3ArtifactProvider, type S3CompatibleClient } from "../../platform/artifacts.js";
import { registerPlatformRoutes } from "../../platform/routes.js";
import { registerRoutes } from "../../routes.js";
import { applyLegacyFoundationBackfill, planLegacyFoundationBackfill } from "../../platform/legacy-backfill.js";
import { createPostgresBackup, restorePostgresBackup } from "../../platform/backup.js";
import { _resetStoreForTests, updateRuntimeDatabase } from "../../runtime-store.js";
import { _resetSqliteDbForTests } from "../../db-sqlite.js";
import { resolveFromRoot } from "../../repo.js";

let tempRoot = "";
let dataDir = "";
let port = 0;
let database: PlatformDatabase;
let app: ReturnType<typeof Fastify>;
let token = "";
let secondToken = "";

describe("Phase 0 platform foundation", { concurrency: false }, () => {
before(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "envforge-phase0-test-"));
  dataDir = path.join(tempRoot, "pg");
  port = await freePort();
  command("initdb", ["-D", dataDir, "-A", "trust", "-U", "postgres", "--encoding=UTF8", "--no-locale"]);
  command("pg_ctl", ["-D", dataDir, "-o", `-p ${port} -h 127.0.0.1`, "-w", "start"], true);
  command("createdb", ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "envforge_phase0_test"]);
  command("createdb", ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "envforge_phase0_restore"]);
  database = new PlatformDatabase(`postgres://postgres@127.0.0.1:${port}/envforge_phase0_test`);
  await database.migrate();

  process.env.FOOL_RUNTIME_DB = path.join(tempRoot, "runtime.json");
  process.env.FOOL_DATA_DIR = path.join(tempRoot, "legacy-data");
  process.env.NODE_ENV = "test";
  process.env.ENVFORGE_MASTER_KEY ||= "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  await fs.writeFile(process.env.FOOL_RUNTIME_DB, JSON.stringify({ schemaVersion: "0.3.0", users: [], sessions: [], connections: [], userProfiles: [], tasks: [], playbooks: [] }));
  _resetStoreForTests();
  app = Fastify({ logger: false });
  await registerRoutes(app);
  await registerPlatformRoutes(app, database);
  token = `phase0-${uuidV7()}`;
  secondToken = `phase0-${uuidV7()}`;
  await updateRuntimeDatabase((store) => {
    for (const [index, [id, sessionToken]] of [["phase0-user-a", token], ["phase0-user-b", secondToken]].entries()) {
      store.users.push({ id, name: id, username: id, email: `${id}@example.test`, role: index === 0 ? "admin" : "user", passwordHash: "x", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as never);
      store.sessions.push({ token: sessionToken, userId: id, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() } as never);
    }
  });
});

after(async () => {
  await app?.close();
  await database?.close();
  await _resetSqliteDbForTests();
  if (dataDir) command("pg_ctl", ["-D", dataDir, "-m", "fast", "-w", "stop"], true, true);
  if (tempRoot) await fs.rm(tempRoot, { recursive: true, force: true });
});

test("Phase 0 foundation utilities are deterministic and reject secret-shaped fields", () => {
  assert.equal(canonicalJson({ b: 1, a: { d: 2, c: 3 } }), '{"a":{"c":3,"d":2},"b":1}');
  assert.equal(canonicalHash({ a: 1, b: 2 }), canonicalHash({ b: 2, a: 1 }));
  assert.match(uuidV7(), /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.throws(() => assertNoSensitiveKeys({ nested: { password: "canary" } }), /Sensitive field/);
});

test("production migration clean apply and replay preserve checksum and required reservations", async () => {
  const first = await database.migrate();
  const second = await database.migrate();
  assert.deepEqual(second, first);
  assert.equal(first.length, 3);
  const types = await database.pool.query("SELECT conname,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid='core.projects'::regclass");
  assert.match(types.rows.map((row) => row.definition).join(" "), /assessment.*build.*migration.*capture.*restore/);
  const delayed = await database.pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='core' AND table_name='control_plane_operations'");
  const delayedColumns = new Set(delayed.rows.map((row) => row.column_name));
  for (const column of ["available_at", "scheduled_operation_key", "deduplication_key", "cancel_requested_at", "revoked_at"]) assert.ok(delayedColumns.has(column));
  await database.transaction(async (client) => {
    const workspaceA = uuidV7();
    const workspaceB = uuidV7();
    await client.query("INSERT INTO core.workspaces(id,slug,name,status) VALUES($1,$2,'Gap A','active'),($3,$4,'Gap B','active')", [workspaceA, `gap-${workspaceA}`, workspaceB, `gap-${workspaceB}`]);
    const ids = new Map<string, string>();
    for (const projectType of ["assessment", "build", "migration", "capture", "restore"]) {
      const id = uuidV7(); ids.set(projectType, id);
      await client.query("INSERT INTO core.projects(id,workspace_id,project_type,name,status) VALUES($1,$2,$3,$4,'draft')", [id, workspaceA, projectType, `Gap ${projectType}`]);
    }
    const foreignProject = uuidV7();
    await client.query("INSERT INTO core.projects(id,workspace_id,project_type,name,status) VALUES($1,$2,'restore','Foreign','draft')", [foreignProject, workspaceB]);
    await client.query("SAVEPOINT immutable_type");
    await assert.rejects(() => client.query("UPDATE core.projects SET project_type='build' WHERE id=$1", [ids.get("assessment")]));
    await client.query("ROLLBACK TO SAVEPOINT immutable_type");
    await client.query("SAVEPOINT cross_workspace_link");
    await assert.rejects(() => client.query("INSERT INTO core.project_links(workspace_id,from_project_id,to_project_id,link_type) VALUES($1,$2,$3,'restores-archive')", [workspaceA, ids.get("restore"), foreignProject]));
    await client.query("ROLLBACK TO SAVEPOINT cross_workspace_link");
    const ownerId = ids.get("build")!;
    await client.query("INSERT INTO core.revision_identity_reservations(id,workspace_id,owner_type,owner_id,revision_type,revision_number,content_hash) VALUES($1,$2,'project',$3,'plan',1,$4)", [uuidV7(), workspaceA, ownerId, "a".repeat(64)]);
    await client.query("SAVEPOINT duplicate_revision");
    await assert.rejects(() => client.query("INSERT INTO core.revision_identity_reservations(id,workspace_id,owner_type,owner_id,revision_type,revision_number,content_hash) VALUES($1,$2,'project',$3,'plan',1,$4)", [uuidV7(), workspaceA, ownerId, "b".repeat(64)]));
    await client.query("ROLLBACK TO SAVEPOINT duplicate_revision");
  });
});

test("failed production migration rolls back its schema and version record", async () => {
  const migrationRoot = path.join(tempRoot, "failed-migrations");
  await fs.mkdir(migrationRoot, { recursive: true });
  for (const file of ["0001_phase0_foundation.sql", "0002_phase0_operations.sql", "0003_phase1_domain_planning.sql"]) {
    await fs.copyFile(resolveFromRoot("apps/api/migrations/postgres", file), path.join(migrationRoot, file));
  }
  await fs.writeFile(path.join(migrationRoot, "0004_failure_probe.sql"), "CREATE TABLE platform.must_rollback(id integer); SELECT missing_column FROM platform.must_rollback;\n");
  await assert.rejects(() => database.migrate(migrationRoot));
  const table = await database.pool.query("SELECT to_regclass('platform.must_rollback') name");
  const version = await database.pool.query("SELECT 1 FROM platform.schema_migrations WHERE version='0004'");
  assert.equal(table.rows[0].name, null);
  assert.equal(version.rowCount, 0);
});

test("service enforces idempotency, CAS, workspace scope, and atomic records", async () => {
  const service = new FoundationService(database);
  const workspaceId = await service.ensurePersonalWorkspace("direct-a", "Direct A");
  const context = { actorId: "direct-a", workspaceId, requestId: uuidV7(), correlationId: uuidV7(), idempotencyKey: "direct-create" };
  const created = await service.createProject(context, { type: "build", name: "Foundation" });
  const replay = await service.createProject(context, { type: "build", name: "Foundation" });
  assert.equal(replay.replayed, true);
  assert.equal(replay.project.id, created.project.id);
  await assert.rejects(() => service.createProject(context, { type: "capture", name: "Other" }), PlatformConflictError);
  await assert.rejects(() => service.updateProjectName({ ...context, idempotencyKey: "bad-cas" }, created.project.id, 99, "Renamed"), PlatformPreconditionError);
  const updated = await service.updateProjectName({ ...context, idempotencyKey: "good-cas" }, created.project.id, 0, "Renamed");
  assert.equal(updated.project.version, 1);
  await assert.rejects(() => service.createProject({ ...context, idempotencyKey: "duplicate-name" }, { type: "build", name: "Renamed" }));
  const orphanIdempotency = await database.pool.query("SELECT count(*) count FROM audit.idempotency_keys WHERE idempotency_key='duplicate-name'");
  assert.equal(Number(orphanIdempotency.rows[0].count), 0, "failed aggregate transaction must roll back idempotency/event/audit state");
  const other = await service.ensurePersonalWorkspace("direct-b", "Direct B");
  await assert.rejects(() => service.requireWorkspace("direct-b", workspaceId), PlatformAuthorizationError);
  const counts = await database.pool.query(`SELECT
    (SELECT count(*) FROM audit.domain_events WHERE workspace_id=$1) events,
    (SELECT count(*) FROM audit.outbox_messages WHERE workspace_id=$1) outbox,
    (SELECT count(*) FROM audit.audit_records WHERE workspace_id=$1) audits`, [workspaceId]);
  assert.equal(Number(counts.rows[0].events), 2);
  assert.equal(Number(counts.rows[0].outbox), 2);
  assert.equal(Number(counts.rows[0].audits), 2);
  assert.notEqual(other, workspaceId);
  const endpoint = await service.createEndpoint({ ...context, idempotencyKey: "endpoint-create" }, { kind: "linux-host", displayName: "Source host", hostIdentity: { hostname: "source.example.test" } });
  const bound = await service.bindEndpoint({ ...context, idempotencyKey: "endpoint-bind" }, created.project.id, endpoint.id, "source", updated.project.version);
  assert.equal(bound.id, endpoint.id);
  assert.equal((await service.listProjectEndpoints(workspaceId, created.project.id)).length, 1);
});

test("API project contract survives pool restart and hides cross-workspace resources", async () => {
  const headers = { authorization: `Bearer ${token}`, "idempotency-key": "api-create" };
  const created = await app.inject({ method: "POST", url: "/api/v1/projects", headers, payload: { type: "migration", name: "API foundation" } });
  assert.equal(created.statusCode, 201, created.body);
  const project = created.json() as { id: string; workspaceId: string; version: number };
  assert.equal(created.headers.etag, '"0"');
  const replay = await app.inject({ method: "POST", url: "/api/v1/projects", headers, payload: { type: "migration", name: "API foundation" } });
  assert.equal(replay.statusCode, 200, replay.body);
  assert.equal((replay.json() as { id: string }).id, project.id);
  const conflict = await app.inject({ method: "POST", url: "/api/v1/projects", headers, payload: { type: "build", name: "Different" } });
  assert.equal(conflict.statusCode, 409, conflict.body);
  const stale = await app.inject({ method: "PATCH", url: `/api/v1/projects/${project.id}`, headers: { ...headers, "idempotency-key": "api-stale", "if-match": '"7"', "x-workspace-id": project.workspaceId }, payload: { name: "No" } });
  assert.equal(stale.statusCode, 412, stale.body);
  const denied = await app.inject({ method: "GET", url: `/api/v1/projects/${project.id}`, headers: { authorization: `Bearer ${secondToken}`, "x-workspace-id": project.workspaceId } });
  assert.equal(denied.statusCode, 404, denied.body);
  const freshPool = new PlatformDatabase(`postgres://postgres@127.0.0.1:${port}/envforge_phase0_test`);
  const restartedApp = Fastify({ logger: false });
  await registerPlatformRoutes(restartedApp, freshPool);
  const persisted = await restartedApp.inject({ method: "GET", url: `/api/v1/projects/${project.id}`, headers: { authorization: `Bearer ${token}`, "x-workspace-id": project.workspaceId } });
  assert.equal(persisted.statusCode, 200, persisted.body);
  assert.equal((persisted.json() as { id: string }).id, project.id);
  await restartedApp.close();
  await freshPool.close();
});

test("database readiness fails closed when PostgreSQL is unavailable", async () => {
  const unavailable = new PlatformDatabase({ host: "127.0.0.1", port: await freePort(), database: "missing", user: "missing", connectionTimeoutMillis: 250 });
  assert.deepEqual(await unavailable.health(), { ok: false });
  await unavailable.close();
});

test("outbox duplicate delivery is inbox-idempotent and safe operation completes", async () => {
  const projected = await dispatchOnce(database, "projection", "projection-test");
  assert.ok(projected >= 1);
  const projectMessage = await database.pool.query<{ id: string }>("SELECT id FROM audit.outbox_messages WHERE topic='projection.project' ORDER BY created_at LIMIT 1");
  await database.pool.query("UPDATE audit.outbox_messages SET state='pending',published_at=NULL,claimed_by=NULL,claim_token=NULL,lease_expires_at=NULL WHERE id=$1", [projectMessage.rows[0].id]);
  assert.equal(await dispatchOnce(database, "projection", "projection-replay"), 1);
  const inbox = await database.pool.query("SELECT count(*) count FROM audit.inbox_messages WHERE consumer_name='project-summary' AND message_id=$1", [projectMessage.rows[0].id]);
  assert.equal(Number(inbox.rows[0].count), 1);

  const leaseService = new FoundationService(database);
  const leaseWorkspace = await leaseService.ensurePersonalWorkspace("lease-user", "Lease User");
  await leaseService.createProject({ actorId: "lease-user", workspaceId: leaseWorkspace, requestId: uuidV7(), idempotencyKey: "lease-project" }, { type: "assessment", name: "Lease reclaim" });
  const leaseMessage = await database.pool.query<{ id: string }>("SELECT id FROM audit.outbox_messages WHERE topic='projection.project' AND state='pending' ORDER BY created_at DESC LIMIT 1");
  await database.pool.query("UPDATE audit.outbox_messages SET state='claimed',claimed_by='dead-worker',claim_token=$2,lease_expires_at=now()-interval '1 second' WHERE id=$1", [leaseMessage.rows[0].id, uuidV7()]);
  assert.ok(await dispatchOnce(database, "projection", "lease-reclaimer") >= 1);

  const service = new FoundationService(database);
  const workspaceId = await service.ensurePersonalWorkspace("phase0-user-a", "Operation");
  const operationResponse = await app.inject({ method: "POST", url: "/api/v1/platform/operations/hash-verification", headers: { authorization: `Bearer ${token}`, "x-workspace-id": workspaceId, "idempotency-key": "verify-once" }, payload: { input: { value: "safe" } } });
  assert.equal(operationResponse.statusCode, 202, operationResponse.body);
  const operationId = (operationResponse.json() as { id: string }).id;
  assert.equal(await dispatchOnce(database, "operation", "operation-test"), 1);
  const operation = await app.inject({ method: "GET", url: `/api/v1/platform/operations/${operationId}`, headers: { authorization: `Bearer ${token}`, "x-workspace-id": workspaceId } });
  assert.equal(operation.statusCode, 200, operation.body);
  assert.equal((operation.json() as { state: string; resultHash: string }).state, "succeeded");
  assert.equal((operation.json() as { resultHash: string }).resultHash, canonicalHash({ value: "safe" }));
  const metrics = await app.inject({ method: "GET", url: "/api/v1/platform/metrics", headers: { authorization: `Bearer ${token}`, "x-workspace-id": workspaceId } });
  assert.equal(metrics.statusCode, 200, metrics.body);
  assert.equal(typeof (metrics.json() as { outbox_pending: number }).outbox_pending, "number");

  const unsupported = await database.pool.query<{ id: string }>("SELECT id FROM audit.outbox_messages WHERE topic='projection.project' ORDER BY created_at LIMIT 1");
  await database.pool.query("UPDATE audit.outbox_messages SET state='pending',published_at=NULL,claimed_by=NULL,claim_token=NULL,lease_expires_at=NULL,attempt_count=7,payload=jsonb_set(payload,'{schemaVersion}','99'::jsonb) WHERE id=$1", [unsupported.rows[0].id]);
  assert.equal(await dispatchOnce(database, "projection", "unsupported-schema"), 1);
  const dead = await database.pool.query("SELECT state FROM audit.outbox_messages WHERE id=$1", [unsupported.rows[0].id]);
  assert.equal(dead.rows[0].state, "dead-letter");
});

test("local artifact publish is atomic, workspace-scoped, and detects corruption", async () => {
  const provider = new LocalArtifactProvider(path.join(tempRoot, "artifacts"));
  const workspaceId = uuidV7();
  await database.pool.query("INSERT INTO core.workspaces(id,slug,name,status) VALUES($1,$2,$3,'active')", [workspaceId, `artifact-${workspaceId}`, "Artifact Workspace"]);
  const service = new ArtifactService(database, provider);
  const record = await service.put(workspaceId, "foundation-test", "text/plain", Buffer.from("foundation artifact"));
  assert.equal(record.state, "available");
  assert.equal((await service.get(workspaceId, record.id)).toString(), "foundation artifact");
  await assert.rejects(() => provider.get(uuidV7(), record.key, record.sha256), /workspace access denied/);
  const diskPath = path.join(tempRoot, "artifacts", ...record.key.split("/"));
  await fs.writeFile(diskPath, "tampered");
  await assert.rejects(() => service.get(workspaceId, record.id), ArtifactCorruptionError);
  const state = await database.pool.query("SELECT state FROM artifact.artifacts WHERE id=$1", [record.id]);
  assert.equal(state.rows[0].state, "corrupt");
  await assert.rejects(() => provider.get(workspaceId, "../escape", record.sha256));
});

test("S3-compatible provider contract reconciles staging and verifies reads", async () => {
  const client = new MemoryS3();
  const provider = new S3ArtifactProvider(client, "phase0-test");
  const workspaceId = uuidV7();
  const put = await provider.put(workspaceId, Buffer.from("s3 contract"));
  assert.equal((await provider.get(workspaceId, put.key, put.sha256)).toString(), "s3 contract");
  assert.equal((await provider.head(workspaceId, put.key))?.sha256, put.sha256);
  assert.equal([...client.objects.keys()].some((key) => key.includes("/staging/")), false);
});

test("legacy foundation backfill is dry-run safe, resumable, and idempotent", async () => {
  const source = [{ id: "legacy-session-1", userId: "legacy-user", name: "Imported migration", status: "review" }, { id: "legacy-rejected" }];
  const dryRun = planLegacyFoundationBackfill(source);
  assert.equal(dryRun[0].state, "rejected");
  assert.equal(dryRun[1].state, "ready");
  const first = await applyLegacyFoundationBackfill(database, source);
  const second = await applyLegacyFoundationBackfill(database, source);
  const imported = first.find((item) => item.sourceId === "legacy-session-1")!;
  const replay = second.find((item) => item.sourceId === "legacy-session-1")!;
  assert.equal(imported.state, "imported");
  assert.equal(replay.state, "existing");
  assert.equal(replay.targetId, imported.targetId);
  const operations = await database.pool.query("SELECT count(*) count FROM core.control_plane_operations WHERE workspace_id IN (SELECT workspace_id FROM platform.legacy_backfill_items WHERE source_id='legacy-session-1')");
  assert.equal(Number(operations.rows[0].count), 0, "backfill must not emit an external/control operation");
});

test("secret canary is rejected before persistence and absent from a database dump", async () => {
  const canary = "ENVFORGE_PHASE0_CANARY_DO_NOT_PERSIST_7f302c";
  const service = new FoundationService(database);
  const workspaceId = await service.ensurePersonalWorkspace("canary-user", "Canary User");
  await assert.rejects(() => service.createHashVerificationOperation({ actorId: "canary-user", workspaceId, requestId: uuidV7(), idempotencyKey: "canary" }, { password: canary }), /Sensitive field/);
  const dump = spawnSync("pg_dump", ["--dbname", `postgres://postgres@127.0.0.1:${port}/envforge_phase0_test`, "--format=plain", "--no-owner", "--no-privileges"], { encoding: "utf8", timeout: 60_000 });
  assert.equal(dump.status, 0, dump.stderr);
  assert.equal(dump.stdout.includes(canary), false);
});

test("PostgreSQL backup restores into an empty disposable database", async () => {
  const backupPath = path.join(tempRoot, "phase0.backup");
  const sourceUrl = `postgres://postgres@127.0.0.1:${port}/envforge_phase0_test`;
  const restoreUrl = `postgres://postgres@127.0.0.1:${port}/envforge_phase0_restore`;
  const backup = await createPostgresBackup(sourceUrl, backupPath);
  assert.ok(backup.bytes > 0);
  await restorePostgresBackup(restoreUrl, backupPath);
  const restored = new PlatformDatabase(restoreUrl);
  const counts = await restored.pool.query("SELECT count(*) projects FROM core.projects");
  assert.ok(Number(counts.rows[0].projects) >= 1);
  assert.deepEqual((await restored.migrate()).map((item) => item.version), ["0001", "0002", "0003"]);
  await restored.close();
});

test("Phase 0 performance baseline records idempotency contention and local artifact cost", async () => {
  const service = new FoundationService(database);
  const workspaceId = await service.ensurePersonalWorkspace("perf-user", "Performance");
  const context = { actorId: "perf-user", workspaceId, requestId: uuidV7(), idempotencyKey: "perf-contention-50" };
  const contentionStarted = performance.now();
  const results = await Promise.all(Array.from({ length: 50 }, () => service.createProject(context, { type: "assessment", name: "Contention baseline" })));
  const contentionMs = performance.now() - contentionStarted;
  assert.equal(new Set(results.map((item) => item.project.id)).size, 1);

  const createRead: number[] = [];
  for (let index = 0; index < 20; index += 1) {
    const started = performance.now();
    const created = await service.createProject({ ...context, requestId: uuidV7(), idempotencyKey: `perf-project-${index}` }, { type: "assessment", name: `Performance ${index}` });
    await service.getProject(workspaceId, created.project.id);
    createRead.push(performance.now() - started);
  }
  createRead.sort((a, b) => a - b);

  const artifactWorkspace = uuidV7();
  await database.pool.query("INSERT INTO core.workspaces(id,slug,name,status) VALUES($1,$2,'Performance Artifact','active')", [artifactWorkspace, `perf-artifact-${artifactWorkspace}`]);
  const artifact = new ArtifactService(database, new LocalArtifactProvider(path.join(tempRoot, "performance-artifacts")));
  const artifactStarted = performance.now();
  const record = await artifact.put(artifactWorkspace, "performance", "application/octet-stream", Buffer.alloc(1024 * 1024, 0x41));
  await artifact.get(artifactWorkspace, record.id);
  const artifactMs = performance.now() - artifactStarted;

  console.log(JSON.stringify({ phase0Performance: { contention50Ms: Math.round(contentionMs), createReadP50Ms: roundedPercentile(createRead, 0.5), createReadP95Ms: roundedPercentile(createRead, 0.95), localArtifact1MiBPutReadMs: Math.round(artifactMs) } }));
});
});

class MemoryS3 implements S3CompatibleClient {
  objects = new Map<string, { body: Buffer; metadata: Record<string, string> }>();
  async putObject(input: { key: string; body: Buffer; metadata: Record<string, string> }): Promise<void> { this.objects.set(input.key, { body: Buffer.from(input.body), metadata: { ...input.metadata } }); }
  async headObject(input: { key: string }) { const value = this.objects.get(input.key); return value ? { bytes: value.body.length, metadata: value.metadata } : undefined; }
  async getObject(input: { key: string }): Promise<Buffer> { const value = this.objects.get(input.key); if (!value) throw new Error("missing"); return Buffer.from(value.body); }
  async copyObject(input: { sourceKey: string; targetKey: string }): Promise<void> { const value = this.objects.get(input.sourceKey); if (!value) throw new Error("missing"); this.objects.set(input.targetKey, { body: Buffer.from(value.body), metadata: { ...value.metadata } }); }
  async deleteObject(input: { key: string }): Promise<void> { this.objects.delete(input.key); }
}

function command(name: string, args: string[], quiet = false, ignoreFailure = false): void {
  const result = spawnSync(name, args, { encoding: "utf8", stdio: quiet ? "ignore" : "pipe", timeout: 60_000 });
  if (!ignoreFailure && result.status !== 0) throw new Error(`${name} failed (${result.status}): ${result.stderr || result.stdout || "no output"}`);
}
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => { const server = net.createServer(); server.once("error", reject); server.listen(0, "127.0.0.1", () => { const address = server.address(); const selected = typeof address === "object" && address ? address.port : 0; server.close((error) => error ? reject(error) : resolve(selected)); }); });
}
function roundedPercentile(values: number[], percentile: number): number {
  return Math.round(values[Math.min(values.length - 1, Math.floor(values.length * percentile))]);
}
