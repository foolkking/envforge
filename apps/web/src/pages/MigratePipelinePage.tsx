import React, { useEffect, useMemo, useState } from "react";
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
  applyMigrationSession,
  createMigrationSession,
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

const selectedDecisions = new Set<ReviewDecision>(["approved", "add-to-plan", "migrate-artifact"]);
const stepOrder: MigrationSessionStep[] = ["source", "analysis", "select", "unknown", "config-data", "plan", "target", "apply", "report"];

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
  pushLog
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
}) {
  const zh = locale === "zh";
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
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to create migration session.");
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
      setError(err instanceof Error ? err.message : "Failed to load config bundles.");
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
      setError(err instanceof Error ? err.message : "Failed to load migration plan.");
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
      setError(err instanceof Error ? err.message : "Failed to load apply readiness.");
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
      setError(err instanceof Error ? err.message : "Failed to load migration report.");
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
      pushLog?.("success", zh ? "源主机快照已绑定到迁移会话" : "Source snapshot attached to migration session");
      await loadAnalysis(current.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Snapshot collection failed.");
      pushLog?.("error", err instanceof Error ? err.message : "Snapshot collection failed.");
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
      setError(err instanceof Error ? err.message : "Save decision failed.");
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
      setError(err instanceof Error ? err.message : "Save config decision failed.");
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
      setError(err instanceof Error ? err.message : "Save data decision failed.");
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
      setError(err instanceof Error ? err.message : "Target selection failed.");
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
      pushLog?.("success", zh ? "Dry-run 已完成，未修改目标机器" : "Dry-run completed; no target changes were made");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dry-run failed.");
    } finally {
      setStepLoading(false);
    }
  }

  async function runApply() {
    if (!session) return;
    setStepLoading(true);
    setError("");
    try {
      const next = await applyMigrationSession(authToken, session.id, { rollbackOnFailure: true });
      setSession(next.session);
      setApplyResult(next.result);
      await loadApplyReadiness(session.id);
      pushLog?.("success", next.result.ok ? "migration apply completed" : "migration apply finished with failures");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed.");
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
      setError(err instanceof Error ? err.message : "Verify failed.");
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
    if (!authToken) return <EmptyPipelineState title={zh ? "请先登录" : "Login required"} body={zh ? "迁移会话和候选选择需要登录态。" : "Migration sessions and decisions require an authenticated session."} />;
    if (!connectionId) return <EmptyPipelineState title={zh ? "选择源主机" : "Select a source host"} body={zh ? "选择或新建连接后，迁移流水线会从源主机快照开始。" : "Select or create a connection to start from a source HostSnapshot."} />;
    if (loading) return <EmptyPipelineState title={zh ? "正在打开迁移会话" : "Opening migration session"} body={zh ? "正在恢复上次步骤和已选择项。" : "Restoring the current step and staged decisions."} />;

    switch (activeStep) {
      case "source":
        return (
          <SourceStep
            locale={locale}
            connection={activeConnection}
            probe={activeProbe ?? null}
            connected={connected}
            loading={stepLoading}
            onCollect={() => void collectAndAttachSnapshot()}
            onOpenHostDetails={onOpenHostDetails}
          />
        );
      case "analysis":
        return <AnalysisStep locale={locale} session={session} analysis={analysis} onRefresh={() => session && void loadAnalysis(session.id)} onContinue={() => void goStep("select")} />;
      case "select":
        return <CapabilitySelectionStep locale={locale} analysis={analysis} decisions={decisionByCandidate} loading={stepLoading} onDecision={saveDecision} />;
      case "unknown":
        return <UnknownReviewStep locale={locale} queue={analysis?.reviewQueue ?? []} decisions={decisionByCandidate} loading={stepLoading} onDecision={saveDecision} />;
      case "config-data":
        return (
          <ConfigDataReviewStep
            locale={locale}
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
        return <PlanPreviewStep locale={locale} session={session} plan={plan} loading={stepLoading} onRefresh={() => session && void loadPlan(session.id)} />;
      case "target":
        return (
          <TargetDryRunStep
            locale={locale}
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
            locale={locale}
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
            locale={locale}
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
      <MigrateStepHeader locale={locale} activeStep={activeStep} session={session} onStep={(step) => void goStep(step)} />
      <StagedPlanBar locale={locale} session={session} onRecommended={() => session && void goStep(session.recommendedStep)} onPlan={() => void goStep("plan")} />
      {error ? <div className="pipeline-error"><AlertTriangle aria-hidden />{error}</div> : null}
      {content}
      {summary && !error ? (
        <div className="pipeline-footnote">
          {zh
            ? `状态来自 migration session：已选 ${summary.selectedCount}，待审 ${summary.pendingReviewCount}，阻塞 ${summary.blockerCount}。`
            : `State comes from the migration session: ${summary.selectedCount} selected, ${summary.pendingReviewCount} pending, ${summary.blockerCount} blockers.`}
        </div>
      ) : null}
    </section>
  );
}

function MigrateStepHeader({
  locale,
  activeStep,
  session,
  onStep
}: {
  locale: Locale;
  activeStep: MigrationSessionStep;
  session: MigrationSessionView | null;
  onStep: (step: MigrationSessionStep) => void;
}) {
  const zh = locale === "zh";
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
          {stepLabel(step, locale)}
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
        <p className="eyebrow">{zh ? "迁移流水线" : "Migrate pipeline"}</p>
        <h2>{stepLabel(activeStep, locale)}</h2>
      </div>
      <div className="migrate-step-segments">
        <div className="migrate-step-segment">
          <span className="migrate-step-segment-label">{zh ? "生产计划" : "Produce plan"}</span>
          <ol className="migrate-step-tabs">{produceSteps.map(renderTab)}</ol>
        </div>
        <div className="migrate-step-segment migrate-step-segment-deliver">
          <span className="migrate-step-segment-label">{zh ? "交付" : "Deliver"}</span>
          <ol className="migrate-step-tabs">{deliverSteps.map(renderTab)}</ol>
        </div>
      </div>
    </header>
  );
}

function StagedPlanBar({
  locale,
  session,
  onRecommended,
  onPlan
}: {
  locale: Locale;
  session: MigrationSessionView | null;
  onRecommended: () => void;
  onPlan: () => void;
}) {
  const zh = locale === "zh";
  const summary = session?.summary;
  return (
    <div className="staged-plan-bar">
      <div className="staged-plan-metrics">
        <Metric label={zh ? "已选择" : "Selected"} value={summary?.selectedCount ?? 0} />
        <Metric label={zh ? "待审查" : "Pending"} value={summary?.pendingReviewCount ?? 0} tone={(summary?.pendingReviewCount ?? 0) > 0 ? "warn" : "safe"} />
        <Metric label={zh ? "阻塞" : "Blockers"} value={summary?.blockerCount ?? 0} tone={(summary?.blockerCount ?? 0) > 0 ? "danger" : "safe"} />
        <Metric label={zh ? "配置风险" : "Config risk"} value={summary?.configRiskCount ?? 0} tone={(summary?.configRiskCount ?? 0) > 0 ? "warn" : "neutral"} />
        <Metric label={zh ? "计划项" : "Plan items"} value={summary?.planItemCount ?? 0} />
      </div>
      <div className="staged-plan-actions">
        <Button variant="secondary" disabled={!session} onClick={onPlan}><FileText aria-hidden />{zh ? "查看计划" : "View plan"}</Button>
        <Button variant="primary" disabled={!session} onClick={onRecommended}>{zh ? "继续" : "Continue"}<ArrowRight aria-hidden /></Button>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "safe" | "warn" | "danger" }) {
  return <span className={`staged-metric ${tone}`}><strong>{value}</strong>{label}</span>;
}

function SourceStep({
  locale,
  connection,
  probe,
  connected,
  loading,
  onCollect,
  onOpenHostDetails
}: {
  locale: Locale;
  connection?: ConnectionProfile;
  probe: AgentProbeResult | null;
  connected: boolean;
  loading: boolean;
  onCollect: () => void;
  onOpenHostDetails: () => void;
}) {
  const zh = locale === "zh";
  return (
    <div className="pipeline-step-surface source-step-layout">
      <section className="source-summary-panel">
        <p className="eyebrow">{zh ? "源主机" : "Source host"}</p>
        <h3>{connection?.probeSnapshot?.system.hostname || connection?.label || connection?.fields.host || (zh ? "未选择源主机" : "No source selected")}</h3>
        <div className="source-fact-grid">
          <Fact label="Address" value={connection ? `${connection.fields.host ?? "-"}:${connection.fields.port ?? "22"}` : "-"} />
          <Fact label={zh ? "连接状态" : "Status"} value={connection ? connectionStatus(connection.status, locale) : "-"} />
          <Fact label={zh ? "认证" : "Auth"} value={connection?.method === "ssh-key" ? "ssh-key" : connection ? "password" : "-"} />
          <Fact label={zh ? "快照" : "Snapshot"} value={probe?.collectedAt ? new Date(probe.collectedAt).toLocaleString() : (zh ? "未采集" : "Not collected")} />
        </div>
        {probe ? (
          <div className="source-system-strip">
            <span>{probe.system.osPretty ?? `${probe.system.platform} ${probe.system.release}`}</span>
            <span>{probe.system.cpu.cores} CPU</span>
            <span>{probe.system.memory.totalGb} GB RAM</span>
            <span>{probe.counts?.total ?? probe.software.length} {zh ? "项证据" : "evidence items"}</span>
          </div>
        ) : (
          <p className="pipeline-muted">{zh ? "采集 HostSnapshot 后才会进入分析、选择和计划阶段。" : "Collect a HostSnapshot before analysis, selection, and planning."}</p>
        )}
      </section>
      <aside className="source-action-panel">
        <h3>{zh ? "只读采集" : "Read-only collection"}</h3>
        <p>{zh ? "采集 OS、包、服务、端口和配置清单；不会修改源主机。" : "Collect OS, packages, services, ports, and config inventory without mutating the source host."}</p>
        <Button variant="primary" disabled={!connected || loading} onClick={onCollect}>
          {loading ? <RefreshCw className="spinning" aria-hidden /> : <MonitorCog aria-hidden />}
          {loading ? (zh ? "采集中" : "Collecting") : (probe ? (zh ? "重新采集并分析" : "Recollect and analyze") : (zh ? "采集主机快照" : "Collect HostSnapshot"))}
        </Button>
        <Button variant="secondary" disabled={!connection} onClick={onOpenHostDetails}><Eye aria-hidden />{zh ? "主机详情" : "Host details"}</Button>
      </aside>
    </div>
  );
}

function AnalysisStep({ locale, session, analysis, onRefresh, onContinue }: { locale: Locale; session: MigrationSessionView | null; analysis: MigrationSessionAnalysis | null; onRefresh: () => void; onContinue: () => void }) {
  const zh = locale === "zh";
  const summary = session?.summary;
  return (
    <div className="pipeline-step-surface">
      <div className="pipeline-section-heading">
        <div>
          <p className="eyebrow">{zh ? "分析摘要" : "Analysis summary"}</p>
          <h3>{zh ? "系统识别到的迁移能力" : "Detected migration capabilities"}</h3>
        </div>
        <Button variant="secondary" onClick={onRefresh}><RefreshCw aria-hidden />{zh ? "刷新分析" : "Refresh"}</Button>
      </div>
      <div className="analysis-metric-grid">
        <MetricCard icon={<PackagePlus aria-hidden />} label={zh ? "候选能力" : "Candidates"} value={summary?.totalCandidates ?? 0} />
        <MetricCard icon={<CheckCircle2 aria-hidden />} label={zh ? "自动建议" : "Auto suggested"} value={summary?.autoCandidates ?? 0} tone="safe" />
        <MetricCard icon={<AlertTriangle aria-hidden />} label={zh ? "需要确认" : "Needs review"} value={summary?.reviewCandidates ?? 0} tone="warn" />
        <MetricCard icon={<ShieldAlert aria-hidden />} label={zh ? "配置风险" : "Config risk"} value={summary?.configRiskCount ?? 0} tone="warn" />
        <MetricCard icon={<Database aria-hidden />} label={zh ? "数据审查" : "Data review"} value={summary?.dataReviewCount ?? 0} tone="warn" />
        <MetricCard icon={<X aria-hidden />} label={zh ? "已忽略基线" : "Ignored baseline"} value={summary?.ignoredArtifacts ?? 0} />
      </div>
      <div className="analysis-callout">
        <p>{analysis?.report ? (zh ? "下一步按 capability 选择迁移项；包、服务、端口和配置只作为证据。" : "Next, select by capability. Packages, services, ports, and configs stay as evidence.") : (zh ? "当前还没有可分析的快照。" : "No analyzable snapshot is available yet.")}</p>
        <Button variant="primary" disabled={!analysis?.report} onClick={onContinue}>{zh ? "开始选择迁移项" : "Start selection"}<ArrowRight aria-hidden /></Button>
      </div>
    </div>
  );
}

function CapabilitySelectionStep({
  locale,
  analysis,
  decisions,
  loading,
  onDecision
}: {
  locale: Locale;
  analysis: MigrationSessionAnalysis | null;
  decisions: Record<string, MigrationDecision>;
  loading: boolean;
  onDecision: (input: { candidateId?: string; candidateIds?: string[]; decision: ReviewDecision }) => Promise<void>;
}) {
  const zh = locale === "zh";
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
          <p className="eyebrow">{zh ? "迁移项选择" : "Capability selection"}</p>
          <h3>{zh ? "按能力选择，不按包选择" : "Select capabilities, not packages"}</h3>
        </div>
        <span className="selection-count">{filtered.length} / {candidates.length}</span>
      </div>
      <div className="capability-filter-row">
        {["all", "web", "database", "runtime", "container", "security", "manual", "unknown"].map((id) => (
          <button key={id} type="button" className={`filter-pill ${filter === id ? "active" : ""}`} onClick={() => setFilter(id)}>{groupLabel(id, locale)}</button>
        ))}
      </div>
      {selected.size > 0 ? (
        <div className="selection-bulk-bar">
          <strong>{zh ? `已选择 ${selected.size} 项同类 ${groupLabel(selectedGroup ?? "all", locale)}` : `${selected.size} ${groupLabel(selectedGroup ?? "all", locale)} item(s) selected`}</strong>
          <Button variant="secondary" disabled={loading} onClick={() => void bulk("add-to-plan")}>{zh ? "批量加入计划" : "Add to plan"}</Button>
          <Button variant="secondary" disabled={loading} onClick={() => void bulk("record-only")}>{zh ? "仅记录" : "Record only"}</Button>
          <Button variant="secondary" disabled={loading} onClick={() => void bulk("skipped")}>{zh ? "跳过" : "Skip"}</Button>
          <Button variant="ghost" onClick={() => setSelected(new Set())}>{zh ? "清空" : "Clear"}</Button>
        </div>
      ) : null}
      <div className="capability-card-grid">
        {filtered.length === 0 ? <EmptyPipelineState title={zh ? "没有匹配的能力" : "No matching capabilities"} body={zh ? "切换分类或重新采集源主机快照。" : "Change the filter or recollect the source HostSnapshot."} /> : null}
        {filtered.map((candidate) => {
          const group = candidateGroup(candidate);
          const disabled = Boolean(selectedGroup && selectedGroup !== group && !selected.has(candidate.id));
          const decision = decisions[candidate.id]?.decision ?? "pending";
          return (
            <article className={`capability-card risk-${candidate.riskLevel}`} key={candidate.id}>
              <label className="capability-select-check">
                <input type="checkbox" checked={selected.has(candidate.id)} disabled={disabled} onChange={() => toggleCandidate(candidate)} />
                <span>{groupLabel(group, locale)}</span>
              </label>
              <div className="capability-card-head">
                <div>
                  <h4>{candidate.catalogRuleName ?? candidate.name}</h4>
                  <p>{evidenceSummary(candidate, locale)}</p>
                </div>
                <span className={`decision-chip decision-${decision}`}>{decisionLabel(decision, locale)}</span>
              </div>
              <div className="capability-score-row">
                <Score label={zh ? "意图" : "Intent"} value={candidate.intentConfidence} />
                <Score label={zh ? "准备度" : "Readiness"} value={candidate.migrationReadiness} />
                <span className={`risk-chip risk-${candidate.riskLevel}`}>{riskLabel(candidate.riskLevel, locale)}</span>
              </div>
              <div className="capability-actions">
                <Button variant="primary" disabled={loading} onClick={() => void onDecision({ candidateId: candidate.id, decision: "add-to-plan" })}>{zh ? "加入迁移" : "Add"}</Button>
                <Button variant="secondary" disabled={loading} onClick={() => void onDecision({ candidateId: candidate.id, decision: "record-only" })}>{zh ? "仅记录" : "Record"}</Button>
                <Button variant="secondary" disabled={loading} onClick={() => void onDecision({ candidateId: candidate.id, decision: "skipped" })}>{zh ? "跳过" : "Skip"}</Button>
                <Button variant="ghost" onClick={() => setDrawer(candidate)}><Eye aria-hidden />{zh ? "证据" : "Evidence"}</Button>
              </div>
            </article>
          );
        })}
      </div>
      {drawer ? <EvidenceDrawer locale={locale} candidate={drawer} onClose={() => setDrawer(null)} /> : null}
    </div>
  );
}

function UnknownReviewStep({ locale, queue, decisions, loading, onDecision }: { locale: Locale; queue: MigrationReviewQueueItem[]; decisions: Record<string, MigrationDecision>; loading: boolean; onDecision: (input: { candidateId?: string; candidateIds?: string[]; decision: ReviewDecision }) => Promise<void> }) {
  const zh = locale === "zh";
  return (
    <div className="pipeline-step-surface">
      <div className="pipeline-section-heading">
        <div>
          <p className="eyebrow">{zh ? "未知项审查" : "Unknown review"}</p>
          <h3>{zh ? "未匹配规则库的候选不会消失" : "Unmatched candidates stay visible"}</h3>
        </div>
        <span className="selection-count">{queue.length}</span>
      </div>
      <div className="unknown-review-list">
        {queue.length === 0 ? <EmptyPipelineState title={zh ? "没有未知项" : "No unknown items"} body={zh ? "当前快照没有待处理的未知或低置信度项。" : "The current snapshot has no unknown or low-confidence items."} /> : null}
        {queue.map((item) => {
          const decision = decisions[item.candidate.id]?.decision ?? item.decision;
          return (
            <article className="unknown-review-row" key={item.candidate.id}>
              <div>
                <strong>{item.candidate.name}</strong>
                <p>{item.reason}</p>
                <small>{item.candidate.source} · {item.candidate.version || "-"} · {decisionLabel(decision, locale)}</small>
              </div>
              <div>
                <Button variant="secondary" disabled={loading} onClick={() => void onDecision({ candidateId: item.candidate.id, decision: "migrate-artifact" })}>{zh ? "手工迁移" : "Manual item"}</Button>
                <Button variant="secondary" disabled={loading} onClick={() => void onDecision({ candidateId: item.candidate.id, decision: "create-catalog-draft" })}>{zh ? "生成草稿" : "Catalog draft"}</Button>
                <Button variant="secondary" disabled={loading} onClick={() => void onDecision({ candidateId: item.candidate.id, decision: "record-only" })}>{zh ? "仅记录" : "Record"}</Button>
                <Button variant="ghost" disabled={loading} onClick={() => void onDecision({ candidateId: item.candidate.id, decision: "skipped" })}>{zh ? "跳过" : "Skip"}</Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ConfigDataReviewStep({ locale, analysis, configBundles, configDecisions, dataDecisions, loading, onRefresh, onConfigDecision, onDataDecision }: { locale: Locale; analysis: MigrationSessionAnalysis | null; configBundles: ConfigBundle[]; configDecisions: MigrationConfigDecision[]; dataDecisions: MigrationDataDecision[]; loading: boolean; onRefresh: () => void; onConfigDecision: (input: { bundleId: string; strategy: ConfigBundle["migrationStrategy"]; status: "approved" | "blocked"; note?: string }) => Promise<void>; onDataDecision: (input: { candidateId: string; strategy: "no-data" | "backup-restore" | "rsync-copy" | "export-import" | "manual" | "external"; status: "confirmed" | "blocked"; paths?: string[]; note?: string }) => Promise<void> }) {
  const zh = locale === "zh";
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
          <p className="eyebrow">{zh ? "配置与数据审核" : "Config and data review"}</p>
          <h3>{zh ? "按 ConfigBundle 审核，不展示整机文件树" : "Review ConfigBundles, not the whole file tree"}</h3>
        </div>
        <Button variant="secondary" disabled={loading} onClick={onRefresh}><RefreshCw aria-hidden />{zh ? "刷新" : "Refresh"}</Button>
      </div>
      {unresolvedSecrets.length > 0 ? (
        <div className="pipeline-warning"><ShieldAlert aria-hidden />{zh ? `仍有 ${unresolvedSecrets.length} 个 secret/blocked bundle 未显式确认，apply 会被阻断。` : `${unresolvedSecrets.length} secret/blocked bundle(s) still block apply until explicitly confirmed.`}</div>
      ) : null}
      <div className="config-bundle-grid">
        {relevant.length === 0 ? <EmptyPipelineState title={zh ? "没有需要审核的 bundle" : "No bundles require review"} body={zh ? "已选择项暂未关联配置或数据 bundle。" : "Selected items do not currently expose config or data bundles."} /> : null}
        {relevant.map((bundle) => {
          const decision = configById.get(bundle.id);
          return (
            <article className={`config-bundle-card sensitivity-${bundle.sensitivity}`} key={bundle.id}>
              <header>
                <div>
                  <strong>{bundle.ownerDisplayName ?? bundle.ownerRuleId ?? bundle.ownerCapabilityKey ?? (zh ? "未知归属" : "Unknown owner")}</strong>
                  <small>{bundle.paths.length} {zh ? "个路径" : "path(s)"} · {bundle.ownership}</small>
                </div>
                <span className={`risk-chip risk-${bundle.riskLevel}`}>{riskLabel(bundle.riskLevel, locale)}</span>
              </header>
              <dl className="bundle-facts">
                <div><dt>{zh ? "默认状态" : "Default"}</dt><dd>{bundle.defaultStatus}</dd></div>
                <div><dt>Secret</dt><dd>{bundle.sensitivity}</dd></div>
                <div><dt>{zh ? "策略" : "Strategy"}</dt><dd>{decision?.strategy ?? bundle.migrationStrategy}</dd></div>
                <div><dt>{zh ? "决策" : "Decision"}</dt><dd>{decision?.status ?? (zh ? "未确认" : "pending")}</dd></div>
              </dl>
              <p>{bundle.rollbackStrategy ?? (zh ? "应用前需要目标备份和回滚点。" : "Target backup and rollback checkpoint required before apply.")}</p>
              <div className="bundle-decision-actions">
                <Button variant="secondary" disabled={loading} onClick={() => void onConfigDecision({ bundleId: bundle.id, strategy: bundle.migrationStrategy, status: "approved", note: "ConfigBundle strategy reviewed." })}>{zh ? "确认策略" : "Confirm"}</Button>
                {(bundle.sensitivity === "secret" || bundle.migrationStrategy === "secret-out-of-band") ? (
                  <Button variant="secondary" disabled={loading} onClick={() => void onConfigDecision({ bundleId: bundle.id, strategy: "secret-out-of-band", status: "approved", note: "Secret handled out of band; raw value will not be copied." })}>{zh ? "Secret 线下处理" : "Secret out-of-band"}</Button>
                ) : null}
                <Button variant="ghost" disabled={loading} onClick={() => void onConfigDecision({ bundleId: bundle.id, strategy: "blocked", status: "blocked", note: "Blocked by operator." })}>{zh ? "阻断" : "Block"}</Button>
                <Button variant="ghost" onClick={() => setDrawer(bundle)}><Eye aria-hidden />{zh ? "Diff / Raw" : "Diff / Raw"}</Button>
              </div>
            </article>
          );
        })}
      </div>
      <section className="data-strategy-panel">
        <div className="pipeline-section-heading">
          <div>
            <p className="eyebrow">{zh ? "数据策略确认" : "Data strategy confirmation"}</p>
            <h3>{zh ? "有数据路径的能力必须确认迁移方式" : "Capabilities with data paths require a confirmed strategy"}</h3>
          </div>
          <span className="selection-count">{dataCandidates.length}</span>
        </div>
        <div className="data-strategy-grid">
          {dataCandidates.length === 0 ? <p className="pipeline-muted">{zh ? "当前已选项没有需要确认的数据路径。" : "Selected items do not require a data strategy."}</p> : null}
          {dataCandidates.map((candidate) => {
            const decision = dataByCandidate.get(candidate.id);
            const paths = candidate.dataPaths ?? [];
            return (
              <article className="data-strategy-card" key={candidate.id}>
                <header>
                  <strong>{candidate.catalogRuleName ?? candidate.name}</strong>
                  <span className={`decision-chip decision-${decision?.status ?? "pending"}`}>{decision?.status ?? (zh ? "未确认" : "pending")}</span>
                </header>
                <p>{paths.length ? paths.join(" · ") : (zh ? "规则要求确认数据迁移方式。" : "The rule requires a data movement strategy.")}</p>
                <div className="bundle-decision-actions">
                  <Button variant="secondary" disabled={loading} onClick={() => void onDataDecision({ candidateId: candidate.id, strategy: "backup-restore", status: "confirmed", paths, note: "Backup/restore strategy confirmed." })}>{zh ? "备份恢复" : "Backup/restore"}</Button>
                  <Button variant="secondary" disabled={loading} onClick={() => void onDataDecision({ candidateId: candidate.id, strategy: "rsync-copy", status: "confirmed", paths, note: "Rsync/copy strategy confirmed." })}>{zh ? "同步复制" : "Rsync/copy"}</Button>
                  <Button variant="secondary" disabled={loading} onClick={() => void onDataDecision({ candidateId: candidate.id, strategy: "manual", status: "confirmed", paths, note: "Manual data migration confirmed." })}>{zh ? "手工迁移" : "Manual"}</Button>
                  <Button variant="ghost" disabled={loading} onClick={() => void onDataDecision({ candidateId: candidate.id, strategy: "manual", status: "blocked", paths, note: "Data strategy blocked by operator." })}>{zh ? "阻断" : "Block"}</Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      {drawer ? <ConfigBundleDrawer locale={locale} bundle={drawer} decision={configById.get(drawer.id)} onClose={() => setDrawer(null)} /> : null}
    </div>
  );
  return (
    <div className="pipeline-step-surface">
      <div className="pipeline-section-heading">
        <div>
          <p className="eyebrow">{zh ? "配置与数据审查" : "Config and data review"}</p>
          <h3>{zh ? "按 bundle 审查，不展示整机文件树" : "Review bundles, not the whole file tree"}</h3>
        </div>
        <Button variant="secondary" disabled={loading} onClick={onRefresh}><RefreshCw aria-hidden />{zh ? "刷新" : "Refresh"}</Button>
      </div>
      <div className="config-bundle-grid">
        {relevant.length === 0 ? <EmptyPipelineState title={zh ? "没有需要审查的 bundle" : "No bundles require review"} body={zh ? "已选择项暂未关联配置或数据 bundle。" : "Selected items do not currently expose config or data bundles."} /> : null}
        {relevant.map((bundle) => (
          <article className={`config-bundle-card sensitivity-${bundle.sensitivity}`} key={bundle.id}>
            <header>
              <div>
                <strong>{bundle.ownerDisplayName ?? bundle.ownerRuleId ?? bundle.ownerCapabilityKey ?? (zh ? "未知归属" : "Unknown owner")}</strong>
                <small>{bundle.paths.length} {zh ? "个文件" : "file(s)"} · {bundle.ownership}</small>
              </div>
              <span className={`risk-chip risk-${bundle.riskLevel}`}>{riskLabel(bundle.riskLevel, locale)}</span>
            </header>
            <dl className="bundle-facts">
              <div><dt>{zh ? "默认状态" : "Default"}</dt><dd>{bundle.defaultStatus}</dd></div>
              <div><dt>Secret</dt><dd>{bundle.sensitivity}</dd></div>
              <div><dt>{zh ? "策略" : "Strategy"}</dt><dd>{bundle.migrationStrategy}</dd></div>
              <div><dt>{zh ? "验证" : "Validation"}</dt><dd>{bundle.validationHint ?? "-"}</dd></div>
            </dl>
            <p>{bundle.rollbackStrategy ?? (zh ? "应用前需要目标备份和回滚点。" : "Target backup and rollback checkpoint required before apply.")}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function ConfigBundleDrawer({ locale, bundle, decision, onClose }: { locale: Locale; bundle: ConfigBundle; decision?: MigrationConfigDecision; onClose: () => void }) {
  const zh = locale === "zh";
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
          <Button variant="ghost" className="icon-action" onClick={onClose} aria-label="Close"><X aria-hidden /></Button>
        </header>
        <section>
          <h3>{zh ? "审核摘要" : "Review summary"}</h3>
          <dl className="bundle-facts">
            <div><dt>{zh ? "策略" : "Strategy"}</dt><dd>{decision?.strategy ?? bundle.migrationStrategy}</dd></div>
            <div><dt>{zh ? "决策" : "Decision"}</dt><dd>{decision?.status ?? "pending"}</dd></div>
            <div><dt>{zh ? "敏感度" : "Sensitivity"}</dt><dd>{bundle.sensitivity}</dd></div>
            <div><dt>{zh ? "风险" : "Risk"}</dt><dd>{bundle.riskLevel}</dd></div>
          </dl>
        </section>
        <section>
          <h3>{zh ? "Diff / Raw 入口" : "Diff / Raw detail"}</h3>
          <p className="pipeline-muted">{zh ? "当前阶段只展示脱敏路径、策略和审核原因；真实内容 diff 后续由连接内文件读取能力提供。" : "This view exposes redacted paths, strategy, and reasons. Raw file content is intentionally not loaded here."}</p>
          <pre>{JSON.stringify({ id: bundle.id, paths: safePaths, reasons: bundle.reasons, validationHint: bundle.validationHint, rollbackStrategy: bundle.rollbackStrategy }, null, 2)}</pre>
        </section>
      </aside>
    </div>
  );
}

function PlanPreviewStep({ locale, session, plan, loading, onRefresh }: { locale: Locale; session: MigrationSessionView | null; plan: MigrationPlan | null; loading: boolean; onRefresh: () => void }) {
  const zh = locale === "zh";
  const groups = groupPlanActions(plan);
  const blocked = (session?.summary.pendingReviewCount ?? 0) > 0;
  return (
    <div className="pipeline-step-surface">
      <div className="pipeline-section-heading">
        <div>
          <p className="eyebrow">{zh ? "Migration Plan 预览" : "Migration Plan preview"}</p>
          <h3>{zh ? "完整计划只在这里显示" : "The full plan appears here"}</h3>
        </div>
        <Button variant="secondary" disabled={loading} onClick={onRefresh}><RefreshCw aria-hidden />{zh ? "刷新计划" : "Refresh plan"}</Button>
      </div>
      {blocked ? <div className="pipeline-warning"><AlertTriangle aria-hidden />{zh ? "仍有待审查项，不能继续执行。" : "Pending review remains; execution is blocked."}</div> : null}
      {!plan ? <EmptyPipelineState title={zh ? "计划尚未生成" : "Plan is not ready"} body={zh ? "选择迁移项并清理阻塞后刷新计划。" : "Select migration items and clear blockers, then refresh the plan."} /> : null}
      {plan ? (
        <div className="plan-action-groups">
          {Object.entries(groups).map(([group, actions]) => (
            <section className="plan-action-group" key={group}>
              <h4>{group}</h4>
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
    </div>
  );
}

function TargetDryRunStep({ locale, sourceConnectionId, session, connections, dryRun, loading, onSelectTarget, onDryRun }: { locale: Locale; sourceConnectionId: string; session: MigrationSessionView | null; connections: ConnectionProfile[]; dryRun: MigrationDryRunResult | null; loading: boolean; onSelectTarget: (id: string) => void; onDryRun: () => void }) {
  const zh = locale === "zh";
  const targets = connections.filter((connection) => connection.id !== sourceConnectionId);
  return (
    <div className="pipeline-step-surface target-dryrun-layout">
      <section>
        <p className="eyebrow">{zh ? "目标机器" : "Target machine"}</p>
        <h3>{zh ? "选择目标并执行 dry-run" : "Choose target and run dry-run"}</h3>
        <select value={session?.targetConnectionId ?? ""} onChange={(event) => event.target.value && onSelectTarget(event.target.value)}>
          <option value="">{zh ? "选择目标连接" : "Select target connection"}</option>
          {targets.map((connection) => <option key={connection.id} value={connection.id}>{connection.label} · {connection.fields.host ?? "-"}</option>)}
        </select>
        <Button variant="primary" disabled={!session || loading} onClick={onDryRun}><Play aria-hidden />{zh ? "运行 dry-run" : "Run dry-run"}</Button>
      </section>
      <section className="dryrun-result-panel">
        <h4>{zh ? "Dry-run 结果" : "Dry-run result"}</h4>
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
        ) : <p className="pipeline-muted">{zh ? "dry-run 不会修改目标机器。" : "Dry-run does not mutate the target machine."}</p>}
      </section>
    </div>
  );
}

function ApplyReportStep({ locale, mode, session, dryRun, readiness, applyResult, verifyResult, report, loading, onRefreshReadiness, onApply, onVerify, onReport }: { locale: Locale; mode: "apply" | "report"; session: MigrationSessionView | null; dryRun: MigrationDryRunResult | null; readiness: MigrationSessionApplyReadiness | null; applyResult: MigrationApplyResult | null; verifyResult: MigrationVerificationRunResult | null; report: MigrationSessionReport | null; loading: boolean; onRefreshReadiness: () => void; onApply: () => void; onVerify: () => void; onReport: () => void }) {
  const zh = locale === "zh";
  const blockers = readiness?.blockers ?? [];
  const warnings = readiness?.warnings ?? [];
  const canApply = Boolean(readiness?.ready && !loading);
  const canVerify = Boolean((applyResult?.ok || session?.status === "applied" || session?.lastApplyAt) && !loading);
  return (
    <div className="pipeline-step-surface apply-report-layout">
      <div className="pipeline-section-heading">
        <div>
          <p className="eyebrow">{mode === "report" ? (zh ? "验证与报告" : "Verify and report") : (zh ? "执行门禁" : "Apply readiness")}</p>
          <h3>{zh ? "先看 readiness，再执行 apply / verify / report 闭环" : "Check readiness before apply, then verify and report"}</h3>
        </div>
        <Button variant="secondary" disabled={loading} onClick={onRefreshReadiness}><RefreshCw aria-hidden />{zh ? "刷新门禁" : "Refresh readiness"}</Button>
      </div>
      <div className="apply-readiness-grid">
        <article className={`apply-readiness-card ${readiness?.ready ? "ready" : "blocked"}`}>
          <header>
            <strong>{readiness?.ready ? (zh ? "可执行" : "Ready") : (zh ? "被阻断" : "Blocked")}</strong>
            <span className={`risk-chip ${readiness?.ready ? "risk-safe" : "risk-dangerous"}`}>{readiness?.ready ? "ready" : "blocked"}</span>
          </header>
          <div className="dryrun-summary">
            <Metric label="dry-run" value={dryRun?.summary.total ?? Number(readiness?.dryRun?.summary?.total ?? 0)} tone={readiness?.dryRun?.status === "passed" ? "safe" : "warn"} />
            <Metric label="blockers" value={blockers.length} tone={blockers.length ? "danger" : "safe"} />
            <Metric label="warnings" value={warnings.length} tone={warnings.length ? "warn" : "neutral"} />
          </div>
          {blockers.length ? (
            <ul className="readiness-list">
              {blockers.slice(0, 8).map((blocker, index) => <li key={`blocker-${index}`}>{blocker}</li>)}
            </ul>
          ) : <p className="pipeline-muted">{zh ? "当前没有阻断项。真实执行仍会记录审计与回滚信息。" : "No blockers. Apply will still record audit and rollback details."}</p>}
        </article>
        <article className="apply-readiness-card">
          <header><strong>{zh ? "回滚信息" : "Rollback"}</strong></header>
          <p className="pipeline-muted">{report?.rollback?.available ? (report.rollback.rolledBack ? (zh ? "最近一次 apply 已触发回滚。" : "The latest apply triggered rollback.") : (zh ? "最近一次 apply 有可见回滚上下文。" : "The latest apply has visible rollback context.")) : (zh ? "apply 前暂无回滚记录；执行时会记录安装包和服务状态回滚点。" : "No rollback record yet; apply captures package/service rollback context.")}</p>
          {report?.rollback?.steps?.length ? (
            <div className="dryrun-step-list">{report.rollback.steps.slice(0, 5).map((step, index) => <span key={`rollback-${index}`}>{step.status ?? "-"} · {step.label ?? step.message ?? "-"}</span>)}</div>
          ) : null}
        </article>
      </div>
      <div className="apply-command-row">
        <Button variant="primary" disabled={!canApply} onClick={onApply}><Play aria-hidden />{zh ? "执行 apply" : "Apply"}</Button>
        <Button variant="secondary" disabled={!canVerify} onClick={onVerify}><CheckCircle2 aria-hidden />{zh ? "执行 verify" : "Verify"}</Button>
        <Button variant="secondary" disabled={!session || loading} onClick={onReport}><FileText aria-hidden />{zh ? "生成报告" : "Report"}</Button>
      </div>
      <div className="apply-run-grid">
        <RunSummaryCard title="Apply" ok={applyResult?.ok} total={applyResult?.summary.total ?? Number(report?.apply?.summary?.total ?? 0)} failed={applyResult?.summary.failed ?? Number(report?.apply?.summary?.failed ?? 0)} />
        <RunSummaryCard title="Verify" ok={verifyResult?.ok} total={verifyResult?.summary.total ?? Number(report?.verify?.summary?.total ?? 0)} failed={verifyResult?.summary.failed ?? Number(report?.verify?.summary?.failed ?? 0)} />
        <RunSummaryCard title="Report" ok={Boolean(report)} total={report?.plan?.items ?? session?.summary.planItemCount ?? 0} failed={report?.readiness?.blockers.length ?? 0} />
      </div>
      {report ? (
        <section className="session-report-panel">
          <h4>{zh ? "报告摘要" : "Report summary"}</h4>
          <div className="dryrun-step-list">
            <span>{zh ? "源" : "Source"} · {report.sourceHost}</span>
            <span>{zh ? "目标" : "Target"} · {report.targetConnectionId ?? "-"}</span>
            <span>{zh ? "验证" : "Verify"} · {report.verify?.status ?? "-"}</span>
            <span>{zh ? "回滚" : "Rollback"} · {report.rollback?.rolledBack ? "rolled-back" : (report.rollback?.available ? "available" : "-")}</span>
          </div>
        </section>
      ) : null}
    </div>
  );
  return (
    <div className="pipeline-step-surface apply-report-placeholder">
      <CheckCircle2 aria-hidden />
      <h3>{zh ? "执行、验证、报告将在第八阶段闭环" : "Apply, verify, and report close in phase 8"}</h3>
      <p>{zh ? "当前第 5/6 阶段先完成流水线外壳和能力级选择。后续会接入 apply、verify、rollback 和 report 端点。" : "This phase focuses on the pipeline shell and capability-level selection. Apply, verify, rollback, and report endpoints come next."}</p>
      <div className="apply-report-facts">
        <Metric label={zh ? "会话状态" : "Status"} value={session ? 1 : 0} />
        <Metric label="dry-run" value={dryRun?.summary.total ?? 0} />
      </div>
    </div>
  );
}

function RunSummaryCard({ title, ok, total, failed }: { title: string; ok?: boolean; total: number; failed: number }) {
  return (
    <article className={`run-summary-card ${ok === false || failed > 0 ? "failed" : ok ? "ok" : ""}`}>
      <strong>{title}</strong>
      <div className="dryrun-summary">
        <Metric label="total" value={total} />
        <Metric label="failed" value={failed} tone={failed > 0 ? "danger" : "safe"} />
      </div>
    </article>
  );
}

function EvidenceDrawer({ locale, candidate, onClose }: { locale: Locale; candidate: MigrationCandidate; onClose: () => void }) {
  const zh = locale === "zh";
  return (
    <div className="drawer-overlay" role="dialog" aria-modal="true">
      <aside className="evidence-drawer">
        <header className="drawer-header">
          <div>
            <p className="eyebrow">{zh ? "原始证据" : "Raw evidence"}</p>
            <h2>{candidate.catalogRuleName ?? candidate.name}</h2>
          </div>
          <Button variant="ghost" className="icon-action" onClick={onClose} aria-label="Close"><X aria-hidden /></Button>
        </header>
        <section>
          <h3>{zh ? "证据摘要" : "Evidence summary"}</h3>
          <ul>
            {candidate.reasons.map((reason, index) => <li key={`reason-${index}`}>{reason}</li>)}
          </ul>
        </section>
        <section>
          <h3>{zh ? "Raw evidence" : "Raw evidence"}</h3>
          <pre>{JSON.stringify(candidate.rawEvidence ?? [], null, 2)}</pre>
        </section>
        <section>
          <h3>{zh ? "Normalized artifacts" : "Normalized artifacts"}</h3>
          <pre>{JSON.stringify(candidate.normalizedArtifacts ?? [], null, 2)}</pre>
        </section>
      </aside>
    </div>
  );
}

function MetricCard({ icon, label, value, tone = "neutral" }: { icon: React.ReactNode; label: string; value: number; tone?: "neutral" | "safe" | "warn" | "danger" }) {
  return <article className={`analysis-metric-card ${tone}`}>{icon}<strong>{value}</strong><span>{label}</span></article>;
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return <span><strong>{label}</strong>{value}</span>;
}

function Score({ label, value }: { label: string; value: number }) {
  return <span className="score-pill"><strong>{Math.round(value * 100)}%</strong>{label}</span>;
}

function EmptyPipelineState({ title, body }: { title: string; body: string }) {
  return <div className="pipeline-empty-state"><h3>{title}</h3><p>{body}</p></div>;
}

function stepLabel(step: MigrationSessionStep, locale: Locale): string {
  const labels: Record<MigrationSessionStep, { zh: string; en: string }> = {
    source: { zh: "源主机", en: "Source" },
    analysis: { zh: "分析", en: "Analysis" },
    select: { zh: "选择", en: "Select" },
    unknown: { zh: "未知项", en: "Unknown" },
    "config-data": { zh: "配置/数据", en: "Config/Data" },
    plan: { zh: "计划", en: "Plan" },
    target: { zh: "目标/Dry-run", en: "Target/Dry-run" },
    apply: { zh: "执行", en: "Apply" },
    report: { zh: "报告", en: "Report" }
  };
  return locale === "zh" ? labels[step].zh : labels[step].en;
}

function connectionStatus(status: ConnectionProfile["status"], locale: Locale): string {
  const labels: Record<ConnectionProfile["status"], { zh: string; en: string }> = {
    probed: { zh: "已采集", en: "Collected" },
    ssh_ok: { zh: "SSH 成功", en: "SSH OK" },
    validated: { zh: "已保存", en: "Saved" },
    ssh_failed: { zh: "SSH 失败", en: "SSH failed" },
    unreachable: { zh: "不可达", en: "Unreachable" }
  };
  return locale === "zh" ? labels[status].zh : labels[status].en;
}

function candidateGroup(candidate: MigrationCandidate): string {
  const key = `${candidate.catalogRuleId ?? ""} ${candidate.catalogRuleName ?? ""} ${candidate.name} ${candidate.migrationClass} ${candidate.source}`.toLowerCase();
  if (candidate.migrationClass === "container-workload" || key.includes("docker") || key.includes("container")) return "container";
  if (candidate.migrationClass === "manual-install") return "manual";
  if (candidate.migrationClass === "unknown-review") return "unknown";
  if (key.includes("postgres") || key.includes("mysql") || key.includes("redis") || key.includes("database") || key.includes("mongo")) return "database";
  if (key.includes("nginx") || key.includes("apache") || key.includes("traefik") || key.includes("web")) return "web";
  if (candidate.riskLevel === "privileged" || key.includes("ssh") || key.includes("firewall") || key.includes("security")) return "security";
  return "runtime";
}

function groupLabel(group: string, locale: Locale): string {
  const labels: Record<string, { zh: string; en: string }> = {
    all: { zh: "全部", en: "All" },
    web: { zh: "Web", en: "Web" },
    database: { zh: "数据库", en: "Database" },
    runtime: { zh: "运行时", en: "Runtime" },
    container: { zh: "容器", en: "Container" },
    security: { zh: "安全", en: "Security" },
    manual: { zh: "手工", en: "Manual" },
    unknown: { zh: "未知", en: "Unknown" }
  };
  return locale === "zh" ? (labels[group]?.zh ?? group) : (labels[group]?.en ?? group);
}

function evidenceSummary(candidate: MigrationCandidate, locale: Locale): string {
  const parts = [
    ...(candidate.packageNames ?? []).slice(0, 4).map((name) => `pkg:${name}`),
    ...(candidate.serviceNames ?? []).slice(0, 3).map((name) => `svc:${name}`),
    ...(candidate.ports ?? []).slice(0, 3).map((port) => `:${port}`),
    ...(candidate.configPaths ?? []).slice(0, 2).map((path) => `cfg:${path}`)
  ];
  if (parts.length) return parts.join(" · ");
  return locale === "zh" ? `${candidate.source} 证据 · ${candidate.version || "未知版本"}` : `${candidate.source} evidence · ${candidate.version || "unknown version"}`;
}

function decisionLabel(decision: ReviewDecision, locale: Locale): string {
  const zh: Record<ReviewDecision, string> = {
    pending: "待定",
    approved: "批准",
    skipped: "跳过",
    ignore: "忽略",
    "record-only": "仅记录",
    "migrate-artifact": "手工迁移",
    "create-catalog-draft": "规则草稿",
    "add-to-plan": "加入计划",
    "needs-manual-instruction": "需手工指引"
  };
  const en: Record<ReviewDecision, string> = {
    pending: "Pending",
    approved: "Approved",
    skipped: "Skipped",
    ignore: "Ignored",
    "record-only": "Record only",
    "migrate-artifact": "Manual item",
    "create-catalog-draft": "Catalog draft",
    "add-to-plan": "Added",
    "needs-manual-instruction": "Manual guide"
  };
  return locale === "zh" ? zh[decision] : en[decision];
}

function riskLabel(risk: MigrationCandidate["riskLevel"], locale: Locale): string {
  const zh = { safe: "安全", review: "需审查", privileged: "高权限", dangerous: "危险" } as const;
  const en = { safe: "Safe", review: "Review", privileged: "Privileged", dangerous: "Dangerous" } as const;
  return (locale === "zh" ? zh : en)[risk];
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
