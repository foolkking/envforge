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

// Phase 7-B: second user for cross-user isolation test (H1)
const userIdB = "ig-route-user-b";
const tokenB = "ig-route-token-b";

function auth(): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

// Phase 7-B: auth helper for user B
function authB(): { authorization: string } {
  return { authorization: `Bearer ${tokenB}` };
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
    }, {
      id: userIdB, name: "IG Route User B", email: "ig-route-b@example.test", role: "user",
      createdAt: "2026-07-09T00:00:00.000Z", updatedAt: "2026-07-09T00:00:00.000Z"
    }],
    sessions: [{
      token, userId, createdAt: "2026-07-09T00:00:00.000Z",
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    }, {
      token: tokenB, userId: userIdB, createdAt: "2026-07-09T00:00:00.000Z",
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
      },
      // Phase 7-B: empty-snapshot connection (H4)
      {
        id: "ig-conn-empty", userId, method: "ssh-key", label: "Empty snapshot", status: "probed",
        fields: { host: "empty.example" }, maskedSecrets: [], realConnection: false,
        probeSnapshot: {
          agentId: "ig-empty-agent",
          collectedAt: "2026-07-09T02:00:00.000Z",
          collection: { status: "ok", completeness: 1, commands: [], errors: [], timedOut: false },
          collectors: {},
          system: {
            hostname: "empty-host", platform: "linux", arch: "x86_64", release: "6.8", uptime: 60,
            osPretty: "Ubuntu 24.04 LTS",
            cpu: { model: "fixture", cores: 2, speedMhz: 2000 },
            memory: { totalBytes: 1024, freeBytes: 512, usedBytes: 512, totalGb: "1", freeGb: "0.5" }
          },
          software: [],
          configChecklist: [],
          counts: { apt: 0, rpm: 0, snap: 0, flatpak: 0, npm: 0, pip: 0, gem: 0, cargo: 0, localBin: 0, opt: 0, userBin: 0, nvm: 0, pyenv: 0, docker: 0, enabledServices: 0, runningServices: 0, total: 0 }
        },
        createdAt: "2026-07-09T00:00:00.000Z", updatedAt: "2026-07-09T00:00:00.000Z"
      },
      // Phase 7-B: user B's connection for cross-user isolation (H1)
      {
        id: "ig-conn-userb", userId: userIdB, method: "ssh-key", label: "User B Connection", status: "probed",
        fields: { host: "userb.example" }, maskedSecrets: [], realConnection: false,
        probeSnapshot: probeSnapshot(),
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
      },
      // Phase 7-B: empty-snapshot session (H4)
      {
        id: "ig-session-empty", userId, connectionId: "ig-conn-empty", status: "analysis-ready", currentStep: "analysis",
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

// ── Phase 7-B: Contract hardening tests ──

// ── H1: Cross-user isolation ──

test("H1: Connection inventory-graph returns 404 for another user's connection", async () => {
  const env = await setup();
  try {
    // User B tries to access User A's connection → 404
    const res = await env.app.inject({
      method: "GET", url: "/api/connections/ig-connection/inventory-graph", headers: authB()
    });
    assert.equal(res.statusCode, 404, `expected 404, got ${res.statusCode}: ${res.body}`);

    // User B CAN access their own connection → 200
    const own = await env.app.inject({
      method: "GET", url: "/api/connections/ig-conn-userb/inventory-graph", headers: authB()
    });
    assert.equal(own.statusCode, 200, own.body);

    // User A can still access their own connection → 200
    const userA = await env.app.inject({
      method: "GET", url: "/api/connections/ig-connection/inventory-graph", headers: auth()
    });
    assert.equal(userA.statusCode, 200, userA.body);
  } finally {
    await env.cleanup();
  }
});

// ── H3a: Session inventory-graph response shape contract ──

test("H3a: Session inventory-graph response has expected shape", async () => {
  const env = await setup();
  try {
    const res = await env.app.inject({
      method: "GET", url: "/api/migration/sessions/ig-session/inventory-graph", headers: auth()
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = res.json();

    // Top-level contract
    assert.ok(body.graph, "top-level 'graph' key present");
    const g = body.graph;

    // Required shape fields
    assert.equal(typeof g.hostname, "string", "hostname is string");
    assert.equal(typeof g.capturedAt, "string", "capturedAt is string");
    assert.equal(typeof g.completeness, "number", "completeness is number");
    assert.ok(Array.isArray(g.nodes), "nodes is array");
    assert.ok(Array.isArray(g.rels), "rels is array");

    // Node structure
    assert.ok(g.nodes.length > 0, "at least one node");
    const n = g.nodes[0];
    assert.equal(typeof n.id, "string", "node.id is string");
    assert.equal(typeof n.kind, "string", "node.kind is string");
    assert.equal(typeof n.label, "string", "node.label is string");
    assert.ok(typeof n.evidence === "object" && n.evidence !== null, "node.evidence is object");

    // Completion guarantees
    assert.ok(g.completeness >= 0 && g.completeness <= 1, "completeness in [0, 1]");
  } finally {
    await env.cleanup();
  }
});

// ── H3b: Session service-stacks response shape contract ──

test("H3b: Session service-stacks response has expected shape", async () => {
  const env = await setup();
  try {
    const res = await env.app.inject({
      method: "GET", url: "/api/migration/sessions/ig-session/service-stacks", headers: auth()
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = res.json();

    // Top-level contract
    assert.ok(Array.isArray(body.stacks), "top-level 'stacks' key is array");
    assert.ok(body.stacks.length > 0, "at least one stack");

    const s = body.stacks[0];

    // Core fields (always present)
    assert.equal(typeof s.id, "string", "stack.id is string");
    assert.ok(s.id.startsWith("stack:"), `stack.id starts with "stack:": ${s.id}`);
    assert.equal(typeof s.label, "string", "stack.label is string");
    assert.ok(s.service, "stack.service exists");
    assert.equal(s.service.kind, "service", "stack.service.kind is 'service'");
    assert.ok(Array.isArray(s.packages), "stack.packages is array");
    assert.ok(Array.isArray(s.ports), "stack.ports is array");
    assert.ok(Array.isArray(s.configFiles), "stack.configFiles is array");
    assert.ok(Array.isArray(s.containers), "stack.containers is array");
    assert.ok(["high", "medium", "low"].includes(s.confidence), `confidence valid: ${s.confidence}`);
    assert.equal(typeof s.reasoning, "string", "stack.reasoning is string");

    // Enrichment metadata
    assert.ok(s.enrichment, "enrichment metadata present");
    assert.equal(s.enrichment.version, "phase5.stack.v1", "enrichment version is phase5.stack.v1");
    assert.equal(typeof s.enrichment.sourceGraphNodeCount, "number", "sourceGraphNodeCount is number");
    assert.equal(typeof s.enrichment.sourceGraphEdgeCount, "number", "sourceGraphEdgeCount is number");
    assert.ok(s.enrichment.sourceGraphNodeCount > 0, "sourceGraphNodeCount > 0");
    assert.ok(s.enrichment.sourceGraphEdgeCount >= 0, "sourceGraphEdgeCount >= 0");
  } finally {
    await env.cleanup();
  }
});

// ── H3c: Connection inventory-graph response shape contract ──

test("H3c: Connection inventory-graph response has expected shape", async () => {
  const env = await setup();
  try {
    const res = await env.app.inject({
      method: "GET", url: "/api/connections/ig-connection/inventory-graph", headers: auth()
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = res.json();

    // Same contract as H3a: top-level
    assert.ok(body.graph, "top-level 'graph' key present");
    const g = body.graph;

    // Required shape fields
    assert.equal(typeof g.hostname, "string", "hostname is string");
    assert.equal(typeof g.capturedAt, "string", "capturedAt is string");
    assert.equal(typeof g.completeness, "number", "completeness is number");
    assert.ok(Array.isArray(g.nodes), "nodes is array");
    assert.ok(Array.isArray(g.rels), "rels is array");

    // Node structure
    assert.ok(g.nodes.length > 0, "at least one node");
    const n = g.nodes[0];
    assert.equal(typeof n.id, "string", "node.id is string");
    assert.equal(typeof n.kind, "string", "node.kind is string");
    assert.equal(typeof n.label, "string", "node.label is string");
    assert.ok(typeof n.evidence === "object" && n.evidence !== null, "node.evidence is object");
  } finally {
    await env.cleanup();
  }
});

// ── H4a: Empty snapshot → 200 with empty graph ──

test("H4a: Inventory-graph returns 200 with empty graph for empty snapshot", async () => {
  const env = await setup();
  try {
    const res = await env.app.inject({
      method: "GET", url: "/api/migration/sessions/ig-session-empty/inventory-graph", headers: auth()
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = res.json();
    assert.ok(body.graph, "graph key present");
    assert.equal(body.graph.nodes.length, 0, "no nodes for empty snapshot");
    assert.equal(body.graph.rels.length, 0, "no rels for empty snapshot");
  } finally {
    await env.cleanup();
  }
});

// ── H4b: No services → 200 with empty stacks ──

test("H4b: Service-stacks returns 200 with empty array for empty snapshot", async () => {
  const env = await setup();
  try {
    const res = await env.app.inject({
      method: "GET", url: "/api/migration/sessions/ig-session-empty/service-stacks", headers: auth()
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = res.json();
    assert.ok(Array.isArray(body.stacks), "stacks is array");
    assert.equal(body.stacks.length, 0, "empty stacks for empty snapshot");
  } finally {
    await env.cleanup();
  }
});

// ── H7: Enrichment field completeness regression guard ──

test("H7: Enrichment fields are undefined or Array, never unexpected types", async () => {
  const env = await setup();
  try {
    const res = await env.app.inject({
      method: "GET", url: "/api/migration/sessions/ig-session/service-stacks", headers: auth()
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = res.json();

    const enrichmentFields = [
      "processes", "dataPaths", "envFiles", "secretRefs", "volumes",
      "networks", "certificates", "domains", "usersGroups", "scheduledTasks"
    ];

    for (const s of body.stacks) {
      assert.ok(s.enrichment, "each stack has enrichment metadata");
      assert.equal(s.enrichment.version, "phase5.stack.v1", "enrichment version consistent");

      for (const field of enrichmentFields) {
        const value = s[field];
        // Must be undefined or an array — never null, never a plain string, never a number
        if (value === undefined) continue; // ok — optional field not present
        if (value === null) throw new assert.AssertionError({ message: `'${field}' is null, expected undefined or Array` });
        assert.ok(Array.isArray(value), `'${field}' is Array when present, got ${typeof value}`);
      }
    }
  } finally {
    await env.cleanup();
  }
});

// ── H8 (OPTIONAL): Secret safety structural test at route level ──

test("H8: SecretRef fields are structurally safe — fingerprint only, no raw values", async () => {
  const env = await setup();
  try {
    const res = await env.app.inject({
      method: "GET", url: "/api/migration/sessions/ig-session/service-stacks", headers: auth()
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = res.json();

    for (const s of body.stacks) {
      if (!s.secretRefs || s.secretRefs.length === 0) continue;
      for (const sr of s.secretRefs) {
        assert.equal(sr.redacted, true, "secretRef.redacted is always true");
        assert.equal(typeof sr.fingerprint, "string", "secretRef.fingerprint is string (hash)");
        assert.equal(typeof sr.sourceLocation, "string", "secretRef.sourceLocation is string");
        assert.equal(typeof sr.kind, "string", "secretRef.kind is string");
        assert.equal(typeof sr.confidence, "string", "secretRef.confidence is string");
        // Must NOT contain raw value fields
        assert.ok(!("value" in sr), "secretRef must not have raw 'value' field");
        assert.ok(!("plaintext" in sr), "secretRef must not have raw 'plaintext' field");
        assert.ok(!("raw" in sr), "secretRef must not have raw 'raw' field");
        // fingerprint is a hash (hex string), not a raw credential
        assert.ok(sr.fingerprint.length > 0, "fingerprint is non-empty");
      }
    }
  } finally {
    await env.cleanup();
  }
});
