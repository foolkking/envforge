import { createId, updateRuntimeDatabase } from "../runtime-store.js";
import type { DecisionAuditRecord } from "./audit.js";
import { classifyDecision, type DecisionFacts, type DecisionOutcome } from "./classify.js";
import type { DecisionHistoryRecord } from "./history.js";
import { findBestDecisionProfileAssignment, getDecisionProfile, type DecisionProfile } from "./profiles.js";
import { requiresReviewInbox, type ReviewInboxItem } from "./review-inbox.js";
import { clampDecisionScore, type DecisionScores } from "./score.js";
import {
  findBestDecisionPreference,
  rememberedPreferenceConfidence,
  type DecisionPreferenceContext,
  type DecisionPreferenceScope,
  type UserDecisionPreference
} from "./user-preferences.js";

export interface DecisionEvaluationInput {
  userId: string;
  actorId?: string;
  subjectId: string;
  subjectType: DecisionHistoryRecord["subjectType"];
  title: string;
  reason?: string;
  scores: DecisionScores;
  facts?: DecisionFacts;
  requiredGates?: string[];
  planId?: string;
  snapshotId?: string;
  targetId?: string;
  context?: Omit<DecisionPreferenceContext, "userId" | "candidateId" | "candidateName"> & {
    candidateId?: string;
    candidateName?: string;
  };
}

export interface DecisionEvaluationResult {
  outcome: DecisionOutcome;
  scores: DecisionScores;
  reasons: string[];
  profile: DecisionProfile;
  preference?: UserDecisionPreference;
  history: DecisionHistoryRecord;
  inboxItem?: ReviewInboxItem;
}

/**
 * Evaluates and persists one decision as a single runtime-store transaction.
 * It is advisory only and never calls an executor or mutates an Environment
 * Plan, so the P0 Apply security boundary remains untouched.
 */
