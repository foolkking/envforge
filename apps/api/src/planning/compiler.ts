import { createHash } from "node:crypto";
import { canonicalHash } from "../platform/foundation.js";
import {
  CANONICALIZER_VERSION, COMPILER_VERSION, PLAN_SCHEMA_VERSION, evaluateReadiness, planHash, validateBlueprint,
  type BlueprintContent, type CanonicalPlan, type DecisionContent, type HashRef, type PlanAction, type PlanBinding,
  type PlanContract, type PlanDependency, type PlanGate, type PlanningMode, type PlanRisk, type PlanStage
} from "./model.js";

export interface CompilerBlueprint { id: string; workloadId: string; hash: string; content: BlueprintContent }
export interface CompilerInput {
  projectId: string; mode: PlanningMode; blueprints: CompilerBlueprint[]; decision: { id: string; hash: string; content: DecisionContent };
  sourceSnapshot?: HashRef; targetSnapshot?: HashRef; archiveVersion?: HashRef;
  capability: HashRef & { version: string; certifiedModes: PlanningMode[] }; policy: HashRef & { version: string };
  estimate?: Record<string, unknown>;
}
export type CompilerResult = { outcome: "compiled" | "review-required"; plan: CanonicalPlan; hash: string } | { outcome: "blocked"; blockers: string[]; diagnostics: Record<string, unknown> };

const BUILD_STAGES = ["target-preflight","prepare-identity","prepare-storage","install-runtime","deploy","configure","initialize-data","bind-secrets","activate","verify","execution-commit","cleanup"];
const MODE_STAGES: Record<PlanningMode, string[]> = {
  build: BUILD_STAGES,
  migration: ["source-preflight","target-preflight","initial-sync","quiesce","final-sync","activate-target","verify","cutover","cleanup"],
  capture: ["source-preflight","quiesce","capture","encrypt","replicate","verify","release-gate","cleanup"],
  restore: ["archive-verify","target-preflight","restore-data","deploy","configure","bind-secrets","activate","verify","execution-commit","cleanup"]
};

export function compilePlan(input: CompilerInput): CompilerResult {
  if (!input.blueprints.length) return blocked("blueprint-required");
  if (!input.capability.certifiedModes.includes(input.mode)) return blocked(`capability-unavailable:${input.mode}`);
  if (["build","migration","restore"].includes(input.mode) && !input.targetSnapshot) return blocked("target-snapshot-required");
  if (input.mode === "migration" && !input.sourceSnapshot) return blocked("source-snapshot-required");
  if (input.mode === "restore" && !input.archiveVersion) return blocked("archive-version-required");
  const orderedBlueprints = [...input.blueprints].sort((left, right) => left.id.localeCompare(right.id));
  const readiness = orderedBlueprints.map((blueprint) => ({ blueprint, result: evaluateReadiness(blueprint.content, input.mode) }));
  const blockers = readiness.flatMap(({ blueprint, result }) => result.blockers.map((item) => `${blueprint.id}:${item}`));
  if (blockers.length) return { outcome: "blocked", blockers, diagnostics: { phase: "validating-inputs", blockers } };
  orderedBlueprints.forEach((blueprint) => validateBlueprint(blueprint.content));

  const bindings = bindingsFor(input);
  const stages: PlanStage[] = MODE_STAGES[input.mode].map((key, sequence) => ({ key, sequence, required: true }));
  const actions = orderedBlueprints.flatMap((blueprint) => actionsFor(input.mode, blueprint));
  const dependencies = chain(actions);
  assertValidDag(actions, dependencies);
  const contracts = orderedBlueprints.flatMap((blueprint) => contractsFor(blueprint));
  const gates: PlanGate[] = [
    { key: "exact-input-bindings", type: "integrity", required: true, definition: { bindingCount: bindings.length } },
    { key: "required-verification", type: "verification", required: true, definition: { contractKeys: contracts.filter((item) => item.type === "verification").map((item) => item.key) } }
  ];
  const reviewWarnings = readiness.flatMap(({ blueprint, result }) => result.warnings.map((warning) => `${blueprint.id}:${warning}`));
  const risks: PlanRisk[] = reviewWarnings.map((warning, index) => ({ key: `manual-review-${index + 1}`, severity: "high", hardBlocker: false, content: { warning } }));
  const plan: CanonicalPlan = {
    schemaVersion: PLAN_SCHEMA_VERSION,
    planType: input.mode,
    bindings,
    compiler: { version: COMPILER_VERSION, canonicalizerVersion: CANONICALIZER_VERSION },
    stages,
    actions,
    dependencies,
    contracts,
    gates,
    risks,
    limitations: [...new Set(orderedBlueprints.flatMap((blueprint) => blueprint.content.knownLimitations))].sort(),
    estimates: input.estimate ?? {},
    trace: { projectId: input.projectId, reasons: ["confirmed-blueprint", "immutable-decision", "version-bound-capability", "version-bound-policy"] }
  };
  return { outcome: reviewWarnings.length ? "review-required" : "compiled", plan, hash: planHash(plan) };
}

