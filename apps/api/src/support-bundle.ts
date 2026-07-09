import { redactSecrets, safePreview, type ActionRunRecord } from "./action-runs.js";
import type { FailureDiagnostic } from "./failure-diagnostics.js";
import type { AssessmentSummary } from "./migration-assessment.js";
import type { InventoryGraph, ServiceStack } from "./inventory-graph.js";

export interface SupportBundlePlanMetadata {
  id: string;
  name?: string;
  type?: string;
  status?: string;
  planHash?: string;
  approvedPlanHash?: string;
  artifactHashes?: Array<{ id: string; kind?: string; contentSha256: string; storageRef?: string }>;
}

export interface SupportBundleApplyMetadata {
  applyRunId?: string;
  idempotencyKey?: string;
  status?: string;
  targetConnectionId?: string;
  createdAt?: string;
  completedAt?: string;
}

export interface SupportBundle {
  id: string;
  schemaVersion: "1.0";
  generatedAt: string;
  sessionId: string;
  goldenScenarioId?: string;
  source: { host?: string; os?: string; architecture?: string };
  plan?: SupportBundlePlanMetadata;
  apply?: SupportBundleApplyMetadata;
  actionRecords: Array<{
    id: string;
    planId: string;
    planHash: string;
    actionId: string;
    targetConnectionId: string;
    status: ActionRunRecord["status"];
    dryRun: boolean;
    startedAt: string;
    endedAt?: string;
    commands: ActionRunRecord["commandSummaries"];
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    error?: string;
    redacted: boolean;
  }>;
  snapshotSummary?: {
    capturedAt?: string;
    evidenceStatus: string;
    collectorCompleteness: number;
    collectors: AssessmentSummary["evidenceQuality"]["collectors"];
  };
  assessment?: {
    id: string;
    availability: AssessmentSummary["availability"];
    readiness: AssessmentSummary["readiness"];
    riskSummary: AssessmentSummary["riskSummary"];
    serviceStacks: AssessmentSummary["serviceStacks"];
  };
  /** Phase 6-B: enriched inventory graph evidence. */
  inventoryGraph?: InventoryGraph;
  /** Phase 6-B: enriched service stacks from the Inventory Graph engine. */
  enrichedStacks?: ServiceStack[];
  reviewDecisions: AssessmentSummary["requiredDecisions"];
  verification?: unknown;
  failureDiagnostics: FailureDiagnostic[];
  versions: { envForge?: string; catalog?: string };
  redaction: {
    applied: true;
    note: string;
    excluded: string[];
  };
  safetyBoundary: {
    readOnlyExport: true;
    approvalCreated: false;
    applyRunCreated: false;
    actionRunCreated: false;
    repairExecuted: false;
    rollbackExecuted: false;
    statements: string[];
  };
}

export interface BuildSupportBundleInput {
  sessionId: string;
  generatedAt?: string;
  goldenScenarioId?: string;
  assessment?: AssessmentSummary;
  /** Phase 6-B: inventory graph from the session snapshot. */
  inventoryGraph?: InventoryGraph;
  /** Phase 6-B: enriched service stacks from the Inventory Graph engine. */
  enrichedStacks?: ServiceStack[];
  plan?: SupportBundlePlanMetadata;
  apply?: SupportBundleApplyMetadata;
  actionRecords?: ActionRunRecord[];
  verification?: unknown;
  failureDiagnostics?: FailureDiagnostic[];
  envForgeVersion?: string;
  catalogVersion?: string;
}

const REDACTION_NOTE = "Sensitive values are redacted by default. Support Bundle export contains safe evidence summaries, hashes, counts, and paths; it excludes raw secrets and user data.";

export function buildSupportBundle(input: BuildSupportBundleInput): SupportBundle {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const assessment = input.assessment;
  const bundle: SupportBundle = {
    id: `support:${input.sessionId}:${generatedAt}`,
    schemaVersion: "1.0",
    generatedAt,
    sessionId: input.sessionId,
    goldenScenarioId: input.goldenScenarioId,
    source: {
      host: assessment?.source?.host,
      os: assessment?.source?.os,
      architecture: assessment?.source?.architecture
    },
    plan: input.plan ? {
      ...input.plan,
      artifactHashes: input.plan.artifactHashes?.map((artifact) => ({
        id: artifact.id,
        kind: artifact.kind,
        contentSha256: artifact.contentSha256,
        storageRef: artifact.storageRef
      }))
    } : undefined,
    apply: input.apply ? { ...input.apply } : undefined,
    actionRecords: (input.actionRecords ?? []).map(safeActionRecord),
    snapshotSummary: assessment ? {
      capturedAt: assessment.snapshot?.capturedAt,
      evidenceStatus: assessment.evidenceQuality.overallStatus,
      collectorCompleteness: assessment.evidenceQuality.completeness,
      collectors: assessment.evidenceQuality.collectors
    } : undefined,
    assessment: assessment ? {
      id: assessment.id,
      availability: assessment.availability,
      readiness: assessment.readiness,
      riskSummary: assessment.riskSummary,
      serviceStacks: assessment.serviceStacks
    } : undefined,
    inventoryGraph: input.inventoryGraph,
    enrichedStacks: input.enrichedStacks ?? assessment?.enrichedStacks,
    reviewDecisions: assessment?.requiredDecisions ?? [],
    verification: input.verification,
    failureDiagnostics: input.failureDiagnostics ?? [],
    versions: {
      envForge: input.envForgeVersion ?? assessment?.metadata.envForgeVersion ?? process.env.npm_package_version,
      catalog: input.catalogVersion ?? assessment?.metadata.catalogVersion ?? process.env.ENVFORGE_CATALOG_VERSION
    },
    redaction: {
      applied: true,
      note: REDACTION_NOTE,
      excluded: [
        "private key content",
        "full token and password values",
        "raw .env secret values",
        "database table contents",
        "application user data",
        "arbitrary home directory content"
      ]
    },
    safetyBoundary: {
      readOnlyExport: true,
      approvalCreated: false,
      applyRunCreated: false,
      actionRunCreated: false,
      repairExecuted: false,
      rollbackExecuted: false,
      statements: [
        "This Support Bundle was generated from stored evidence in read-only mode.",
        "No approval, Apply Run, or ActionRunRecord was created by this export.",
        "No target mutation was performed.",
        "Repair Plan suggestions remain drafts and were not executed.",
        "Rollback boundaries are explanatory; no rollback was executed by this export."
      ]
    }
  };
  return redactObject(bundle) as SupportBundle;
}

