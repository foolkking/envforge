import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  approveEnvironmentPlan,
  claimPlanForApply,
  createEnvironmentPlan,
  finalizeApplyClaim,
  getApplyRunResponse,
  getEnvironmentPlan,
  mutateEnvironmentPlan,
  PlanAlreadyExistsError,
  PlanIntegrityError
} from "../../plan-store.js";
import { _resetStoreForTests, updateRuntimeDatabase } from "../../runtime-store.js";
import { buildConfigChangePlan, buildImportedRecipePlan, type EnvironmentPlan } from "../../environment-plan.js";
import { prepareEnvironmentPlanForCreation } from "../../plan-lifecycle.js";
import { computeEnvironmentPlanHash, freezeEnvironmentPlan } from "../../plan-hash.js";
import { getPlanArtifact } from "../../artifact-store.js";

let tmpDir = "";
const userId = "plan-security-user";
let planSequence = 0;

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "envforge-plan-security-"));
  process.env.FOOL_RUNTIME_DB = path.join(tmpDir, "runtime.json");
  process.env.FOOL_DATA_DIR = tmpDir;
  process.env.ENVFORGE_ARTIFACT_DIR = path.join(tmpDir, "artifacts");
  await fs.writeFile(process.env.FOOL_RUNTIME_DB, JSON.stringify({
    schemaVersion: "0.3.0", users: [], sessions: [], connections: [], userProfiles: [], tasks: [], playbooks: []
  }));
  _resetStoreForTests();
});

