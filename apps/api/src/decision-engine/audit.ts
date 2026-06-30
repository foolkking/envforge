import { createId, readRuntimeDatabase, updateRuntimeDatabase } from "../runtime-store.js";

export type DecisionAuditEvent =
  | "decision-evaluated"
  | "preference-upserted"
  | "preference-deleted"
  | "review-opened"
  | "review-resolved"
  | "profile-assigned";

export interface DecisionAuditRecord {
  id: string;
  userId: string;
  actorId: string;
  event: DecisionAuditEvent;
  subjectId: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, string | number | boolean>;
  createdAt: string;
}

export async function appendDecisionAudit(
  record: Omit<DecisionAuditRecord, "id" | "createdAt">
): Promise<DecisionAuditRecord> {
  const created: DecisionAuditRecord = {
    ...record,
    before: record.before === undefined ? undefined : structuredClone(record.before),
    after: record.after === undefined ? undefined : structuredClone(record.after),
    metadata: record.metadata ? { ...record.metadata } : undefined,
    id: createId("daudit"),
    createdAt: new Date().toISOString()
  };
  return updateRuntimeDatabase((database) => {
    if (!database.decisionAuditLog) database.decisionAuditLog = [];
    database.decisionAuditLog.push(created);
    if (database.decisionAuditLog.length > 5000) database.decisionAuditLog.splice(0, database.decisionAuditLog.length - 5000);
    return created;
  });
}

export async function listDecisionAudit(input: {
  userId: string;
  subjectId?: string;
  limit?: number;
}): Promise<DecisionAuditRecord[]> {
  const database = await readRuntimeDatabase();
  const limit = Math.max(1, Math.min(500, input.limit ?? 100));
  return (database.decisionAuditLog ?? [])
    .filter((record) => record.userId === input.userId)
    .filter((record) => !input.subjectId || record.subjectId === input.subjectId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}
