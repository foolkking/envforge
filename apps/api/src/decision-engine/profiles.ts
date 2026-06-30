import { createId, readRuntimeDatabase, updateRuntimeDatabase } from "../runtime-store.js";
import type { DecisionScores } from "./score.js";
import type { DecisionPreferenceScope } from "./user-preferences.js";

export interface DecisionProfile {
  id: string;
  name: string;
  minimumEvidenceStrength: number;
  minimumMigrationReadiness: number;
  minimumAutomationConfidence: number;
  minimumCollectorCompleteness: number;
  maximumAutomaticRisk: number;
  /** Incomplete evidence above this risk becomes a blocker. */
  incompleteEvidenceRiskThreshold: number;
  /** Critical workloads above this score never auto-stage. */
  automaticBusinessCriticalityCeiling: number;
}

export interface DecisionProfileAssignment {
  id: string;
  userId: string;
  profileId: string;
  scope: DecisionPreferenceScope;
  scopeId?: string;
  createdAt: string;
  updatedAt: string;
}

export const CONSERVATIVE_DECISION_PROFILE: DecisionProfile = {
  id: "conservative",
  name: "Conservative",
  minimumEvidenceStrength: 0.85,
  minimumMigrationReadiness: 0.8,
  minimumAutomationConfidence: 0.8,
  minimumCollectorCompleteness: 0.8,
  maximumAutomaticRisk: 0.3,
  incompleteEvidenceRiskThreshold: 0.55,
  automaticBusinessCriticalityCeiling: 0.75
};

export const BALANCED_DECISION_PROFILE: DecisionProfile = {
  id: "balanced",
  name: "Balanced",
  minimumEvidenceStrength: 0.8,
  minimumMigrationReadiness: 0.7,
  minimumAutomationConfidence: 0.7,
  minimumCollectorCompleteness: 0.7,
  maximumAutomaticRisk: 0.4,
  incompleteEvidenceRiskThreshold: 0.6,
  automaticBusinessCriticalityCeiling: 0.85
};

export const BUILTIN_DECISION_PROFILES: readonly DecisionProfile[] = [
  CONSERVATIVE_DECISION_PROFILE,
  BALANCED_DECISION_PROFILE
];

export function getDecisionProfile(profileId: string | undefined): DecisionProfile {
  return BUILTIN_DECISION_PROFILES.find((profile) => profile.id === profileId) ?? CONSERVATIVE_DECISION_PROFILE;
}

export function profileAllowsAutomation(profile: DecisionProfile, scores: DecisionScores): boolean {
  return scores.evidenceStrength >= profile.minimumEvidenceStrength
    && scores.migrationReadiness >= profile.minimumMigrationReadiness
    && scores.automationConfidence >= profile.minimumAutomationConfidence
    && scores.collectorCompleteness >= profile.minimumCollectorCompleteness
    && scores.riskScore <= profile.maximumAutomaticRisk
    && scores.businessCriticality <= profile.automaticBusinessCriticalityCeiling;
}

export async function assignDecisionProfile(input: {
  userId: string;
  profileId: string;
  scope?: DecisionPreferenceScope;
  scopeId?: string;
}): Promise<DecisionProfileAssignment> {
  getDecisionProfileOrThrow(input.profileId);
  const scope = input.scope ?? "global";
  if (scope !== "global" && !input.scopeId?.trim()) throw new Error(`Decision profile scope ${scope} requires scopeId.`);
  const scopeId = scope === "global" ? undefined : input.scopeId!.trim();
  const now = new Date().toISOString();
  return updateRuntimeDatabase((database) => {
    if (!database.decisionProfileAssignments) database.decisionProfileAssignments = [];
    const existing = database.decisionProfileAssignments.find((assignment) =>
      assignment.userId === input.userId && assignment.scope === scope && assignment.scopeId === scopeId
    );
    if (existing) {
      const before = structuredClone(existing);
      existing.profileId = input.profileId;
      existing.updatedAt = now;
      appendProfileAudit(database, input.userId, existing, before, now);
      return existing;
    }
    const created: DecisionProfileAssignment = {
      id: createId("dprof"), userId: input.userId, profileId: input.profileId, scope, scopeId, createdAt: now, updatedAt: now
    };
    database.decisionProfileAssignments.push(created);
    appendProfileAudit(database, input.userId, created, undefined, now);
    return created;
  });
}

export async function resolveDecisionProfile(input: {
  userId: string;
  connectionId?: string;
  projectId?: string;
  serviceId?: string;
  capabilityId?: string;
}): Promise<{ profile: DecisionProfile; assignment?: DecisionProfileAssignment }> {
  const database = await readRuntimeDatabase();
  const assignment = findBestDecisionProfileAssignment(database.decisionProfileAssignments ?? [], input);
  return { profile: getDecisionProfile(assignment?.profileId), assignment };
}

export function findBestDecisionProfileAssignment(
  assignments: readonly DecisionProfileAssignment[],
  input: { userId: string; connectionId?: string; projectId?: string; serviceId?: string; capabilityId?: string }
): DecisionProfileAssignment | undefined {
  return assignments
    .filter((candidate) => candidate.userId === input.userId)
    .filter((candidate) => assignmentMatches(candidate, input))
    .sort((left, right) => scopeRank(right.scope) - scopeRank(left.scope) || right.updatedAt.localeCompare(left.updatedAt))[0];
}

function assignmentMatches(
  assignment: DecisionProfileAssignment,
  context: { connectionId?: string; projectId?: string; serviceId?: string; capabilityId?: string }
): boolean {
  if (assignment.scope === "global") return true;
  if (assignment.scope === "connection") return assignment.scopeId === context.connectionId;
  if (assignment.scope === "project") return assignment.scopeId === context.projectId;
  if (assignment.scope === "service") return assignment.scopeId === context.serviceId;
  return assignment.scopeId === context.capabilityId;
}

function getDecisionProfileOrThrow(profileId: string): DecisionProfile {
  const profile = BUILTIN_DECISION_PROFILES.find((candidate) => candidate.id === profileId);
  if (!profile) throw new Error(`Unknown decision profile: ${profileId}`);
  return profile;
}

function scopeRank(scope: DecisionPreferenceScope): number {
  return scope === "capability" ? 5 : scope === "service" ? 4 : scope === "project" ? 3 : scope === "connection" ? 2 : 1;
}

function appendProfileAudit(
  database: Awaited<ReturnType<typeof readRuntimeDatabase>>,
  userId: string,
  assignment: DecisionProfileAssignment,
  before: DecisionProfileAssignment | undefined,
  createdAt: string
): void {
  if (!database.decisionAuditLog) database.decisionAuditLog = [];
  database.decisionAuditLog.push({
    id: createId("daudit"), userId, actorId: userId, event: "profile-assigned", subjectId: assignment.id,
    before: before ? structuredClone(before) : undefined,
    after: structuredClone(assignment),
    createdAt
  });
  if (database.decisionAuditLog.length > 5000) database.decisionAuditLog.splice(0, database.decisionAuditLog.length - 5000);
}
