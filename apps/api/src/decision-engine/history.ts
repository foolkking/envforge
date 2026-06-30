import { createId, readRuntimeDatabase, updateRuntimeDatabase } from "../runtime-store.js";
import type { DecisionOutcome } from "./classify.js";
import type { DecisionScores } from "./score.js";

export interface DecisionHistoryRecord {
  id: string;
  userId: string;
  /** Stable evaluation scope; keeps identical candidate ids isolated across source snapshots. */
  dedupeKey?: string;
  subjectId: string;
  subjectType: "migration-candidate" | "environment-plan" | "capability" | "evidence";
  outcome: DecisionOutcome;
  scores: DecisionScores;
  reasons: string[];
  requiredGates: string[];
  preferenceId?: string;
  profileId: string;
  createdAt: string;
}

export async function appendDecisionHistory(
  record: Omit<DecisionHistoryRecord, "id" | "createdAt">
): Promise<DecisionHistoryRecord> {
  const created: DecisionHistoryRecord = {
    ...record,
    scores: structuredClone(record.scores),
    reasons: [...record.reasons],
    requiredGates: [...new Set(record.requiredGates)],
    id: createId("dhist"),
    createdAt: new Date().toISOString()
  };
  return updateRuntimeDatabase((database) => {
    if (!database.decisionHistory) database.decisionHistory = [];
    database.decisionHistory.push(created);
    // Retention bounds storage but never mutates an individual history record.
    if (database.decisionHistory.length > 5000) database.decisionHistory.splice(0, database.decisionHistory.length - 5000);
    return created;
  });
}

export async function listDecisionHistory(input: {
  userId: string;
  subjectId?: string;
  limit?: number;
}): Promise<DecisionHistoryRecord[]> {
  const database = await readRuntimeDatabase();
  const limit = Math.max(1, Math.min(500, input.limit ?? 100));
  return (database.decisionHistory ?? [])
    .filter((record) => record.userId === input.userId)
    .filter((record) => !input.subjectId || record.subjectId === input.subjectId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}
