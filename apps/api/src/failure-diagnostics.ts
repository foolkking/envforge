import { redactSecrets, safePreview, type ActionRunRecord } from "./action-runs.js";
import type { FullSystemSnapshot } from "./collectors/remote-collector.js";
import type { AssessmentSummary } from "./migration-assessment.js";
import type { StoredMigrationSessionRun, StoredProbeSnapshot } from "./runtime-store.js";

export type FailureSource = "assessment" | "review" | "plan" | "apply" | "verify" | "report" | "golden-scenario";
export type FailureSeverity = "info" | "warning" | "error" | "critical";
export type FailureCategory =
  | "validation-failed"
  | "command-failed"
  | "missing-artifact"
  | "missing-dependency"
  | "collector-failed"
  | "permission-denied"
  | "network-unreachable"
  | "service-unhealthy"
  | "config-invalid"
  | "secret-missing"
  | "data-risk"
  | "verification-failed"
  | "rollback-required"
  | "manual-follow-up"
  | "unknown";

export type FailureRecommendedActionKind =
  | "view-diff"
  | "retry"
  | "skip"
  | "mark-manual"
  | "generate-repair-plan-draft"
  | "rollback"
  | "export-support-bundle"
  | "inspect-evidence"
  | "update-decision"
  | "rerun-assessment"
  | "contact-support";

export interface FailureEvidenceRef {
  id: string;
  kind: "command" | "stdout" | "stderr" | "collector" | "verification" | "decision" | "artifact" | "note";
  source: string;
  label: string;
  value?: string;
  exitCode?: number;
  timedOut?: boolean;
}

export interface FailureRecommendedAction {
  kind: FailureRecommendedActionKind;
  label: string;
  description: string;
  available: boolean;
  unavailableReason?: string;
}

export interface RepairPlanDraft {
  id: string;
  title: string;
  status: "draft" | "not-available";
  summary: string;
  proposedSteps: Array<{
    id: string;
    description: string;
    risk: "low" | "medium" | "high" | "unknown";
    requiresReview: boolean;
    wouldRequireApprovedPlan: boolean;
  }>;
  safetyNotes: string[];
}

export interface FailureDiagnostic {
  id: string;
  source: FailureSource;
  severity: FailureSeverity;
  category: FailureCategory;
  title: string;
  summary: string;
  whatFailed: string;
  whereFailed?: string;
  attempted?: string;
  impact: string;
  likelyCauses: string[];
  evidence: FailureEvidenceRef[];
  recommendedActions: FailureRecommendedAction[];
  retry: { allowed: boolean; reason: string };
  skip: { allowed: boolean; reason: string };
  rollback: { required: boolean; available: boolean; boundary: string };
  repairPlanDraft?: RepairPlanDraft;
  supportBundleRefs: string[];
  redactionApplied: boolean;
}

export interface FailureEvidenceInput {
  id?: string;
  source: FailureSource;
  severity?: FailureSeverity;
  categoryHint?: FailureCategory;
  title?: string;
  whatFailed: string;
  whereFailed?: string;
  attempted?: string;
  impact?: string;
  message?: string;
  command?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  timedOut?: boolean;
  beforeMutation?: boolean;
  serviceName?: string;
  evidence?: FailureEvidenceRef[];
}

export interface BuildSessionFailureEvidenceInput {
  assessment?: AssessmentSummary;
  snapshot?: FullSystemSnapshot | StoredProbeSnapshot;
  runs?: StoredMigrationSessionRun[];
  actionRuns?: ActionRunRecord[];
}