function bindingsFor(input: CompilerInput): PlanBinding[] {
  const values: PlanBinding[] = [
    ...input.blueprints.map((item) => ({ type: "blueprint" as const, key: item.workloadId, id: item.id, hash: item.hash })),
    { type: "decision-set", key: "decision", id: input.decision.id, hash: input.decision.hash },
    { type: "capability", key: "compiler-capability", id: input.capability.id, hash: input.capability.hash, metadata: { version: input.capability.version, certifiedModes: input.capability.certifiedModes } },
    { type: "policy", key: "policy", id: input.policy.id, hash: input.policy.hash, metadata: { version: input.policy.version } }
  ];
  if (input.sourceSnapshot) values.push({ type: "source-snapshot", key: "source", ...input.sourceSnapshot });
  if (input.targetSnapshot) values.push({ type: "target-snapshot", key: "target", ...input.targetSnapshot });
  if (input.archiveVersion) values.push({ type: "archive-version", key: "archive", ...input.archiveVersion });
  return values.sort((left, right) => `${left.type}:${left.key}`.localeCompare(`${right.type}:${right.key}`));
}

function actionsFor(mode: PlanningMode, blueprint: CompilerBlueprint): PlanAction[] {
  const workloadKey = safeKey(blueprint.workloadId);
  const source = blueprint.content.deployment;
  const specs = [
    { stage: mode === "capture" ? "source-preflight" : "target-preflight", type: "InspectCompatibility", risk: "low" as const },
    { stage: mode === "capture" ? "capture" : "deploy", type: mode === "capture" ? "CaptureDeploymentMaterial" : "DeployWorkload", risk: "medium" as const },
    { stage: "verify", type: "VerifyWorkloadContract", risk: "low" as const }
  ];
  return specs.map((spec, index) => {
    const key = `${workloadKey}:${index + 1}:${safeKey(spec.type)}`;
    return {
      id: deterministicUuid(`${blueprint.hash}:${key}`), key, stageKey: spec.stage, type: spec.type,
      adapterId: "envforge.contract-only", adapterVersion: "1.0.0", implementationHash: canonicalHash({ adapter: "envforge.contract-only", version: "1.0.0" }),
      inputs: { blueprintRevisionId: blueprint.id, deploymentSourceType: source.sourceType, deploymentReference: source.reference, expectedChecksum: source.checksum },
      preconditions: [{ kind: "input-hash", expected: blueprint.hash }], postconditions: [{ kind: "contract-evidence-required" }],
      resourceKeys: [`workload:${blueprint.workloadId}`], verificationCheckIds: blueprint.content.verification.map((_, checkIndex) => `${workloadKey}:verify:${checkIndex + 1}`),
      retryPolicy: { maxAttempts: 1 }, recoveryContract: { reconciliation: "required-before-phase-2-execution" },
      rollbackDefinition: spec.type === "DeployWorkload" ? { classification: "contract-only", removeOnlyCreatedResources: true } : undefined,
      resumability: "manual", riskLevel: spec.risk,
      trace: { blueprintRevisionId: blueprint.id, jsonPointer: spec.type === "DeployWorkload" ? "/deployment" : "/verification", compilerStage: "compiling-contracts", reason: spec.type }
    };
  });
}