export async function evaluateAndRecordDecision(input: DecisionEvaluationInput): Promise<DecisionEvaluationResult> {
  return updateRuntimeDatabase((database) => {
    const now = new Date().toISOString();
    const context: DecisionPreferenceContext = {
      userId: input.userId,
      candidateId: input.context?.candidateId ?? input.subjectId,
      candidateName: input.context?.candidateName ?? input.title,
      connectionId: input.context?.connectionId,
      projectId: input.context?.projectId,
      serviceId: input.context?.serviceId,
      capabilityId: input.context?.capabilityId
    };
    const preference = findBestDecisionPreference(database.decisionUserPreferences ?? [], context);
    const assignment = findBestDecisionProfileAssignment(database.decisionProfileAssignments ?? [], context);
    const profile = getDecisionProfile(assignment?.profileId);
    const scores: DecisionScores = {
      ...input.scores,
      userPreferenceConfidence: rememberedPreferenceConfidence(preference)
    };
    const facts: DecisionFacts = { ...input.facts, preferredOutcome: preference?.preferredOutcome };
    const outcome = classifyDecision(scores, facts, profile);
    const reasons = decisionReasons(outcome, scores, facts, preference, profile, input.reason);
    const requiredGates = [...new Set(input.requiredGates ?? [])];
    const dedupeKey = decisionDedupeKey(input);
    const existing = (database.decisionReviewInbox ?? []).find((item) => item.userId === input.userId && item.dedupeKey === dedupeKey);
    const previous = [...(database.decisionHistory ?? [])].reverse().find((record) =>
      record.userId === input.userId
      && record.dedupeKey === dedupeKey
      && record.subjectId === input.subjectId
      && record.subjectType === input.subjectType
    );
    if (previous
      && previous.outcome === outcome
      && previous.profileId === profile.id
      && previous.preferenceId === preference?.id
      && JSON.stringify(previous.scores) === JSON.stringify(scores)
      && JSON.stringify(previous.requiredGates) === JSON.stringify(requiredGates)
      && JSON.stringify(previous.reasons) === JSON.stringify(reasons)) {
      return {
        outcome, scores, reasons, profile, preference, history: previous,
        inboxItem: existing?.status === "open" ? existing : undefined
      };
    }

    if (!database.decisionHistory) database.decisionHistory = [];
    const history: DecisionHistoryRecord = {
      id: createId("dhist"),
      userId: input.userId,
      dedupeKey,
      subjectId: input.subjectId,
      subjectType: input.subjectType,
      outcome,
      scores: structuredClone(scores),
      reasons,
      requiredGates,
      preferenceId: preference?.id,
      profileId: profile.id,
      createdAt: now
    };
    database.decisionHistory.push(history);
    if (database.decisionHistory.length > 5000) database.decisionHistory.splice(0, database.decisionHistory.length - 5000);

    let inboxItem: ReviewInboxItem | undefined;
    if (!database.decisionReviewInbox) database.decisionReviewInbox = [];
    if (requiresReviewInbox(outcome)) {
      const targetItem: ReviewInboxItem = existing ?? {
        id: createId("dinbox"),
        userId: input.userId,
        dedupeKey,
        createdAt: now,
        updatedAt: now,
        status: "open",
        title: input.title,
        reason: reasons.join(" "),
        outcome,
        scores: structuredClone(scores),
        requiredGates: []
      };
      Object.assign(targetItem, {
        candidateId: input.context?.candidateId ?? (input.subjectType === "migration-candidate" ? input.subjectId : undefined),
        planId: input.planId,
        snapshotId: input.snapshotId,
        targetId: input.targetId,
        title: input.title.trim(),
        reason: reasons.join(" "),
        outcome,
        scores: structuredClone(scores),
        requiredGates,
        status: "open" as const,
        resolutionNote: undefined,
        resolvedBy: undefined,
        resolvedAt: undefined,
        updatedAt: now
      });
      inboxItem = targetItem;
      if (!existing) database.decisionReviewInbox.push(targetItem);
    } else if (existing?.status === "open") {
      existing.status = "resolved";
      existing.resolutionNote = "Resolved automatically because the latest evaluation no longer requires review.";
      existing.resolvedBy = "decision-engine";
      existing.resolvedAt = now;
      existing.updatedAt = now;
    }

    if (!database.decisionAuditLog) database.decisionAuditLog = [];
    const audit: DecisionAuditRecord = {
      id: createId("daudit"),
      userId: input.userId,
      actorId: input.actorId ?? "decision-engine",
      event: "decision-evaluated",
      subjectId: input.subjectId,
      after: { outcome, scores, profileId: profile.id, preferenceId: preference?.id },
      metadata: { inboxRequired: requiresReviewInbox(outcome), requiredGateCount: requiredGates.length },
      createdAt: now
    };
    database.decisionAuditLog.push(audit);
    if (database.decisionAuditLog.length > 5000) database.decisionAuditLog.splice(0, database.decisionAuditLog.length - 5000);

    return { outcome, scores, reasons, profile, preference, history, inboxItem };
  });
}