export function buildFailureDiagnostic(input: FailureEvidenceInput): FailureDiagnostic {
  const combined = [input.title, input.whatFailed, input.whereFailed, input.attempted, input.message, input.command, input.stdout, input.stderr]
    .filter(Boolean)
    .join("\n");
  const category = input.categoryHint ?? classifyFailure(combined, input.source);
  const profile = profileFor(category, combined, input);
  const evidence = redactEvidence([
    ...(input.command ? [{ id: `${input.id ?? "failure"}:command`, kind: "command" as const, source: input.source, label: "Command", value: input.command, exitCode: input.exitCode, timedOut: input.timedOut }] : []),
    ...(input.stdout ? [{ id: `${input.id ?? "failure"}:stdout`, kind: "stdout" as const, source: input.source, label: "Redacted stdout", value: safePreview(input.stdout, 1600).text }] : []),
    ...(input.stderr ? [{ id: `${input.id ?? "failure"}:stderr`, kind: "stderr" as const, source: input.source, label: "Redacted stderr", value: safePreview(input.stderr, 1600).text, exitCode: input.exitCode, timedOut: input.timedOut }] : []),
    ...(input.evidence ?? [])
  ]);
  const redactionApplied = evidence.some((item) => item.value?.includes("<REDACTED-"))
    || redactSecrets(combined).redacted;
  const id = input.id ?? `failure:${category}:${stableKey(input.whatFailed)}`;
  const repairPlanDraft = repairDraftFor(id, category, combined);
  return redactDiagnostic({
    id,
    source: input.source,
    severity: input.severity ?? profile.severity,
    category,
    title: input.title ?? profile.title,
    summary: input.message ?? profile.summary,
    whatFailed: input.whatFailed,
    whereFailed: input.whereFailed,
    attempted: input.attempted ?? input.command,
    impact: input.impact ?? profile.impact,
    likelyCauses: profile.likelyCauses,
    evidence,
    recommendedActions: actionsFor(category, repairPlanDraft),
    retry: profile.retry,
    skip: profile.skip,
    rollback: rollbackFor(input, category),
    repairPlanDraft,
    supportBundleRefs: [`support-bundle:failure:${id}`],
    redactionApplied
  });
}

export function buildFailureDiagnostics(inputs: readonly FailureEvidenceInput[]): FailureDiagnostic[] {
  return inputs.map(buildFailureDiagnostic);
}

export function collectSessionFailureEvidence(input: BuildSessionFailureEvidenceInput): FailureEvidenceInput[] {
  const evidence: FailureEvidenceInput[] = [];
  for (const [name, collector] of Object.entries(input.snapshot?.collectors ?? {})) {
    if (collector.status === "ok") continue;
    const failed = collector.commands.find((command) => command.timedOut || (command.exitCode !== undefined && command.exitCode !== 0));
    evidence.push({
      id: `collector:${name}`,
      source: "assessment",
      severity: collector.status === "failed" ? "error" : "warning",
      categoryHint: "collector-failed",
      title: `${name} collection ${collector.status}`,
      whatFailed: `Read-only collector ${name} returned ${collector.status} evidence.`,
      whereFailed: `collector:${name}`,
      attempted: failed?.command ?? `Collect ${name} evidence`,
      message: collector.errors.join(" ") || collector.stderr || `Collector completeness was ${Math.round(collector.completeness * 100)}%.`,
      command: failed?.command,
      stderr: collector.stderr,
      exitCode: failed?.exitCode,
      timedOut: failed?.timedOut,
      beforeMutation: true,
      evidence: [{ id: `collector:${name}:status`, kind: "collector", source: "collector-envelope", label: `${name}: ${collector.status}`, value: `completeness=${collector.completeness}` }]
    });
  }
  for (const run of input.runs ?? []) evidence.push(...failureEvidenceFromRun(run));
  for (const run of input.actionRuns ?? []) {
    if (!["failed", "rollback-failed", "manual-required"].includes(run.status)) continue;
    evidence.push({
      id: `action-run:${run.id}`,
      source: run.status === "manual-required" ? "review" : "apply",
      severity: run.status === "rollback-failed" ? "critical" : "error",
      categoryHint: run.status === "manual-required" ? "manual-follow-up" : undefined,
      title: `Action ${run.actionId} ${run.status}`,
      whatFailed: run.error ?? run.applyResult?.message ?? `Action ${run.actionId} did not succeed.`,
      whereFailed: `Plan ${run.planId}, action ${run.actionId}`,
      attempted: run.commandSummaries.map((command) => command.command).join("; "),
      message: run.error,
      stdout: run.stdoutPreview,
      stderr: run.stderrPreview,
      exitCode: run.exitCode,
      evidence: [{ id: run.id, kind: "note", source: "ActionRunRecord", label: `ActionRunRecord ${run.status}`, value: `planHash=${run.planHash}` }]
    });
  }
  for (const decision of input.assessment?.requiredDecisions ?? []) {
    const text = `${decision.title} ${decision.reason} ${decision.defaultSafeChoice}`;
    if (!/backup freshness|secret|manual/i.test(text)) continue;
    evidence.push({
      id: `decision:${decision.id}`,
      source: "review",
      severity: /backup|data migration/i.test(text) ? "warning" : "error",
      categoryHint: /backup|data migration/i.test(text) ? "data-risk" : /secret/i.test(text) ? "secret-missing" : "manual-follow-up",
      title: decision.title,
      whatFailed: decision.reason,
      whereFailed: decision.relatedServiceStackIds.join(", "),
      impact: `Plan generation must retain the component as blocked, record-only, or manual until this decision is resolved.`,
      message: `Default safe choice: ${decision.defaultSafeChoice}`,
      beforeMutation: true,
      evidence: [{ id: decision.id, kind: "decision", source: "Assessment", label: decision.title, value: decision.defaultSafeChoice }]
    });
  }
  return dedupeInputs(evidence);
}

