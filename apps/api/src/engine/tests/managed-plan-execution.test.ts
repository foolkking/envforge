import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { executeEnvironmentPlan } from "../managed-execution.js";
import { freezeEnvironmentPlan } from "../../plan-hash.js";
import { approveEnvironmentPlan, asEnvironmentPlan, createEnvironmentPlan } from "../../plan-store.js";
import { _resetStoreForTests, readRuntimeDatabase, type StoredConnection } from "../../runtime-store.js";
import { buildConfigChangePlan, type EnvironmentPlan } from "../../environment-plan.js";
import { prepareEnvironmentPlanForCreation } from "../../plan-lifecycle.js";
import type { ManagedExecutionAdapter } from "../../managed-execution.js";

let tmpDir = "";
let sequence = 0;
const userId = "managed-plan-user";
const connection = {
  id: "managed-target", userId, method: "ssh-key", label: "managed target", tags: [], status: "validated",
  fields: { host: "127.0.0.1", port: "22", username: "root" }, maskedSecrets: [], realConnection: false,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
} as StoredConnection;

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "envforge-managed-plan-"));
  process.env.FOOL_RUNTIME_DB = path.join(tmpDir, "runtime.json");
  process.env.FOOL_DATA_DIR = tmpDir;
  process.env.ENVFORGE_ARTIFACT_DIR = path.join(tmpDir, "artifacts");
  await fs.writeFile(process.env.FOOL_RUNTIME_DB, JSON.stringify({
    schemaVersion: "0.3.0", users: [], sessions: [], connections: [connection], userProfiles: [], tasks: [], playbooks: []
  }));
  _resetStoreForTests();
});

after(async () => fs.rm(tmpDir, { recursive: true, force: true }));

function plan(): EnvironmentPlan {
  return freezeEnvironmentPlan({
    id: `managed-plan-${++sequence}-${randomUUID().slice(0, 8)}`,
    type: "repair",
    status: "needs-review",
    name: "Managed execution test",
    targetConnectionId: connection.id,
    generatedAt: new Date().toISOString(),
    summary: { totalItems: 1, totalActions: 1, highRisk: 1, requiresSudo: 0, rollbackable: 0 },
    review: { required: true, reasons: ["test"] },
    artifacts: [],
    items: [{
      id: "repair-item", name: "Repair item", type: "repair", risks: ["command"], evidence: ["test"], userDecision: "approved",
      actions: [{
        id: "run-repair", kind: "runCommand", label: "Run repair", command: "echo managed",
        requiresSudo: false, changesTarget: true, canRollback: false, risk: "high"
      }]
    }]
  });
}

async function persistAndApprove(frozen: EnvironmentPlan): Promise<EnvironmentPlan> {
  await createEnvironmentPlan(frozen, userId);
  const approved = await approveEnvironmentPlan(frozen.id, userId, {
    planHash: frozen.planHash!,
    approvedBy: userId,
    approvedAt: new Date().toISOString(),
    acceptedRisks: frozen.items.flatMap((item) => (item.audit?.remainingRisks ?? []).map((risk) => `${item.id}::${risk}`)),
    acceptedConflicts: (frozen.review.conflicts ?? []).filter((conflict) => conflict.severity === "warn").map((conflict) => `${conflict.id}::${conflict.resolutionOptions[0]?.id ?? ""}`),
    confirmedGates: (frozen.review.approvalsRequired ?? []).map((gate) => `${gate.itemId}::${gate.id}`)
  });
  assert.ok(approved);
  return asEnvironmentPlan(approved);
}

function adapter(applyOk = true): ManagedExecutionAdapter {
  return {
    snapshot: async () => ({ kind: "generic", capturedAt: new Date().toISOString(), notes: ["captured"] }),
    apply: async () => ({ ok: applyOk, message: applyOk ? "applied" : "failed", steps: [] }),
    verify: async () => ({ ok: true, message: "verified", checks: [] }),
    rollback: async () => ({ ok: false, message: "not supported", steps: [] })
  };
}

