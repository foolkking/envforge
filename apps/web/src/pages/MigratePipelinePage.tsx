import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  Eye,
  FileText,
  MonitorCog,
  PackagePlus,
  Play,
  RefreshCw,
  Server,
  ShieldAlert,
  X
} from "lucide-react";
import {
  attachMigrationSessionSnapshot,
  createMigrationSession,
  createPlanFromMigrationSession,
  dryRunMigrationSession,
  fetchMigrationSessionApplyReadiness,
  fetchMigrationSessionAnalysis,
  fetchMigrationSessionConfigBundles,
  fetchMigrationSessionPlan,
  fetchMigrationSessionReport,
  saveMigrationSessionDecisions,
  saveMigrationSessionConfigDecision,
  saveMigrationSessionDataDecision,
  updateMigrationSession,
  verifyMigrationSession,
  type AgentProbeResult,
  type ConfigBundle,
  type ConnectionProfile,
  type MigrationApplyResult,
  type MigrationCandidate,
  type MigrationConfigDecision,
  type MigrationDataDecision,
  type MigrationDecision,
  type MigrationDryRunResult,
  type MigrationPlan,
  type MigrationReviewQueueItem,
  type MigrationSessionApplyReadiness,
  type MigrationSessionAnalysis,
  type MigrationSessionReport,
  type MigrationSessionStep,
  type MigrationSessionView,
  type MigrationVerificationRunResult,
  type ReviewDecision
} from "../api";
import type { Locale } from "../lib/types";
import { Button } from "../components/ui/Button";
import { MetricPill } from "../components/ui/MetricPill";
import { Card } from "../components/ui/Card";
import { FilterPill } from "../components/ui/FilterPill";
import { useEscapeToClose } from "../lib/useEscapeToClose";

const selectedDecisions = new Set<ReviewDecision>(["approved", "add-to-plan", "migrate-artifact"]);
const stepOrder: MigrationSessionStep[] = ["source", "analysis", "select", "unknown", "config-data", "plan", "target", "apply", "report"];

const STEP_LABEL_KEYS = {
  source: "migratePipeline.steps.source",
  analysis: "migratePipeline.steps.analysis",
  select: "migratePipeline.steps.select",
  unknown: "migratePipeline.steps.unknown",
  "config-data": "migratePipeline.steps.configData",
  plan: "migratePipeline.steps.plan",
  target: "migratePipeline.steps.target",
  apply: "migratePipeline.steps.apply",
  report: "migratePipeline.steps.report"
} as const satisfies Record<MigrationSessionStep, string>;

const CONNECTION_STATUS_KEYS = {
  probed: "migratePipeline.connectionStatuses.probed",
  ssh_ok: "migratePipeline.connectionStatuses.sshOk",
  validated: "migratePipeline.connectionStatuses.validated",
  ssh_failed: "migratePipeline.connectionStatuses.sshFailed",
  unreachable: "migratePipeline.connectionStatuses.unreachable"
} as const satisfies Record<ConnectionProfile["status"], string>;

const GROUP_LABEL_KEYS = {
  all: "migratePipeline.groups.all", web: "migratePipeline.groups.web", database: "migratePipeline.groups.database",
  runtime: "migratePipeline.groups.runtime", container: "migratePipeline.groups.container", security: "migratePipeline.groups.security",
  manual: "migratePipeline.groups.manual", unknown: "migratePipeline.groups.unknown"
} as const;

const DECISION_LABEL_KEYS = {
  pending: "migratePipeline.decisions.pending",
  approved: "migratePipeline.decisions.approved",
  skipped: "migratePipeline.decisions.skipped",
  ignore: "migratePipeline.decisions.ignore",
  "record-only": "migratePipeline.decisions.recordOnly",
  "migrate-artifact": "migratePipeline.decisions.migrateArtifact",
  "create-catalog-draft": "migratePipeline.decisions.createCatalogDraft",
  "add-to-plan": "migratePipeline.decisions.addToPlan",
  "needs-manual-instruction": "migratePipeline.decisions.needsManualInstruction"
} as const satisfies Record<ReviewDecision, string>;

const RISK_LABEL_KEYS = {
  safe: "migratePipeline.risks.safe",
  review: "migratePipeline.risks.review",
  privileged: "migratePipeline.risks.privileged",
  dangerous: "migratePipeline.risks.dangerous"
} as const satisfies Record<MigrationCandidate["riskLevel"], string>;

const PLAN_GROUP_LABEL_KEYS = {
  Packages: "migratePipeline.planPreview.groups.Packages",
  Services: "migratePipeline.planPreview.groups.Services",
  Configs: "migratePipeline.planPreview.groups.Configs",
  Data: "migratePipeline.planPreview.groups.Data",
  Verification: "migratePipeline.planPreview.groups.Verification",
  Rollback: "migratePipeline.planPreview.groups.Rollback",
  Review: "migratePipeline.planPreview.groups.Review"
} as const;