function failureEvidenceFromRun(run: StoredMigrationSessionRun): FailureEvidenceInput[] {
  if (run.status !== "failed" && run.status !== "blocked") return [];
  const result = asRecord(run.result);
  const checks = Array.isArray(result?.checks) ? result.checks.map(asRecord).filter(Boolean) : [];
  const failedChecks = checks.filter((check) => check?.status === "failed" || check?.ok === false || nonZero(check?.exitCode));
  if (failedChecks.length > 0) return failedChecks.map((check, index) => ({
    id: `session-run:${run.id}:check:${index}`,
    source: run.kind === "verify" ? "verify" : run.kind === "dry-run" ? "plan" : "apply",
    severity: "error",
    categoryHint: run.kind === "verify" ? "verification-failed" : undefined,
    title: stringValue(check?.label) || `${run.kind} check failed`,
    whatFailed: stringValue(check?.message) || stringValue(check?.label) || `${run.kind} check failed.`,
    whereFailed: stringValue(check?.itemName) || `Migration session ${run.sessionId}`,
    attempted: stringValue(check?.command),
    command: stringValue(check?.command),
    stdout: stringValue(check?.stdout),
    stderr: stringValue(check?.stderr),
    exitCode: numberValue(check?.exitCode),
    serviceName: stringValue(check?.itemName),
    beforeMutation: run.kind === "dry-run"
  }));
  return [{
    id: `session-run:${run.id}`,
    source: run.kind === "verify" ? "verify" : run.kind === "report" ? "report" : run.kind === "dry-run" ? "plan" : "apply",
    severity: run.status === "blocked" ? "warning" : "error",
    categoryHint: run.kind === "verify" ? "verification-failed" : undefined,
    title: `${run.kind} ${run.status}`,
    whatFailed: stringValue(result?.error) || stringValue(result?.message) || `Migration ${run.kind} did not complete successfully.`,
    whereFailed: `Migration session ${run.sessionId}`,
    message: JSON.stringify(run.summary ?? {}),
    beforeMutation: run.kind === "dry-run"
  }];
}

