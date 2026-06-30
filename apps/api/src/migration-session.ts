import type { FullSystemSnapshot } from "./collectors/remote-collector.js";
import {
  buildMigrationCandidateReport,
  buildMigrationPlanFromCandidates,
  type ConfigBundle,
  type MigrationCandidate,
  type MigrationCandidateReport,
  type MigrationDecisionPolicyContext,
  type MigrationPlan,
  type ReviewDecision
} from "./migration-classifier.js";
import { assessMigrationApplyReadiness, type MigrationApplyReadiness } from "./migration-apply-readiness.js";
import { buildUnknownReviewQueue, decisionMap, type MigrationReviewQueueItem } from "./migration-review.js";
import type {
  StoredMigrationConfigDecision,
  StoredMigrationDataDecision,
  StoredMigrationDecision,
  StoredMigrationSession,
  StoredProbeSnapshot
} from "./runtime-store.js";

export type MigrationSessionStatus = StoredMigrationSession["status"];
export type MigrationSessionStep = StoredMigrationSession["currentStep"];

export interface MigrationSessionSummary {
  totalCandidates: number;
  autoCandidates: number;
  reviewCandidates: number;
  manualCandidates: number;
  ignoredArtifacts: number;
  selectedCount: number;
  skippedCount: number;
  recordOnlyCount: number;
  pendingReviewCount: number;
  blockerCount: number;
  configRiskCount: number;
  secretOrBlockedConfigCount: number;
  dataReviewCount: number;
  planItemCount: number;
  applyBlockerCount: number;
}

export interface MigrationSessionView {
  id: string;
  userId: string;
  connectionId: string;
  targetConnectionId?: string;
  status: MigrationSessionStatus;
  currentStep: MigrationSessionStep;
  recommendedStep: MigrationSessionStep;
  recommendedStatus: MigrationSessionStatus;
  createdAt: string;
  updatedAt: string;
  lastSnapshotAt?: string;
  lastAnalysisAt?: string;
  lastPlanAt?: string;
  lastDryRunAt?: string;
  lastApplyAt?: string;
  lastVerifyAt?: string;
  lastReportAt?: string;
  summary: MigrationSessionSummary;
}

const selectedDecisions = new Set<ReviewDecision>(["approved", "add-to-plan", "migrate-artifact"]);
const skippedDecisions = new Set<ReviewDecision>(["skipped", "ignore"]);

export function initialMigrationSessionState(hasSnapshot: boolean): Pick<StoredMigrationSession, "status" | "currentStep"> {
  return hasSnapshot
    ? { status: "analysis-ready", currentStep: "analysis" }
    : { status: "created", currentStep: "source" };
}

export function buildMigrationSessionArtifacts(
  session: StoredMigrationSession,
  snapshot: FullSystemSnapshot | StoredProbeSnapshot | undefined,
  decisions: StoredMigrationDecision[],
  options: {
    host?: string;
    decisionPolicy?: MigrationDecisionPolicyContext;
    configDecisions?: StoredMigrationConfigDecision[];
    dataDecisions?: StoredMigrationDataDecision[];
  } = {}
): {
  view: MigrationSessionView;
  report?: MigrationCandidateReport;
  reviewQueue: MigrationReviewQueueItem[];
  plan?: MigrationPlan;
  readiness?: MigrationApplyReadiness;
} {
  const normalizedSnapshot = snapshot ? normalizeSessionSnapshot(snapshot) : undefined;
  const report = normalizedSnapshot ? buildMigrationCandidateReport(normalizedSnapshot, {
    host: options.host,
    decisionPolicy: options.decisionPolicy
  }) : undefined;
  const reviewQueue = report ? buildUnknownReviewQueue(report, decisions) : [];
  const plan = report ? buildMigrationPlanFromCandidates(report, decisionMap(decisions)) : undefined;
  const readiness = plan ? assessMigrationApplyReadiness(plan) : undefined;
  const summary = buildMigrationSessionSummary(
    report,
    decisions,
    reviewQueue,
    plan,
    readiness,
    options.configDecisions ?? [],
    options.dataDecisions ?? []
  );
  const recommendedStep = recommendedStepForSummary(Boolean(normalizedSnapshot), summary);
  const recommendedStatus = recommendedStatusForSummary(Boolean(normalizedSnapshot), summary);
  return {
    view: {
      id: session.id,
      userId: session.userId,
      connectionId: session.connectionId,
      targetConnectionId: session.targetConnectionId,
      status: session.status,
      currentStep: session.currentStep,
      recommendedStep,
      recommendedStatus,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastSnapshotAt: session.lastSnapshotAt,
      lastAnalysisAt: session.lastAnalysisAt,
      lastPlanAt: session.lastPlanAt,
      lastDryRunAt: session.lastDryRunAt,
      lastApplyAt: session.lastApplyAt,
      lastVerifyAt: session.lastVerifyAt,
      lastReportAt: session.lastReportAt,
      summary
    },
    report,
    reviewQueue,
    plan,
    readiness
  };
}

