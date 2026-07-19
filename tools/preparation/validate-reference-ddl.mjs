#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ddlRoot = path.resolve(process.env.ENVFORGE_DDL_ROOT || path.join(root, "docs/07-persistence/ddl"));
const ddl = ["phase-0-foundation.sql", "phase-1-domain.sql", "phase-2-execution.sql"].map((name) => path.join(ddlRoot, name));
const probes = path.join(ddlRoot, "preparation-constraint-probes.sql");
const evidencePath = path.resolve(process.env.ENVFORGE_DDL_EVIDENCE_PATH || path.join(root, "delivery/preparation/evidence/database/reference-ddl-validation.json"));
const started = Date.now();
let tempRoot;
let dataDir;
let port;
let managedCluster = false;

try {
  const configured = process.env.PREPARATION_DATABASE_URL;
  let connection;
  if (configured) {
    const url = new URL(configured);
    if (!url.pathname.toLowerCase().includes("envforge_preparation")) {
      throw new Error("PREPARATION_DATABASE_URL must name an explicit envforge_preparation disposable database.");
    }
    connection = { url: configured };
  } else {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "envforge-preparation-pg-"));
    dataDir = path.join(tempRoot, "data");
    port = await freePort();
    checked("initdb", ["-D", dataDir, "-A", "trust", "-U", "postgres", "--encoding=UTF8", "--no-locale"]);
    checked("pg_ctl", ["-D", dataDir, "-o", `-p ${port} -h 127.0.0.1`, "-w", "start"]);
    managedCluster = true;
    checked("createdb", ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "envforge_preparation"]);
    checked("createdb", ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "envforge_preparation_reapply"]);
    connection = { host: "127.0.0.1", port: String(port), user: "postgres" };
  }

  const first = await applyAndProbe(connection, "envforge_preparation");
  const second = await applyAndProbe(connection, "envforge_preparation_reapply");
  const psqlVersion = checked("psql", ["--version"]).stdout.trim();
  const serverVersion = query(connection, "envforge_preparation", "SHOW server_version;").trim().split(/\r?\n/).at(-1);
  const summary = {
    status: "PASS",
    command: "npm run validate:ddl",
    tool: psqlVersion,
    serverVersion,
    validationTarget: "disposable PostgreSQL; not a final support commitment",
    environment: `${process.platform}/${process.arch} node ${process.version}`,
    exitCode: 0,
    cleanApply: first,
    cleanReapply: second,
    constraintProbeCount: 8,
    ddl: await Promise.all(ddl.map(async (file) => ({
      file: path.relative(root, file).replaceAll(path.sep, "/"),
      sha256: createHash("sha256").update(await readFile(file)).digest("hex")
    }))),
    probesSha256: createHash("sha256").update(await readFile(probes)).digest("hex"),
    elapsedMs: Date.now() - started,
    productionAuthority: false
  };
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 2));
} finally {
  if (managedCluster && dataDir) spawnSync("pg_ctl", ["-D", dataDir, "-m", "fast", "-w", "stop"], { encoding: "utf8" });
  if (tempRoot) {
    const resolved = path.resolve(tempRoot);
    const expectedParent = path.resolve(os.tmpdir());
    if (path.dirname(resolved) !== expectedParent || !path.basename(resolved).startsWith("envforge-preparation-pg-")) {
      throw new Error(`Refusing to remove unexpected temporary path: ${resolved}`);
    }
    await rm(resolved, { recursive: true, force: true });
  }
}

async function applyAndProbe(connection, database) {
  for (const file of ddl) psqlFile(connection, database, file);
  const probe = psqlFile(connection, database, probes);
  const match = probe.stdout.match(/preparation_table_count\s*[\r\n-]+\s*(\d+)/i);
  return { database, ddlFilesApplied: ddl.length, probes: "PASS", tableCount: match ? Number(match[1]) : null };
}

function psqlFile(connection, database, file) {
  const args = psqlArgs(connection, database, ["-v", "ON_ERROR_STOP=1", "-f", file]);
  return checked("psql", args);
}

function query(connection, database, sql) {
  return checked("psql", psqlArgs(connection, database, ["-tAc", sql])).stdout;
}

function psqlArgs(connection, database, tail) {
  if (connection.url) return [connection.url, ...tail];
  return ["-h", connection.host, "-p", connection.port, "-U", connection.user, "-d", database, ...tail];
}

function checked(command, args) {
  // On Windows pg_ctl's detached postgres child can inherit stdout/stderr and
  // keep a synchronous pipe open after pg_ctl itself has returned. Ignore the
  // streams for pg_ctl so the validation process remains deterministic.
  const isPgCtl = path.basename(command).toLowerCase().startsWith("pg_ctl");
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: isPgCtl ? "ignore" : "pipe"
  });
  if (result.status !== 0) {
    process.stderr.write(`${command} failed with ${result.status}.\n${result.stdout || ""}${result.stderr || ""}`);
    process.exit(result.status ?? 1);
  }
  return result;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const selected = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(selected));
    });
  });
}