function classifyFailure(text: string, source: FailureSource): FailureCategory {
  if (/nginx\s+-t|nginx.*config.*valid|configuration.*invalid/i.test(text)) return "config-invalid";
  if (/artifact.*(?:missing|not found|hash|tamper)|sha-?256.*mismatch/i.test(text)) return "missing-artifact";
  if (/permission denied|eacces|operation not permitted/i.test(text)) return "permission-denied";
  if (/secret.*(?:missing|not found|required)|missing.*(?:token|password|credential|\.env)/i.test(text)) return "secret-missing";
  if (/backup freshness|backup.*unknown|data strategy|stateful data/i.test(text)) return "data-risk";
  if (/collector|collection.*(?:partial|failed|timeout)/i.test(text)) return "collector-failed";
  if (/connection refused|network unreachable|host unreachable|ssh timeout/i.test(text)) return "network-unreachable";
  if (/service.*(?:unhealthy|inactive|failed)|healthcheck.*failed/i.test(text)) return source === "verify" ? "verification-failed" : "service-unhealthy";
  if (source === "verify") return "verification-failed";
  if (/validation.*failed/i.test(text)) return "validation-failed";
  if (/exit code|command.*failed/i.test(text)) return "command-failed";
  return "unknown";
}

function profileFor(category: FailureCategory, text: string, input: FailureEvidenceInput) {
  const nginx = category === "config-invalid" && /nginx/i.test(text);
  if (nginx) return {
    severity: "error" as const,
    title: "Nginx configuration validation failed",
    summary: "The generated Nginx configuration did not pass validation before reload.",
    impact: "Nginx was not reloaded. Existing target service state was not changed by the failed validation step.",
    likelyCauses: [
      "Referenced certificate path does not exist on the target.",
      "An included upstream configuration was not migrated.",
      "The target Nginx version does not support a directive."
    ],
    retry: { allowed: false, reason: "Do not retry until the configuration or missing dependencies have been reviewed in a new approved Plan." },
    skip: { allowed: true, reason: "The HTTPS block may be kept as manual follow-up or record-only; skipping does not mutate the target." }
  };
  const profiles: Record<FailureCategory, { severity: FailureSeverity; title: string; summary: string; impact: string; likelyCauses: string[]; retry: { allowed: boolean; reason: string }; skip: { allowed: boolean; reason: string } }> = {
    "collector-failed": { severity: "warning", title: "Read-only evidence collection was incomplete", summary: "A collector returned partial or failed evidence.", impact: "Missing evidence cannot be treated as proof that the component is absent; planning may be blocked.", likelyCauses: ["The command timed out.", "The collector lacked permission.", "The relevant tool is unavailable or returned an error."], retry: { allowed: true, reason: "Re-running the read-only assessment is safe and does not claim a real Apply." }, skip: { allowed: true, reason: "Keep the area as unknown/manual rather than assuming absence." } },
    "config-invalid": { severity: "error", title: "Configuration validation failed", summary: "A proposed configuration did not pass its validation command.", impact: "The dependent service must not be reloaded with invalid configuration.", likelyCauses: ["A referenced path or include is missing.", "The target version rejects a directive.", "The generated configuration is incomplete."], retry: { allowed: false, reason: "Review the diff and create a reviewed repair Plan before retrying target-changing work." }, skip: { allowed: true, reason: "Mark the component manual or record-only without changing the target." } },
    "command-failed": { severity: "error", title: "Command execution failed", summary: "A managed step returned a non-zero result.", impact: "The action did not complete; inspect its ActionRunRecord before choosing a safe next step.", likelyCauses: ["A dependency is missing.", "The command lacked permission.", "The target state differed from the reviewed assumptions."], retry: { allowed: false, reason: "Retry must use an explicit reviewed policy and the original immutable Plan context." }, skip: { allowed: true, reason: "Mark manual only when the remaining Plan can stay safe without this action." } },
    "missing-artifact": { severity: "critical", title: "Approved artifact is unavailable or invalid", summary: "An artifact required by the immutable Plan could not be verified.", impact: "Execution is blocked before unverified content can be used.", likelyCauses: ["Artifact storage is unavailable.", "The artifact was removed.", "The artifact content hash no longer matches."], retry: { allowed: false, reason: "Restore the exact approved artifact or create and approve a new Plan revision." }, skip: { allowed: false, reason: "Skipping would break the approved Plan integrity boundary." } },
    "permission-denied": { severity: "error", title: "Permission denied", summary: "The requested read or managed step lacked sufficient permission.", impact: "The affected evidence or action is incomplete.", likelyCauses: ["The SSH user lacks permission.", "sudo is unavailable or requires interaction.", "The path is protected by host policy."], retry: { allowed: false, reason: "Review permissions first; do not broaden privileges automatically." }, skip: { allowed: true, reason: "Keep the item unknown/manual if stronger permission is not approved." } },
    "secret-missing": { severity: "error", title: "Required secret is missing", summary: "A service cannot be safely reconstructed without an out-of-band secret decision.", impact: "The service remains blocked or record-only; EnvForge will not invent or expose a secret.", likelyCauses: ["The target secret was not provisioned.", "A referenced environment key is absent.", "Secret-manager integration is not configured."], retry: { allowed: false, reason: "Provision the secret through an approved out-of-band process before creating a new Plan." }, skip: { allowed: true, reason: "Record the service without staging automated migration actions." } },
    "data-risk": { severity: "warning", title: "Stateful data safety is unresolved", summary: "Backup freshness or the data migration strategy has not been confirmed.", impact: "The component must remain blocked, manual, or record-only until data safety is reviewed.", likelyCauses: ["Backup freshness is unknown.", "Restore compatibility is unverified.", "Data volume or consistency requirements are unknown."], retry: { allowed: false, reason: "This is a review decision, not a retryable command failure." }, skip: { allowed: true, reason: "Record-only is the safe default until backup evidence is confirmed." } },
    "verification-failed": { severity: "error", title: "Post-apply verification failed", summary: "A verification check did not confirm the expected target state.", impact: "The Apply result cannot be considered verified; rollback availability depends on recorded action boundaries.", likelyCauses: ["The service is inactive or unhealthy.", "A port or dependency is unavailable.", "The verification expectation no longer matches target state."], retry: { allowed: false, reason: "Inspect evidence first; any retry must remain bound to approved execution context." }, skip: { allowed: true, reason: "Mark manual follow-up only with an explicit unresolved verification warning." } },
    "service-unhealthy": { severity: "error", title: "Service health check failed", summary: "The service did not reach the expected healthy state.", impact: "Dependent workloads may be unavailable or degraded.", likelyCauses: ["The service failed to start.", "A dependency is unavailable.", "Configuration or data compatibility failed."], retry: { allowed: false, reason: "Inspect health evidence before any reviewed retry." }, skip: { allowed: true, reason: "Mark manual with a visible unresolved impact." } },
    "network-unreachable": { severity: "error", title: "Target network is unreachable", summary: "EnvForge could not reach the expected host or service.", impact: "The affected operation or verification could not complete.", likelyCauses: ["Firewall or routing blocks access.", "The target is offline.", "Connection details are stale."], retry: { allowed: true, reason: "Retry only after connectivity is restored; real Apply still requires its original claim policy." }, skip: { allowed: true, reason: "Defer and keep the result unverified." } },
    "validation-failed": { severity: "error", title: "Validation failed", summary: "A safety validation did not pass.", impact: "The following mutation must remain blocked.", likelyCauses: ["The candidate configuration is invalid.", "A dependency is missing.", "Target assumptions are stale."], retry: { allowed: false, reason: "Correct the candidate in a reviewed Plan revision before retry." }, skip: { allowed: true, reason: "Keep the step manual without applying the invalid candidate." } },
    "missing-dependency": { severity: "error", title: "Required dependency is missing", summary: "A required executable, service, path, or include was not found.", impact: "The dependent action cannot complete safely.", likelyCauses: ["The dependency was not migrated.", "The target layout differs.", "The capability is unsupported on this target."], retry: { allowed: false, reason: "Add the dependency through a reviewed Plan." }, skip: { allowed: true, reason: "Keep the dependent component manual or record-only." } },
    "rollback-required": { severity: "critical", title: "Rollback review is required", summary: "Recorded evidence indicates a target-changing action may need rollback.", impact: "Target state may be partially changed.", likelyCauses: ["A failure occurred after a write.", "Verification failed after apply."], retry: { allowed: false, reason: "Do not retry before rollback boundaries are reviewed." }, skip: { allowed: false, reason: "Skipping may leave an unsafe partial state." } },
    "manual-follow-up": { severity: "warning", title: "Manual follow-up is required", summary: "Automation cannot safely resolve this item from current evidence.", impact: "The item remains unresolved and must be visible in Plan/report review.", likelyCauses: ["Evidence is incomplete.", "No certified safe adapter exists.", "A human-owned policy decision is required."], retry: { allowed: false, reason: "This requires a human decision rather than automatic retry." }, skip: { allowed: true, reason: "Record-only or manual follow-up is allowed without target mutation." } },
    "unknown": { severity: input.severity ?? "error", title: "Unclassified failure", summary: "EnvForge recorded a failure that needs operator review.", impact: "The affected step remains unresolved; no recovery is assumed.", likelyCauses: ["The available evidence is insufficient to classify the failure."], retry: { allowed: false, reason: "Inspect the redacted evidence before deciding whether retry is safe." }, skip: { allowed: true, reason: "Mark manual if the unresolved impact is acceptable and documented." } }
  };
  return profiles[category];
}