/** Resolve an Inbox item and optionally remember that explicit user choice. */
export async function resolveDecisionReview(input: {
  userId: string;
  actorId: string;
  itemId: string;
  status: "accepted" | "rejected" | "deferred" | "resolved";
  note?: string;
  remember?: {
    scope: DecisionPreferenceScope;
    scopeId?: string;
    pattern: string;
    preferredOutcome: DecisionOutcome;
    confidence?: number;
  };
}): Promise<{ item: ReviewInboxItem; preference?: UserDecisionPreference } | undefined> {
  return updateRuntimeDatabase((database) => {
    const item = (database.decisionReviewInbox ?? []).find((candidate) =>
      candidate.id === input.itemId && candidate.userId === input.userId
    );
    if (!item) return undefined;
    const before = structuredClone(item);
    const now = new Date().toISOString();
    item.status = input.status;
    item.resolutionNote = input.note?.trim() || undefined;
    item.resolvedBy = input.actorId;
    item.resolvedAt = now;
    item.updatedAt = now;

    let preference: UserDecisionPreference | undefined;
    if (input.remember) {
      if (input.remember.scope !== "global" && !input.remember.scopeId?.trim()) {
        throw new Error(`Decision preference scope ${input.remember.scope} requires scopeId.`);
      }
      const pattern = input.remember.pattern.trim().toLocaleLowerCase();
      if (!pattern) throw new Error("Decision preference pattern is required.");
      if (!database.decisionUserPreferences) database.decisionUserPreferences = [];
      const scopeId = input.remember.scope === "global" ? undefined : input.remember.scopeId!.trim();
      preference = database.decisionUserPreferences.find((candidate) =>
        candidate.userId === input.userId
        && candidate.scope === input.remember!.scope
        && candidate.scopeId === scopeId
        && candidate.pattern === pattern
      );
      if (preference) {
        preference.preferredOutcome = input.remember.preferredOutcome;
        preference.observations += 1;
        preference.confidence = safePreferenceConfidence(input.remember.confidence ?? preference.confidence + (1 - preference.confidence) * 0.2);
        preference.updatedAt = now;
      } else {
        preference = {
          id: createId("dpref"),
          userId: input.userId,
          scope: input.remember.scope,
          scopeId,
          pattern,
          preferredOutcome: input.remember.preferredOutcome,
          confidence: safePreferenceConfidence(input.remember.confidence ?? 0.65),
          observations: 1,
          createdAt: now,
          updatedAt: now
        };
        database.decisionUserPreferences.push(preference);
      }
    }

    if (!database.decisionAuditLog) database.decisionAuditLog = [];
    database.decisionAuditLog.push({
      id: createId("daudit"),
      userId: input.userId,
      actorId: input.actorId,
      event: "review-resolved",
      subjectId: item.id,
      before,
      after: structuredClone(item),
      metadata: { rememberedPreference: Boolean(preference) },
      createdAt: now
    });
    if (preference) {
      database.decisionAuditLog.push({
        id: createId("daudit"),
        userId: input.userId,
        actorId: input.actorId,
        event: "preference-upserted",
        subjectId: preference.id,
        after: structuredClone(preference),
        createdAt: now
      });
    }
    if (database.decisionAuditLog.length > 5000) database.decisionAuditLog.splice(0, database.decisionAuditLog.length - 5000);
    return { item, preference };
  });
}

function decisionDedupeKey(input: DecisionEvaluationInput): string {
  return [
    input.subjectType,
    input.subjectId,
    input.context?.connectionId ?? "",
    input.snapshotId ?? "",
    input.targetId ?? ""
  ].join(":");
}

function decisionReasons(
  outcome: DecisionOutcome,
  scores: DecisionScores,
  facts: DecisionFacts,
  preference: UserDecisionPreference | undefined,
  profile: DecisionProfile,
  suppliedReason: string | undefined
): string[] {
  const reasons = suppliedReason?.trim() ? [suppliedReason.trim()] : [];
  if (facts.touchesDatabase && !facts.dataStrategyConfirmed) reasons.push("Database evidence requires an explicit data strategy.");
  if (facts.touchesSecret && !facts.secretPolicyConfirmed) reasons.push("Secret-bearing evidence requires an explicit secret policy.");
  if (facts.hasBlockers) reasons.push("One or more candidate blockers remain unresolved.");
  if (scores.collectorCompleteness < profile.minimumCollectorCompleteness) reasons.push("Collector evidence is below the active profile completeness threshold.");
  if (preference) reasons.push(`Applied remembered ${preference.scope} preference ${preference.id} as advisory context.`);
  reasons.push(`Decision outcome: ${outcome}; profile: ${profile.id}.`);
  return [...new Set(reasons)];
}

function safePreferenceConfidence(value: number): number {
  return Number.isFinite(value) ? clampDecisionScore(value) : 0.5;
}
