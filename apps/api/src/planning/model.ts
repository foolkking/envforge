import { canonicalHash } from "../platform/foundation.js";

export const BLUEPRINT_SCHEMA_VERSION = "workload-blueprint-v1";
export const DECISION_SCHEMA_VERSION = "decision-set-v1";
export const PLAN_SCHEMA_VERSION = "plan-revision-v1";
export const COMPILER_VERSION = "envforge-plan-compiler-1.0.0";
export const CANONICALIZER_VERSION = "phase0-canonical-json-v1";

export type PlanningMode = "build" | "migration" | "capture" | "restore";
export type ReadinessStatus = "planner-ready" | "review-required" | "blocked";
export type EphemeralStateDisposition = "drain" | "quiesce" | "checkpoint" | "requeue" | "restart" | "discard-with-warning" | "manual" | "blocked";

export interface HashRef { id: string; hash: string }

export interface BlueprintContent {
  identity: { name: string; kind: string; provenance?: Record<string, unknown>; scope?: Record<string, unknown> };
  components: Array<{ key: string; kind: string; source?: string }>;
  runtime: {
    executionModel: string; entrypoint: string; workingDirectory: string; runUser: string; runGroup: string;
    environmentRefs: string[]; environmentFileRefs: string[]; enabled: boolean; desiredState: "active" | "inactive";
    restartPolicy: string; restartDelaySeconds: number; after: string[]; before: string[]; wants: string[]; requires: string[];
    startupTimeoutSeconds: number; shutdownTimeoutSeconds: number; resourceLimits: Record<string, unknown>;
    securityContext: Record<string, unknown>; socketActivation: boolean; timerActivation: boolean;
    healthCheck: Record<string, unknown>; allowedWritePaths: string[]; stateDirectories: string[]; runtimeDirectories: string[];
  };
  deployment: {
    sourceType: "package" | "git" | "container-image" | "docker-compose" | "binary" | "directory";
    reference: string; exactVersion: string; checksum: string; buildCommand?: string; lockfile?: string;
    provenance: Record<string, unknown>; fallbackStrategy: string;
  };
  config: Array<{
    key: string; classification: "portable" | "target-rendered" | "host-specific" | "secret-placeholder";
    sourceArtifactRef?: string; sanitizedArtifactRef?: string; validationCommandRef?: string; owner?: string; mode?: string;
  }>;
  datasets: Array<Record<string, unknown>>;
  secretRequirements: Array<{ id: string; purpose: string; providerBindingRef?: string; required: boolean }>;
  endpoints: Array<Record<string, unknown>>;
  systemIdentities: Array<Record<string, unknown>>;
  scheduledTasks: Array<Record<string, unknown>>;
  dependencies: Array<{ workloadId: string; kind: string }>;
  externalDependencies: Array<Record<string, unknown>>;
  ephemeralState: Record<string, EphemeralStateDisposition>;
  compatibility: Record<string, unknown>;
  verification: Array<Record<string, unknown>>;
  operationalRequirements: Record<string, unknown>;
  migrationRequirements: Record<string, unknown>;
  captureRequirements: Record<string, unknown>;
  knownLimitations: string[];
}

export interface DecisionContent {
  conflicts?: Record<string, string>;
  datasetStrategies?: Record<string, string>;
  secretProviderBindings?: Record<string, string>;
  maintenanceWindow?: Record<string, unknown>;
  cutoverStrategy?: Record<string, unknown>;
  verification?: Record<string, unknown>;
  rollback?: Record<string, unknown>;
  riskAcceptances?: Array<{ riskId: string; reason: string; expiresAt?: string }>;
}