after(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function recipeDraft(): EnvironmentPlan {
  const plan = buildImportedRecipePlan({
    targetConnectionId: "target-1",
    name: "Frozen recipe",
    yaml: "name: frozen\nsteps:\n  - run: echo safe\n"
  });
  plan.id = `security-plan-${++planSequence}`;
  return plan;
}

async function createApprovedPlan(): Promise<EnvironmentPlan> {
  const draft = recipeDraft();
  const plan = await prepareEnvironmentPlanForCreation(draft, { recipeYaml: draft.export?.yaml });
  await createEnvironmentPlan(plan, userId);
  const confirmedGates = (plan.review.approvalsRequired ?? []).map((gate) => `${gate.itemId}::${gate.id}`);
  const approved = await approveEnvironmentPlan(plan.id, userId, {
    planHash: plan.planHash!,
    approvedAt: new Date().toISOString(),
    approvedBy: userId,
    acceptedRisks: [],
    acceptedConflicts: [],
    confirmedGates
  });
  return approved?.payload as EnvironmentPlan;
}

test("canonical planHash is stable, ignores runtime fields, and changes with immutable content", () => {
  const frozen = freezeEnvironmentPlan({ ...recipeDraft(), artifacts: [] });
  const sameHash = computeEnvironmentPlanHash({
    ...frozen,
    status: "succeeded",
    approvedAt: "2030-01-01T00:00:00.000Z",
    approvedBy: "another-user",
    approvedPlanHash: "runtime-only"
  });
  assert.equal(sameHash, frozen.planHash);

  const changed = structuredClone(frozen);
  changed.items[0]!.actions[0]!.label = "Changed frozen action";
  assert.notEqual(computeEnvironmentPlanHash(changed), frozen.planHash);
});

test("Plan store is create-only and approval is bound to the frozen hash", async () => {
  const plan = await prepareEnvironmentPlanForCreation(recipeDraft(), { recipeYaml: recipeDraft().export?.yaml });
  await createEnvironmentPlan(plan, userId);
  await assert.rejects(() => createEnvironmentPlan(plan, userId), PlanAlreadyExistsError);

  const approvedAt = new Date().toISOString();
  const confirmedGates = (plan.review.approvalsRequired ?? []).map((gate) => `${gate.itemId}::${gate.id}`);
  const approved = await approveEnvironmentPlan(plan.id, userId, {
    planHash: plan.planHash!, approvedAt, approvedBy: userId,
    acceptedRisks: [], acceptedConflicts: [], confirmedGates
  });
  assert.equal((approved?.payload as EnvironmentPlan).approvedPlanHash, plan.planHash);
  assert.equal(approved?.approvalRecord?.planHash, plan.planHash);

  await assert.rejects(() => approveEnvironmentPlan(plan.id, userId, {
    planHash: "0".repeat(64), approvedAt, approvedBy: userId,
    acceptedRisks: [], acceptedConflicts: [], confirmedGates: []
  }), PlanIntegrityError);
});

test("frozen Plan actions, export, and artifact metadata cannot be overwritten", async () => {
  const plan = await prepareEnvironmentPlanForCreation(recipeDraft(), { recipeYaml: recipeDraft().export?.yaml });
  await createEnvironmentPlan(plan, userId);

  for (const mutate of [
    (candidate: EnvironmentPlan) => { candidate.items[0]!.actions[0]!.label = "tampered"; },
    (candidate: EnvironmentPlan) => { candidate.export!.yaml += "\n# tampered"; },
    (candidate: EnvironmentPlan) => { candidate.artifacts![0]!.contentSha256 = "f".repeat(64); }
  ]) {
    await assert.rejects(() => mutateEnvironmentPlan(plan.id, userId, (record) => {
      mutate(record.payload as EnvironmentPlan);
      return record;
    }), PlanIntegrityError);
  }
});

test("approved Plan risks and conflicts cannot be overwritten", async () => {
  const approved = await createApprovedPlan();

  await assert.rejects(() => mutateEnvironmentPlan(approved.id, userId, (record) => {
    const candidate = record.payload as EnvironmentPlan;
    candidate.items[0]!.risks.push("tampered risk after approval");
    return record;
  }), PlanIntegrityError);

  await assert.rejects(() => mutateEnvironmentPlan(approved.id, userId, (record) => {
    const candidate = record.payload as EnvironmentPlan;
    candidate.review.conflicts = [
      ...(candidate.review.conflicts ?? []),
      {
        id: "tampered-conflict",
        type: "test",
        severity: "warn",
        reason: "tampered after approval",
        capabilityKeys: ["a", "b"],
        participatingItemIds: [candidate.items[0]!.id],
        resolutionOptions: [{ id: "ack", label: "Acknowledge" }]
      }
    ];
    return record;
  }), PlanIntegrityError);
});

test("claimPlanForApply atomically claims once and rejects non-idempotent re-entry", async () => {
  const approved = await createApprovedPlan();
  const first = await claimPlanForApply({
    planId: approved.id,
    userId,
    expectedPlanHash: approved.planHash!,
    approvedPlanHash: approved.approvedPlanHash!,
    idempotencyKey: "claim-running"
  });
  assert.equal(first.status, "claimed");

  const duplicate = await claimPlanForApply({
    planId: approved.id,
    userId,
    expectedPlanHash: approved.planHash!,
    approvedPlanHash: approved.approvedPlanHash!,
    idempotencyKey: "claim-running"
  });
  assert.equal(duplicate.status, "duplicate");
  assert.equal(duplicate.existingRunId, first.claimId);
  const runningResponse = await getApplyRunResponse(first.claimId, userId) as { applyRun?: { status?: string } };
  assert.equal(runningResponse.applyRun?.status, "running");

  const differentKey = await claimPlanForApply({
    planId: approved.id,
    userId,
    expectedPlanHash: approved.planHash!,
    approvedPlanHash: approved.approvedPlanHash!,
    idempotencyKey: "claim-other"
  });
  assert.equal(differentKey.status, "already-running");
  assert.equal(differentKey.existingRunId, first.claimId);

  await finalizeApplyClaim({
    claimId: first.claimId,
    userId,
    ok: false,
    error: "intentional failure",
    responseSnapshot: { ok: false, error: "intentional failure", applyRunId: first.claimId }
  });
  const failedStored = await getEnvironmentPlan(approved.id, userId);
  assert.equal(failedStored?.status, "failed");

  const failedDuplicate = await claimPlanForApply({
    planId: approved.id,
    userId,
    expectedPlanHash: approved.planHash!,
    approvedPlanHash: approved.approvedPlanHash!,
    idempotencyKey: "claim-running"
  });
  assert.equal(failedDuplicate.status, "duplicate");
  const failedResponse = await getApplyRunResponse(first.claimId, userId) as { ok?: boolean; error?: string };
  assert.equal(failedResponse.ok, false);
  assert.equal(failedResponse.error, "intentional failure");

  await assert.rejects(() => claimPlanForApply({
    planId: approved.id,
    userId,
    expectedPlanHash: approved.planHash!,
    approvedPlanHash: approved.approvedPlanHash!,
    idempotencyKey: "claim-after-failure"
  }), PlanIntegrityError);
});

test("idempotency key cannot be reused for the same Plan after planHash changes", async () => {
  const approved = await createApprovedPlan();
  const first = await claimPlanForApply({
    planId: approved.id,
    userId,
    expectedPlanHash: approved.planHash!,
    approvedPlanHash: approved.approvedPlanHash!,
    idempotencyKey: "hash-bound-key"
  });
  assert.equal(first.status, "claimed");

  const tampered = structuredClone(approved);
  tampered.items[0]!.actions[0]!.label = "tampered action after idempotency claim";
  const newHash = computeEnvironmentPlanHash(tampered);
  tampered.planHash = newHash;
  tampered.approvedPlanHash = newHash;
  tampered.approvalRecord = { ...tampered.approvalRecord!, planHash: newHash };

  await updateRuntimeDatabase((db) => {
    const row = db.environmentPlans?.find((candidate) => candidate.id === approved.id && candidate.userId === userId);
    assert.ok(row);
    row.status = "approved";
    row.payload = tampered;
    row.approvalRecord = tampered.approvalRecord;
  });

  await assert.rejects(() => claimPlanForApply({
    planId: approved.id,
    userId,
    expectedPlanHash: newHash,
    approvedPlanHash: newHash,
    idempotencyKey: "hash-bound-key"
  }), PlanIntegrityError);
});

test("config change content and path are frozen into a verified artifact/action pair", async () => {
  const draft = buildConfigChangePlan({
    targetConnectionId: "target-1",
    path: "/etc/example.conf",
    originalContent: "mode=old\n",
    candidateContent: "mode=new\n",
    validationCommand: "example --check"
  });
  const plan = await prepareEnvironmentPlanForCreation(draft, { configContent: "mode=new\n" });
  const artifact = plan.artifacts?.find((entry) => entry.kind === "config");
  const write = plan.items.flatMap((item) => item.actions).find((action) => action.kind === "writeConfig");
  assert.ok(artifact?.contentSha256);
  assert.equal(write?.applySpec?.path, "/etc/example.conf");
  assert.equal(write?.applySpec?.artifactId, artifact?.id);
  assert.equal((await getPlanArtifact(plan.id, artifact!)).toString("utf8"), "mode=new\n");

  const storedPath = path.join(process.env.ENVFORGE_ARTIFACT_DIR!, artifact!.storageRef);
  await fs.writeFile(storedPath, "mode=attacker\n");
  await assert.rejects(() => getPlanArtifact(plan.id, artifact!), /hash mismatch/i);
});

test("stored Plan remains retrievable without replacing its immutable payload", async () => {
  const plan = await prepareEnvironmentPlanForCreation(recipeDraft(), { recipeYaml: recipeDraft().export?.yaml });
  await createEnvironmentPlan(plan, userId);
  const stored = await getEnvironmentPlan(plan.id, userId);
  assert.equal((stored?.payload as EnvironmentPlan).planHash, plan.planHash);
});
