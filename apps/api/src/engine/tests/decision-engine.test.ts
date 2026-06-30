import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  BALANCED_DECISION_PROFILE,
  CONSERVATIVE_DECISION_PROFILE,
  assignDecisionProfile,
  classifyDecision,
  evaluateAndRecordDecision,
  findBestDecisionPreference,
  listDecisionAudit,
  listDecisionHistory,
  listDecisionPreferences,
  listReviewInbox,
  resolveDecisionProfile,
  resolveDecisionReview,
  upsertDecisionPreference,
  type DecisionScores,
  type UserDecisionPreference
} from "../../decision-engine/index.js";
import { _resetStoreForTests } from "../../runtime-store.js";

let tempDirectory = "";

before(async () => {
  tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "envforge-decision-engine-"));
  process.env.FOOL_RUNTIME_DB = path.join(tempDirectory, "runtime.json");
  await fs.writeFile(process.env.FOOL_RUNTIME_DB, JSON.stringify({
    schemaVersion: "0.3.0", users: [], sessions: [], connections: [], userProfiles: [], tasks: [], playbooks: []
  }));
  _resetStoreForTests();
});

after(async () => {
  _resetStoreForTests();
  await fs.rm(tempDirectory, { recursive: true, force: true });
});

function scores(overrides: Partial<DecisionScores> = {}): DecisionScores {
  return {
    intentConfidence: 0.85,
    evidenceStrength: 0.85,
    migrationReadiness: 0.8,
    riskScore: 0.2,
    automationConfidence: 0.8,
    businessCriticality: 0.5,
    reviewCost: 0.2,
    userPreferenceConfidence: 0.5,
    collectorCompleteness: 0.9,
    ...overrides
  };
}

test("decision engine auto-stages only strong, low-risk evidence", () => {
  assert.equal(classifyDecision(scores()), "auto-staged");
});

test("decision engine blocks incomplete high-risk collector evidence", () => {
  assert.equal(classifyDecision(scores({ collectorCompleteness: 0.5, riskScore: 0.8 })), "blocker");
});

test("decision engine requires explicit data and secret policy decisions", () => {
  assert.equal(classifyDecision(scores(), { touchesDatabase: true, dataStrategyConfirmed: false }), "required-decision");
  assert.equal(classifyDecision(scores(), { touchesSecret: true, secretPolicyConfirmed: false }), "required-decision");
});

test("decision engine records weak low-value evidence without staging it", () => {
  assert.equal(classifyDecision(scores({ intentConfidence: 0.2, businessCriticality: 0.2 })), "record-only");
});

test("remembered preferences never bypass secret/data requirements or blockers", () => {
  const advisoryPreference = { preferredOutcome: "record-only" as const };
  assert.equal(classifyDecision(scores(), { ...advisoryPreference, touchesSecret: true, secretPolicyConfirmed: false }), "required-decision");
  assert.equal(classifyDecision(scores(), { ...advisoryPreference, touchesDatabase: true, dataStrategyConfirmed: false }), "required-decision");
  assert.equal(classifyDecision(scores(), { ...advisoryPreference, hasBlockers: true }), "blocker");
});

test("risk profiles deterministically control auto-staging thresholds", () => {
  const borderline = scores({
    evidenceStrength: 0.82,
    migrationReadiness: 0.75,
    automationConfidence: 0.75,
    riskScore: 0.35
  });
  assert.equal(classifyDecision(borderline, {}, BALANCED_DECISION_PROFILE), "auto-staged");
  assert.equal(classifyDecision(borderline, {}, CONSERVATIVE_DECISION_PROFILE), "suggested-decision");
});

test("preference memory is persisted and most-specific scope wins", async () => {
  await upsertDecisionPreference({
    userId: "decision-user",
    scope: "global",
    pattern: "*",
    preferredOutcome: "suggested-decision",
    confidence: 0.7
  });
  const connectionPreference = await upsertDecisionPreference({
    userId: "decision-user",
    scope: "connection",
    scopeId: "connection-1",
    pattern: "nginx*",
    preferredOutcome: "required-decision",
    confidence: 0.8
  });
  const preferences = await listDecisionPreferences("decision-user");
  assert.equal(preferences.length, 2);
  assert.equal(findBestDecisionPreference(preferences, {
    userId: "decision-user",
    connectionId: "connection-1",
    candidateName: "nginx service"
  })?.id, connectionPreference.id);

  _resetStoreForTests();
  assert.equal((await listDecisionPreferences("decision-user")).length, 2, "preferences must survive a store restart");
});