export interface PlanBinding { type: "blueprint" | "decision-set" | "source-snapshot" | "target-snapshot" | "archive-version" | "capability" | "policy"; key: string; id: string; hash: string; metadata?: Record<string, unknown> }
export interface PlanStage { key: string; sequence: number; required: boolean }
export interface PlanAction {
  id: string; key: string; stageKey: string; type: string; adapterId: string; adapterVersion: string; implementationHash: string;
  inputs: Record<string, unknown>; preconditions: Array<Record<string, unknown>>; postconditions: Array<Record<string, unknown>>;
  resourceKeys: string[]; verificationCheckIds: string[]; retryPolicy: Record<string, unknown>; recoveryContract: Record<string, unknown>;
  rollbackDefinition?: Record<string, unknown>; resumability: "idempotent" | "byte-resumable" | "step-resumable" | "restart-required" | "manual";
  riskLevel: "low" | "medium" | "high" | "critical"; trace: Record<string, unknown>;
}
export interface PlanDependency { fromActionId: string; toActionId: string; type: "must-complete-before" | "must-succeed-before" | "same-checkpoint" | "rollback-after" | "exclusive-resource-lock" }
export interface PlanContract { type: "dataset" | "secret" | "cutover" | "verification" | "rollback" | "runtime" | "deployment" | "config" | "ephemeral-state"; key: string; content: Record<string, unknown>; hash: string }
export interface PlanGate { key: string; type: string; required: boolean; definition: Record<string, unknown> }
export interface PlanRisk { key: string; severity: "low" | "medium" | "high" | "critical"; hardBlocker: boolean; content: Record<string, unknown> }

export interface CanonicalPlan {
  schemaVersion: string; planType: PlanningMode; bindings: PlanBinding[]; compiler: { version: string; canonicalizerVersion: string };
  stages: PlanStage[]; actions: PlanAction[]; dependencies: PlanDependency[]; contracts: PlanContract[]; gates: PlanGate[]; risks: PlanRisk[];
  limitations: string[]; estimates: Record<string, unknown>; trace: Record<string, unknown>;
}

const prohibitedKey = /^(?:password|passwd|token|privateKey|private_key|secretValue|secret_value|credential|connectionString)$/i;
const rawSecretPattern = /(?:BEGIN [A-Z ]*PRIVATE KEY|envforge[-_]secret[-_]canary|password\s*=|token\s*=)/i;

export function assertPlanningSafe(value: unknown, path = "planning-input"): void {
  if (Array.isArray(value)) { value.forEach((item, index) => assertPlanningSafe(item, `${path}[${index}]`)); return; }
  if (typeof value === "string") {
    if (rawSecretPattern.test(value)) throw new Error(`Secret material is not allowed in ${path}.`);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (prohibitedKey.test(key)) throw new Error(`Secret field is not allowed in ${path}: ${key}`);
    assertPlanningSafe(item, `${path}.${key}`);
  }
}

export function validateBlueprint(content: BlueprintContent): void {
  assertPlanningSafe(content);
  if (!content.identity?.name || !content.identity.kind) throw new Error("Blueprint identity is required.");
  if (!Array.isArray(content.components) || content.components.length === 0) throw new Error("Blueprint requires at least one component.");
  if (!content.runtime?.entrypoint || !content.runtime.workingDirectory || !content.runtime.runUser || !content.runtime.runGroup) throw new Error("Complete RuntimeContract is required.");
  if (!content.deployment?.sourceType || !content.deployment.reference || !content.deployment.exactVersion || !/^[0-9a-f]{64}$/.test(content.deployment.checksum)) throw new Error("Complete DeploymentContract with checksum is required.");
  for (const config of content.config ?? []) {
    if (config.classification === "secret-placeholder" && config.sourceArtifactRef) throw new Error("Secret placeholder cannot bind a raw source artifact.");
  }
  const requiredTransient = ["httpRequests", "databaseTransactions", "fileLocks", "activeWriters", "inMemorySessions", "activeJobs", "leaderElection", "scheduledExecutions", "unpersistedMessages"];
  for (const key of requiredTransient) if (!content.ephemeralState?.[key]) throw new Error(`EphemeralStatePolicy is missing ${key}.`);
}

export function evaluateReadiness(content: BlueprintContent, mode: PlanningMode): { status: ReadinessStatus; blockers: string[]; warnings: string[] } {
  validateBlueprint(content);
  const blockers = Object.entries(content.ephemeralState).filter(([, disposition]) => disposition === "blocked").map(([key]) => `ephemeral-state:${key}`);
  const manual = Object.entries(content.ephemeralState).filter(([, disposition]) => disposition === "manual").map(([key]) => `manual-ephemeral-state:${key}`);
  if (mode === "capture" && content.secretRequirements.some((requirement) => requirement.required && !requirement.providerBindingRef)) blockers.push("capture-secret-provider-missing");
  return { status: blockers.length ? "blocked" : manual.length ? "review-required" : "planner-ready", blockers, warnings: manual };
}

export function planHash(plan: CanonicalPlan): string { return canonicalHash(plan); }