export function buildMigrationSessionSummary(
  report: MigrationCandidateReport | undefined,
  decisions: StoredMigrationDecision[],
  reviewQueue: MigrationReviewQueueItem[],
  plan: MigrationPlan | undefined,
  readiness: MigrationApplyReadiness | undefined,
  configDecisions: StoredMigrationConfigDecision[] = [],
  dataDecisions: StoredMigrationDataDecision[] = []
): MigrationSessionSummary {
  if (!report) {
    return {
      totalCandidates: 0,
      autoCandidates: 0,
      reviewCandidates: 0,
      manualCandidates: 0,
      ignoredArtifacts: 0,
      selectedCount: 0,
      skippedCount: 0,
      recordOnlyCount: 0,
      pendingReviewCount: 0,
      blockerCount: 0,
      configRiskCount: 0,
      secretOrBlockedConfigCount: 0,
      dataReviewCount: 0,
      planItemCount: 0,
      applyBlockerCount: 0
    };
  }

  const byCandidate = decisionMap(decisions);
  const selectedCandidates = report.candidates.filter((candidate) => selectedDecisions.has(byCandidate[candidate.id] ?? "pending"));
  const selectedCount = report.candidates.filter((candidate) => selectedDecisions.has(byCandidate[candidate.id] ?? "pending")).length;
  const skippedCount = report.candidates.filter((candidate) => skippedDecisions.has(byCandidate[candidate.id] ?? "pending")).length;
  const recordOnlyCount = report.candidates.filter((candidate) => byCandidate[candidate.id] === "record-only").length;
  const pendingReviewIds = new Set<string>();
  for (const candidate of report.candidates) {
    const decision = byCandidate[candidate.id] ?? "pending";
    if (decision === "pending" && (candidate.decisionBand === "review" || candidate.decisionBand === "manual" || (candidate.blockers?.length ?? 0) > 0)) {
      pendingReviewIds.add(candidate.id);
    }
  }
  for (const item of reviewQueue) {
    if ((byCandidate[item.candidate.id] ?? item.decision) === "pending") pendingReviewIds.add(item.candidate.id);
  }
  const relevantBundles = selectedCandidates.length
    ? dedupeBundles(selectedCandidates.flatMap((candidate) => candidate.configBundles ?? []))
    : [];
  const configByBundle = new Map(configDecisions.map((row) => [row.bundleId, row]));
  const unresolvedConfigBundles = relevantBundles.filter((bundle) => {
    if (!requiresConfigDecision(bundle)) return false;
    return configByBundle.get(bundle.id)?.status !== "approved";
  });
  const blockedConfigDecisionCount = relevantBundles.filter((bundle) => configByBundle.get(bundle.id)?.status === "blocked").length;
  const dataCandidates = selectedCandidates.filter(candidateRequiresDataDecision);
  const dataByCandidate = new Map(dataDecisions.map((row) => [row.candidateId, row]));
  const unresolvedDataCount = dataCandidates.filter((candidate) => dataByCandidate.get(candidate.id)?.status !== "confirmed").length;
  const blockedDataDecisionCount = dataCandidates.filter((candidate) => dataByCandidate.get(candidate.id)?.status === "blocked").length;
  const blockerCount =
    selectedCandidates.reduce((sum, candidate) => sum + (candidate.blockers?.length ?? 0), 0) +
    blockedConfigDecisionCount +
    blockedDataDecisionCount +
    unresolvedConfigBundles.filter((bundle) => bundle.sensitivity === "secret" || bundle.sensitivity === "blocked" || bundle.migrationStrategy === "blocked").length;
  const configRiskCount = unresolvedConfigBundles.filter((bundle) => bundle.riskLevel !== "safe" || bundle.migrationStrategy !== "omit-default").length;
  const secretOrBlockedConfigCount = unresolvedConfigBundles.filter((bundle) =>
    bundle.sensitivity === "secret" ||
    bundle.sensitivity === "blocked" ||
    bundle.migrationStrategy === "secret-out-of-band" ||
    bundle.migrationStrategy === "blocked"
  ).length;
  const dataReviewCount = unresolvedDataCount;

  return {
    totalCandidates: report.candidates.length,
    autoCandidates: report.candidates.filter((candidate) => candidate.decisionBand === "auto").length,
    reviewCandidates: report.candidates.filter((candidate) => candidate.decisionBand === "review").length,
    manualCandidates: report.candidates.filter((candidate) => candidate.decisionBand === "manual").length,
    ignoredArtifacts: report.normalizedArtifacts.filter((artifact) => !artifact.userFacing).length,
    selectedCount,
    skippedCount,
    recordOnlyCount,
    pendingReviewCount: pendingReviewIds.size,
    blockerCount,
    configRiskCount,
    secretOrBlockedConfigCount,
    dataReviewCount,
    planItemCount: plan?.items.length ?? 0,
    applyBlockerCount: (readiness?.blockers.length ?? 0) + pendingReviewIds.size + configRiskCount + secretOrBlockedConfigCount + dataReviewCount + blockerCount
  };
}