function repairDraftFor(failureId: string, category: FailureCategory, text: string): RepairPlanDraft | undefined {
  const shared = [
    "This repair plan is a draft and must be reviewed before it can become an approved Environment Plan.",
    "No target command, Apply, or rollback is executed by generating this draft."
  ];
  if (category === "config-invalid" && /nginx/i.test(text)) return {
    id: `repair-draft:${failureId}`,
    title: "Repair Nginx configuration validation",
    status: "draft",
    summary: "Prepare reviewed changes that restore referenced dependencies and validate configuration before reload.",
    proposedSteps: [
      step("certificate", "Reissue or import the missing certificate on the target.", "high", true),
      step("config", "Update the Nginx server block to use a reviewed valid certificate path.", "medium", true),
      step("validate", "Run nginx -t before reload.", "low", false),
      step("reload", "Reload Nginx only after configuration validation passes.", "medium", true)
    ],
    safetyNotes: shared
  };
  if (["secret-missing", "missing-dependency", "verification-failed", "service-unhealthy", "command-failed"].includes(category)) return {
    id: `repair-draft:${failureId}`,
    title: `Repair ${category.replaceAll("-", " ")}`,
    status: "draft",
    summary: "Convert the recommended evidence-based corrections into a separately reviewed Environment Plan.",
    proposedSteps: [
      step("inspect", "Inspect the redacted failure evidence and confirm the root cause.", "low", false),
      step("correct", "Stage the minimum corrective change as an immutable Plan artifact/action.", "unknown", true),
      step("verify", "Add a validation check that must pass before any service reload or completion.", "low", false)
    ],
    safetyNotes: shared
  };
  return undefined;
}

