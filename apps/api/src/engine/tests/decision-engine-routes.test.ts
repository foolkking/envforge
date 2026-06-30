import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { evaluateAndRecordDecision, type DecisionScores } from "../../decision-engine/index.js";
import { registerRoutes } from "../../routes.js";
import { _resetStoreForTests } from "../../runtime-store.js";

const userId = "decision-route-user";
const token = "decision-route-token";

function auth(): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

function scores(overrides: Partial<DecisionScores> = {}): DecisionScores {
  return {
    intentConfidence: 0.6,
    evidenceStrength: 0.6,
    migrationReadiness: 0.55,
    riskScore: 0.25,
    automationConfidence: 0.45,
    businessCriticality: 0.3,
    reviewCost: 0.4,
    userPreferenceConfidence: 0.5,
    collectorCompleteness: 0.9,
    ...overrides
  };
}

async function setup() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "envforge-decision-routes-"));
  process.env.FOOL_RUNTIME_DB = path.join(directory, "runtime.json");
  process.env.FOOL_DATA_DIR = directory;
  process.env.NODE_ENV = "development";
  await fs.writeFile(process.env.FOOL_RUNTIME_DB, JSON.stringify({
    schemaVersion: "0.4.0",
    users: [{
      id: userId,
      name: "Decision User",
      email: "decision@example.test",
      role: "user",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }],
    sessions: [{
      token,
      userId,
      createdAt: "2026-01-01T00:00:00.000Z",
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    }],
    connections: [{
      id: "decision-connection",
      userId,
      method: "ssh-key",
      label: "Decision source",
      status: "probed",
      fields: { host: "decision-source.example" },
      maskedSecrets: [],
      realConnection: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      probeSnapshot: {
        agentId: "decision-agent",
        collectedAt: "2026-01-02T00:00:00.000Z",
        collection: { status: "ok", completeness: 1, commands: [], errors: [], timedOut: false },
        system: {
          hostname: "decision-source", platform: "linux", arch: "x64", release: "6.8", uptime: 120,
          cpu: { model: "test", cores: 2, speedMhz: 2000 },
          memory: { totalBytes: 1024, freeBytes: 512, usedBytes: 512, totalGb: "1", freeGb: "0.5" }
        },
        software: [{ name: "custom-agent", version: "1.0.0", source: "local-bin", status: "present", trust: "user" }],
        configChecklist: []
      }
    }],
    userProfiles: []
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

test("Decision Engine preference/profile routes persist scoped policy with validation and audit", async () => {
  const env = await setup();
  try {
    const anonymous = await env.app.inject({ method: "GET", url: "/api/decision-engine/preferences" });
    assert.equal(anonymous.statusCode, 401);

    const invalid = await env.app.inject({
      method: "PUT",
      url: "/api/decision-engine/preferences",
      headers: auth(),
      payload: { scope: "connection", pattern: "nginx*", preferredOutcome: "record-only" }
    });
    assert.equal(invalid.statusCode, 400, "non-global preference must have a scopeId");

    const saved = await env.app.inject({
      method: "PUT",
      url: "/api/decision-engine/preferences",
      headers: auth(),
      payload: {
        scope: "connection", scopeId: "connection-1", pattern: "nginx*",
        preferredOutcome: "required-decision", confidence: 0.8
      }
    });
    assert.equal(saved.statusCode, 200);
    const preferenceId = saved.json().preference.id as string;

    const listed = await env.app.inject({ method: "GET", url: "/api/decision-engine/preferences", headers: auth() });
    assert.equal(listed.json().preferences.length, 1);
    assert.equal(listed.json().preferences[0].scopeId, "connection-1");

    const assigned = await env.app.inject({
      method: "PUT",
      url: "/api/decision-engine/profiles",
      headers: auth(),
      payload: { profileId: "balanced", scope: "connection", scopeId: "connection-1" }
    });
    assert.equal(assigned.statusCode, 200);
    const profiles = await env.app.inject({
      method: "GET", url: "/api/decision-engine/profiles?connectionId=connection-1", headers: auth()
    });
    assert.equal(profiles.json().active.profile.id, "balanced");

    const audit = await env.app.inject({ method: "GET", url: "/api/decision-engine/audit", headers: auth() });
    assert.deepEqual(
      new Set(audit.json().audit.map((entry: { event: string }) => entry.event)),
      new Set(["preference-upserted", "profile-assigned"])
    );

    const removed = await env.app.inject({
      method: "DELETE", url: `/api/decision-engine/preferences/${preferenceId}`, headers: auth()
    });
    assert.equal(removed.statusCode, 200);
    const empty = await env.app.inject({ method: "GET", url: "/api/decision-engine/preferences", headers: auth() });
    assert.equal(empty.json().preferences.length, 0);
  } finally {
    await env.cleanup();
  }
});

test("Decision Engine Inbox route resolves review, remembers choice, and exposes history/audit", async () => {
  const env = await setup();
  try {
    const evaluation = await evaluateAndRecordDecision({
      userId,
      subjectId: "candidate-route-1",
      subjectType: "migration-candidate",
      title: "Local monitoring agent",
      scores: scores(),
      requiredGates: ["partial-snapshot-confirm"],
      context: {
        connectionId: "connection-2",
        candidateId: "candidate-route-1",
        candidateName: "Local monitoring agent"
      }
    });
    assert.ok(evaluation.inboxItem);

    const inbox = await env.app.inject({
      method: "GET", url: "/api/decision-engine/review-inbox?status=open", headers: auth()
    });
    assert.equal(inbox.statusCode, 200);
    assert.equal(inbox.json().items.length, 1);
    assert.deepEqual(inbox.json().items[0].requiredGates, ["partial-snapshot-confirm"]);

    const invalidRemember = await env.app.inject({
      method: "PATCH",
      url: `/api/decision-engine/review-inbox/${evaluation.inboxItem!.id}`,
      headers: auth(),
      payload: {
        status: "accepted",
        remember: {
          scope: "connection",
          pattern: "local monitoring agent",
          preferredOutcome: "record-only",
          confidence: 2
        }
      }
    });
    assert.equal(invalidRemember.statusCode, 400);

    const resolved = await env.app.inject({
      method: "PATCH",
      url: `/api/decision-engine/review-inbox/${evaluation.inboxItem!.id}`,
      headers: auth(),
      payload: {
        status: "accepted",
        note: "Remember this low-risk agent as record-only.",
        remember: {
          scope: "connection",
          scopeId: "connection-2",
          pattern: "local monitoring agent",
          preferredOutcome: "record-only",
          confidence: 0.9
        }
      }
    });
    assert.equal(resolved.statusCode, 200);
    assert.equal(resolved.json().item.status, "accepted");
    assert.equal(resolved.json().preference.preferredOutcome, "record-only");

    const open = await env.app.inject({
      method: "GET", url: "/api/decision-engine/review-inbox?status=open", headers: auth()
    });
    assert.equal(open.json().items.length, 0);

    const history = await env.app.inject({
      method: "GET", url: "/api/decision-engine/history?subjectId=candidate-route-1", headers: auth()
    });
    assert.equal(history.json().history.length, 1);
    assert.equal(history.json().history[0].outcome, "suggested-decision");

    const audit = await env.app.inject({ method: "GET", url: "/api/decision-engine/audit", headers: auth() });
    assert.deepEqual(
      new Set(audit.json().audit.map((entry: { event: string }) => entry.event)),
      new Set(["decision-evaluated", "review-resolved", "preference-upserted"])
    );
  } finally {
    await env.cleanup();
  }
});

test("migration session analysis materializes Decision Engine Inbox/history and user decision resolves it", async () => {
  const env = await setup();
  try {
    const created = await env.app.inject({
      method: "POST",
      url: "/api/migration/sessions",
      headers: auth(),
      payload: { connectionId: "decision-connection", reuseLatest: false }
    });
    assert.equal(created.statusCode, 200);
    const sessionId = created.json().session.id as string;

    const analysis = await env.app.inject({
      method: "GET", url: `/api/migration/sessions/${sessionId}/analysis`, headers: auth()
    });
    assert.equal(analysis.statusCode, 200);
    assert.ok(analysis.json().report.candidates.length > 0);
    const candidateId = analysis.json().report.candidates[0].id as string;

    const inbox = await env.app.inject({
      method: "GET", url: "/api/decision-engine/review-inbox?status=open", headers: auth()
    });
    assert.equal(inbox.statusCode, 200);
    assert.ok(inbox.json().items.some((item: { candidateId?: string }) => item.candidateId === candidateId));

    const historyBefore = await env.app.inject({
      method: "GET", url: `/api/decision-engine/history?subjectId=${encodeURIComponent(candidateId)}`, headers: auth()
    });
    assert.equal(historyBefore.json().history.length, 1, "repeated analysis must not duplicate an unchanged evaluation");

    const decided = await env.app.inject({
      method: "POST",
      url: `/api/migration/sessions/${sessionId}/decisions`,
      headers: auth(),
      payload: { candidateId, decision: "record-only", note: "Keep evidence without migration." }
    });
    assert.equal(decided.statusCode, 200);
    const openAfter = await env.app.inject({
      method: "GET", url: "/api/decision-engine/review-inbox?status=open", headers: auth()
    });
    assert.equal(openAfter.json().items.some((item: { candidateId?: string }) => item.candidateId === candidateId), false);
    const audit = await env.app.inject({ method: "GET", url: "/api/decision-engine/audit", headers: auth() });
    assert.ok(audit.json().audit.some((entry: { event: string }) => entry.event === "review-resolved"));
  } finally {
    await env.cleanup();
  }
});
