/**
 * inventory-graph-routes.test.ts — Phase 6-B route-level tests for
 * InventoryGraph and enriched ServiceStack production exposure.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { registerRoutes } from "../../routes.js";
import { _resetStoreForTests, readRuntimeDatabase } from "../../runtime-store.js";

const userId = "ig-route-user";
const token = "ig-route-token";

function auth(): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

function probeSnapshot() {
  return {
    agentId: "ig-route-agent",
    collectedAt: "2026-07-09T01:00:00.000Z",
    collection: { status: "ok", completeness: 1, commands: [], errors: [], timedOut: false },
    collectors: {
      "services-running": {
        id: "services-running", status: "ok", completeness: 1,
        commands: [{ command: "systemctl list-units", exitCode: 0 }], errors: [],
        collectedAt: "2026-07-09T01:00:00.000Z", data: ["nginx.service"]
      }
    },
    system: {
      hostname: "ig-route-host", platform: "linux", arch: "x86_64", release: "6.8", uptime: 120,
      osPretty: "Ubuntu 24.04 LTS",
      cpu: { model: "fixture", cores: 2, speedMhz: 2000 },
      memory: { totalBytes: 1024, freeBytes: 512, usedBytes: 512, totalGb: "1", freeGb: "0.5" }
    },
    software: [
      { name: "nginx", version: "1.26.0", source: "apt", status: "installed", trust: "user" },
      { name: "nginx.service", version: "", source: "systemd", status: "running" }
    ],
    configChecklist: [
      { id: "open-ports", label: "Open ports", category: "network", status: "80, 443", lastChanged: "2026-07-09" }
    ],
    counts: {
      apt: 1, rpm: 0, snap: 0, flatpak: 0, npm: 0, pip: 0, gem: 0, cargo: 0,
      localBin: 0, opt: 0, userBin: 0, nvm: 0, pyenv: 0, docker: 0,
      enabledServices: 0, runningServices: 1, total: 2
    }
  };
}

async function setup() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "envforge-ig-routes-"));
  process.env.FOOL_RUNTIME_DB = path.join(directory, "runtime.json");
  process.env.FOOL_DATA_DIR = directory;
  process.env.NODE_ENV = "development";
  await fs.writeFile(process.env.FOOL_RUNTIME_DB, JSON.stringify({
    schemaVersion: "0.4.0",
    users: [{
      id: userId, name: "IG Route User", email: "ig-route@example.test", role: "user",
      createdAt: "2026-07-09T00:00:00.000Z", updatedAt: "2026-07-09T00:00:00.000Z"
    }],
    sessions: [{
      token, userId, createdAt: "2026-07-09T00:00:00.000Z",
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    }],
    connections: [
      {
        id: "ig-connection", userId, method: "ssh-key", label: "IG Connection", status: "probed",
        fields: { host: "ig-host.example" }, maskedSecrets: [], realConnection: false,
        probeSnapshot: probeSnapshot(),
        createdAt: "2026-07-09T00:00:00.000Z", updatedAt: "2026-07-09T00:00:00.000Z"
      },
      {
        id: "ig-conn-no-probe", userId, method: "ssh-key", label: "No probe", status: "validated",
        fields: { host: "no-probe.example" }, maskedSecrets: [], realConnection: false,
        createdAt: "2026-07-09T00:00:00.000Z", updatedAt: "2026-07-09T00:00:00.000Z"
      }
    ],
    migrationSessions: [
      {
        id: "ig-session", userId, connectionId: "ig-connection", status: "analysis-ready", currentStep: "analysis",
        createdAt: "2026-07-09T00:00:00.000Z", updatedAt: "2026-07-09T00:00:00.000Z"
      },
      {
        id: "ig-session-no-snap", userId, connectionId: "ig-conn-no-probe", status: "created", currentStep: "source",
        createdAt: "2026-07-09T00:00:00.000Z", updatedAt: "2026-07-09T00:00:00.000Z"
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

// ── Session inventory-graph route ──

test("GET /api/migration/sessions/:sessionId/inventory-graph returns 200 with valid session", async () => {
  const env = await setup();
  try {
    const res = await env.app.inject({
      method: "GET", url: "/api/migration/sessions/ig-session/inventory-graph", headers: auth()
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = res.json();
    assert.ok(body.graph, "response has graph");
    assert.equal(body.graph.hostname, "ig-route-host");
    assert.ok(Array.isArray(body.graph.nodes), "graph has nodes array");
    assert.ok(Array.isArray(body.graph.rels), "graph has rels array");
    assert.ok(body.graph.nodes.some((n: { kind: string }) => n.kind === "package"), "graph has package nodes");
    assert.ok(body.graph.nodes.some((n: { kind: string }) => n.kind === "service"), "graph has service nodes");
    assert.ok(body.graph.nodes.some((n: { kind: string }) => n.kind === "port"), "graph has port nodes");
  } finally {
    await env.cleanup();
  }
});

test("GET /api/migration/sessions/:sessionId/inventory-graph returns 404 for unknown session", async () => {
  const env = await setup();
  try {
    const res = await env.app.inject({
      method: "GET", url: "/api/migration/sessions/not-found/inventory-graph", headers: auth()
    });
    assert.equal(res.statusCode, 404);
  } finally {
    await env.cleanup();
  }
});

test("GET /api/migration/sessions/:sessionId/inventory-graph returns 400 for session without snapshot", async () => {
  const env = await setup();
  try {
    const res = await env.app.inject({
      method: "GET", url: "/api/migration/sessions/ig-session-no-snap/inventory-graph", headers: auth()
    });
    assert.equal(res.statusCode, 400);
    assert.match(res.json().error, /No snapshot available/);
  } finally {
    await env.cleanup();
  }
});

// ── Session service-stacks route ──

test("GET /api/migration/sessions/:sessionId/service-stacks returns 200 with enriched stacks", async () => {
  const env = await setup();
  try {
    const res = await env.app.inject({
      method: "GET", url: "/api/migration/sessions/ig-session/service-stacks", headers: auth()
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = res.json();
    assert.ok(Array.isArray(body.stacks), "response has stacks array");
    assert.ok(body.stacks.length > 0, "at least one stack");

    const nginx = body.stacks.find((s: { label: string }) => s.label === "nginx");
    assert.ok(nginx, "nginx stack present");
    assert.equal(nginx.confidence, "medium");
    assert.ok(Array.isArray(nginx.packages), "stack has packages");
    assert.ok(Array.isArray(nginx.ports), "stack has ports");
    assert.ok(nginx.packages.some((p: { name: string }) => p.name === "nginx"), "nginx package in stack");
  } finally {
    await env.cleanup();
  }
});

test("GET /api/migration/sessions/:sessionId/service-stacks — enrichment metadata present", async () => {
  const env = await setup();
  try {
    const res = await env.app.inject({
      method: "GET", url: "/api/migration/sessions/ig-session/service-stacks", headers: auth()
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    const nginx = body.stacks.find((s: { label: string }) => s.label === "nginx");
    assert.ok(nginx);
    assert.ok(nginx.enrichment, "enrichment metadata present");
    assert.equal(nginx.enrichment.version, "phase5.stack.v1");
    assert.ok(typeof nginx.enrichment.sourceGraphNodeCount === "number");
    assert.ok(typeof nginx.enrichment.sourceGraphEdgeCount === "number");
  } finally {
    await env.cleanup();
  }
});

test("GET /api/migration/sessions/:sessionId/service-stacks — no raw secret values", async () => {
  const env = await setup();
  try {
    const res = await env.app.inject({
      method: "GET", url: "/api/migration/sessions/ig-session/service-stacks", headers: auth()
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.stringify(res.json());
    // Verify no raw secret-like values in response
    assert.doesNotMatch(body, /\bpassword\b/i);
    assert.doesNotMatch(body, /\bsecret\b/i);
    assert.doesNotMatch(body, /\bprivate[_-]?key\b/i);
  } finally {
    await env.cleanup();
  }
});

// ── Connection inventory-graph route ──

test("GET /api/connections/:id/inventory-graph returns 200 with probed connection", async () => {
  const env = await setup();
  try {
    const res = await env.app.inject({
      method: "GET", url: "/api/connections/ig-connection/inventory-graph", headers: auth()
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = res.json();
    assert.ok(body.graph, "response has graph");
    assert.equal(body.graph.hostname, "ig-route-host");
    assert.ok(body.graph.nodes.length > 0, "graph has nodes");
  } finally {
    await env.cleanup();
  }
});

test("GET /api/connections/:id/inventory-graph returns 400 without probeSnapshot", async () => {
  const env = await setup();
  try {
    const res = await env.app.inject({
      method: "GET", url: "/api/connections/ig-conn-no-probe/inventory-graph", headers: auth()
    });
    assert.equal(res.statusCode, 400);
    assert.match(res.json().error, /probe.*before/i);
  } finally {
    await env.cleanup();
  }
});

test("GET /api/connections/:id/inventory-graph returns 404 for unknown connection", async () => {
  const env = await setup();
  try {
    const res = await env.app.inject({
      method: "GET", url: "/api/connections/not-found/inventory-graph", headers: auth()
    });
    assert.equal(res.statusCode, 404);
  } finally {
    await env.cleanup();
  }
});

// ── Auth requirement ──

test("Inventory graph routes require auth", async () => {
  const env = await setup();
  try {
    const sessionRes = await env.app.inject({
      method: "GET", url: "/api/migration/sessions/ig-session/inventory-graph"
    });
    assert.equal(sessionRes.statusCode, 401);

    const stacksRes = await env.app.inject({
      method: "GET", url: "/api/migration/sessions/ig-session/service-stacks"
    });
    assert.equal(stacksRes.statusCode, 401);

    const connRes = await env.app.inject({
      method: "GET", url: "/api/connections/ig-connection/inventory-graph"
    });
    assert.equal(connRes.statusCode, 401);
  } finally {
    await env.cleanup();
  }
});
