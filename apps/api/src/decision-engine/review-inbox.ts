import { createId, readRuntimeDatabase, updateRuntimeDatabase } from "../runtime-store.js";
import type { DecisionOutcome } from "./classify.js";
import type { DecisionScores } from "./score.js";

export type ReviewInboxStatus = "open" | "accepted" | "rejected" | "deferred" | "resolved";

export interface ReviewInboxItem {
  id: string;
  userId: string;
  dedupeKey: string;
  candidateId?: string;
  planId?: string;
  snapshotId?: string;
  targetId?: string;
  title: string;
  reason: string;
  outcome: DecisionOutcome;
  scores: DecisionScores;
  requiredGates: string[];
  status: ReviewInboxStatus;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Compatibility view used by the initial, in-memory engine draft. */
export interface DecisionInboxItem {
  candidateId: string;
  outcome: DecisionOutcome;
  scores: DecisionScores;
  reasons: string[];
}

export interface UpsertReviewInboxInput {
  userId: string;
  dedupeKey: string;
  candidateId?: string;
  planId?: string;
  snapshotId?: string;
  targetId?: string;
  title: string;
  reason: string;
  outcome: DecisionOutcome;
  scores: DecisionScores;
  requiredGates?: string[];
}

export function requiresReviewInbox(outcome: DecisionOutcome): boolean {
  return outcome === "required-decision" || outcome === "suggested-decision" || outcome === "blocker";
}

export async function upsertReviewInboxItem(input: UpsertReviewInboxInput): Promise<ReviewInboxItem> {
  if (!requiresReviewInbox(input.outcome)) throw new Error(`Decision outcome ${input.outcome} does not belong in the review inbox.`);
  if (!input.dedupeKey.trim()) throw new Error("Review inbox dedupeKey is required.");
  const now = new Date().toISOString();
  return updateRuntimeDatabase((database) => {
    if (!database.decisionReviewInbox) database.decisionReviewInbox = [];
    const existing = database.decisionReviewInbox.find((item) =>
      item.userId === input.userId && item.dedupeKey === input.dedupeKey
    );
    if (existing) {
      existing.candidateId = input.candidateId;
      existing.planId = input.planId;
      existing.snapshotId = input.snapshotId;
      existing.targetId = input.targetId;
      existing.title = input.title;
      existing.reason = input.reason;
      existing.outcome = input.outcome;
      existing.scores = structuredClone(input.scores);
      existing.requiredGates = [...new Set(input.requiredGates ?? [])];
      // A fresh evaluation can reopen a previously handled item if the same
      // unresolved safety condition appears again.
      if (existing.status !== "open") {
        existing.status = "open";
        existing.resolutionNote = undefined;
        existing.resolvedBy = undefined;
        existing.resolvedAt = undefined;
      }
      existing.updatedAt = now;
      return existing;
    }
    const created: ReviewInboxItem = {
      id: createId("dinbox"),
      userId: input.userId,
      dedupeKey: input.dedupeKey.trim(),
      candidateId: input.candidateId,
      planId: input.planId,
      snapshotId: input.snapshotId,
      targetId: input.targetId,
      title: input.title.trim(),
      reason: input.reason.trim(),
      outcome: input.outcome,
      scores: structuredClone(input.scores),
      requiredGates: [...new Set(input.requiredGates ?? [])],
      status: "open",
      createdAt: now,
      updatedAt: now
    };
    database.decisionReviewInbox.push(created);
    return created;
  });
}

export async function listReviewInbox(input: {
  userId: string;
  status?: ReviewInboxStatus | "all";
  limit?: number;
}): Promise<ReviewInboxItem[]> {
  const database = await readRuntimeDatabase();
  const limit = Math.max(1, Math.min(500, input.limit ?? 100));
  return (database.decisionReviewInbox ?? [])
    .filter((item) => item.userId === input.userId)
    .filter((item) => !input.status || input.status === "all" || item.status === input.status)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, limit);
}

export async function resolveReviewInboxItem(input: {
  userId: string;
  itemId: string;
  status: Exclude<ReviewInboxStatus, "open">;
  actorId: string;
  note?: string;
}): Promise<ReviewInboxItem | undefined> {
  const now = new Date().toISOString();
  return updateRuntimeDatabase((database) => {
    const item = (database.decisionReviewInbox ?? []).find((candidate) =>
      candidate.id === input.itemId && candidate.userId === input.userId
    );
    if (!item) return undefined;
    item.status = input.status;
    item.resolutionNote = input.note?.trim() || undefined;
    item.resolvedBy = input.actorId;
    item.resolvedAt = now;
    item.updatedAt = now;
    return item;
  });
}

export async function resolveReviewInboxByDedupeKey(input: {
  userId: string;
  dedupeKey: string;
  actorId: string;
  note?: string;
}): Promise<ReviewInboxItem | undefined> {
  const database = await readRuntimeDatabase();
  const item = (database.decisionReviewInbox ?? []).find((candidate) =>
    candidate.userId === input.userId && candidate.dedupeKey === input.dedupeKey && candidate.status === "open"
  );
  if (!item) return undefined;
  return resolveReviewInboxItem({ ...input, itemId: item.id, status: "resolved" });
}