export function MigratePipelinePage({
  locale,
  authToken,
  connectionId,
  activeConnection,
  activeProbe,
  connected,
  connections,
  onCollectSnapshot,
  onOpenHostDetails,
  pushLog,
  onPlanCreated
}: {
  locale: Locale;
  authToken: string;
  connectionId: string | null;
  activeConnection?: ConnectionProfile;
  activeProbe?: AgentProbeResult | null;
  connected: boolean;
  connections: ConnectionProfile[];
  onCollectSnapshot: () => Promise<void>;
  onOpenHostDetails: () => void;
  pushLog?: (type: "info" | "success" | "error" | "cmd", text: string) => void;
  /** Phase 3: after the migration plan is promoted into the Plan center. */
  onPlanCreated?: (planId: string) => void;
}) {
  const { t } = useTranslation();
  const [session, setSession] = useState<MigrationSessionView | null>(null);
  const [analysis, setAnalysis] = useState<MigrationSessionAnalysis | null>(null);
  const [configBundles, setConfigBundles] = useState<ConfigBundle[]>([]);
  const [configDecisions, setConfigDecisions] = useState<MigrationConfigDecision[]>([]);
  const [dataDecisions, setDataDecisions] = useState<MigrationDataDecision[]>([]);
  const [plan, setPlan] = useState<MigrationPlan | null>(null);
  const [dryRun, setDryRun] = useState<MigrationDryRunResult | null>(null);
  const [applyReadiness, setApplyReadiness] = useState<MigrationSessionApplyReadiness | null>(null);
  const [applyResult, setApplyResult] = useState<MigrationApplyResult | null>(null);
  const [verifyResult, setVerifyResult] = useState<MigrationVerificationRunResult | null>(null);
  const [report, setReport] = useState<MigrationSessionReport | null>(null);
  const [activeStep, setActiveStep] = useState<MigrationSessionStep>("source");
  const [loading, setLoading] = useState(false);
  const [stepLoading, setStepLoading] = useState(false);
  const [error, setError] = useState("");
  const [creatingPlan, setCreatingPlan] = useState(false);

  useEffect(() => {
    setAnalysis(null);
    setConfigBundles([]);
    setConfigDecisions([]);
    setDataDecisions([]);
    setPlan(null);
    setDryRun(null);
    setApplyReadiness(null);
    setApplyResult(null);
    setVerifyResult(null);
    setReport(null);
    if (!authToken || !connectionId) {
      setSession(null);
      setActiveStep("source");
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const next = await createMigrationSession(authToken, { connectionId, reuseLatest: true });
        if (cancelled) return;
        setSession(next);
        setActiveStep(next.currentStep);
        if (activeProbe) await loadAnalysis(next.id, cancelled);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t("migratePipeline.errors.createSession"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authToken, connectionId]);

  useEffect(() => {
    if (!session || !activeProbe) return;
    void loadAnalysis(session.id);
  }, [activeProbe?.collectedAt, session?.id]);

  useEffect(() => {
    if (!session) return;
    if (activeStep === "config-data") void loadConfigBundles(session.id);
    if (activeStep === "plan") void loadPlan(session.id);
    if (activeStep === "apply") void loadApplyReadiness(session.id);
    if (activeStep === "report") void loadReport(session.id);
  }, [activeStep, session?.id]);

  async function loadAnalysis(sessionId: string, cancelled = false) {
    try {
      const next = await fetchMigrationSessionAnalysis(authToken, sessionId);
      if (cancelled) return;
      setAnalysis(next);
      setSession(next.session);
    } catch {
      if (!cancelled) setAnalysis(null);
    }
  }

  async function loadConfigBundles(sessionId: string) {
    setStepLoading(true);
    setError("");
    try {
      const next = await fetchMigrationSessionConfigBundles(authToken, sessionId);
      setConfigBundles(next.configBundles);
      setConfigDecisions(next.configDecisions ?? []);
      setDataDecisions(next.dataDecisions ?? []);
      setSession(next.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("migratePipeline.errors.loadConfig"));
    } finally {
      setStepLoading(false);
    }
  }

  async function loadPlan(sessionId: string) {
    setStepLoading(true);
    setError("");
    try {
      const next = await fetchMigrationSessionPlan(authToken, sessionId);
      setPlan(next.plan);
      setSession(next.session);
    } catch (err) {
      setPlan(null);
      setError(err instanceof Error ? err.message : t("migratePipeline.errors.loadPlan"));
    } finally {
      setStepLoading(false);
    }
  }

  async function loadApplyReadiness(sessionId: string) {
    setStepLoading(true);
    setError("");
    try {
      const next = await fetchMigrationSessionApplyReadiness(authToken, sessionId);
      setSession(next.session);
      setApplyReadiness(next.readiness);
    } catch (err) {
      setApplyReadiness(null);
      setError(err instanceof Error ? err.message : t("migratePipeline.errors.loadReadiness"));
    } finally {
      setStepLoading(false);
    }
  }

  async function loadReport(sessionId: string) {
    setStepLoading(true);
    setError("");
    try {
      const next = await fetchMigrationSessionReport(authToken, sessionId);
      setSession(next.session);
      setReport(next.report);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : t("migratePipeline.errors.loadReport"));
    } finally {
      setStepLoading(false);
    }
  }

  async function goStep(step: MigrationSessionStep) {
    setActiveStep(step);
    if (!session) return;
    try {
      const next = await updateMigrationSession(authToken, session.id, { currentStep: step });
      setSession(next);
    } catch {
      // Local step changes should still work if the session update races with a refresh.
    }
  }

  // Phase 3: promote this migration session into a first-class Environment
  // Plan and hand off to the Plan center, which owns review / apply / verify
  // / report through the unified engine.
  async function promoteToPlanCenter(targetConnectionId: string) {
    if (!session) return;
    setCreatingPlan(true);
    setError("");
    try {
      const { plan } = await createPlanFromMigrationSession(authToken, session.id, targetConnectionId);
      pushLog?.("success", t("migratePipeline.logs.planCreated"));
      onPlanCreated?.(plan.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("migratePipeline.errors.createPlan"));
    } finally {
      setCreatingPlan(false);
    }
  }

  async function collectAndAttachSnapshot() {
    if (!connectionId || !authToken) return;
    setStepLoading(true);
    setError("");
    try {
      await onCollectSnapshot();
      const current = session ?? await createMigrationSession(authToken, { connectionId, reuseLatest: true });
      const next = await attachMigrationSessionSnapshot(authToken, current.id);
      setSession(next.session);
      if (next.report) {
        setAnalysis({ session: next.session, report: next.report, reviewQueue: [], decisions: [] });
      }
      setActiveStep("analysis");
      pushLog?.("success", t("migratePipeline.logs.snapshotAttached"));
      await loadAnalysis(current.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("migratePipeline.errors.snapshot"));
      pushLog?.("error", err instanceof Error ? err.message : t("migratePipeline.errors.snapshot"));
    } finally {
      setStepLoading(false);
    }
  }

  async function saveDecision(input: { candidateId?: string; candidateIds?: string[]; decision: ReviewDecision }) {
    if (!session) return;
    setStepLoading(true);
    setError("");
    try {
      const result = await saveMigrationSessionDecisions(authToken, session.id, input);
      setSession(result.session);
      await loadAnalysis(session.id);
      pushLog?.("success", `migration decision: ${input.decision}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("migratePipeline.errors.saveDecision"));
    } finally {
      setStepLoading(false);
    }
  }

  async function saveConfigDecision(input: { bundleId: string; strategy: ConfigBundle["migrationStrategy"]; status: "approved" | "blocked"; note?: string }) {
    if (!session) return;
    setStepLoading(true);
    setError("");
    try {
      const result = await saveMigrationSessionConfigDecision(authToken, session.id, input);
      setSession(result.session);
      setConfigDecisions(result.configDecisions);
      setDataDecisions(result.dataDecisions);
      await loadConfigBundles(session.id);
      pushLog?.("success", `config decision: ${input.bundleId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("migratePipeline.errors.saveConfig"));
    } finally {
      setStepLoading(false);
    }
  }

  async function saveDataDecision(input: { candidateId: string; strategy: "no-data" | "backup-restore" | "rsync-copy" | "export-import" | "manual" | "external"; status: "confirmed" | "blocked"; paths?: string[]; note?: string }) {
    if (!session) return;
    setStepLoading(true);
    setError("");
    try {
      const result = await saveMigrationSessionDataDecision(authToken, session.id, input);
      setSession(result.session);
      setConfigDecisions(result.configDecisions);
      setDataDecisions(result.dataDecisions);
      await loadConfigBundles(session.id);
      pushLog?.("success", `data decision: ${input.candidateId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("migratePipeline.errors.saveData"));
    } finally {
      setStepLoading(false);
    }
  }

  async function selectTarget(targetConnectionId: string) {
    if (!session) return;
    setStepLoading(true);
    setError("");
    try {
      const next = await updateMigrationSession(authToken, session.id, { targetConnectionId, currentStep: "target", status: "target-connected" });
      setSession(next);
      setActiveStep("target");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("migratePipeline.errors.target"));
    } finally {
      setStepLoading(false);
    }
  }

  async function runDryRun() {
    if (!session) return;
    setStepLoading(true);
    setError("");
    try {
      const next = await dryRunMigrationSession(authToken, session.id);
      setSession(next.session);
      setDryRun(next.result);
      setActiveStep(next.session.currentStep);
      pushLog?.("success", t("migratePipeline.logs.dryRunDone"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("migratePipeline.errors.dryRun"));
    } finally {
      setStepLoading(false);
    }
  }

  async function runApply() {
    if (!session?.targetConnectionId) return;
    setStepLoading(true);
    setError("");
    try {
      await promoteToPlanCenter(session.targetConnectionId);
      pushLog?.("success", t("migratePipeline.logs.planCreated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("migratePipeline.errors.createPlan"));
    } finally {
      setStepLoading(false);
    }
  }

  async function runVerify() {
    if (!session) return;
    setStepLoading(true);
    setError("");
    try {
      const next = await verifyMigrationSession(authToken, session.id);
      setSession(next.session);
      setVerifyResult(next.result);
      setActiveStep(next.session.currentStep);
      pushLog?.("success", next.result.ok ? "migration verify passed" : "migration verify finished with failures");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("migratePipeline.errors.verify"));
    } finally {
      setStepLoading(false);
    }
  }

  const summary = session?.summary;
  const decisionByCandidate = useMemo(() => {
    const map: Record<string, MigrationDecision> = {};
    for (const row of analysis?.decisions ?? []) map[row.candidateId] = row;
    return map;
  }, [analysis?.decisions]);

  const content = (() => {
    if (!authToken) return <EmptyPipelineState title={t("migratePipeline.shell.loginTitle")} body={t("migratePipeline.shell.loginBody")} />;
    if (!connectionId) return <EmptyPipelineState title={t("migratePipeline.shell.sourceTitle")} body={t("migratePipeline.shell.sourceBody")} />;
    if (loading) return <EmptyPipelineState title={t("migratePipeline.shell.openingTitle")} body={t("migratePipeline.shell.openingBody")} />;

    switch (activeStep) {
      case "source":
        return (
          <SourceStep
            connection={activeConnection}
            probe={activeProbe ?? null}
            connected={connected}
            loading={stepLoading}
            onCollect={() => void collectAndAttachSnapshot()}
            onOpenHostDetails={onOpenHostDetails}
          />
        );
      case "analysis":
        return <AnalysisStep session={session} analysis={analysis} onRefresh={() => session && void loadAnalysis(session.id)} onContinue={() => void goStep("select")} />;
      case "select":
        return <CapabilitySelectionStep analysis={analysis} decisions={decisionByCandidate} loading={stepLoading} onDecision={saveDecision} />;
      case "unknown":
        return <UnknownReviewStep queue={analysis?.reviewQueue ?? []} decisions={decisionByCandidate} loading={stepLoading} onDecision={saveDecision} />;
      case "config-data":
        return (
          <ConfigDataReviewStep
            analysis={analysis}
            configBundles={configBundles}
            configDecisions={configDecisions}
            dataDecisions={dataDecisions}
            loading={stepLoading}
            onRefresh={() => session && void loadConfigBundles(session.id)}
            onConfigDecision={saveConfigDecision}
            onDataDecision={saveDataDecision}
          />
        );
      case "plan":
        return (
          <PlanPreviewStep
            session={session}
            plan={plan}
            loading={stepLoading}
            onRefresh={() => session && void loadPlan(session.id)}
            connections={connections}
            sourceConnectionId={connectionId}
            creating={creatingPlan}
            onCreatePlan={promoteToPlanCenter}
          />
        );
      case "target":
        return (
          <TargetDryRunStep
            sourceConnectionId={connectionId}
            session={session}
            connections={connections}
            dryRun={dryRun}
            loading={stepLoading}
            onSelectTarget={(id) => void selectTarget(id)}
            onDryRun={() => void runDryRun()}
          />
        );
      case "apply":
        return (
          <ApplyReportStep
            mode="apply"
            session={session}
            dryRun={dryRun}
            readiness={applyReadiness}
            applyResult={applyResult}
            verifyResult={verifyResult}
            report={report}
            loading={stepLoading}
            onRefreshReadiness={() => session && void loadApplyReadiness(session.id)}
            onApply={() => void runApply()}
            onVerify={() => void runVerify()}
            onReport={() => session && void loadReport(session.id)}
          />
        );
      case "report":
        return (
          <ApplyReportStep
            mode="report"
            session={session}
            dryRun={dryRun}
            readiness={applyReadiness}
            applyResult={applyResult}
            verifyResult={verifyResult}
            report={report}
            loading={stepLoading}
            onRefreshReadiness={() => session && void loadApplyReadiness(session.id)}
            onApply={() => void runApply()}
            onVerify={() => void runVerify()}
            onReport={() => session && void loadReport(session.id)}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <section className="migrate-pipeline-page">
      <MigrateStepHeader activeStep={activeStep} session={session} onStep={(step) => void goStep(step)} />
      <StagedPlanBar session={session} onRecommended={() => session && void goStep(session.recommendedStep)} onPlan={() => void goStep("plan")} />
      {error ? <div className="pipeline-error"><AlertTriangle aria-hidden />{error}</div> : null}
      {content}
      {summary && !error ? (
        <div className="pipeline-footnote">
          {t("migratePipeline.shell.footnote", { selected: summary.selectedCount, pending: summary.pendingReviewCount, blockers: summary.blockerCount })}
        </div>
      ) : null}
    </section>
  );
}

function MigrateStepHeader({
  activeStep,
  session,
  onStep
}: {
  activeStep: MigrationSessionStep;
  session: MigrationSessionView | null;
  onStep: (step: MigrationSessionStep) => void;
}) {
  const { t } = useTranslation();
  const activeIndex = stepOrder.indexOf(activeStep);

  // The migrate flow splits at "plan": everything up to and including the
  // plan is "produce the plan"; the rest is "deliver" (target/apply/report).
  // Visual segmentation only — step logic and order are unchanged.
  const renderTab = (step: MigrationSessionStep) => {
    const index = stepOrder.indexOf(step);
    const blocked = !session && step !== "source";
    const state = step === activeStep ? "active" : index < activeIndex ? "done" : blocked ? "blocked" : "todo";
    return (
      <li key={step}>
        <button type="button" className={`migrate-step-tab ${state}`} disabled={blocked} onClick={() => onStep(step)}>
          <span>{index + 1}</span>
          {t(STEP_LABEL_KEYS[step])}
        </button>
      </li>
    );
  };

  const planIndex = stepOrder.indexOf("plan");
  const produceSteps = stepOrder.slice(0, planIndex + 1);
  const deliverSteps = stepOrder.slice(planIndex + 1);

  return (
    <header className="migrate-step-header">
      <div>
        <p className="eyebrow">{t("migratePipeline.header.eyebrow")}</p>
        <h2>{t(STEP_LABEL_KEYS[activeStep])}</h2>
      </div>
      <div className="migrate-step-segments">
        <div className="migrate-step-segment">
          <span className="migrate-step-segment-label">{t("migratePipeline.header.produce")}</span>
          <ol className="migrate-step-tabs">{produceSteps.map(renderTab)}</ol>
        </div>
        <div className="migrate-step-segment migrate-step-segment-deliver">
          <span className="migrate-step-segment-label">{t("migratePipeline.header.deliver")}</span>
          <ol className="migrate-step-tabs">{deliverSteps.map(renderTab)}</ol>
        </div>
      </div>
    </header>
  );
}

function StagedPlanBar({
  session,
  onRecommended,
  onPlan
}: {
  session: MigrationSessionView | null;
  onRecommended: () => void;
  onPlan: () => void;
}) {
  const { t } = useTranslation();
  const summary = session?.summary;
  return (
    <div className="staged-plan-bar">
      <div className="staged-plan-metrics">
        <Metric label={t("migratePipeline.staged.selected")} value={summary?.selectedCount ?? 0} />
        <Metric label={t("migratePipeline.staged.pending")} value={summary?.pendingReviewCount ?? 0} tone={(summary?.pendingReviewCount ?? 0) > 0 ? "warn" : "safe"} />
        <Metric label={t("migratePipeline.staged.blockers")} value={summary?.blockerCount ?? 0} tone={(summary?.blockerCount ?? 0) > 0 ? "danger" : "safe"} />
        <Metric label={t("migratePipeline.staged.configRisk")} value={summary?.configRiskCount ?? 0} tone={(summary?.configRiskCount ?? 0) > 0 ? "warn" : "neutral"} />
        <Metric label={t("migratePipeline.staged.planItems")} value={summary?.planItemCount ?? 0} />
      </div>
      <div className="staged-plan-actions">
        <Button variant="secondary" disabled={!session} onClick={onPlan}><FileText aria-hidden />{t("migratePipeline.staged.viewPlan")}</Button>
        <Button variant="primary" disabled={!session} onClick={onRecommended}>{t("migratePipeline.staged.continue")}<ArrowRight aria-hidden /></Button>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "safe" | "warn" | "danger" }) {
  return <span className={`staged-metric ${tone}`}><strong>{value}</strong>{label}</span>;
}

function SourceStep({
  connection,
  probe,
  connected,
  loading,
  onCollect,
  onOpenHostDetails
}: {
  connection?: ConnectionProfile;
  probe: AgentProbeResult | null;
  connected: boolean;
  loading: boolean;
  onCollect: () => void;
  onOpenHostDetails: () => void;
}) {
  const { t } = useTranslation();
  const collection = probe?.collection;
  const collectorSections = Object.values(probe?.collectors ?? {});
  const attentionSections = collectorSections.filter((section) =>
    section.status !== "ok" || section.commands.some((command) => command.timedOut || (command.exitCode !== undefined && command.exitCode !== 0))
  );
  const completenessPercent = Math.round((collection?.completeness ?? 0) * 100);
  const partialSnapshotGate = collection !== undefined && collection.completeness < 0.85;
  const confidenceKey = completenessPercent >= 90
    ? "migratePipeline.source.confidenceHigh"
    : completenessPercent >= 70
      ? "migratePipeline.source.confidenceMedium"
      : "migratePipeline.source.confidenceLow";
  return (
    <div className="pipeline-step-surface source-step-layout">
      <section className="source-summary-panel">
        <p className="eyebrow">{t("migratePipeline.source.eyebrow")}</p>
        <h3>{connection?.probeSnapshot?.system.hostname || connection?.label || connection?.fields.host || t("migratePipeline.source.noSource")}</h3>
        <div className="source-fact-grid">
          <Fact label="Address" value={connection ? `${connection.fields.host ?? "-"}:${connection.fields.port ?? "22"}` : "-"} />
          <Fact label={t("migratePipeline.source.status")} value={connection ? t(CONNECTION_STATUS_KEYS[connection.status]) : "-"} />
          <Fact label={t("migratePipeline.source.auth")} value={connection?.method === "ssh-key" ? "ssh-key" : connection ? "password" : "-"} />
          <Fact label={t("migratePipeline.source.snapshot")} value={probe?.collectedAt ? new Date(probe.collectedAt).toLocaleString() : t("migratePipeline.source.notCollected")} />
        </div>
        {probe ? (
          <>
            <div className="source-system-strip">
              <span>{probe.system.osPretty ?? `${probe.system.platform} ${probe.system.release}`}</span>
              <span>{probe.system.cpu.cores} CPU</span>
              <span>{probe.system.memory.totalGb} GB RAM</span>
              <span>{t("migratePipeline.source.evidenceItems", { count: probe.counts?.total ?? probe.software.length })}</span>
            </div>
            {collection ? (
              <section className={`collector-evidence-quality ${collection.status}`} aria-label={t("migratePipeline.source.evidenceQuality")}>
                <div className="collector-evidence-heading">
                  <div>
                    <strong>{t("migratePipeline.source.evidenceQuality")}</strong>
                    <small>{t("migratePipeline.source.evidenceConfidence", { confidence: t(confidenceKey) })}</small>
                  </div>
                  <div className="collector-evidence-metrics">
                    <span className={`collector-status ${collection.status}`}>{t(`migratePipeline.source.collectorStatus.${collection.status}`)}</span>
                    <span>{t("migratePipeline.source.completeness", { percent: completenessPercent })}</span>
                  </div>
                </div>
                {partialSnapshotGate ? (
                  <p className="collector-gate-warning">
                    <AlertTriangle aria-hidden />
                    {t("migratePipeline.source.partialGate", { gate: "partial-snapshot-confirm" })}
                  </p>
                ) : null}
                {collection.timedOut ? <p className="collector-timeout"><AlertTriangle aria-hidden />{t("migratePipeline.source.timedOut")}</p> : null}
                <details className="collector-command-evidence">
                  <summary>{t("migratePipeline.source.commandEvidence", { count: collectorSections.length })}</summary>
                  {attentionSections.length ? (
                    <div className="collector-command-list">
                      {attentionSections.map((section) => (
                        <article key={section.id}>
                          <div>
                            <strong>{section.id}</strong>
                            <span className={`collector-status ${section.status}`}>{t(`migratePipeline.source.collectorStatus.${section.status}`)}</span>
                            <span>{Math.round(section.completeness * 100)}%</span>
                          </div>
                          {section.commands.map((command) => (
                            <code key={`${section.id}:${command.command}`}>
                              {command.command} · {command.timedOut ? t("migratePipeline.source.commandTimedOut") : `exit ${command.exitCode ?? "?"}`}
                            </code>
                          ))}
                          {section.errors.map((error) => <p key={error}>{error}</p>)}
                          {section.stderr ? <pre>{section.stderr.slice(0, 800)}</pre> : null}
                        </article>
                      ))}
                    </div>
                  ) : <p className="pipeline-muted">{t("migratePipeline.source.noCommandFailures")}</p>}
                </details>
              </section>
            ) : null}
          </>
        ) : (
          <p className="pipeline-muted">{t("migratePipeline.source.collectFirst")}</p>
        )}
      </section>
      <aside className="source-action-panel">
        <h3>{t("migratePipeline.source.readOnly")}</h3>
        <p>{t("migratePipeline.source.intro")}</p>
        <Button variant="primary" disabled={!connected || loading} onClick={onCollect}>
          {loading ? <RefreshCw className="spinning" aria-hidden /> : <MonitorCog aria-hidden />}
          {loading ? t("migratePipeline.source.collecting") : probe ? t("migratePipeline.source.recollect") : t("migratePipeline.source.collect")}
        </Button>
        <Button variant="secondary" disabled={!connection} onClick={onOpenHostDetails}><Eye aria-hidden />{t("migratePipeline.source.details")}</Button>
      </aside>
    </div>
  );
}

function AnalysisStep({ session, analysis, onRefresh, onContinue }: { session: MigrationSessionView | null; analysis: MigrationSessionAnalysis | null; onRefresh: () => void; onContinue: () => void }) {
  const { t } = useTranslation();
  const summary = session?.summary;
  return (
    <div className="pipeline-step-surface">
      <div className="pipeline-section-heading">
        <div>
          <p className="eyebrow">{t("migratePipeline.analysis.eyebrow")}</p>
          <h3>{t("migratePipeline.analysis.title")}</h3>
        </div>
        <Button variant="secondary" onClick={onRefresh}><RefreshCw aria-hidden />{t("migratePipeline.analysis.refresh")}</Button>
      </div>
      <div className="analysis-metric-grid">
        <MetricCard icon={<PackagePlus aria-hidden />} label={t("migratePipeline.analysis.candidates")} value={summary?.totalCandidates ?? 0} />
        <MetricCard icon={<CheckCircle2 aria-hidden />} label={t("migratePipeline.analysis.autoSuggested")} value={summary?.autoCandidates ?? 0} tone="safe" />
        <MetricCard icon={<AlertTriangle aria-hidden />} label={t("migratePipeline.analysis.needsReview")} value={summary?.reviewCandidates ?? 0} tone="warn" />
        <MetricCard icon={<ShieldAlert aria-hidden />} label={t("migratePipeline.analysis.configRisk")} value={summary?.configRiskCount ?? 0} tone="warn" />
        <MetricCard icon={<Database aria-hidden />} label={t("migratePipeline.analysis.dataReview")} value={summary?.dataReviewCount ?? 0} tone="warn" />
        <MetricCard icon={<X aria-hidden />} label={t("migratePipeline.analysis.ignoredBaseline")} value={summary?.ignoredArtifacts ?? 0} />
      </div>
      <div className="analysis-callout">
        <p>{analysis?.report ? t("migratePipeline.analysis.next") : t("migratePipeline.analysis.unavailable")}</p>
        <Button variant="primary" disabled={!analysis?.report} onClick={onContinue}>{t("migratePipeline.analysis.start")}<ArrowRight aria-hidden /></Button>
      </div>
    </div>
  );
}

function CapabilitySelectionStep({
  analysis,
  decisions,
  loading,
  onDecision
}: {
  analysis: MigrationSessionAnalysis | null;
  decisions: Record<string, MigrationDecision>;
  loading: boolean;
  onDecision: (input: { candidateId?: string; candidateIds?: string[]; decision: ReviewDecision }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<MigrationCandidate | null>(null);
  const candidates = analysis?.report?.candidates ?? [];
  const filtered = candidates.filter((candidate) => filter === "all" || candidateGroup(candidate) === filter);
  const selectedGroup = [...selected][0] ? candidateGroup(candidates.find((candidate) => candidate.id === [...selected][0])!) : null;

  function toggleCandidate(candidate: MigrationCandidate) {
    const group = candidateGroup(candidate);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(candidate.id)) next.delete(candidate.id);
      else {
        if (selectedGroup && selectedGroup !== group) return next;
        next.add(candidate.id);
      }
      return next;
    });
  }

  async function bulk(decision: ReviewDecision) {
    if (selected.size === 0) return;
    await onDecision({ candidateIds: [...selected], decision });
    setSelected(new Set());
  }

  return (
    <div className="pipeline-step-surface">
      <div className="pipeline-section-heading">
        <div>
          <p className="eyebrow">{t("migratePipeline.selection.eyebrow")}</p>
          <h3>{t("migratePipeline.selection.title")}</h3>
        </div>
        <span className="selection-count">{filtered.length} / {candidates.length}</span>
      </div>
      <div className="capability-filter-row">
        {(Object.keys(GROUP_LABEL_KEYS) as Array<keyof typeof GROUP_LABEL_KEYS>).map((id) => (
          <FilterPill key={id} active={filter === id} onClick={() => setFilter(id)}>{t(GROUP_LABEL_KEYS[id])}</FilterPill>
        ))}
      </div>
      {selected.size > 0 ? (
        <div className="selection-bulk-bar">
          <strong>{t("migratePipeline.selection.selected", { count: selected.size, group: t(GROUP_LABEL_KEYS[selectedGroup ?? "all"]) })}</strong>
          <Button variant="secondary" disabled={loading} onClick={() => void bulk("add-to-plan")}>{t("migratePipeline.selection.addBulk")}</Button>
          <Button variant="secondary" disabled={loading} onClick={() => void bulk("record-only")}>{t("migratePipeline.selection.recordOnly")}</Button>
          <Button variant="secondary" disabled={loading} onClick={() => void bulk("skipped")}>{t("migratePipeline.selection.skip")}</Button>
          <Button variant="ghost" onClick={() => setSelected(new Set())}>{t("migratePipeline.selection.clear")}</Button>
        </div>
      ) : null}
      <div className="capability-card-grid">
        {filtered.length === 0 ? <EmptyPipelineState title={t("migratePipeline.selection.emptyTitle")} body={t("migratePipeline.selection.emptyBody")} /> : null}
        {filtered.map((candidate) => {
          const group = candidateGroup(candidate);
          const disabled = Boolean(selectedGroup && selectedGroup !== group && !selected.has(candidate.id));
          const decision = decisions[candidate.id]?.decision ?? "pending";
          return (
            <Card as="article" className={`capability-card risk-${candidate.riskLevel}`} key={candidate.id}>
              <label className="capability-select-check">
                <input type="checkbox" checked={selected.has(candidate.id)} disabled={disabled} onChange={() => toggleCandidate(candidate)} />
                <span>{t(GROUP_LABEL_KEYS[group])}</span>
              </label>
              <div className="capability-card-head">
                <div>
                  <h4>{candidate.catalogRuleName ?? candidate.name}</h4>
                  <p>{evidenceSummary(candidate) ?? t("migratePipeline.evidenceFallback", { source: candidate.source, version: candidate.version || t("migratePipeline.unknownVersion") })}</p>
                </div>
                <span className={`decision-chip decision-${decision}`}>{t(DECISION_LABEL_KEYS[decision])}</span>
              </div>
              <div className="capability-score-row">
                <Score label={t("migratePipeline.selection.intent")} value={candidate.intentConfidence} />
                <Score label={t("migratePipeline.selection.readiness")} value={candidate.migrationReadiness} />
                <span className={`risk-chip risk-${candidate.riskLevel}`}>{t(RISK_LABEL_KEYS[candidate.riskLevel])}</span>
              </div>
              <div className="capability-actions">
                <Button variant="primary" disabled={loading} onClick={() => void onDecision({ candidateId: candidate.id, decision: "add-to-plan" })}>{t("migratePipeline.selection.add")}</Button>
                <Button variant="secondary" disabled={loading} onClick={() => void onDecision({ candidateId: candidate.id, decision: "record-only" })}>{t("migratePipeline.selection.record")}</Button>
                <Button variant="secondary" disabled={loading} onClick={() => void onDecision({ candidateId: candidate.id, decision: "skipped" })}>{t("migratePipeline.selection.skip")}</Button>
                <Button variant="ghost" onClick={() => setDrawer(candidate)}><Eye aria-hidden />{t("migratePipeline.selection.evidence")}</Button>
              </div>
            </Card>
          );
        })}
      </div>
      {drawer ? <EvidenceDrawer candidate={drawer} onClose={() => setDrawer(null)} /> : null}
    </div>
  );
}

function UnknownReviewStep({ queue, decisions, loading, onDecision }: { queue: MigrationReviewQueueItem[]; decisions: Record<string, MigrationDecision>; loading: boolean; onDecision: (input: { candidateId?: string; candidateIds?: string[]; decision: ReviewDecision }) => Promise<void> }) {
  const { t } = useTranslation();
  return (
    <div className="pipeline-step-surface">
      <div className="pipeline-section-heading">
        <div>
          <p className="eyebrow">{t("migratePipeline.unknown.eyebrow")}</p>
          <h3>{t("migratePipeline.unknown.title")}</h3>
        </div>
        <span className="selection-count">{queue.length}</span>
      </div>
      <div className="unknown-review-list">
        {queue.length === 0 ? <EmptyPipelineState title={t("migratePipeline.unknown.emptyTitle")} body={t("migratePipeline.unknown.emptyBody")} /> : null}
        {queue.map((item) => {
          const decision = decisions[item.candidate.id]?.decision ?? item.decision;
          return (
            <article className="unknown-review-row" key={item.candidate.id}>
              <div>
                <strong>{item.candidate.name}</strong>
                <p>{item.reason}</p>
                <small>{item.candidate.source} · {item.candidate.version || "-"} · {t(DECISION_LABEL_KEYS[decision])}</small>
              </div>
              <div>
                <Button variant="secondary" disabled={loading} onClick={() => void onDecision({ candidateId: item.candidate.id, decision: "migrate-artifact" })}>{t("migratePipeline.unknown.manualItem")}</Button>
                <Button variant="secondary" disabled={loading} onClick={() => void onDecision({ candidateId: item.candidate.id, decision: "create-catalog-draft" })}>{t("migratePipeline.unknown.catalogDraft")}</Button>
                <Button variant="secondary" disabled={loading} onClick={() => void onDecision({ candidateId: item.candidate.id, decision: "record-only" })}>{t("migratePipeline.unknown.record")}</Button>
                <Button variant="ghost" disabled={loading} onClick={() => void onDecision({ candidateId: item.candidate.id, decision: "skipped" })}>{t("migratePipeline.unknown.skip")}</Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ConfigDataReviewStep({ analysis, configBundles, configDecisions, dataDecisions, loading, onRefresh, onConfigDecision, onDataDecision }: { analysis: MigrationSessionAnalysis | null; configBundles: ConfigBundle[]; configDecisions: MigrationConfigDecision[]; dataDecisions: MigrationDataDecision[]; loading: boolean; onRefresh: () => void; onConfigDecision: (input: { bundleId: string; strategy: ConfigBundle["migrationStrategy"]; status: "approved" | "blocked"; note?: string }) => Promise<void>; onDataDecision: (input: { candidateId: string; strategy: "no-data" | "backup-restore" | "rsync-copy" | "export-import" | "manual" | "external"; status: "confirmed" | "blocked"; paths?: string[]; note?: string }) => Promise<void> }) {
  const { t } = useTranslation();
  const decisions = new Map((analysis?.decisions ?? []).map((row) => [row.candidateId, row.decision]));
  const selectedCandidates = (analysis?.report?.candidates ?? []).filter((candidate) => selectedDecisions.has(decisions.get(candidate.id) ?? "pending"));
  const selectedRuleIds = new Set(selectedCandidates.flatMap((candidate) => [candidate.catalogRuleId, candidate.normalizedArtifactKey]).filter(Boolean) as string[]);
  const relevant = configBundles.filter((bundle) => !selectedRuleIds.size || selectedRuleIds.has(bundle.ownerRuleId ?? "") || selectedRuleIds.has(bundle.ownerCapabilityKey ?? ""));
  const [drawer, setDrawer] = useState<ConfigBundle | null>(null);
  const configById = new Map(configDecisions.map((row) => [row.bundleId, row]));
  const dataByCandidate = new Map(dataDecisions.map((row) => [row.candidateId, row]));
  const dataCandidates = selectedCandidates.filter((candidate) =>
    (candidate.dataPaths?.length ?? 0) > 0 ||
    candidate.reviewReasons?.some((reason) => /data strategy|data paths|data directories|copy\/export strategy/i.test(reason))
  );
  const unresolvedSecrets = relevant.filter((bundle) => {
    const decision = configById.get(bundle.id);
    return (bundle.sensitivity === "secret" || bundle.sensitivity === "blocked" || bundle.migrationStrategy === "secret-out-of-band" || bundle.migrationStrategy === "blocked") && decision?.status !== "approved";
  });
  return (
    <div className="pipeline-step-surface">
      <div className="pipeline-section-heading">
        <div>
          <p className="eyebrow">{t("migratePipeline.configData.eyebrow")}</p>
          <h3>{t("migratePipeline.configData.title")}</h3>
        </div>
        <Button variant="secondary" disabled={loading} onClick={onRefresh}><RefreshCw aria-hidden />{t("migratePipeline.configData.refresh")}</Button>
      </div>
      {unresolvedSecrets.length > 0 ? (
        <div className="pipeline-warning"><ShieldAlert aria-hidden />{t("migratePipeline.configData.blockers", { count: unresolvedSecrets.length })}</div>
      ) : null}
      <div className="config-bundle-grid">
        {relevant.length === 0 ? <EmptyPipelineState title={t("migratePipeline.configData.emptyTitle")} body={t("migratePipeline.configData.emptyBody")} /> : null}
        {relevant.map((bundle) => {
          const decision = configById.get(bundle.id);
          return (
            <Card as="article" className={`config-bundle-card sensitivity-${bundle.sensitivity}`} key={bundle.id} tone={bundle.sensitivity === "secret" || bundle.sensitivity === "blocked" ? "danger" : "default"}>
              <header>
                <div>
                  <strong>{bundle.ownerDisplayName ?? bundle.ownerRuleId ?? bundle.ownerCapabilityKey ?? t("migratePipeline.configData.unknownOwner")}</strong>
                  <small>{t("migratePipeline.configData.paths", { count: bundle.paths.length })} · {bundle.ownership}</small>
                </div>
                <span className={`risk-chip risk-${bundle.riskLevel}`}>{t(RISK_LABEL_KEYS[bundle.riskLevel])}</span>
              </header>
              <dl className="bundle-facts">
                <div><dt>{t("migratePipeline.configData.defaultStatus")}</dt><dd>{bundle.defaultStatus}</dd></div>
                <div><dt>{t("migratePipeline.configData.secret")}</dt><dd>{bundle.sensitivity}</dd></div>
                <div><dt>{t("migratePipeline.configData.strategy")}</dt><dd>{decision?.strategy ?? bundle.migrationStrategy}</dd></div>
                <div><dt>{t("migratePipeline.configData.decision")}</dt><dd>{decision?.status ?? t("migratePipeline.configData.pending")}</dd></div>
              </dl>
              <p>{bundle.rollbackStrategy ?? t("migratePipeline.configData.rollbackFallback")}</p>
              <div className="bundle-decision-actions">
                <Button variant="secondary" disabled={loading} onClick={() => void onConfigDecision({ bundleId: bundle.id, strategy: bundle.migrationStrategy, status: "approved", note: "ConfigBundle strategy reviewed." })}>{t("migratePipeline.configData.confirm")}</Button>
                {(bundle.sensitivity === "secret" || bundle.migrationStrategy === "secret-out-of-band") ? (
                  <Button variant="secondary" disabled={loading} onClick={() => void onConfigDecision({ bundleId: bundle.id, strategy: "secret-out-of-band", status: "approved", note: "Secret handled out of band; raw value will not be copied." })}>{t("migratePipeline.configData.secretOutOfBand")}</Button>
                ) : null}
                <Button variant="ghost" disabled={loading} onClick={() => void onConfigDecision({ bundleId: bundle.id, strategy: "blocked", status: "blocked", note: "Blocked by operator." })}>{t("migratePipeline.configData.block")}</Button>
                <Button variant="ghost" onClick={() => setDrawer(bundle)}><Eye aria-hidden />{t("migratePipeline.configData.diffRaw")}</Button>
              </div>
            </Card>
          );
        })}
      </div>
      <section className="data-strategy-panel">
        <div className="pipeline-section-heading">
          <div>
            <p className="eyebrow">{t("migratePipeline.configData.dataEyebrow")}</p>
            <h3>{t("migratePipeline.configData.dataTitle")}</h3>
          </div>
          <span className="selection-count">{dataCandidates.length}</span>
        </div>
        <div className="data-strategy-grid">
          {dataCandidates.length === 0 ? <p className="pipeline-muted">{t("migratePipeline.configData.noData")}</p> : null}
          {dataCandidates.map((candidate) => {
            const decision = dataByCandidate.get(candidate.id);
            const paths = candidate.dataPaths ?? [];
            return (
              <Card as="article" className="data-strategy-card" key={candidate.id}>
                <header>
                  <strong>{candidate.catalogRuleName ?? candidate.name}</strong>
                  <span className={`decision-chip decision-${decision?.status ?? "pending"}`}>{decision?.status ?? t("migratePipeline.configData.pending")}</span>
                </header>
                <p>{paths.length ? paths.join(" · ") : t("migratePipeline.configData.dataFallback")}</p>
                <div className="bundle-decision-actions">
                  <Button variant="secondary" disabled={loading} onClick={() => void onDataDecision({ candidateId: candidate.id, strategy: "backup-restore", status: "confirmed", paths, note: "Backup/restore strategy confirmed." })}>{t("migratePipeline.configData.backupRestore")}</Button>
                  <Button variant="secondary" disabled={loading} onClick={() => void onDataDecision({ candidateId: candidate.id, strategy: "rsync-copy", status: "confirmed", paths, note: "Rsync/copy strategy confirmed." })}>{t("migratePipeline.configData.rsyncCopy")}</Button>
                  <Button variant="secondary" disabled={loading} onClick={() => void onDataDecision({ candidateId: candidate.id, strategy: "manual", status: "confirmed", paths, note: "Manual data migration confirmed." })}>{t("migratePipeline.configData.manual")}</Button>
                  <Button variant="ghost" disabled={loading} onClick={() => void onDataDecision({ candidateId: candidate.id, strategy: "manual", status: "blocked", paths, note: "Data strategy blocked by operator." })}>{t("migratePipeline.configData.block")}</Button>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
      {drawer ? <ConfigBundleDrawer bundle={drawer} decision={configById.get(drawer.id)} onClose={() => setDrawer(null)} /> : null}
    </div>
  );
}

function ConfigBundleDrawer({ bundle, decision, onClose }: { bundle: ConfigBundle; decision?: MigrationConfigDecision; onClose: () => void }) {
  const { t } = useTranslation();
  useEscapeToClose(onClose);
  const safePaths = bundle.paths.map((file) => ({
    path: file.path,
    defaultStatus: file.defaultStatus,
    sensitivity: file.sensitivity,
    source: file.source,
    isGlob: file.isGlob
  }));
  return (
    <div className="drawer-overlay" role="dialog" aria-modal="true">
      <aside className="evidence-drawer">
        <header className="drawer-header">
          <div>
            <p className="eyebrow">ConfigBundle</p>
            <h2>{bundle.ownerDisplayName ?? bundle.ownerRuleId ?? bundle.id}</h2>
          </div>
          <Button variant="ghost" className="icon-action" onClick={onClose} aria-label={t("migratePipeline.configDrawer.close")}><X aria-hidden /></Button>
        </header>
        <section>
          <h3>{t("migratePipeline.configDrawer.summary")}</h3>
          <dl className="bundle-facts">
            <div><dt>{t("migratePipeline.configDrawer.strategy")}</dt><dd>{decision?.strategy ?? bundle.migrationStrategy}</dd></div>
            <div><dt>{t("migratePipeline.configDrawer.decision")}</dt><dd>{decision?.status ?? "pending"}</dd></div>
            <div><dt>{t("migratePipeline.configDrawer.sensitivity")}</dt><dd>{bundle.sensitivity}</dd></div>
            <div><dt>{t("migratePipeline.configDrawer.risk")}</dt><dd>{bundle.riskLevel}</dd></div>
          </dl>
        </section>
        <section>
          <h3>{t("migratePipeline.configDrawer.detail")}</h3>
          <p className="pipeline-muted">{t("migratePipeline.configDrawer.detailBody")}</p>
          <pre>{JSON.stringify({ id: bundle.id, paths: safePaths, reasons: bundle.reasons, validationHint: bundle.validationHint, rollbackStrategy: bundle.rollbackStrategy }, null, 2)}</pre>
        </section>
      </aside>
    </div>
  );
}

function PlanPreviewStep({ session, plan, loading, onRefresh, connections, sourceConnectionId, creating, onCreatePlan }: { session: MigrationSessionView | null; plan: MigrationPlan | null; loading: boolean; onRefresh: () => void; connections: ConnectionProfile[]; sourceConnectionId: string | null; creating: boolean; onCreatePlan: (targetConnectionId: string) => void | Promise<void> }) {
  const { t } = useTranslation();
  const groups = groupPlanActions(plan);
  const blocked = (session?.summary.pendingReviewCount ?? 0) > 0;
  const targetOptions = connections.filter((c) => c.id !== sourceConnectionId);
  const [targetId, setTargetId] = useState<string>(session?.targetConnectionId ?? "");
  return (
    <div className="pipeline-step-surface">
      <div className="pipeline-section-heading">
        <div>
          <p className="eyebrow">{t("migratePipeline.planPreview.eyebrow")}</p>
          <h3>{t("migratePipeline.planPreview.title")}</h3>
        </div>
        <Button variant="secondary" disabled={loading} onClick={onRefresh}><RefreshCw aria-hidden />{t("migratePipeline.planPreview.refresh")}</Button>
      </div>
      {blocked ? <div className="pipeline-warning"><AlertTriangle aria-hidden />{t("migratePipeline.planPreview.blocked")}</div> : null}
      {!plan ? <EmptyPipelineState title={t("migratePipeline.planPreview.emptyTitle")} body={t("migratePipeline.planPreview.emptyBody")} /> : null}
      {plan ? (
        <div className="plan-action-groups">
          {Object.entries(groups).map(([group, actions]) => (
            <section className="plan-action-group" key={group}>
              <h4>{t(PLAN_GROUP_LABEL_KEYS[group as keyof typeof PLAN_GROUP_LABEL_KEYS])}</h4>
              {actions.length === 0 ? <p className="pipeline-muted">-</p> : actions.map((action) => (
                <article key={action.id}>
                  <strong>{action.label}</strong>
                  <small>{action.itemName} · {action.kind} · {action.requiresSudo ? "sudo" : "user"}</small>
                </article>
              ))}
            </section>
          ))}
        </div>
      ) : null}
      {plan ? (
        <div className="migrate-deliver-card">
          <div>
            <p className="eyebrow">{t("migratePipeline.planPreview.deliver")}</p>
            <h4>{t("migratePipeline.planPreview.deliverTitle")}</h4>
            <p className="pipeline-muted">{t("migratePipeline.planPreview.deliverBody")}</p>
          </div>
          <div className="migrate-deliver-actions">
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} aria-label={t("migratePipeline.planPreview.targetAria")}>
              <option value="">{t("migratePipeline.planPreview.selectTarget")}</option>
              {targetOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.label || c.fields.host || c.id}</option>
              ))}
            </select>
            <Button
              variant="primary"
              disabled={!targetId || blocked || creating}
              loading={creating}
              onClick={() => targetId && void onCreatePlan(targetId)}
            >
              {t("migratePipeline.planPreview.create")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TargetDryRunStep({ sourceConnectionId, session, connections, dryRun, loading, onSelectTarget, onDryRun }: { sourceConnectionId: string; session: MigrationSessionView | null; connections: ConnectionProfile[]; dryRun: MigrationDryRunResult | null; loading: boolean; onSelectTarget: (id: string) => void; onDryRun: () => void }) {
  const { t } = useTranslation();
  const targets = connections.filter((connection) => connection.id !== sourceConnectionId);
  return (
    <div className="pipeline-step-surface target-dryrun-layout">
      <section>
        <p className="eyebrow">{t("migratePipeline.target.eyebrow")}</p>
        <h3>{t("migratePipeline.target.title")}</h3>
        <select value={session?.targetConnectionId ?? ""} onChange={(event) => event.target.value && onSelectTarget(event.target.value)}>
          <option value="">{t("migratePipeline.target.select")}</option>
          {targets.map((connection) => <option key={connection.id} value={connection.id}>{connection.label} · {connection.fields.host ?? "-"}</option>)}
        </select>
        <Button variant="primary" disabled={!session || loading} onClick={onDryRun}><Play aria-hidden />{t("migratePipeline.target.run")}</Button>
      </section>
      <section className="dryrun-result-panel">
        <h4>{t("migratePipeline.target.result")}</h4>
        {dryRun ? (
          <>
            <div className="dryrun-summary">
              <Metric label="would-run" value={dryRun.summary["would-run"]} />
              <Metric label="needs-review" value={dryRun.summary["needs-review"]} tone={dryRun.summary["needs-review"] > 0 ? "warn" : "neutral"} />
              <Metric label="blocked" value={dryRun.summary.blocked} tone={dryRun.summary.blocked > 0 ? "danger" : "safe"} />
            </div>
            <div className="dryrun-step-list">
              {dryRun.steps.slice(0, 8).map((step) => <span key={step.id}>{step.status} · {step.label}</span>)}
            </div>
          </>
        ) : <p className="pipeline-muted">{t("migratePipeline.target.note")}</p>}
      </section>
    </div>
  );
}

function ApplyReportStep({ mode, session, dryRun, readiness, applyResult, verifyResult, report, loading, onRefreshReadiness, onApply, onVerify, onReport }: { mode: "apply" | "report"; session: MigrationSessionView | null; dryRun: MigrationDryRunResult | null; readiness: MigrationSessionApplyReadiness | null; applyResult: MigrationApplyResult | null; verifyResult: MigrationVerificationRunResult | null; report: MigrationSessionReport | null; loading: boolean; onRefreshReadiness: () => void; onApply: () => void; onVerify: () => void; onReport: () => void }) {
  const { t } = useTranslation();
  const blockers = readiness?.blockers ?? [];
  const warnings = readiness?.warnings ?? [];
  const canApply = Boolean(readiness?.ready && !loading);
  const canVerify = Boolean((applyResult?.ok || session?.status === "applied" || session?.lastApplyAt) && !loading);
  return (
    <div className="pipeline-step-surface apply-report-layout">
      <div className="pipeline-section-heading">
        <div>
          <p className="eyebrow">{mode === "report" ? t("migratePipeline.applyReport.verifyReport") : t("migratePipeline.applyReport.readiness")}</p>
          <h3>{t("migratePipeline.applyReport.title")}</h3>
        </div>
        <Button variant="secondary" disabled={loading} onClick={onRefreshReadiness}><RefreshCw aria-hidden />{t("migratePipeline.applyReport.refresh")}</Button>
      </div>
      <div className="apply-readiness-grid">
        <Card as="article" className={`apply-readiness-card ${readiness?.ready ? "ready" : "blocked"}`} tone={readiness?.ready ? "ok" : "danger"}>
          <header>
            <strong>{readiness?.ready ? t("migratePipeline.applyReport.ready") : t("migratePipeline.applyReport.blocked")}</strong>
            <span className={`risk-chip ${readiness?.ready ? "risk-safe" : "risk-dangerous"}`}>{readiness?.ready ? t("migratePipeline.applyReport.ready") : t("migratePipeline.applyReport.blocked")}</span>
          </header>
          <div className="dryrun-summary">
            <Metric label={t("migratePipeline.applyReport.dryRun")} value={dryRun?.summary.total ?? Number(readiness?.dryRun?.summary?.total ?? 0)} tone={readiness?.dryRun?.status === "passed" ? "safe" : "warn"} />
            <Metric label={t("migratePipeline.applyReport.blockers")} value={blockers.length} tone={blockers.length ? "danger" : "safe"} />
            <Metric label={t("migratePipeline.applyReport.warnings")} value={warnings.length} tone={warnings.length ? "warn" : "neutral"} />
          </div>
          {blockers.length ? (
            <ul className="readiness-list">
              {blockers.slice(0, 8).map((blocker, index) => <li key={`blocker-${index}`}>{blocker}</li>)}
            </ul>
          ) : <p className="pipeline-muted">{t("migratePipeline.applyReport.noBlockers")}</p>}
        </Card>
        <Card as="article" className="apply-readiness-card">
          <header><strong>{t("migratePipeline.applyReport.rollback")}</strong></header>
          <p className="pipeline-muted">{report?.rollback?.available ? (report.rollback.rolledBack ? t("migratePipeline.applyReport.rollbackTriggered") : t("migratePipeline.applyReport.rollbackAvailable")) : t("migratePipeline.applyReport.noRollback")}</p>
          {report?.rollback?.steps?.length ? (
            <div className="dryrun-step-list">{report.rollback.steps.slice(0, 5).map((step, index) => <span key={`rollback-${index}`}>{step.status ?? "-"} · {step.label ?? step.message ?? "-"}</span>)}</div>
          ) : null}
        </Card>
      </div>
      <div className="apply-command-row">
        <Button variant="primary" disabled={!canApply} onClick={onApply}><Play aria-hidden />{t("migratePipeline.applyReport.apply")}</Button>
        <Button variant="secondary" disabled={!canVerify} onClick={onVerify}><CheckCircle2 aria-hidden />{t("migratePipeline.applyReport.verify")}</Button>
        <Button variant="secondary" disabled={!session || loading} onClick={onReport}><FileText aria-hidden />{t("migratePipeline.applyReport.report")}</Button>
      </div>
      <div className="apply-run-grid">
        <RunSummaryCard title={t("migratePipeline.applyReport.apply")} ok={applyResult?.ok} total={applyResult?.summary.total ?? Number(report?.apply?.summary?.total ?? 0)} failed={applyResult?.summary.failed ?? Number(report?.apply?.summary?.failed ?? 0)} />
        <RunSummaryCard title={t("migratePipeline.applyReport.verify")} ok={verifyResult?.ok} total={verifyResult?.summary.total ?? Number(report?.verify?.summary?.total ?? 0)} failed={verifyResult?.summary.failed ?? Number(report?.verify?.summary?.failed ?? 0)} />
        <RunSummaryCard title={t("migratePipeline.applyReport.report")} ok={Boolean(report)} total={report?.plan?.items ?? session?.summary.planItemCount ?? 0} failed={report?.readiness?.blockers.length ?? 0} />
      </div>
      {report ? (
        <section className="session-report-panel">
          <h4>{t("migratePipeline.applyReport.reportSummary")}</h4>
          <div className="dryrun-step-list">
            <span>{t("migratePipeline.applyReport.source")} · {report.sourceHost}</span>
            <span>{t("migratePipeline.applyReport.target")} · {report.targetConnectionId ?? "-"}</span>
            <span>{t("migratePipeline.applyReport.verify")} · {report.verify?.status ?? "-"}</span>
            <span>{t("migratePipeline.applyReport.rollback")} · {report.rollback?.rolledBack ? t("migratePipeline.applyReport.rolledBackStatus") : (report.rollback?.available ? t("migratePipeline.applyReport.availableStatus") : "-")}</span>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function RunSummaryCard({ title, ok, total, failed }: { title: string; ok?: boolean; total: number; failed: number }) {
  const { t } = useTranslation();
  return (
    <Card as="article" className={`run-summary-card ${ok === false || failed > 0 ? "failed" : ok ? "ok" : ""}`} tone={ok === false || failed > 0 ? "danger" : ok ? "ok" : "default"}>
      <strong>{title}</strong>
      <div className="dryrun-summary">
        <Metric label={t("migratePipeline.applyReport.total")} value={total} />
        <Metric label={t("migratePipeline.applyReport.failed")} value={failed} tone={failed > 0 ? "danger" : "safe"} />
      </div>
    </Card>
  );
}

function EvidenceDrawer({ candidate, onClose }: { candidate: MigrationCandidate; onClose: () => void }) {
  const { t } = useTranslation();
  useEscapeToClose(onClose);
  return (
    <div className="drawer-overlay" role="dialog" aria-modal="true">
      <aside className="evidence-drawer">
        <header className="drawer-header">
          <div>
            <p className="eyebrow">{t("migratePipeline.evidenceDrawer.eyebrow")}</p>
            <h2>{candidate.catalogRuleName ?? candidate.name}</h2>
          </div>
          <Button variant="ghost" className="icon-action" onClick={onClose} aria-label={t("migratePipeline.evidenceDrawer.close")}><X aria-hidden /></Button>
        </header>
        <section>
          <h3>{t("migratePipeline.evidenceDrawer.summary")}</h3>
          <ul>
            {candidate.reasons.map((reason, index) => <li key={`reason-${index}`}>{reason}</li>)}
          </ul>
        </section>
        <section>
          <h3>{t("migratePipeline.evidenceDrawer.raw")}</h3>
          <pre>{JSON.stringify(candidate.rawEvidence ?? [], null, 2)}</pre>
        </section>
        <section>
          <h3>{t("migratePipeline.evidenceDrawer.normalized")}</h3>
          <pre>{JSON.stringify(candidate.normalizedArtifacts ?? [], null, 2)}</pre>
        </section>
      </aside>
    </div>
  );
}

function MetricCard({ icon, label, value, tone = "neutral" }: { icon: React.ReactNode; label: string; value: number; tone?: "neutral" | "safe" | "warn" | "danger" }) {
  const cardTone = tone === "safe" ? "ok" : tone === "warn" ? "warn" : tone === "danger" ? "danger" : "default";
  return <Card as="article" className={`analysis-metric-card ${tone}`} tone={cardTone}>{icon}<strong>{value}</strong><span>{label}</span></Card>;
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return <span><strong>{label}</strong>{value}</span>;
}

function Score({ label, value }: { label: string; value: number }) {
  return <MetricPill value={`${Math.round(value * 100)}%`} label={label} />;
}

function EmptyPipelineState({ title, body }: { title: string; body: string }) {
  return <div className="pipeline-empty-state"><h3>{title}</h3><p>{body}</p></div>;
}

function candidateGroup(candidate: MigrationCandidate): keyof typeof GROUP_LABEL_KEYS {
  const key = `${candidate.catalogRuleId ?? ""} ${candidate.catalogRuleName ?? ""} ${candidate.name} ${candidate.migrationClass} ${candidate.source}`.toLowerCase();
  if (candidate.migrationClass === "container-workload" || key.includes("docker") || key.includes("container")) return "container";
  if (candidate.migrationClass === "manual-install") return "manual";
  if (candidate.migrationClass === "unknown-review") return "unknown";
  if (key.includes("postgres") || key.includes("mysql") || key.includes("redis") || key.includes("database") || key.includes("mongo")) return "database";
  if (key.includes("nginx") || key.includes("apache") || key.includes("traefik") || key.includes("web")) return "web";
  if (candidate.riskLevel === "privileged" || key.includes("ssh") || key.includes("firewall") || key.includes("security")) return "security";
  return "runtime";
}

function evidenceSummary(candidate: MigrationCandidate): string | null {
  const parts = [
    ...(candidate.packageNames ?? []).slice(0, 4).map((name) => `pkg:${name}`),
    ...(candidate.serviceNames ?? []).slice(0, 3).map((name) => `svc:${name}`),
    ...(candidate.ports ?? []).slice(0, 3).map((port) => `:${port}`),
    ...(candidate.configPaths ?? []).slice(0, 2).map((path) => `cfg:${path}`)
  ];
  return parts.length ? parts.join(" · ") : null;
}

function groupPlanActions(plan: MigrationPlan | null): Record<string, Array<{ id: string; itemName: string; kind: string; label: string; requiresSudo: boolean }>> {
  const groups: Record<string, Array<{ id: string; itemName: string; kind: string; label: string; requiresSudo: boolean }>> = {
    Packages: [],
    Services: [],
    Configs: [],
    Data: [],
    Verification: [],
    Rollback: [],
    Review: []
  };
  for (const item of plan?.items ?? []) {
    item.actions.forEach((action, index) => {
      const row = { id: `${item.id}:${index}`, itemName: item.name, kind: action.kind, label: action.label, requiresSudo: Boolean(action.requiresSudo) };
      if (action.kind === "installPackage") groups.Packages.push(row);
      else if (action.kind === "restart") groups.Services.push(row);
      else if (action.kind === "copyConfig") groups.Configs.push(row);
      else if (action.kind === "validate") groups.Verification.push(row);
      else if (action.kind === "review") groups.Review.push(row);
      else groups.Rollback.push(row);
    });
  }
  return groups;
}
