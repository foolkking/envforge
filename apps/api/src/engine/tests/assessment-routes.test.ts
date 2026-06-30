import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { registerRoutes } from "../../routes.js";
import { _resetStoreForTests, readRuntimeDatabase } from "../../runtime-store.js";

const userId = "assessment-route-user";
const token = "assessment-route-token";

function auth(): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

function probeSnapshot() {
  return {
    agentId: "assessment-route-agent",
    collectedAt: "2026-07-01T01:00:00.000Z",
    collection: { status: "ok", completeness: 1, commands: [], errors: [], timedOut: false },
    collectors: {
      "docker-images": {
        id: "docker-images", status: "ok", completeness: 1,
        commands: [{ command: "docker images", exitCode: 0 }], errors: [],
        collectedAt: "2026-07-01T01:00:00.000Z", data: []
      },
      "services-running": {
        id: "services-running", status: "ok", completeness: 1,
        commands: [{ command: "systemctl list-units", exitCode: 0 }], errors: [],
        collectedAt: "2026-07-01T01:00:00.000Z", data: ["postgresql.service"]
      }
    },
    system: {
      hostname: "assessment-source", platform: "linux", arch: "x86_64", release: "6.8", uptime: 120,
      osPretty: "Ubuntu 24.04 LTS",
      cpu: { model: "fixture", cores: 2, speedMhz: 2000 },
      memory: { totalBytes: 1024, freeBytes: 512, usedBytes: 512, totalGb: "1", freeGb: "0.5" }
    },
    software: [
      { name: "postgresql", version: "16", source: "apt", status: "installed", trust: "user" },
      { name: "postgresql", version: "running-service", source: "systemd", status: "running", trust: "user" }
    ],
    configChecklist: [
      { id: "open-ports", label: "Open ports: 5432", category: "network", status: "healthy", lastChanged: "2026-07-01" },
      { id: "postgresql-config", label: "pg_hba.conf and postgresql.conf found", category: "database", status: "healthy", lastChanged: "2026-07-01" }
    ],
    counts: {
      apt: 1, rpm: 0, snap: 0, flatpak: 0, npm: 0, pip: 0, gem: 0, cargo: 0,
      localBin: 0, opt: 0, userBin: 0, nvm: 0, pyenv: 0, docker: 0,
      enabledServices: 0, runningServices: 1, total: 2
    }
  };
}

async function setup() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "envforge-assessment-routes-"));
  process.env.FOOL_RUNTIME_DB = path.join(directory, "runtime.json");
  process.env.FOOL_DATA_DIR = directory;
  process.env.NODE_ENV = "development";
  await fs.writeFile(process.env.FOOL_RUNTIME_DB, JSON.stringify({
    schemaVersion: "0.4.0",
    users: [{
      id: userId, name: "Assessment User", email: "assessment@example.test", role: "user",
      createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z"
    }],
    sessions: [{
      token, userId, createdAt: "2026-07-01T00:00:00.000Z",
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    }],
    connections: [
      {
        id: "assessment-source", userId, method: "ssh-key", label: "Assessment source", status: "probed",
        fields: { host: "assessment-source.example" }, maskedSecrets: [], realConnection: false,
        probeSnapshot: probeSnapshot(), createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z"
      },
      {
        id: "assessment-no-snapshot", userId, method: "ssh-key", label: "No snapshot", status: "validated",
        fields: { host: "no-snapshot.example" }, maskedSecrets: [], realConnection: false,
        createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z"
      }
    ],
    migrationSessions: [
      {
        id: "assessment-session", userId, connectionId: "assessment-source", status: "analysis-ready", currentStep: "analysis",
        createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z"
      },
      {
        id: "assessment-missing-snapshot", userId, connectionId: "assessment-no-snapshot", status: "created", currentStep: "source",
        createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z"
      }
    ],
    migrationSessionRuns: [], migrationDecisions: [], migrationConfigDecisions: [], migrationDataDecisions: [],
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

function readOnlyState(db: Awaited<ReturnType<typeof readRuntimeDatabase>>) {
  return {
    sessions: db.migrationSessions,
    sessionRuns: db.migrationSessionRuns,
    environmentPlans: db.environmentPlans,
    applyRuns: db.applyRuns,
    idempotency: db.applyIdempotencyRecords,
    actionRuns: db.actionRuns,
    inbox: db.decisionReviewInbox,
    history: db.decisionHistory,
    audit: db.decisionAuditLog
  };
}

test("Assessment API and reports are read-only derived views", async () => {
  const env = await setup();
  try {
    const before = readOnlyState(await readRuntimeDatabase());
    const summary = await env.app.inject({
      method: "GET", url: "/api/migration/sessions/assessment-session/assessment", headers: auth()
    });
    assert.equal(summary.statusCode, 200, summary.body);
    assert.ok(summary.json().assessment.serviceStacks.some((stack: { category: string }) => stack.category === "database"));

    const jsonReport = await env.app.inject({
      method: "GET", url: "/api/migration/sessions/assessment-session/assessment/report?format=json", headers: auth()
    });
    assert.equal(jsonReport.statusCode, 200, jsonReport.body);
    assert.equal(jsonReport.json().format, "json");
    assert.equal(jsonReport.json().report.sessionId, "assessment-session");

    const markdownReport = await env.app.inject({
      method: "GET", url: "/api/migration/sessions/assessment-session/assessment/report?format=markdown", headers: auth()
    });
    assert.equal(markdownReport.statusCode, 200, markdownReport.body);
    assert.match(String(markdownReport.headers["content-type"] ?? ""), /^text\/markdown/);
    assert.match(markdownReport.body, /No apply run was created/);
    assert.match(markdownReport.body, /No target mutation was performed/);

    const after = readOnlyState(await readRuntimeDatabase());
    assert.deepEqual(after, before, "Assessment reads must not create or mutate session runs, Plans, approvals, apply/action runs, or Decision Engine records");
    assert.equal(after.environmentPlans?.some((plan) => plan.status === "approved"), false);
  } finally {
    await env.cleanup();
  }
});

test("Assessment routes return explicit unavailable states and reject unsupported formats", async () => {
  const env = await setup();
  try {
    const missingSession = await env.app.inject({
      method: "GET", url: "/api/migration/sessions/not-found/assessment", headers: auth()
    });
    assert.equal(missingSession.statusCode, 404);
    assert.equal(missingSession.json().status, "assessment-unavailable");

    const missingSnapshot = await env.app.inject({
      method: "GET", url: "/api/migration/sessions/assessment-missing-snapshot/assessment", headers: auth()
    });
    assert.equal(missingSnapshot.statusCode, 409);
    assert.equal(missingSnapshot.json().status, "snapshot-missing");

    const invalidFormat = await env.app.inject({
      method: "GET", url: "/api/migration/sessions/assessment-session/assessment/report?format=pdf", headers: auth()
    });
    assert.equal(invalidFormat.statusCode, 400);
    assert.match(invalidFormat.json().error, /json or markdown/);
  } finally {
    await env.cleanup();
  }
});
