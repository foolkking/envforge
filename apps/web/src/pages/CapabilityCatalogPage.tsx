import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  cancelTaskRequest,
  checkCompatibility,
  createEnvironmentPlan,
  createRebuildPlan,
  fetchBatchImpact,
  fetchDockerCompose,
  fetchCatalogGuide,
  fetchPlaybookPreview,
  listEnvironmentPlans,
  fetchTargetDistro,
  fetchVarsSchema,
  runPreflightCheck,
  type BatchImpactResult,
  type CatalogGuide,
  type CatalogItem,
  type CompatibilityLevel,
  type CompatibilityResult,
  type DistroInfo,
  type ExecutionTask,
  type EnvironmentPlan,
  type PreflightReport,
  type VarsSchema
} from "../api";
import type { Locale } from "../lib/types";
import { categoryIcons } from "../lib/types";
import { useEscapeToClose } from "../lib/useEscapeToClose";
import { ComponentPreview, getCatalogComponents } from "../components/ComponentPreview";
import { PreflightPanel } from "../components/PreflightPanel";
import { BUILD_PIPELINE_TITLE_KEY, WorkflowStepper, buildBuildSteps } from "../components/WorkflowStepper";
import { MarkdownOverlay } from "../components/MarkdownOverlay";
import { ConfigureRunPanel } from "../components/ConfigureRunPanel";
import { Button } from "../components/ui/Button";
import { FilterPill } from "../components/ui/FilterPill";
import { Badge } from "../components/ui/Badge";
import { PlanReviewPanel } from "../components/PlanReviewPanel";

const BUILD_CATEGORY_KEYS = {
  runtime: "capabilityCatalog.categories.runtime",
  database: "capabilityCatalog.categories.database",
  security: "capabilityCatalog.categories.security",
  network: "capabilityCatalog.categories.network",
  container: "capabilityCatalog.categories.container",
  developer: "capabilityCatalog.categories.developer",
  service: "capabilityCatalog.categories.service"
} as const;