test("evaluation creates review/history/audit and resolution can remember the user's choice", async () => {
  const evaluated = await evaluateAndRecordDecision({
    userId: "review-user",
    subjectId: "candidate-1",
    subjectType: "migration-candidate",
    title: "Custom agent",
    reason: "No catalog rule matched.",
    scores: scores({ intentConfidence: 0.6, evidenceStrength: 0.6, automationConfidence: 0.4 }),
    requiredGates: ["partial-snapshot-confirm"],
    context: { connectionId: "connection-2", candidateId: "candidate-1", candidateName: "Custom agent" }
  });
  assert.equal(evaluated.outcome, "suggested-decision");
  assert.equal(evaluated.inboxItem?.status, "open");
  assert.deepEqual(evaluated.inboxItem?.requiredGates, ["partial-snapshot-confirm"]);

  const resolved = await resolveDecisionReview({
    userId: "review-user",
    actorId: "review-user",
    itemId: evaluated.inboxItem!.id,
    status: "accepted",
    note: "Keep similar local agents as records.",
    remember: {
      scope: "connection",
      scopeId: "connection-2",
      pattern: "custom agent",
      preferredOutcome: "record-only",
      confidence: 0.9
    }
  });
  assert.equal(resolved?.item.status, "accepted");
  assert.equal(resolved?.preference?.preferredOutcome, "record-only");

  const reevaluated = await evaluateAndRecordDecision({
    userId: "review-user",
    subjectId: "candidate-1",
    subjectType: "migration-candidate",
    title: "Custom agent",
    scores: scores({ intentConfidence: 0.6, evidenceStrength: 0.6, automationConfidence: 0.4, businessCriticality: 0.2 }),
    context: { connectionId: "connection-2", candidateId: "candidate-1", candidateName: "Custom agent" }
  });
  assert.equal(reevaluated.outcome, "record-only");
  assert.equal(reevaluated.preference?.id, resolved?.preference?.id);
  assert.equal((await listReviewInbox({ userId: "review-user", status: "open" })).length, 0);
  assert.equal((await listDecisionHistory({ userId: "review-user", subjectId: "candidate-1" })).length, 2);
  assert.deepEqual(
    new Set((await listDecisionAudit({ userId: "review-user" })).map((entry) => entry.event)),
    new Set(["decision-evaluated", "review-resolved", "preference-upserted"])
  );
});

test("identical candidate ids remain isolated across source connections", async () => {
  const base = {
    userId: "multi-source-user",
    subjectId: "candidate-shared",
    subjectType: "migration-candidate" as const,
    title: "Shared candidate",
    scores: scores({ intentConfidence: 0.6, evidenceStrength: 0.6, automationConfidence: 0.4 })
  };
  await evaluateAndRecordDecision({
    ...base,
    snapshotId: "source-a:2026-06-30T00:00:00.000Z",
    context: { connectionId: "source-a", candidateId: base.subjectId }
  });
  await evaluateAndRecordDecision({
    ...base,
    snapshotId: "source-b:2026-06-30T00:00:00.000Z",
    context: { connectionId: "source-b", candidateId: base.subjectId }
  });

  const history = await listDecisionHistory({ userId: base.userId, subjectId: base.subjectId });
  const inbox = await listReviewInbox({ userId: base.userId, status: "open" });
  assert.equal(history.length, 2);
  assert.equal(new Set(history.map((record) => record.dedupeKey)).size, 2);
  assert.equal(inbox.length, 2);
  assert.deepEqual(new Set(inbox.map((item) => item.snapshotId)), new Set([
    "source-a:2026-06-30T00:00:00.000Z",
    "source-b:2026-06-30T00:00:00.000Z"
  ]));
});

test("profile assignment is scoped and persists through the runtime store", async () => {
  await assignDecisionProfile({ userId: "profile-user", profileId: "balanced", scope: "global" });
  await assignDecisionProfile({
    userId: "profile-user", profileId: "conservative", scope: "connection", scopeId: "production"
  });
  assert.equal((await resolveDecisionProfile({ userId: "profile-user", connectionId: "development" })).profile.id, "balanced");
  assert.equal((await resolveDecisionProfile({ userId: "profile-user", connectionId: "production" })).profile.id, "conservative");
});
