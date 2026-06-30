import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { registerRoutes } from "../../routes.js";
import { _resetStoreForTests, readRuntimeDatabase, updateRuntimeDatabase } from "../../runtime-store.js";
import type { EnvironmentPlan } from "../../environment-plan.js";
import { createEnvironmentPlan } from "../../plan-store.js";
import { prepareEnvironmentPlanForCreation } from "../../plan-lifecycle.js";
import { runApprovedPlanSchedulesOnceForTests } from "../../scheduler.js";

async function bootApp() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "envforge-plan-apply-routes-"));
  process.env.FOOL_RUNTIME_DB = path.join(tmpDir, "runtime.json");
  process.env.FOOL_DATA_DIR = tmpDir;
  process.env.ENVFORGE_ARTIFACT_DIR = path.join(tmpDir, "artifacts");
  process.env.NODE_ENV = "development";
  process.env.SMTP_HOST = "";
  process.env.SMTP_USER = "";
  process.env.SMTP_PASS = "";
  process.env.ENVFORGE_MASTER_KEY ||= "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  await fs.writeFile(process.env.FOOL_RUNTIME_DB, JSON.stringify({
    schemaVersion: "0.3.0", users: [], sessions: [], connections: [], userProfiles: [], tasks: [], playbooks: []
  }));
  _resetStoreForTests();
  const app = Fastify({ logger: false });
  await registerRoutes(app);
  return { app, tmpDir };
}

async function seedIdentity(): Promise<{ token: string; userId: string; connectionId: string }> {
  const userId = `security-user-${Date.now()}-${Math.random()}`;
  const token = `security-token-${Math.random()}`;
  const connectionId = `security-connection-${Math.random()}`;
  await updateRuntimeDatabase((db) => {
    db.users.push({
      id: userId, name: "Security User", email: `${userId}@example.com`, role: "user",
      passwordHash: "x", createdAt: new Date().toISOString()
    } as never);
    db.sessions.push({
      token, userId, kind: "regular", ip: "127.0.0.1", userAgent: "test",
      createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString()
    } as never);
    db.connections.push({
      id: connectionId, userId, method: "ssh-key", label: "isolated target", tags: [], status: "validated",
      fields: { host: "127.0.0.1", port: "22", username: "root" }, maskedSecrets: [], realConnection: false,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    } as never);
  });
  return { token, userId, connectionId };
}

async function createRecipePlan(app: ReturnType<typeof Fastify>, token: string, connectionId: string): Promise<EnvironmentPlan> {
  const response = await app.inject({
    method: "POST", url: "/api/plans", headers: { authorization: `Bearer ${token}` },
    payload: {
      targetConnectionId: connectionId,
      source: { kind: "recipe", name: "Security route recipe", yaml: "name: route-test\nsteps:\n  - run: echo frozen\n" }
    }
  });
  assert.equal(response.statusCode, 200, response.body);
  return (response.json() as { plan: EnvironmentPlan }).plan;
}