export function CapabilityCatalogPage({
  locale,
  items,
  selected,
  onOpenGuide,
  onToggle,
  authToken,
  activeConnectionId,
  activeTask,
  onTaskUpdate,
  onNavigateToPlans
}: {
  locale: Locale;
  items: CatalogItem[];
  selected: Set<string>;
  onOpenGuide: (id: string) => void;
  onToggle: (id: string) => void;
  authToken: string;
  activeConnectionId: string | null;
  activeTask: ExecutionTask | null;
  onTaskUpdate: (task: ExecutionTask) => void;
  /** Hand off to the Plan center to review / apply / verify the generated plan. */
  onNavigateToPlans?: () => void;
}) {
  const { t: i18nT } = useTranslation();
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [taskError, setTaskError] = useState("");
  const [batchInstalling, setBatchInstalling] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  // Paginate the catalog so the grid doesn't render ~120 cards at once
  // (an endless scroll, especially on mobile). Reset when the filter changes.
  const [visibleCount, setVisibleCount] = useState(30);
  useEffect(() => { setVisibleCount(30); }, [categoryFilter]);
  const [phase, setPhase] = useState<"select" | "review">("select");
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeRebuildPlan, setActiveRebuildPlan] = useState<EnvironmentPlan | null>(null);
  // Persisted Build / Rebuild plan state for the active connection. Refreshed
  // on mount so the stepper shows real progress even after reload. Each
  // signal maps to one stage of the 9-step Build pipeline:
  //   hasPlan       → step 5 "Rebuild Plan"
  //   hasReviewed   → step 6 "Review"  (status >= "approved")
  //   hasApplied    → step 7 "Apply"   (status >= "applying")
  //   hasVerified   → step 8 "Verify"  (any persisted verifyResults)
  //   hasReport     → step 9 "Report"  (terminal status)
  const [buildPlanState, setBuildPlanState] = useState<{
    hasPlan: boolean;
    hasReviewed: boolean;
    hasApplied: boolean;
    hasVerified: boolean;
    hasReport: boolean;
  }>({ hasPlan: false, hasReviewed: false, hasApplied: false, hasVerified: false, hasReport: false });
  const [impact, setImpact] = useState<BatchImpactResult | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [dockerComposeId, setDockerComposeId] = useState<string | null>(null);
  const [dockerComposeContent, setDockerComposeContent] = useState("");
  useEscapeToClose(() => handleCloseDockerModal(), dockerComposeId !== null);
  const [preflightReport, setPreflightReport] = useState<PreflightReport | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [postPlanGuide, setPostPlanGuide] = useState<CatalogGuide | null>(null);

  // Configurable recipe flow: when the user clicks "configure plan" on a
  // card, we fetch the schema + guide in parallel and open the split-pane modal.
  const [configureItem, setConfigureItem] = useState<CatalogItem | null>(null);
  const [configureSchema, setConfigureSchema] = useState<VarsSchema | null>(null);
  const [configureGuide, setConfigureGuide] = useState<CatalogGuide | null>(null);
  const [configureLoading, setConfigureLoading] = useState(false);
  const [configureSubmitting, setConfigureSubmitting] = useState(false);
  const [configureFieldErrors, setConfigureFieldErrors] = useState<Record<string, string> | undefined>();

  const [targetDistro, setTargetDistro] = useState<DistroInfo | null>(null);
  const [compatibilityMap, setCompatibilityMap] = useState<Map<string, CompatibilityResult>>(new Map());

  useEffect(() => {
    if (!authToken || !activeConnectionId) {
      setTargetDistro(null);
      setCompatibilityMap(new Map());
      return;
    }
    let cancelled = false;
    void fetchTargetDistro(authToken, activeConnectionId)
      .then((d) => { if (!cancelled) setTargetDistro(d); })
      .catch(() => { if (!cancelled) setTargetDistro(null); });
    return () => { cancelled = true; };
  }, [authToken, activeConnectionId]);

  // Pull persisted Rebuild plans for the active connection so the workflow
  // stepper reflects real progress: a plan exists, the operator picked a
  // target, and at least one apply has been started.
  useEffect(() => {
    if (!authToken || !activeConnectionId) {
      setBuildPlanState({ hasPlan: false, hasReviewed: false, hasApplied: false, hasVerified: false, hasReport: false });
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const all = await listEnvironmentPlans(authToken, { targetConnectionId: activeConnectionId });
        if (cancelled) return;
        const rebuilds = all.filter((row) => row.type === "rebuild");
        const reviewedStatuses = new Set<NonNullable<EnvironmentPlan["status"]>>(["approved", "applying", "verifying", "succeeded", "partially-succeeded", "failed", "rolled-back", "committed"]);
        const appliedStatuses = new Set<NonNullable<EnvironmentPlan["status"]>>(["applying", "verifying", "succeeded", "partially-succeeded", "failed", "rolled-back", "committed"]);
        const terminalStatuses = new Set<NonNullable<EnvironmentPlan["status"]>>(["succeeded", "partially-succeeded", "failed", "rolled-back", "committed"]);
        const hasPlan = rebuilds.length > 0;
        const hasReviewed = rebuilds.some((row) => reviewedStatuses.has(row.status ?? "draft"));
        const hasApplied = rebuilds.some((row) => appliedStatuses.has(row.status ?? "draft"));
        const hasVerified = rebuilds.some((row) => row.verifyResults.length > 0);
        const hasReport = rebuilds.some((row) => terminalStatuses.has(row.status ?? "draft"));
        setBuildPlanState({ hasPlan, hasReviewed, hasApplied, hasVerified, hasReport });
      } catch {
        // Fail closed.
      }
    })();
    return () => { cancelled = true; };
  }, [authToken, activeConnectionId, activeRebuildPlan, activeTaskId]);

  useEffect(() => {
    if (!authToken || !activeConnectionId || selected.size === 0) {
      setCompatibilityMap(new Map());
      return;
    }
    const ids = items.filter((i) => selected.has(i.id)).map((i) => i.id);
    if (ids.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await checkCompatibility(authToken, activeConnectionId, ids);
        if (!cancelled) {
          const map = new Map<string, CompatibilityResult>();
          for (const r of result.results) map.set(r.catalogId, r);
          setCompatibilityMap(map);
          setTargetDistro(result.distro);
        }
      } catch { /* best-effort: ignore */ }
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [authToken, activeConnectionId, selected.size, items]);

  // Auto-fetch impact when selection changes (debounced)
  useEffect(() => {
    const selectedIds = items.filter((i) => selected.has(i.id)).map((i) => i.id);
    if (selectedIds.length === 0) { setImpact(null); return; }

    setLoadingImpact(true);
    const timer = setTimeout(async () => {
      try {
        const result = await fetchBatchImpact(selectedIds);
        setImpact(result);
      } catch { /* silent */ } finally {
        setLoadingImpact(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timer);
  }, [selected.size, items]);

  async function handleExecute(itemId: string, dryRun: boolean): Promise<boolean> {
    if (!authToken || !activeConnectionId) {
      setTaskError("Login and select a connected VM first");
      return false;
    }
    setExecutingId(itemId);
    setTaskError("");
    return new Promise<boolean>((resolve) => {
      createEnvironmentPlan(authToken, {
        type: "rebuild",
        targetConnectionId: activeConnectionId,
        source: { kind: "capability-selection", capabilityIds: [itemId] }
      })
        .then(({ plan }) => {
          setActiveRebuildPlan(plan);
          return { plan, dryRun };
        })
        .then((result) => {
          setActiveRebuildPlan(result.plan);
          setExecutingId(null);
          resolve(true);
        })
        .catch((err: unknown) => {
          setTaskError(err instanceof Error ? err.message : "Execution failed");
          setExecutingId(null);
          resolve(false);
        });
    });
  }

  async function handleBatchInstall(dryRun: boolean) {
    if (!authToken || !activeConnectionId) {
      setTaskError("Login and select a connected VM first");
      return;
    }
    const selectedItems = items.filter((i) => selected.has(i.id));
    if (selectedItems.length === 0) return;

    setBatchInstalling(true);
    setBatchProgress({ done: 0, total: selectedItems.length });
    setTaskError("");

    try {
      const { plan } = await createRebuildPlan(
        authToken,
        activeConnectionId,
        selectedItems.map((i) => i.id)
      );
      setActiveRebuildPlan(plan);
      setBatchInstalling(false);
      setBatchProgress(null);
      return;
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : i18nT("capabilityCatalog.createPlanFailed"));
      setBatchInstalling(false);
      setBatchProgress(null);
    }
  }

  async function handlePreflightThenGeneratePlan() {
    if (!authToken || !activeConnectionId) {
      setTaskError("Login and select a connected VM first");
      return;
    }
    setPreflightLoading(true);
    setPreflightReport(null);
    try {
      const report = await runPreflightCheck(authToken, activeConnectionId);
      setPreflightReport(report);
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : "Preflight failed");
    } finally {
      setPreflightLoading(false);
    }
  }

  async function handleCancelBatch() {
    if (!authToken || !activeTaskId) return;
    await cancelTaskRequest(authToken, activeTaskId);
  }

  async function handleShowDockerCompose(e: React.MouseEvent, itemId: string) {
    e.stopPropagation();
    setDockerComposeId(itemId);
    setDockerComposeContent("");
    try {
      const content = await fetchDockerCompose(itemId);
      setDockerComposeContent(content);
    } catch (err) {
      setDockerComposeContent(`# Error: ${err instanceof Error ? err.message : "Failed to load"}`);
    }
  }

  function handleCloseDockerModal() {
    setDockerComposeId(null);
    setDockerComposeContent("");
  }

  function handleCopyCompose() {
    if (dockerComposeContent) {
      void navigator.clipboard.writeText(dockerComposeContent);
    }
  }

  function handleDownloadCompose() {
    if (!dockerComposeContent || !dockerComposeId) return;
    const blob = new Blob([dockerComposeContent], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dockerComposeId}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Open the configure-and-run modal for a Playbook. Fetches the vars schema
   * and the guide markdown in parallel.
   *
   */
  async function handleOpenConfigure(item: CatalogItem) {
    if (!canExecute) {
      setTaskError(executeTooltip ?? "");
      return;
    }
    setConfigureLoading(true);
    setConfigureItem(item);
    setConfigureFieldErrors(undefined);
    try {
      const [schema, guide] = await Promise.all([
        fetchVarsSchema(item.id),
        fetchCatalogGuide(item.id).catch(() => null)
      ]);
      setConfigureSchema(schema);
      setConfigureGuide(guide);
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : "Failed to load configuration");
      setConfigureItem(null);
    } finally {
      setConfigureLoading(false);
    }
  }

  function handleCloseConfigure() {
    if (configureSubmitting) return; // don't close mid-submit
    setConfigureItem(null);
    setConfigureSchema(null);
    setConfigureGuide(null);
    setConfigureFieldErrors(undefined);
  }

  /**
   * User submitted the configure form. The configurable input now creates a
   * reviewed Rebuild Plan instead of directly executing the catalog recipe.
   */
  async function handleConfigureSubmit(vars: Record<string, unknown>) {
    if (!configureItem || !authToken || !activeConnectionId) return;
    setConfigureSubmitting(true);
    setConfigureFieldErrors(undefined);
    try {
      const preview = await fetchPlaybookPreview(authToken, configureItem.id, vars);
      if (!("preview" in preview)) {
        setConfigureFieldErrors(preview.fieldErrors);
        return;
      }
      const { plan } = await createEnvironmentPlan(authToken, {
        type: "imported-recipe",
        targetConnectionId: activeConnectionId,
        source: { kind: "recipe", yaml: preview.preview.renderedYaml, name: configureItem.nameEn || configureItem.name }
      });
      setActiveRebuildPlan(plan);
      const itemForGuide = configureItem;
      setConfigureItem(null);
      setConfigureSchema(null);
      setConfigureGuide(null);
      void fetchCatalogGuide(itemForGuide.id)
        .then((g) => setPostPlanGuide(g))
        .catch(() => { /* no guide is fine */ });
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setConfigureSubmitting(false);
    }
  }

  const componentLabels = {
    software: "Capability",
    "system-command": "Command",
    "system-config": "Config"
  };

  const canExecute = Boolean(authToken && activeConnectionId);
  const executeTooltip = !authToken
    ? i18nT("capabilityCatalog.loginRequired")
    : !activeConnectionId
    ? i18nT("capabilityCatalog.selectVm")
    : undefined;

  return (
    <div className="store-content">
      <WorkflowStepper
        locale={locale}
        titleKey={BUILD_PIPELINE_TITLE_KEY}
        steps={buildBuildSteps({
          hasConnection: Boolean(activeConnectionId),
          // Target Snapshot proxy: distro probe is a read-only snapshot of
          // the target. Once it succeeds we treat the snapshot step as done.
          hasTargetSnapshot: Boolean(targetDistro),
          hasSelection: selected.size > 0,
          // Build only offers certified capabilities. Conflicts now come
          // only from cross-distro compatibility:
          //  - a capability whose compatibility check returned `unsupported`,
          //  - a capability whose compatibility check returned `known_incompatible`.
          // Resolved means: a non-empty selection with none of those flags.
          hasConflictsResolved: selected.size > 0 && !items.some((item) => {
            if (!selected.has(item.id)) return false;
            const compat = compatibilityMap.get(item.id);
            if (!compat) return false;
            return compat.level === "unsupported";
          }),
          hasPlan: Boolean(activeRebuildPlan) || buildPlanState.hasPlan,
          hasReviewed: buildPlanState.hasReviewed,
          hasApplied: Boolean(activeTaskId) || buildPlanState.hasApplied,
          hasVerified: buildPlanState.hasVerified,
          hasReport: buildPlanState.hasReport
          // Build is a plan *producer*: the stepper shows only the production
          // stages (up to "Rebuild Plan"). Review / Apply / Verify / Report
          // are owned by the Plan center — see the hand-off button below.
        }).slice(0, 5)}
      />
      <div className="store-heading">
        <div>
          <h1>{i18nT("nav.pages.build")}</h1>
          <p className="store-hint">
            {`${items.length} items · ${selected.size} selected`}
            {targetDistro && (
              <span className={`distro-badge distro-family-${targetDistro.family}`} style={{ marginLeft: 10 }}>
                {targetDistro.family === "unknown" ? "Unknown distro" : targetDistro.prettyName}
              </span>
            )}
          </p>
        </div>
        <div className="market-header-actions">
          {phase === "review" ? (
            <Button variant="ghost" onClick={() => setPhase("select")}>
              {i18nT("capabilityCatalog.back")}
            </Button>
          ) : (selected.size > 0 || activeRebuildPlan) ? (
            <Button variant="secondary" onClick={() => setPhase("review")}>
              {i18nT("capabilityCatalog.reviewPlan")}
            </Button>
          ) : null}
          {onNavigateToPlans && (activeRebuildPlan || buildPlanState.hasPlan) ? (
            <Button variant="secondary" onClick={onNavigateToPlans}>
              {i18nT("capabilityCatalog.planCenter")}
            </Button>
          ) : null}
          {selected.size > 0 ? (
            <Button
              variant="ghost"
              onClick={() => {
                items.forEach((i) => { if (selected.has(i.id)) onToggle(i.id); });
              }}
            >
              {i18nT("capabilityCatalog.clear")}
            </Button>
          ) : null}
          {batchInstalling ? (
            <Button
              variant="ghost"
              style={{ color: "var(--ef-danger)", borderColor: "var(--ef-danger)" }}
              onClick={() => void handleCancelBatch()}
            >
              {i18nT("capabilityCatalog.cancel")}
            </Button>
          ) : null}
          <Button
            variant="primary"
            className="batch-install-btn"
            loading={batchInstalling}
            disabled={
              !canExecute ||
              selected.size === 0 ||
              batchInstalling
            }
            title={
              !canExecute
                ? executeTooltip
                : selected.size === 0
                ? i18nT("capabilityCatalog.selectFirst")
                : undefined
            }
            onClick={() => { setPhase("review"); void handlePreflightThenGeneratePlan(); }}
          >
            {batchInstalling
              ? batchProgress
                ? i18nT("capabilityCatalog.applying", { done: batchProgress.done, total: batchProgress.total })
                : i18nT("capabilityCatalog.preparing")
              : i18nT("capabilityCatalog.generate", { count: selected.size })}
          </Button>
        </div>
      </div>

      <div className={`build-workbench-grid phase-${phase}`}>
        <aside className="build-workbench-rail">
      {/* Build renders only certified capabilities. Not-ready items live
          in the Capability Admin registry. */}
      <div
        className="market-certified-banner"
        style={{
          background: "var(--ef-success-soft)",
          border: "1px solid var(--ef-success)",
          color: "var(--ef-success)",
          padding: "10px 14px",
          borderRadius: 8,
          margin: "8px 0",
          fontSize: 13
        }}
        data-testid="market-certified-banner"
      >
        <strong>{i18nT("capabilityCatalog.certifiedCount", { count: items.length })}</strong>
        {" "}
        {i18nT("capabilityCatalog.certifiedIntro")}
      </div>
      {items.length === 0 ? (
        <div
          className="market-empty-certified"
          style={{
            padding: 24,
            textAlign: "center",
            background: "var(--ef-surface-soft)",
            border: "1px dashed var(--ef-border)",
            borderRadius: 8,
            color: "var(--ef-muted)"
          }}
        >
          {i18nT("capabilityCatalog.certifiedOnly")}
        </div>
      ) : null}

      {/* Category filter pills */}
      <div className="market-category-filters">
        <FilterPill active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>
          {i18nT("capabilityCatalog.categories.all")}
        </FilterPill>
        {["runtime", "database", "security", "network", "container", "developer", "service"].map((cat) => (
          <FilterPill key={cat} active={categoryFilter === cat} onClick={() => setCategoryFilter(cat)}>
            {i18nT(BUILD_CATEGORY_KEYS[cat as keyof typeof BUILD_CATEGORY_KEYS])}
          </FilterPill>
        ))}
      </div>

        </aside>
        <aside className="build-plan-inspector">
      {taskError ? <p className="connection-error" style={{ marginBottom: 16 }}>{taskError}</p> : null}

      {selected.size > 0 && (impact || loadingImpact) ? (
        <div className="impact-panel">
          {loadingImpact ? (
            <div className="impact-loading"><span className="spinning">...</span>{i18nT("capabilityCatalog.estimating")}</div>
          ) : impact ? (
            <>
              <div className="impact-header">
                <span className={`impact-risk risk-${impact.totals.maxRisk}`}>{impact.totals.maxRisk}</span>
                <span className="impact-summary">{locale === "zh" ? impact.totals.summaryZh : impact.totals.summaryEn}</span>
              </div>
              <div className="impact-items">
                {impact.reports.map((r) => (
                  <div key={r.catalogId} className="impact-item">
                    <span className="impact-item-name">{r.name}</span>
                    <span className="impact-item-detail">{locale === "zh" ? r.impact.summaryZh : r.impact.summaryEn}</span>
                    {r.impact.needsSudo ? <Badge tone="warn">sudo</Badge> : null}
                    <button type="button" className="impact-item-remove" onClick={() => onToggle(r.catalogId)} disabled={batchInstalling} title={i18nT("capabilityCatalog.removeSelection", { name: r.name })} aria-label={i18nT("capabilityCatalog.removeSelection", { name: r.name })}>×</button>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
      {(preflightLoading || preflightReport) ? (
        <PreflightPanel
          report={preflightReport}
          loading={preflightLoading}
          locale={locale}
          onClose={() => { setPreflightReport(null); }}
          onProceed={() => {
            setPreflightReport(null);
            void handleBatchInstall(false);
          }}
          proceedDisabled={batchInstalling}
        />
      ) : null}
      {activeRebuildPlan ? (
        <div className="impact-panel">
          <div className="impact-header">
            <span className={`impact-risk risk-${activeRebuildPlan.summary.highRisk > 0 ? "high" : "low"}`}>
              {activeRebuildPlan.type}
            </span>
            <span className="impact-summary">
              {i18nT("capabilityCatalog.planSummary", { items: activeRebuildPlan.summary.totalItems, actions: activeRebuildPlan.summary.totalActions, sudo: activeRebuildPlan.summary.requiresSudo })}
            </span>
          </div>
          <div className="impact-items">
            {activeRebuildPlan.items.slice(0, 5).map((item) => (
              <div className="impact-item" key={item.id}>
                <span className="impact-item-name">{item.name}</span>
                <span className="impact-item-detail">{item.actions.map((action) => action.kind).join(" -> ")}</span>
              </div>
            ))}
          </div>
          {/* Catalog Audit Enforcement: in-place Plan Review for the
              freshly-generated Rebuild Plan. The operator must clear all
              conflicts / risks / approval gates before "Apply" runs. */}
          <PlanReviewPanel
            authToken={authToken}
            plan={activeRebuildPlan}
            locale={locale}
            onChanged={(updated) => setActiveRebuildPlan(updated)}
          />
        </div>
      ) : null}
      {!taskError && selected.size === 0 && !preflightLoading && !preflightReport && !activeRebuildPlan ? (
        <section className="build-plan-empty">
          <p className="eyebrow">{i18nT("capabilityCatalog.inspector")}</p>
          <h2>{i18nT("capabilityCatalog.waiting")}</h2>
          <p>{i18nT("capabilityCatalog.waitingBody")}</p>
        </section>
      ) : null}
        </aside>

        <section className="build-catalog-surface">
      <div className="catalog-grid build-catalog-grid">
        {items
          .filter((item) => categoryFilter === "all" || item.category === categoryFilter)
          .slice(0, visibleCount)
          .map((item) => {
          const Icon = categoryIcons[item.category];
          const isSelected = selected.has(item.id);
          const compat = compatibilityMap.get(item.id);
          return (
              <article
                className={`catalog-card ${isSelected ? "catalog-card-selected" : ""} ${compat ? `catalog-compat-${compat.level}` : ""}`}
                key={item.id}
                onClick={() => onToggle(item.id)}
              >
                <div className={`catalog-art ${item.imageTone}`}>
                  <div className="catalog-check">
                    <input type="checkbox" checked={isSelected} onChange={() => onToggle(item.id)} onClick={(e) => e.stopPropagation()} />
                  </div>
                  <Icon aria-hidden />
                </div>
                <div className="catalog-body" onClick={(e) => e.stopPropagation()}>
                  <div className="catalog-title-row">
                    <h2>{locale === "zh" ? item.name : item.nameEn}</h2>
                    <button className="catalog-md-link" type="button" onClick={() => onOpenGuide(item.id)} title={i18nT("capabilityCatalog.viewGuide")}>
                      MD
                    </button>
                    {item.deployModes?.includes("docker") ? (
                      <button
                        className="catalog-md-link catalog-compose-link"
                        type="button"
                        onClick={(e) => void handleShowDockerCompose(e, item.id)}
                        title={i18nT("capabilityCatalog.viewCompose")}
                        style={{ marginLeft: 4 }}
                      >
                        {i18nT("capabilityCatalog.compose")}
                      </button>
                    ) : null}
                    <button
                      className="catalog-md-link"
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleOpenConfigure(item); }}
                      title={i18nT("capabilityCatalog.configurePlan")}
                      disabled={!canExecute || configureLoading}
                      style={{ marginLeft: 4 }}
                    >
                      {i18nT("capabilityCatalog.configure")}
                    </button>
                  </div>
                  {compat && compat.level !== "verified" && compat.level !== "untested" && (
                    <div className={`catalog-compat-banner banner-${compat.level}`}>
                      {compat.level === "compatible" ? "info" : "warn"} {locale === "zh" ? compat.reasonZh : compat.reasonEn}
                    </div>
                  )}
                  <p>{locale === "zh" ? item.summary : item.summaryEn}</p>
                  <div className="catalog-support-row">
                    <span
                      className={`certification-badge certification-${item.certification?.status ?? "certified"}`}
                      title={i18nT("capabilityCatalog.certificationTitle")}
                      style={{
                        background: "var(--ef-success-soft)",
                        color: "var(--ef-success)",
                        border: "1px solid var(--ef-success)",
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 11
                      }}
                      data-testid={`certification-badge-${item.id}`}
                    >
                      {i18nT("capabilityCatalog.certified")}
                    </span>
                    <span>{i18nT("capabilityCatalog.appliesViaPlan")}</span>
                  </div>
                  <div className="catalog-meta">
                    <span>{item.installs}</span>
                    <span className={`sensitivity-tag sensitivity-${item.sensitivity}`}>{item.sensitivity}</span>
                  </div>
                  <ComponentPreview components={getCatalogComponents(item)} labels={componentLabels} locale={locale} compact={item.kind === "software"} />
                </div>
              </article>
          );
        })}
      </div>
        {(() => {
          const total = items.filter((item) => categoryFilter === "all" || item.category === categoryFilter).length;
          return total > visibleCount ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
              <Button variant="secondary" type="button"  onClick={() => setVisibleCount((c) => c + 30)}>
                {i18nT("capabilityCatalog.loadMore", { count: total - visibleCount })}
              </Button>
            </div>
          ) : null;
        })()}
        </section>
      </div>

      {dockerComposeId ? (
        <div className="drawer-overlay" role="dialog" aria-modal="true" aria-label="Docker Compose file" onClick={handleCloseDockerModal} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.32)", display: "flex", alignItems: "stretch", justifyContent: "flex-end", zIndex: 1000 }}>
          <div className="ef-drawer-panel" onClick={(e) => e.stopPropagation()} style={{ background: "var(--ef-surface)", color: "var(--ef-text)", borderRadius: 0, padding: 24, width: "min(720px, 100vw)", height: "100vh", maxHeight: "100vh", display: "flex", flexDirection: "column", boxShadow: "-24px 0 60px rgba(15,23,42,0.22)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Docker Compose - {dockerComposeId}</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost" onClick={handleCopyCompose} title={i18nT("capabilityCatalog.copy")}>{i18nT("capabilityCatalog.copy")}</Button>
                <Button variant="ghost" onClick={handleDownloadCompose} title={i18nT("capabilityCatalog.download")}>{i18nT("capabilityCatalog.download")}</Button>
                <Button variant="ghost" onClick={handleCloseDockerModal} aria-label={i18nT("capabilityCatalog.close")}>×</Button>
              </div>
            </div>
            <pre style={{ flex: 1, overflow: "auto", margin: 0, padding: 16, background: "var(--ef-surface-soft)", borderRadius: 8, fontSize: 13, lineHeight: 1.6, fontFamily: "monospace", whiteSpace: "pre", color: "var(--ef-text)" }}>{dockerComposeContent || i18nT("capabilityCatalog.loading")}</pre>
          </div>
        </div>
      ) : null}

      {configureItem ? (
        <ConfigureRunPanel
          guide={configureGuide}
          schema={configureSchema}
          locale={locale}
          onClose={handleCloseConfigure}
          onPreview={async (vars) => {
            if (!authToken || !configureItem) {
              return { ok: false as const, error: "Login required" };
            }
            const result = await fetchPlaybookPreview(authToken, configureItem.id, vars);
            if ("preview" in result) {
              return { ok: true as const, preview: result.preview };
            }
            return { ok: false as const, error: result.error, fieldErrors: result.fieldErrors };
          }}
          onSubmit={handleConfigureSubmit}
          submitting={configureSubmitting}
          fieldErrors={configureFieldErrors}
        />
      ) : null}

      {postPlanGuide ? (
        <MarkdownOverlay
          guide={postPlanGuide}
          locale={locale}
          onClose={() => setPostPlanGuide(null)}
        />
      ) : null}
    </div>
  );
}