export function supportBundleToMarkdown(bundle: SupportBundle): string {
  const lines = [
    "# EnvForge Support Bundle",
    "",
    `- Bundle ID: \`${bundle.id}\``,
    `- Migration session: \`${bundle.sessionId}\``,
    `- Generated at: ${bundle.generatedAt}`,
    `- Source host: ${bundle.source.host ?? "unavailable"}`,
    `- EnvForge version: ${bundle.versions.envForge ?? "unavailable"}`,
    `- Catalog version: ${bundle.versions.catalog ?? "unavailable"}`,
    "",
    "## Safety boundary",
    "",
    ...bundle.safetyBoundary.statements.map((statement) => `> ${statement}`),
    "",
    "## Failure diagnostics",
    ""
  ];
  if (!bundle.failureDiagnostics.length) lines.push("No stored failure evidence was found for this session.", "");
  for (const diagnostic of bundle.failureDiagnostics) {
    lines.push(
      `### ${diagnostic.title}`,
      "",
      `- Category: ${diagnostic.category}`,
      `- Severity: ${diagnostic.severity}`,
      `- What failed: ${diagnostic.whatFailed}`,
      `- Where: ${diagnostic.whereFailed ?? "unavailable"}`,
      `- Attempted: ${diagnostic.attempted ?? "unavailable"}`,
      `- Impact: ${diagnostic.impact}`,
      `- Retry allowed: ${diagnostic.retry.allowed ? "yes" : "no"} — ${diagnostic.retry.reason}`,
      `- Skip allowed: ${diagnostic.skip.allowed ? "yes" : "no"} — ${diagnostic.skip.reason}`,
      `- Rollback: ${diagnostic.rollback.boundary}`,
      "",
      "Likely causes:"
    );
    lines.push(...diagnostic.likelyCauses.map((cause) => `- ${cause}`), "", "Recommended actions:");
    lines.push(...diagnostic.recommendedActions.map((action) => `- ${action.label}: ${action.available ? action.description : action.unavailableReason ?? "unavailable"}`), "");
    if (diagnostic.repairPlanDraft) {
      lines.push(`Repair Plan: **${diagnostic.repairPlanDraft.status}** — ${diagnostic.repairPlanDraft.summary}`, "");
      lines.push(...diagnostic.repairPlanDraft.safetyNotes.map((note) => `- ${note}`), "");
    }
  }
  lines.push(
    "## Evidence quality",
    "",
    `- Status: ${bundle.snapshotSummary?.evidenceStatus ?? "unavailable"}`,
    `- Collector completeness: ${bundle.snapshotSummary ? `${Math.round(bundle.snapshotSummary.collectorCompleteness * 100)}%` : "unavailable"}`,
    `- Service stacks: ${bundle.assessment?.serviceStacks.length ?? 0}`,
    `- Required review decisions: ${bundle.reviewDecisions.length}`,
    `- ActionRunRecord entries: ${bundle.actionRecords.length}`,
    "",
    "## Plan and Apply evidence",
    "",
    `- Plan ID: ${bundle.plan?.id ?? "unavailable"}`,
    `- planHash: ${bundle.plan?.planHash ?? "unavailable"}`,
    `- approvedPlanHash: ${bundle.plan?.approvedPlanHash ?? "unavailable"}`,
    `- Apply Run ID: ${bundle.apply?.applyRunId ?? "unavailable"}`,
    `- Idempotency key: ${bundle.apply?.idempotencyKey ?? "unavailable"}`,
    `- Artifact hashes: ${bundle.plan?.artifactHashes?.length ?? 0}`,
    "",
    "## Redaction",
    "",
    bundle.redaction.note,
    "",
    ...bundle.redaction.excluded.map((item) => `- Excluded: ${item}`),
    ""
  );
  return redactSecrets(lines.join("\n")).text;
}

function safeActionRecord(record: ActionRunRecord): SupportBundle["actionRecords"][number] {
  return {
    id: record.id,
    planId: record.planId,
    planHash: record.planHash,
    actionId: record.actionId,
    targetConnectionId: record.targetConnectionId,
    status: record.status,
    dryRun: record.dryRun,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    commands: record.commandSummaries.map((command) => ({ ...command, command: safePreview(command.command, 800).text })),
    stdout: record.stdoutPreview ? safePreview(record.stdoutPreview, 4000).text : undefined,
    stderr: record.stderrPreview ? safePreview(record.stderrPreview, 4000).text : undefined,
    exitCode: record.exitCode,
    error: record.error ? safePreview(record.error, 1600).text : undefined,
    redacted: true
  };
}

function redactObject(value: unknown): unknown {
  if (typeof value === "string") return redactSupportText(value);
  if (Array.isArray(value)) return value.map(redactObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, redactObject(item)]));
  }
  return value;
}

function redactSupportText(value: string): string {
  return redactSecrets(value).text.replace(
    /\b([a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:)([^@\s/]+)(@)/gi,
    "$1<REDACTED-URL-PASSWORD>$3"
  );
}