function step(id: string, description: string, risk: "low" | "medium" | "high" | "unknown", targetChanging: boolean) {
  return { id, description, risk, requiresReview: true, wouldRequireApprovedPlan: targetChanging };
}

function actionsFor(category: FailureCategory, draft?: RepairPlanDraft): FailureRecommendedAction[] {
  const actions: FailureRecommendedAction[] = [
    { kind: "inspect-evidence", label: "Inspect evidence", description: "Review redacted command, collector, and ActionRunRecord evidence.", available: true },
    { kind: "export-support-bundle", label: "Export Support Bundle", description: "Export a redacted diagnostic bundle for team or maintainer review.", available: true },
    { kind: "mark-manual", label: "Mark manual follow-up", description: "Keep the item unresolved without mutating the target.", available: true }
  ];
  if (category === "config-invalid") actions.unshift({ kind: "view-diff", label: "View configuration diff", description: "Compare the approved candidate with target evidence before revising it.", available: true });
  if (category === "collector-failed") actions.unshift({ kind: "rerun-assessment", label: "Re-run read-only assessment", description: "Collect evidence again without creating a Plan or Apply Run.", available: true });
  if (category === "data-risk" || category === "secret-missing") actions.unshift({ kind: "update-decision", label: "Update review decision", description: "Record an explicit data or secret handling decision for future Plan generation.", available: true });
  actions.push(draft
    ? { kind: "generate-repair-plan-draft", label: "Generate Repair Plan draft", description: "Use these suggestions as input to a separately reviewed Environment Plan.", available: true }
    : { kind: "generate-repair-plan-draft", label: "Generate Repair Plan draft", description: "No safe automatic draft is available for this evidence.", available: false, unavailableReason: "Root cause must be classified first." });
  actions.push({ kind: "retry", label: "Retry", description: "Retry is not executed from diagnostics and must obey approved Plan claim/idempotency rules.", available: false, unavailableReason: "No safe retry endpoint is exposed by this baseline." });
  actions.push({ kind: "rollback", label: "Rollback", description: "Review the recorded rollback boundary; diagnostics do not execute rollback.", available: false, unavailableReason: "Automatic rollback is not provided by this baseline." });
  return actions;
}

