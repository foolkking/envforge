import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { registerRoutes } from "../../routes.js";
import { _resetStoreForTests, readRuntimeDatabase } from "../../runtime-store.js";

const userId = "failure-route-user";
const token = "failure-route-token";
const sentinel = "SENTINEL_API_TOKEN_SHOULD_NOT_LEAK";

function auth() { return { authorization: `Bearer ${token}` }; }

function snapshot() {
  return {
    agentId: "failure-agent", collectedAt: "2026-07-01T01:00:00.000Z",
    collection: { status: "partial", completeness: 0.6, commands: [], errors: ["partial"], timedOut: true },
    collectors: {
      "docker-images": {
        id: "docker-images", status: "partial", completeness: 0.2,
        commands: [{ command: "docker images", exitCode: 124, timedOut: true }],
        stderr: `API_TOKEN=${sentinel}`, errors: ["docker collection timed out"],
        collectedAt: "2026-07-01T01:00:00.000Z", data: []
      }
    },
    system: {
      hostname: "failure-source", platform: "linux", arch: "x86_64", release: "6.8", uptime: 120, osPretty: "Ubuntu 24.04",
      cpu: { model: "fixture", cores: 2, speedMhz: 2000 }, memory: { totalBytes: 1024, freeBytes: 512, usedBytes: 512, totalGb: "1", freeGb: "0.5" }
    },
    software: [{ name: "nginx", version: "1.24", source: "apt", status: "installed", trust: "user" }],
    configChecklist: [],
    counts: { apt: 1, rpm: 0, snap: 0, flatpak: 0, npm: 0, pip: 0, gem: 0, cargo: 0, localBin: 0, opt: 0, userBin: 0, nvm: 0, pyenv: 0, docker: 0, enabledServices: 0, runningServices: 0, total: 1 }
  };
}

async function setup() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "envforge-failure-routes-"));
  process.env.FOOL_RUNTIME_DB = path.join(directory, "runtime.json");
  process.env.FOOL_DATA_DIR = directory;
  process.env.NODE_ENV = "development";
  await fs.writeFile(process.env.FOOL_RUNTIME_DB, JSON.stringify({
    schemaVersion: "0.4.0",
    users: [{ id: userId, name: "Failure User", email: "failure@example.test", role: "user", createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z" }],
    sessions: [{ token, userId, createdAt: "2026-07-01T00:00:00.000Z", expiresAt: new Date(Date.now() + 60_000).toISOString() }],
    connections: [{
      id: "source", userId, method: "ssh-key", label: "Failure source", status: "probed", fields: { host: "failure.example" }, maskedSecrets: [], realConnection: false,
      probeSnapshot: snapshot(), createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z"
    }],
    migrationSessions: [{ id: "failure-session", userId, connectionId: "source", status: "failed", currentStep: "report", createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z" }],
    migrationSessionRuns: [{
      id: "verify-run", userId, sessionId: "failure-session", connectionId: "source", targetConnectionId: "target", kind: "verify", status: "failed",
      result: { checks: [{ itemName: "nginx", label: "Verify service is active", command: "systemctl is-active nginx", status: "failed", stderr: `API_TOKEN=${sentinel}`, stdout: "inactive", exitCode: 3 }] },
      createdAt: "2026-07-01T01:10:00.000Z"
    }],
    migrationDecisions: [], migrationConfigDecisions: [], migrationDataDecisions: [], environmentPlans: [], applyRuns: [], applyIdempotencyRecords: [], actionRuns: [],
    decisionReviewInbox: [], decisionHistory: [], decisionAuditLog: [], userProfiles: []
  }));
  _resetStoreForTests();
  const app = Fastify({ logger: false });
  await registerRoutes(app);
  return { app, cleanup: async () => { await app.close(); _resetStoreForTests(); await fs.rm(directory, { recursive: true, force: true }); } };
}

function state(db: Awaited<ReturnType<typeof readRuntimeDatabase>>) {
  return {
    sessions: db.migrationSessions, sessionRuns: db.migrationSessionRuns, plans: db.environmentPlans,
    applyRuns: db.applyRuns, actionRuns: db.actionRuns, inbox: db.decisionReviewInbox,
    history: db.decisionHistory, audit: db.decisionAuditLog
  };
}

test("failure and Support Bundle APIs are read-only, redacted derived views", async () => {
  const env = await setup();
  try {
    const before = state(await readRuntimeDatabase());
    const failures = await env.app.inject({ method: "GET", url: "/api/migration/sessions/failure-session/failures", headers: auth() });
    assert.equal(failures.statusCode, 200, failures.body);
    assert.equal(failures.json().readOnly, true);
    assert.ok(failures.json().diagnostics.some((item: { category: string }) => item.category === "collector-failed"));
    assert.ok(failures.json().diagnostics.some((item: { category: string }) => item.category === "verification-failed"));
    assert.doesNotMatch(failures.body, new RegExp(sentinel));

    const json = await env.app.inject({ method: "GET", url: "/api/migration/sessions/failure-session/support-bundle?format=json", headers: auth() });
    assert.equal(json.statusCode, 200, json.body);
    assert.equal(json.json().bundle.safetyBoundary.approvalCreated, false);
    assert.equal(json.json().bundle.safetyBoundary.applyRunCreated, false);
    assert.equal(json.json().bundle.safetyBoundary.actionRunCreated, false);
    assert.doesNotMatch(json.body, new RegExp(sentinel));

    const markdown = await env.app.inject({ method: "GET", url: "/api/migration/sessions/failure-session/support-bundle?format=markdown", headers: auth() });
    assert.equal(markdown.statusCode, 200, markdown.body);
    assert.match(String(markdown.headers["content-type"] ?? ""), /^text\/markdown/);
    assert.match(markdown.body, /No approval, Apply Run, or ActionRunRecord was created/i);
    assert.doesNotMatch(markdown.body, new RegExp(sentinel));

    const after = state(await readRuntimeDatabase());
    assert.deepEqual(after, before, "diagnostics and support export must not create Approval, Plan, Apply Run, ActionRunRecord, or audit state");
  } finally { await env.cleanup(); }
});

test("failure routes expose safe empty/not-found/format states", async () => {
  const env = await setup();
  try {
    const missing = await env.app.inject({ method: "GET", url: "/api/migration/sessions/missing/failures", headers: auth() });
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().status, "failure-diagnostics-unavailable");
    const badFormat = await env.app.inject({ method: "GET", url: "/api/migration/sessions/failure-session/support-bundle?format=zip", headers: auth() });
    assert.equal(badFormat.statusCode, 400);
    assert.match(badFormat.json().error, /json or markdown/);
  } finally { await env.cleanup(); }
});
