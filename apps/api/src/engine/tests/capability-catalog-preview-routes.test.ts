import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import { registerRoutes } from "../../routes.js";
import { _resetStoreForTests, readRuntimeDatabase } from "../../runtime-store.js";
import { stableStringify } from "../../capability-catalog-preview.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");
const adminToken = "catalog-preview-admin-token";
const userToken = "catalog-preview-user-token";

function adminAuth(): { authorization: string } {
  return { authorization: `Bearer ${adminToken}` };
}

function userAuth(): { authorization: string } {
  return { authorization: `Bearer ${userToken}` };
}

async function setup() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "envforge-catalog-preview-routes-"));
  process.env.FOOL_RUNTIME_DB = path.join(directory, "runtime.json");
  process.env.FOOL_DATA_DIR = directory;
  process.env.NODE_ENV = "development";
  await fs.writeFile(process.env.FOOL_RUNTIME_DB, JSON.stringify({
    schemaVersion: "0.4.0",
    users: [
      {
        id: "catalog-preview-admin", name: "Catalog Admin", email: "catalog-admin@example.test", role: "admin",
        createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z"
      },
      {
        id: "catalog-preview-user", name: "Catalog User", email: "catalog-user@example.test", role: "user",
        createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z"
      }
    ],
    sessions: [
      {
        token: adminToken, userId: "catalog-preview-admin", createdAt: "2026-07-01T00:00:00.000Z",
        expiresAt: new Date(Date.now() + 60_000).toISOString()
      },
      {
        token: userToken, userId: "catalog-preview-user", createdAt: "2026-07-01T00:00:00.000Z",
        expiresAt: new Date(Date.now() + 60_000).toISOString()
      }
    ],
    connections: [], migrationSessions: [], migrationSessionRuns: [],
    migrationDecisions: [], migrationConfigDecisions: [], migrationDataDecisions: [],
    environmentPlans: [], applyRuns: [], applyIdempotencyRecords: [], actionRuns: [],
    decisionReviewInbox: [], decisionHistory: [], decisionAudit: [], userProfiles: []
  }));
  _resetStoreForTests();
  const app = Fastify({ logger: false });
  await registerRoutes(app);
  return {
    app,
    cleanup: async () => {
      await app.close();
      _resetStoreForTests();
      await fs.rm(directory, { recursive: true, force: true });
    }
  };
}

function mutationState(db: Awaited<ReturnType<typeof readRuntimeDatabase>>) {
  return {
    environmentPlans: db.environmentPlans,
    applyRuns: db.applyRuns,
    idempotency: db.applyIdempotencyRecords,
    actionRuns: db.actionRuns,
    migrationSessions: db.migrationSessions,
    decisionReviewInbox: db.decisionReviewInbox,
    decisionHistory: db.decisionHistory
  };
}

test("Capability catalog preview routes are admin-only, read-only, and draft-only", async () => {
  const env = await setup();
  const configsCatalogRoot = path.join(repoRoot, "configs", "catalog");
  try {
    const beforeCatalogHash = await hashDirectory(configsCatalogRoot);
    const before = mutationState(await readRuntimeDatabase());

    const forbidden = await env.app.inject({
      method: "GET", url: "/api/capabilities/catalog-preview", headers: userAuth()
    });
    assert.equal(forbidden.statusCode, 403);

    const summary = await env.app.inject({
      method: "GET", url: "/api/capabilities/catalog-preview", headers: adminAuth()
    });
    assert.equal(summary.statusCode, 200, summary.body);
    const preview = summary.json().preview;
    assert.equal(preview.runtimeEnabled, false);
    assert.equal(preview.catalogMutated, false);
    assert.equal(preview.capabilityCount, 2);
    assert.ok(preview.diffSummary.gateChanges > 0);
    assert.ok(preview.diffSummary.permissionChanges > 0);
    assert.ok(preview.diffItems.some((item: { category: string }) => item.category === "service-stack-mapping"));

    const diff = await env.app.inject({
      method: "GET", url: "/api/capabilities/catalog-preview/diff", headers: adminAuth()
    });
    assert.equal(diff.statusCode, 200, diff.body);
    assert.equal(diff.json().previewId, preview.id);
    assert.ok(diff.json().diffItems.some((item: { safetyStatus: string }) => item.safetyStatus === "needs-review"));

    const artifact = await env.app.inject({
      method: "GET", url: "/api/capabilities/catalog-preview/artifact", headers: adminAuth()
    });
    assert.equal(artifact.statusCode, 200, artifact.body);
    assert.equal(artifact.json().runtimeEnabled, false);
    assert.equal(artifact.json().catalogMutated, false);
    assert.ok(artifact.json().artifacts.every((entry: { enabledByDefault: boolean }) => entry.enabledByDefault === false));

    const draft = await env.app.inject({
      method: "POST", url: "/api/capabilities/catalog-preview/promotion-request", headers: adminAuth()
    });
    assert.equal(draft.statusCode, 200, draft.body);
    assert.equal(draft.json().draft.status, "draft");
    assert.equal(draft.json().draft.runtimeEnabled, false);
    assert.equal(draft.json().draft.catalogMutated, false);
    assert.match(draft.json().draft.summary, /No capability was enabled/);
    assert.match(draft.json().draft.summary, /No apply run was created/);

    const after = mutationState(await readRuntimeDatabase());
    const afterCatalogHash = await hashDirectory(configsCatalogRoot);
    assert.deepEqual(after, before, "catalog preview and promotion draft routes must not mutate runtime state");
    assert.equal(afterCatalogHash, beforeCatalogHash, "catalog preview routes must not modify configs/catalog");
  } finally {
    await env.cleanup();
  }
});

async function hashDirectory(root: string): Promise<string> {
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      if (entry.isFile()) files.push(fullPath);
    }
  }
  await walk(root);
  const parts = await Promise.all(
    files.sort().map(async (file) => {
      const relative = path.relative(root, file).replace(/\\/g, "/");
      return relative + "\0" + (await fs.readFile(file, "utf8"));
    })
  );
  return stableStringify(parts);
}