function contractsFor(blueprint: CompilerBlueprint): PlanContract[] {
  const pairs: Array<[PlanContract["type"], string, Record<string, unknown>]> = [
    ["runtime", `${blueprint.workloadId}:runtime`, blueprint.content.runtime],
    ["deployment", `${blueprint.workloadId}:deployment`, blueprint.content.deployment],
    ["ephemeral-state", `${blueprint.workloadId}:ephemeral`, blueprint.content.ephemeralState],
    ["verification", `${blueprint.workloadId}:verification`, { checks: blueprint.content.verification }],
    ["rollback", `${blueprint.workloadId}:rollback`, { limitations: blueprint.content.knownLimitations }]
  ];
  for (const config of blueprint.content.config) pairs.push(["config", `${blueprint.workloadId}:config:${config.key}`, config]);
  for (const [index, dataset] of blueprint.content.datasets.entries()) pairs.push(["dataset", `${blueprint.workloadId}:dataset:${index + 1}`, dataset]);
  for (const requirement of blueprint.content.secretRequirements) pairs.push(["secret", `${blueprint.workloadId}:secret:${requirement.id}`, requirement]);
  return pairs.map(([type, key, content]) => ({ type, key, content, hash: canonicalHash(content) })).sort((a, b) => `${a.type}:${a.key}`.localeCompare(`${b.type}:${b.key}`));
}

function chain(actions: PlanAction[]): PlanDependency[] {
  const sorted = [...actions].sort((a, b) => a.key.localeCompare(b.key));
  return sorted.slice(1).map((action, index) => ({ fromActionId: sorted[index].id, toActionId: action.id, type: "must-succeed-before" }));
}

export function assertValidDag(actions: PlanAction[], dependencies: PlanDependency[]): void {
  const ids = new Set(actions.map((action) => action.id));
  if (ids.size !== actions.length || new Set(actions.map((action) => action.key)).size !== actions.length) throw new Error("Action identifiers and keys must be unique.");
  const incoming = new Map(actions.map((action) => [action.id, 0]));
  const outgoing = new Map(actions.map((action) => [action.id, [] as string[]]));
  for (const edge of dependencies) {
    if (!ids.has(edge.fromActionId) || !ids.has(edge.toActionId)) throw new Error("Action dependency must remain within one Plan.");
    incoming.set(edge.toActionId, (incoming.get(edge.toActionId) ?? 0) + 1); outgoing.get(edge.fromActionId)!.push(edge.toActionId);
  }
  const queue = [...incoming].filter(([, count]) => count === 0).map(([id]) => id);
  let visited = 0;
  while (queue.length) { const id = queue.shift()!; visited += 1; for (const next of outgoing.get(id) ?? []) { const count = incoming.get(next)! - 1; incoming.set(next, count); if (!count) queue.push(next); } }
  if (visited !== actions.length) throw new Error("Action DAG contains a cycle.");
}

function blocked(reason: string): CompilerResult { return { outcome: "blocked", blockers: [reason], diagnostics: { phase: "validating-inputs", blockers: [reason] } }; }
function safeKey(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48); }
function deterministicUuid(seed: string): string { const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32).split(""); hex[12] = "5"; hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16); const value = hex.join(""); return `${value.slice(0,8)}-${value.slice(8,12)}-${value.slice(12,16)}-${value.slice(16,20)}-${value.slice(20)}`; }
