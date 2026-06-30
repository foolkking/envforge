import { createId, readRuntimeDatabase, updateRuntimeDatabase } from "../runtime-store.js";
import type { DecisionOutcome } from "./classify.js";

/** Legacy, coarse preferences accepted by the first decision-engine draft. */
export interface DecisionUserPreferences {
  preferAutomation?: boolean;
  preserveUnknownEvidence?: boolean;
  riskTolerance?: "low" | "medium" | "high";
}

export type DecisionPreferenceScope = "global" | "connection" | "project" | "service" | "capability";

/**
 * A remembered user decision. The record is advisory: hard blockers, secret
 * policy and data-strategy requirements always take precedence during
 * classification.
 */
export interface UserDecisionPreference {
  id: string;
  userId: string;
  scope: DecisionPreferenceScope;
  /** Required for every scope except global. */
  scopeId?: string;
  /** Case-insensitive glob matched against candidate id/name/capability. */
  pattern: string;
  preferredOutcome: DecisionOutcome;
  confidence: number;
  observations: number;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionPreferenceContext {
  userId: string;
  connectionId?: string;
  projectId?: string;
  serviceId?: string;
  capabilityId?: string;
  candidateId?: string;
  candidateName?: string;
}

export interface UpsertDecisionPreferenceInput {
  userId: string;
  scope: DecisionPreferenceScope;
  scopeId?: string;
  pattern: string;
  preferredOutcome: DecisionOutcome;
  /** Defaults to 0.65 for an explicit first observation. */
  confidence?: number;
}

export function preferenceConfidence(preferences: DecisionUserPreferences | undefined): number {
  if (!preferences) return 0.5;
  const explicit = [preferences.preferAutomation, preferences.preserveUnknownEvidence, preferences.riskTolerance]
    .filter((value) => value !== undefined).length;
  return Math.min(1, 0.5 + explicit * 0.15);
}

export function rememberedPreferenceConfidence(preference: UserDecisionPreference | undefined): number {
  return preference ? clampConfidence(preference.confidence) : 0.5;
}

export function findBestDecisionPreference(
  preferences: readonly UserDecisionPreference[],
  context: DecisionPreferenceContext
): UserDecisionPreference | undefined {
  const candidates = preferences
    .filter((preference) => preference.userId === context.userId)
    .filter((preference) => preferenceScopeMatches(preference, context))
    .filter((preference) => preferencePatternMatches(preference.pattern, context));

  return candidates.sort((left, right) => {
    const scopeDelta = scopeRank(right.scope) - scopeRank(left.scope);
    if (scopeDelta !== 0) return scopeDelta;
    const confidenceDelta = right.confidence - left.confidence;
    if (confidenceDelta !== 0) return confidenceDelta;
    return right.updatedAt.localeCompare(left.updatedAt);
  })[0];
}

export async function listDecisionPreferences(userId: string): Promise<UserDecisionPreference[]> {
  const database = await readRuntimeDatabase();
  return (database.decisionUserPreferences ?? [])
    .filter((preference) => preference.userId === userId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function upsertDecisionPreference(input: UpsertDecisionPreferenceInput): Promise<UserDecisionPreference> {
  const pattern = normalizePattern(input.pattern);
  if (!pattern) throw new Error("Decision preference pattern is required.");
  if (input.scope !== "global" && !input.scopeId?.trim()) {
    throw new Error(`Decision preference scope ${input.scope} requires scopeId.`);
  }
  const scopeId = input.scope === "global" ? undefined : input.scopeId!.trim();
  const now = new Date().toISOString();

  return updateRuntimeDatabase((database) => {
    if (!database.decisionUserPreferences) database.decisionUserPreferences = [];
    const existing = database.decisionUserPreferences.find((preference) =>
      preference.userId === input.userId
      && preference.scope === input.scope
      && preference.scopeId === scopeId
      && normalizePattern(preference.pattern) === pattern
    );
    if (existing) {
      const before = structuredClone(existing);
      existing.preferredOutcome = input.preferredOutcome;
      existing.observations += 1;
      existing.confidence = clampConfidence(input.confidence ?? reinforceConfidence(existing.confidence));
      existing.updatedAt = now;
      appendPreferenceAudit(database, input.userId, "preference-upserted", existing.id, before, existing, now);
      return existing;
    }
    const created: UserDecisionPreference = {
      id: createId("dpref"),
      userId: input.userId,
      scope: input.scope,
      scopeId,
      pattern,
      preferredOutcome: input.preferredOutcome,
      confidence: clampConfidence(input.confidence ?? 0.65),
      observations: 1,
      createdAt: now,
      updatedAt: now
    };
    database.decisionUserPreferences.push(created);
    appendPreferenceAudit(database, input.userId, "preference-upserted", created.id, undefined, created, now);
    return created;
  });
}

export async function deleteDecisionPreference(userId: string, preferenceId: string): Promise<boolean> {
  return updateRuntimeDatabase((database) => {
    const preferences = database.decisionUserPreferences ?? [];
    const index = preferences.findIndex((preference) => preference.id === preferenceId && preference.userId === userId);
    if (index < 0) return false;
    const [removed] = preferences.splice(index, 1);
    database.decisionUserPreferences = preferences;
    appendPreferenceAudit(database, userId, "preference-deleted", preferenceId, removed, undefined, new Date().toISOString());
    return true;
  });
}

function preferenceScopeMatches(preference: UserDecisionPreference, context: DecisionPreferenceContext): boolean {
  if (preference.scope === "global") return true;
  if (preference.scope === "connection") return preference.scopeId === context.connectionId;
  if (preference.scope === "project") return preference.scopeId === context.projectId;
  if (preference.scope === "service") return preference.scopeId === context.serviceId;
  return preference.scopeId === context.capabilityId;
}

function preferencePatternMatches(pattern: string, context: DecisionPreferenceContext): boolean {
  const values = [context.candidateId, context.candidateName, context.capabilityId, context.serviceId]
    .filter((value): value is string => Boolean(value));
  const expression = globExpression(normalizePattern(pattern));
  return values.some((value) => expression.test(value.toLocaleLowerCase()));
}

function globExpression(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`, "i");
}

function normalizePattern(pattern: string): string {
  return pattern.trim().toLocaleLowerCase();
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function reinforceConfidence(confidence: number): number {
  return confidence + (1 - confidence) * 0.2;
}

function scopeRank(scope: DecisionPreferenceScope): number {
  return scope === "capability" ? 5 : scope === "service" ? 4 : scope === "project" ? 3 : scope === "connection" ? 2 : 1;
}

function appendPreferenceAudit(
  database: Awaited<ReturnType<typeof readRuntimeDatabase>>,
  userId: string,
  event: "preference-upserted" | "preference-deleted",
  subjectId: string,
  before: unknown,
  after: unknown,
  createdAt: string
): void {
  if (!database.decisionAuditLog) database.decisionAuditLog = [];
  database.decisionAuditLog.push({
    id: createId("daudit"), userId, actorId: userId, event, subjectId,
    before: before === undefined ? undefined : structuredClone(before),
    after: after === undefined ? undefined : structuredClone(after),
    createdAt
  });
  if (database.decisionAuditLog.length > 5000) database.decisionAuditLog.splice(0, database.decisionAuditLog.length - 5000);
}