export function recommendedStepForSummary(hasSnapshot: boolean, summary: MigrationSessionSummary): MigrationSessionStep {
  if (!hasSnapshot) return "source";
  if (summary.totalCandidates === 0) return "analysis";
  if (summary.selectedCount === 0) return "select";
  if (summary.pendingReviewCount > 0) return "unknown";
  if (summary.blockerCount > 0 || summary.configRiskCount > 0 || summary.secretOrBlockedConfigCount > 0 || summary.dataReviewCount > 0) return "config-data";
  if (summary.planItemCount > 0) return "plan";
  return "analysis";
}

export function recommendedStatusForSummary(hasSnapshot: boolean, summary: MigrationSessionSummary): MigrationSessionStatus {
  if (!hasSnapshot) return "created";
  if (summary.selectedCount === 0 && summary.pendingReviewCount === 0) return "analysis-ready";
  if (summary.pendingReviewCount > 0) return "selection-in-progress";
  if (summary.blockerCount > 0 || summary.configRiskCount > 0 || summary.secretOrBlockedConfigCount > 0 || summary.dataReviewCount > 0) return "config-review-required";
  if (summary.planItemCount > 0) return "plan-ready";
  return "analysis-ready";
}

export function isMigrationSessionStep(value: unknown): value is MigrationSessionStep {
  return typeof value === "string" && ["source", "analysis", "select", "unknown", "config-data", "plan", "target", "apply", "report"].includes(value);
}

export function isMigrationSessionStatus(value: unknown): value is MigrationSessionStatus {
  return typeof value === "string" && [
    "created",
    "source-connected",
    "snapshot-collected",
    "analysis-ready",
    "selection-in-progress",
    "config-review-required",
    "plan-ready",
    "target-connected",
    "dry-run-passed",
    "applying",
    "applied",
    "verified",
    "reported",
    "failed",
    "rolled-back"
  ].includes(value);
}

function normalizeSessionSnapshot(snapshot: FullSystemSnapshot | StoredProbeSnapshot): FullSystemSnapshot {
  return {
    ...snapshot,
    counts: snapshot.counts ?? inferSnapshotCounts(snapshot)
  };
}

function inferSnapshotCounts(snapshot: FullSystemSnapshot | StoredProbeSnapshot): FullSystemSnapshot["counts"] {
  const countSource = (source: string) => snapshot.software.filter((item) => item.source === source).length;
  return {
    apt: countSource("apt"),
    rpm: countSource("rpm"),
    snap: countSource("snap"),
    flatpak: countSource("flatpak"),
    npm: countSource("npm"),
    pip: countSource("pip"),
    gem: countSource("gem"),
    cargo: countSource("cargo"),
    localBin: countSource("local-bin"),
    opt: countSource("opt"),
    userBin: countSource("user-bin"),
    nvm: countSource("nvm"),
    pyenv: countSource("pyenv"),
    docker: countSource("docker"),
    enabledServices: snapshot.software.filter((item) => item.source === "systemd" && item.status === "enabled").length,
    runningServices: snapshot.software.filter((item) => item.source === "systemd" && item.status === "running").length,
    total: snapshot.software.length
  };
}

function requiresConfigDecision(bundle: ConfigBundle): boolean {
  return bundle.riskLevel !== "safe" ||
    bundle.defaultStatus !== "default" ||
    bundle.sensitivity !== "safe" ||
    bundle.migrationStrategy !== "omit-default";
}

function candidateRequiresDataDecision(candidate: MigrationCandidate): boolean {
  return Boolean(
    (candidate.dataPaths?.length ?? 0) > 0 ||
    candidate.reviewReasons?.some((reason) => /data strategy|data paths|data directories|copy\/export strategy/i.test(reason))
  );
}

function dedupeBundles(bundles: ConfigBundle[]): ConfigBundle[] {
  return [...new Map(bundles.map((bundle) => [bundle.id, bundle])).values()];
}