function rollbackFor(input: FailureEvidenceInput, category: FailureCategory): FailureDiagnostic["rollback"] {
  if (input.beforeMutation) return { required: false, available: false, boundary: "Failure occurred before a target mutation or service reload; rollback is not required." };
  if (category === "config-invalid" && /nginx/i.test(`${input.title} ${input.whatFailed} ${input.command}`)) {
    return { required: false, available: false, boundary: "Configuration validation failed before Nginx reload. If a file write happened earlier, restore scope must be confirmed from ActionRunRecord evidence; no automatic recovery is claimed." };
  }
  if (category === "verification-failed") return { required: false, available: false, boundary: "Verification failed after Apply may indicate a partial target state. Rollback availability must be read from the approved Plan and ActionRunRecord; this diagnostic does not assume or execute rollback." };
  return { required: false, available: false, boundary: "The available evidence does not prove a rollback is required or available. Review ActionRunRecord boundaries before changing target state." };
}

function redactEvidence(items: FailureEvidenceRef[]): FailureEvidenceRef[] {
  return items.map((item) => ({ ...item, label: redactSecrets(item.label).text, value: item.value === undefined ? undefined : safePreview(item.value, 2000).text }));
}

function redactDiagnostic(diagnostic: FailureDiagnostic): FailureDiagnostic {
  const clean = <T extends string | undefined>(value: T): T => (value === undefined ? value : redactSecrets(value).text) as T;
  return {
    ...diagnostic,
    title: clean(diagnostic.title), summary: clean(diagnostic.summary), whatFailed: clean(diagnostic.whatFailed),
    whereFailed: clean(diagnostic.whereFailed), attempted: clean(diagnostic.attempted), impact: clean(diagnostic.impact),
    likelyCauses: diagnostic.likelyCauses.map((value) => clean(value)), evidence: redactEvidence(diagnostic.evidence),
    recommendedActions: diagnostic.recommendedActions.map((action) => ({ ...action, label: clean(action.label), description: clean(action.description), unavailableReason: clean(action.unavailableReason) })),
    repairPlanDraft: diagnostic.repairPlanDraft ? {
      ...diagnostic.repairPlanDraft,
      title: clean(diagnostic.repairPlanDraft.title), summary: clean(diagnostic.repairPlanDraft.summary),
      proposedSteps: diagnostic.repairPlanDraft.proposedSteps.map((value) => ({ ...value, description: clean(value.description) })),
      safetyNotes: diagnostic.repairPlanDraft.safetyNotes.map((value) => clean(value))
    } : undefined
  };
}

function dedupeInputs(inputs: FailureEvidenceInput[]): FailureEvidenceInput[] {
  return [...new Map(inputs.map((input) => [input.id ?? `${input.source}:${input.whatFailed}`, input])).values()];
}

function stableKey(value: string): string {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function stringValue(value: unknown): string | undefined { return typeof value === "string" ? value : undefined; }
function numberValue(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
function nonZero(value: unknown): boolean { return typeof value === "number" && value !== 0; }