test("managed Plan execution persists hash-bound ActionRunRecord evidence", async () => {
  const frozen = plan();
  const approved = await persistAndApprove(frozen);
  const result = await executeEnvironmentPlan({
    userId, plan: approved, planHash: approved.planHash!, connection, dryRun: false,
    openClient: async () => { throw new Error("mock adapter must not open SSH"); },
    adapterFactory: () => adapter(true)
  });
  assert.equal(result.ok, true);
  assert.equal(result.actionRuns.length, 1);
  const run = result.actionRuns[0]!;
  assert.equal(run.planId, frozen.id);
  assert.equal(run.planHash, frozen.planHash);
  assert.equal(run.actionId, "run-repair");
  assert.equal(run.targetConnectionId, connection.id);
  assert.equal(run.dryRun, false);
  assert.equal(run.status, "succeeded");
  assert.ok(run.commandSummaries.some((entry) => entry.command === "echo managed"));
  assert.ok((await readRuntimeDatabase()).actionRuns?.some((entry) => entry.id === run.id));
});

test("managed Plan execution records action failure", async () => {
  const draft = plan();
  draft.items[0]!.actions.push({
    id: "verify-after-repair", kind: "validate", label: "Verify after repair", command: "true",
    requiresSudo: false, changesTarget: false, canRollback: false, risk: "low"
  });
  draft.summary.totalActions = 2;
  const frozen = freezeEnvironmentPlan(draft);
  const approved = await persistAndApprove(frozen);
  const result = await executeEnvironmentPlan({
    userId, plan: approved, planHash: approved.planHash!, connection, dryRun: false,
    openClient: async () => { throw new Error("mock adapter must not open SSH"); },
    adapterFactory: () => adapter(false)
  });
  assert.equal(result.ok, false);
  assert.equal(result.actionRuns[0]?.status, "failed");
  assert.equal(result.actionRuns[0]?.exitCode, 1);
  assert.equal(result.actionRuns.length, 2, "every frozen action receives an ActionRunRecord");
  assert.equal(result.actionRuns[1]?.status, "skipped");
  assert.match(result.actionRuns[1]?.applyResult?.message ?? "", /prior action/);
});

test("managed Plan dry-run records dryRun=true without invoking adapters", async () => {
  const frozen = plan();
  await createEnvironmentPlan(frozen, userId);
  let invoked = false;
  const result = await executeEnvironmentPlan({
    userId, plan: frozen, planHash: frozen.planHash!, connection, dryRun: true,
    openClient: async () => { throw new Error("dry-run must not open SSH"); },
    adapterFactory: () => {
      const mock = adapter(true);
      return { ...mock, apply: async () => { invoked = true; return mock.apply({} as never); } };
    }
  });
  assert.equal(invoked, false);
  assert.equal(result.actionRuns[0]?.dryRun, true);
  assert.equal(result.actionRuns[0]?.status, "skipped");
});

test("managed config apply obtains candidate bytes only from the frozen artifact", async () => {
  const draft = buildConfigChangePlan({
    targetConnectionId: connection.id,
    path: "/etc/example.conf",
    originalContent: "mode=old\n",
    candidateContent: "mode=new\n",
    validationCommand: "example --check"
  });
  draft.id = `managed-config-${++sequence}`;
  const prepared = await prepareEnvironmentPlanForCreation(draft, { configContent: "mode=new\n" });
  const frozen = prepared;
  const approved = await persistAndApprove(frozen);
  let observedContent: string | undefined;
  const result = await executeEnvironmentPlan({
    userId, plan: approved, planHash: approved.planHash!, connection, dryRun: false,
    openClient: async () => { throw new Error("mock adapter must not open SSH"); },
    adapterFactory: ({ action, artifactContent }) => {
      if (action.kind === "writeConfig") observedContent = artifactContent?.toString("utf8");
      return adapter(true);
    }
  });
  assert.equal(result.ok, true);
  assert.equal(observedContent, "mode=new\n");
  assert.equal(result.actionRuns.length, frozen.items.flatMap((item) => item.actions).length);
});