async function createNoopPlan(userId: string, connectionId: string, suffix: string): Promise<EnvironmentPlan> {
  const draft: EnvironmentPlan = {
    id: `noop-apply-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: "repair",
    status: "needs-review",
    name: "No-op managed apply regression plan",
    targetConnectionId: connectionId,
    generatedAt: new Date().toISOString(),
    summary: { totalItems: 1, totalActions: 1, highRisk: 0, requiresSudo: 0, rollbackable: 0 },
    review: { required: true, reasons: ["Regression plan exercises apply claim without target mutation."], conflicts: [], approvalsRequired: [] },
    items: [{
      id: "noop-item",
      name: "No-op item",
      type: "repair",
      risks: [],
      evidence: ["No SSH side effect; managed execution should still emit ActionRunRecord."],
      userDecision: "approved",
      actions: [{
        id: "noop-action",
        kind: "manualStep",
        label: "No-op manual checkpoint",
        requiresSudo: false,
        changesTarget: false,
        canRollback: false,
        risk: "safe"
      }]
    }],
    export: { markdown: "# No-op managed apply regression plan\n" }
  };
  const frozen = await prepareEnvironmentPlanForCreation(draft);
  await createEnvironmentPlan(frozen, userId);
  return frozen;
}

async function approvePlan(app: ReturnType<typeof Fastify>, token: string, plan: EnvironmentPlan): Promise<EnvironmentPlan> {
  const review = await app.inject({
    method: "POST",
    url: `/api/plans/${encodeURIComponent(plan.id)}/review`,
    headers: { authorization: `Bearer ${token}` },
    payload: approvalPayload(plan)
  });
  assert.equal(review.statusCode, 200, review.body);
  return (review.json() as { plan: EnvironmentPlan }).plan;
}

function approvalPayload(plan: EnvironmentPlan) {
  return {
    decision: "approved",
    acknowledgedRisks: plan.items.map((item) => ({ itemId: item.id, risks: item.risks })),
    acknowledgedConflicts: (plan.review.conflicts ?? []).map((conflict) => ({
      conflictId: conflict.id,
      resolutionId: conflict.resolutionOptions[0]?.id
    })),
    acknowledgedApprovals: (plan.review.approvalsRequired ?? []).map((gate) => ({ itemId: gate.itemId, gateId: gate.id }))
  };
}

test("Apply uses only URL plan id, cannot create a Plan, and rejects payload injection", async () => {
  const { app, tmpDir } = await bootApp();
  try {
    const { token, connectionId } = await seedIdentity();
    const auth = { authorization: `Bearer ${token}` };
    const missing = await app.inject({ method: "POST", url: "/api/plans/missing-id/apply", headers: auth, payload: { plan: { id: "attacker" } } });
    assert.equal(missing.statusCode, 404);
    assert.match(missing.body, /not found/i);

    const plan = await createRecipePlan(app, token, connectionId);
    for (const field of ["plan", "path", "content", "yaml", "actions", "export", "approvals", "acknowledged", "gateAcknowledgements"] as const) {
      const response = await app.inject({
        method: "POST", url: `/api/plans/${encodeURIComponent(plan.id)}/apply`, headers: auth,
        payload: { dryRun: true, [field]: field === "plan" ? { ...plan, id: "other-id" } : "attacker-controlled" }
      });
      assert.equal(response.statusCode, 400, `${field} must be rejected: ${response.body}`);
    }
    const database = await readRuntimeDatabase();
    assert.equal(database.environmentPlans?.length, 1, "Apply must never persist body.plan");
  } finally {
    await app.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("unapproved real apply is refused while dry-run records evidence without approving", async () => {
  const { app, tmpDir } = await bootApp();
  try {
    const { token, connectionId } = await seedIdentity();
    const auth = { authorization: `Bearer ${token}` };
    const plan = await createRecipePlan(app, token, connectionId);
    const refused = await app.inject({ method: "POST", url: `/api/plans/${encodeURIComponent(plan.id)}/apply`, headers: auth, payload: { dryRun: false } });
    assert.equal(refused.statusCode, 400);
    assert.match(refused.body, /approved/i);

    const dryRun = await app.inject({ method: "POST", url: `/api/plans/${encodeURIComponent(plan.id)}/apply`, headers: auth, payload: { dryRun: true } });
    assert.equal(dryRun.statusCode, 200, dryRun.body);
    const body = dryRun.json() as { plan: EnvironmentPlan; execution: { actionRuns: Array<{ planId: string; planHash: string; actionId: string; dryRun: boolean }> } };
    assert.equal(body.plan.status, "needs-review");
    assert.ok(body.execution.actionRuns.length > 0);
    for (const run of body.execution.actionRuns) {
      assert.equal(run.planId, plan.id);
      assert.equal(run.planHash, plan.planHash);
      assert.ok(run.actionId);
      assert.equal(run.dryRun, true);
    }
    const stored = (await readRuntimeDatabase()).environmentPlans?.find((row) => row.id === plan.id);
    assert.equal(stored?.status, "needs-review");
    assert.equal(stored?.lastDryRunResult?.planHash, plan.planHash);
    const detailResponse = await app.inject({ method: "GET", url: `/api/plans/${encodeURIComponent(plan.id)}`, headers: auth });
    const detail = detailResponse.json() as { lastDryRunResult?: { planHash: string }; actionRuns: Array<{ planHash: string; dryRun: boolean }> };
    assert.equal(detail.lastDryRunResult?.planHash, plan.planHash);
    assert.ok(detail.actionRuns.length > 0);
    assert.ok(detail.actionRuns.every((run) => run.planHash === plan.planHash && run.dryRun));
  } finally {
    await app.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("approval stores approvedPlanHash and apply recomputes it before execution", async () => {
  const { app, tmpDir } = await bootApp();
  try {
    const { token, connectionId } = await seedIdentity();
    const auth = { authorization: `Bearer ${token}` };
    const plan = await createRecipePlan(app, token, connectionId);
    const review = await app.inject({
      method: "POST", url: `/api/plans/${encodeURIComponent(plan.id)}/review`, headers: auth, payload: approvalPayload(plan)
    });
    assert.equal(review.statusCode, 200, review.body);
    const approved = (review.json() as { plan: EnvironmentPlan }).plan;
    assert.equal(approved.status, "approved");
    assert.equal(approved.approvedPlanHash, approved.planHash);
    assert.equal(approved.approvalRecord?.planHash, approved.planHash);

    await updateRuntimeDatabase((db) => {
      const row = db.environmentPlans?.find((candidate) => candidate.id === plan.id);
      const payload = row?.payload as EnvironmentPlan | undefined;
      if (payload) payload.items[0]!.actions[0]!.label = "storage tamper";
    });
    const refused = await app.inject({ method: "POST", url: `/api/plans/${encodeURIComponent(plan.id)}/apply`, headers: auth, payload: { dryRun: false } });
    assert.equal(refused.statusCode, 409);
    assert.match(refused.body, /integrity/i);
  } finally {
    await app.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("approvedPlanHash-only tamper is rejected before execution", async () => {
  const { app, tmpDir } = await bootApp();
  try {
    const { token, userId, connectionId } = await seedIdentity();
    const auth = { authorization: `Bearer ${token}` };
    const plan = await approvePlan(app, token, await createNoopPlan(userId, connectionId, "approved-hash-tamper"));
    assert.equal(plan.approvedPlanHash, plan.planHash);

    await updateRuntimeDatabase((db) => {
      const row = db.environmentPlans?.find((candidate) => candidate.id === plan.id);
      const payload = row?.payload as EnvironmentPlan | undefined;
      if (payload) payload.approvedPlanHash = "0".repeat(64);
    });
    const refused = await app.inject({
      method: "POST",
      url: `/api/plans/${encodeURIComponent(plan.id)}/apply`,
      headers: auth,
      payload: { dryRun: false }
    });
    assert.equal(refused.statusCode, 409, refused.body);
    assert.match(refused.body, /approvedPlanHash/i);
    const database = await readRuntimeDatabase();
    assert.equal((database.actionRuns ?? []).filter((run) => run.planId === plan.id && !run.dryRun).length, 0);
  } finally {
    await app.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("concurrent real apply requests cannot both execute the same approved Plan", async () => {
  const { app, tmpDir } = await bootApp();
  try {
    const { token, userId, connectionId } = await seedIdentity();
    const auth = { authorization: `Bearer ${token}` };
    const plan = await approvePlan(app, token, await createNoopPlan(userId, connectionId, "concurrent-different-keys"));

    const [first, second] = await Promise.all([
      app.inject({ method: "POST", url: `/api/plans/${encodeURIComponent(plan.id)}/apply`, headers: auth, payload: { dryRun: false, idempotencyKey: "concurrent-a" } }),
      app.inject({ method: "POST", url: `/api/plans/${encodeURIComponent(plan.id)}/apply`, headers: auth, payload: { dryRun: false, idempotencyKey: "concurrent-b" } })
    ]);
    const statusCodes = [first.statusCode, second.statusCode].sort();
    assert.deepEqual(statusCodes, [200, 409], `${first.statusCode}:${first.body}\n${second.statusCode}:${second.body}`);

    const database = await readRuntimeDatabase();
    const runs = (database.actionRuns ?? []).filter((run) => run.planId === plan.id && !run.dryRun);
    assert.equal(runs.length, 1, "Only the claimed request may emit ActionRunRecord evidence.");
    assert.equal((database.applyRuns ?? []).filter((run) => run.planId === plan.id).length, 1);
    const stored = database.environmentPlans?.find((row) => row.id === plan.id);
    assert.equal(stored?.status, "succeeded");
  } finally {
    await app.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("concurrent real apply without idempotencyKey is still single-claim", async () => {
  const { app, tmpDir } = await bootApp();
  try {
    const { token, userId, connectionId } = await seedIdentity();
    const auth = { authorization: `Bearer ${token}` };
    const plan = await approvePlan(app, token, await createNoopPlan(userId, connectionId, "concurrent-no-key"));

    const [first, second] = await Promise.all([
      app.inject({ method: "POST", url: `/api/plans/${encodeURIComponent(plan.id)}/apply`, headers: auth, payload: { dryRun: false } }),
      app.inject({ method: "POST", url: `/api/plans/${encodeURIComponent(plan.id)}/apply`, headers: auth, payload: { dryRun: false } })
    ]);
    const statusCodes = [first.statusCode, second.statusCode].sort();
    assert.deepEqual(statusCodes, [200, 409], `${first.statusCode}:${first.body}\n${second.statusCode}:${second.body}`);

    const database = await readRuntimeDatabase();
    assert.equal((database.actionRuns ?? []).filter((run) => run.planId === plan.id && !run.dryRun).length, 1);
    assert.equal((database.applyRuns ?? []).filter((run) => run.planId === plan.id).length, 1);
  } finally {
    await app.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("same idempotencyKey returns the same apply run without a second ActionRunRecord batch", async () => {
  const { app, tmpDir } = await bootApp();
  try {
    const { token, userId, connectionId } = await seedIdentity();
    const auth = { authorization: `Bearer ${token}` };
    const plan = await approvePlan(app, token, await createNoopPlan(userId, connectionId, "same-key"));

    const first = await app.inject({
      method: "POST",
      url: `/api/plans/${encodeURIComponent(plan.id)}/apply`,
      headers: auth,
      payload: { dryRun: false, idempotencyKey: "repeat-key" }
    });
    assert.equal(first.statusCode, 200, first.body);
    const firstBody = first.json() as { applyRunId?: string };
    assert.ok(firstBody.applyRunId);

    const second = await app.inject({
      method: "POST",
      url: `/api/plans/${encodeURIComponent(plan.id)}/apply`,
      headers: auth,
      payload: { dryRun: false, idempotencyKey: "repeat-key" }
    });
    assert.equal(second.statusCode, 200, second.body);
    const secondBody = second.json() as { applyRunId?: string; applyRun?: { id?: string } };
    assert.equal(secondBody.applyRunId ?? secondBody.applyRun?.id, firstBody.applyRunId);

    const differentKey = await app.inject({
      method: "POST",
      url: `/api/plans/${encodeURIComponent(plan.id)}/apply`,
      headers: auth,
      payload: { dryRun: false, idempotencyKey: "repeat-key-different" }
    });
    assert.equal(differentKey.statusCode, 409, differentKey.body);
    assert.match(differentKey.body, /already/i);

    const database = await readRuntimeDatabase();
    assert.equal((database.actionRuns ?? []).filter((run) => run.planId === plan.id && !run.dryRun).length, 1);
    assert.equal((database.applyRuns ?? []).filter((run) => run.planId === plan.id).length, 1);
    assert.equal((database.applyIdempotencyRecords ?? []).filter((record) => record.planId === plan.id && record.key === "repeat-key").length, 1);
  } finally {
    await app.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("same idempotencyKey concurrent real apply executes once", async () => {
  const { app, tmpDir } = await bootApp();
  try {
    const { token, userId, connectionId } = await seedIdentity();
    const auth = { authorization: `Bearer ${token}` };
    const plan = await approvePlan(app, token, await createNoopPlan(userId, connectionId, "same-key-concurrent"));

    const [first, second] = await Promise.all([
      app.inject({ method: "POST", url: `/api/plans/${encodeURIComponent(plan.id)}/apply`, headers: auth, payload: { dryRun: false, idempotencyKey: "same-concurrent-key" } }),
      app.inject({ method: "POST", url: `/api/plans/${encodeURIComponent(plan.id)}/apply`, headers: auth, payload: { dryRun: false, idempotencyKey: "same-concurrent-key" } })
    ]);
    assert.equal(first.statusCode, 200, first.body);
    assert.equal(second.statusCode, 200, second.body);

    const database = await readRuntimeDatabase();
    assert.equal((database.actionRuns ?? []).filter((run) => run.planId === plan.id && !run.dryRun).length, 1);
    assert.equal((database.applyRuns ?? []).filter((run) => run.planId === plan.id).length, 1);
    assert.equal((database.applyIdempotencyRecords ?? []).filter((record) => record.planId === plan.id && record.key === "same-concurrent-key").length, 1);
  } finally {
    await app.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("approved Plan schedules also use apply claim and cannot double execute concurrently", async () => {
  const { app, tmpDir } = await bootApp();
  try {
    const { token, userId, connectionId } = await seedIdentity();
    const plan = await approvePlan(app, token, await createNoopPlan(userId, connectionId, "scheduled-claim"));
    const now = new Date();
    const scheduleId = `schedule-claim-${Date.now()}`;
    await updateRuntimeDatabase((db) => {
      db.schedules = db.schedules ?? [];
      db.schedules.push({
        id: scheduleId,
        userId,
        name: "Scheduled approved Plan claim regression",
        planId: plan.id,
        approvedPlanHash: plan.planHash,
        connectionIds: [connectionId],
        tags: [],
        cron: "* * * * *",
        dryRun: false,
        enabled: true,
        nextRunAt: new Date(now.getTime() - 1_000).toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      });
    });

    await Promise.all([
      runApprovedPlanSchedulesOnceForTests(),
      runApprovedPlanSchedulesOnceForTests()
    ]);

    const database = await readRuntimeDatabase();
    assert.equal((database.applyRuns ?? []).filter((run) => run.planId === plan.id).length, 1);
    assert.equal((database.applyIdempotencyRecords ?? []).filter((record) => record.planId === plan.id && record.key.startsWith(`schedule:${scheduleId}:`)).length, 1);
    assert.equal((database.actionRuns ?? []).filter((run) => run.planId === plan.id && !run.dryRun).length, 1);
    const stored = database.environmentPlans?.find((row) => row.id === plan.id);
    assert.equal(stored?.status, "succeeded");
  } finally {
    await app.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("same dry-run idempotencyKey reuses the prior dry-run result without a second ActionRunRecord", async () => {
  const { app, tmpDir } = await bootApp();
  try {
    const { token, userId, connectionId } = await seedIdentity();
    const auth = { authorization: `Bearer ${token}` };
    const plan = await createNoopPlan(userId, connectionId, "dry-run-same-key");

    const first = await app.inject({
      method: "POST",
      url: `/api/plans/${encodeURIComponent(plan.id)}/apply`,
      headers: auth,
      payload: { dryRun: true, idempotencyKey: "dry-run-repeat-key" }
    });
    assert.equal(first.statusCode, 200, first.body);
    const firstBody = first.json() as { execution: { actionRuns: Array<{ id: string }> } };
    assert.equal(firstBody.execution.actionRuns.length, 1);

    const second = await app.inject({
      method: "POST",
      url: `/api/plans/${encodeURIComponent(plan.id)}/apply`,
      headers: auth,
      payload: { dryRun: true, idempotencyKey: "dry-run-repeat-key" }
    });
    assert.equal(second.statusCode, 200, second.body);
    const secondBody = second.json() as { execution: { actionRuns: Array<{ id: string }> } };
    assert.equal(secondBody.execution.actionRuns[0]?.id, firstBody.execution.actionRuns[0]?.id);

    const database = await readRuntimeDatabase();
    assert.equal((database.actionRuns ?? []).filter((run) => run.planId === plan.id && run.dryRun).length, 1);
    assert.equal((database.environmentPlans ?? []).find((row) => row.id === plan.id)?.lastDryRunResult?.idempotencyKey, "dry-run-repeat-key");
  } finally {
    await app.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("Apply verifies frozen artifact bytes before even a dry-run", async () => {
  const { app, tmpDir } = await bootApp();
  try {
    const { token, connectionId } = await seedIdentity();
    const auth = { authorization: `Bearer ${token}` };
    const plan = await createRecipePlan(app, token, connectionId);
    const artifact = plan.artifacts?.[0];
    assert.ok(artifact);
    await fs.writeFile(path.join(process.env.ENVFORGE_ARTIFACT_DIR!, artifact.storageRef), "name: attacker-controlled\n");
    const refused = await app.inject({
      method: "POST", url: `/api/plans/${encodeURIComponent(plan.id)}/apply`, headers: auth, payload: { dryRun: true }
    });
    assert.equal(refused.statusCode, 409);
    assert.match(refused.body, /hash mismatch/i);
  } finally {
    await app.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("legacy target mutation endpoints are gone even when legacy flags are enabled", async () => {
  const { app, tmpDir } = await bootApp();
  try {
    process.env.ENVFORGE_ENABLE_LEGACY_EXECUTE = "true";
    const { token, connectionId } = await seedIdentity();
    const headers = { authorization: `Bearer ${token}` };
    const routes = [
      { method: "POST", url: "/api/execute", payload: { connectionId, profileId: "nginx", dryRun: false } },
      { method: "POST", url: "/api/batch-execute", payload: { connectionId, catalogIds: ["nginx"], dryRun: false } },
      { method: "POST", url: "/api/multi-execute", payload: { yaml: "steps: []", connectionIds: [connectionId], dryRun: false } },
      { method: "POST", url: "/api/rebuild-plan/apply", payload: { connectionId, plan: {}, acknowledged: true, dryRun: false } },
      { method: "POST", url: `/api/connections/${connectionId}/apply-remove-plan`, payload: { acknowledged: true, dryRun: false } },
      { method: "POST", url: `/api/connections/${connectionId}/configs/apply-change-plan`, payload: { path: "/etc/x", content: "x", acknowledged: true } },
      { method: "POST", url: `/api/connections/${connectionId}/configs/write`, payload: { path: "/etc/x", content: "x" } },
      { method: "POST", url: `/api/connections/${connectionId}/configs/rollback`, payload: { path: "/etc/x" } },
      { method: "POST", url: `/api/connections/${connectionId}/uninstall`, payload: { packages: ["nginx"] } },
      { method: "POST", url: "/api/profiles/fake-profile/deploy-stage", payload: { stageId: "install" } },
      { method: "POST", url: "/api/migration/sessions/fake-session/apply", payload: {} },
      { method: "POST", url: `/api/connections/${connectionId}/migration-plan/apply`, payload: {} },
      { method: "PATCH", url: "/api/schedules/fake-schedule", payload: { dryRun: false, enabled: true } }
    ] as const;
    for (const route of routes) {
      const response = await app.inject({ method: route.method, url: route.url, headers, payload: route.payload });
      assert.equal(response.statusCode, 410, `${route.method} ${route.url}: ${response.body}`);
      assert.match(response.body, /Environment Plan/i);
    }
    const schedule = await app.inject({ method: "POST", url: "/api/schedules", headers, payload: { name: "unsafe", cron: "* * * * *", playbookId: "raw", dryRun: false } });
    assert.equal(schedule.statusCode, 410);
  } finally {
    delete process.env.ENVFORGE_ENABLE_LEGACY_EXECUTE;
    await app.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
