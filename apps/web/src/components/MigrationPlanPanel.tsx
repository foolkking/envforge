import { Button } from "./ui/Button";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Download, FileCode2, ListChecks, Play, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  dryRunMigrationPlan,
  exportMigrationPlan,
  fetchMigrationApplyReadiness,
  fetchMigrationCandidates,
  fetchMigrationPlan,
  fetchMigrationReviewQueue,
  fetchMigrationVerifyPreview,
  runMigrationVerify,
  saveMigrationDecision,
  saveMigrationDecisionsBulk,
  type ConfidenceBand,
  type MigrationApplyReadiness,
  type MigrationCandidate,
  type MigrationCandidateReport,
  type MigrationDryRunResult,
  type MigrationPlan,
  type MigrationReviewQueueItem,
  type MigrationVerificationPreview,
  type MigrationVerificationRunResult,
  type ReviewDecision
} from "../api";
import type { Locale } from "../lib/types";

const PAGE_SIZE = 30;

const BAND_LABEL_KEYS = {
  high: "migrationPlan.bands.high",
  medium: "migrationPlan.bands.medium",
  low: "migrationPlan.bands.low",
  ignore: "migrationPlan.bands.ignore"
} as const satisfies Record<ConfidenceBand, string>;

const CLASS_LABEL_KEYS = {
  "managed-software": "migrationPlan.classes.managedSoftware",
  "system-baseline": "migrationPlan.classes.systemBaseline",
  "user-dotfile": "migrationPlan.classes.userDotfile",
  "service-config": "migrationPlan.classes.serviceConfig",
  "language-global-package": "migrationPlan.classes.languageGlobalPackage",
  "container-workload": "migrationPlan.classes.containerWorkload",
  "manual-install": "migrationPlan.classes.manualInstall",
  "unknown-review": "migrationPlan.classes.unknownReview",
  "do-not-migrate": "migrationPlan.classes.doNotMigrate"
} as const satisfies Record<MigrationCandidate["migrationClass"], string>;

export function MigrationPlanPanel({
  authToken,
  connectionId,
  pushLog
}: {
  locale: Locale;
  authToken: string;
  connectionId: string;
  pushLog?: (type: "info" | "success" | "error" | "cmd", text: string) => void;
}) {
  const { t } = useTranslation();
  const [report, setReport] = useState<MigrationCandidateReport | null>(null);
  const [plan, setPlan] = useState<MigrationPlan | null>(null);
  const [reviewQueue, setReviewQueue] = useState<MigrationReviewQueueItem[]>([]);
  const [activeBand, setActiveBand] = useState<ConfidenceBand>("high");
  const [pageIndex, setPageIndex] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [exportText, setExportText] = useState("");
  const [dryRun, setDryRun] = useState<MigrationDryRunResult | null>(null);
  const [verifyPreview, setVerifyPreview] = useState<MigrationVerificationPreview | null>(null);
  const [verifyRun, setVerifyRun] = useState<MigrationVerificationRunResult | null>(null);
  const [readiness, setReadiness] = useState<MigrationApplyReadiness | null>(null);
  const [loading, setLoading] = useState(false);
  const [dryRunning, setDryRunning] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, [connectionId]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [nextReport, nextPlan] = await Promise.all([
        fetchMigrationCandidates(authToken, connectionId),
        fetchMigrationPlan(authToken, connectionId)
      ]);
      const queue = await fetchMigrationReviewQueue(authToken, connectionId).catch(() => []);
      setReport(nextReport);
      setPlan(nextPlan);
      setReviewQueue(queue);
      setSelectedCandidateIds((prev) => new Set([...prev].filter((id) => nextReport.candidates.some((candidate) => candidate.id === id))));
      pushLog?.("success", t("migrationPlan.logs.loaded"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("migrationPlan.errors.load");
      setError(msg);
      pushLog?.("error", msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(candidateId: string, decision: ReviewDecision) {
    setError("");
    try {
      await saveMigrationDecision(authToken, connectionId, candidateId, decision);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("migrationPlan.errors.save");
      setError(msg);
      pushLog?.("error", msg);
    }
  }

  async function handleBulkDecision(decision: ReviewDecision) {
    const ids = [...selectedCandidateIds].filter((id) => report?.candidates.some((candidate) => candidate.id === id));
    if (!ids.length) return;
    setError("");
    try {
      await saveMigrationDecisionsBulk(authToken, connectionId, ids, decision);
      setSelectedCandidateIds(new Set());
      await load();
      pushLog?.("success", t("migrationPlan.logs.bulkUpdated", { count: ids.length }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("migrationPlan.errors.bulk");
      setError(msg);
      pushLog?.("error", msg);
    }
  }

  async function handleExport(format: "json" | "markdown" | "bash" | "ansible") {
    setError("");
    try {
      pushLog?.("cmd", `envforge export migration-plan --format ${format}`);
      const text = await exportMigrationPlan(authToken, connectionId, format);
      setExportText(text);
      pushLog?.("success", t("migrationPlan.logs.exportGenerated", { format }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("migrationPlan.errors.export");
      setError(msg);
      pushLog?.("error", msg);
    }
  }

  async function handleDryRun() {
    setError("");
    setDryRunning(true);
    try {
      pushLog?.("cmd", "envforge migration dry-run");
      const result = await dryRunMigrationPlan(authToken, connectionId);
      setDryRun(result);
      pushLog?.("success", t("migrationPlan.logs.dryRunDone"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("migrationPlan.errors.dryRun");
      setError(msg);
      pushLog?.("error", msg);
    } finally {
      setDryRunning(false);
    }
  }

  async function handleVerifyPreview() {
    setError("");
    setVerifyLoading(true);
    try {
      pushLog?.("cmd", "envforge migration verify --preview");
      const preview = await fetchMigrationVerifyPreview(authToken, connectionId);
      setVerifyPreview(preview);
      pushLog?.("success", t("migrationPlan.logs.verifyPreviewDone"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("migrationPlan.errors.verifyPreview");
      setError(msg);
      pushLog?.("error", msg);
    } finally {
      setVerifyLoading(false);
    }
  }

  async function handleVerifyRun() {
    setError("");
    setVerifyLoading(true);
    try {
      pushLog?.("cmd", "envforge migration verify --run");
      const result = await runMigrationVerify(authToken, connectionId);
      setVerifyRun(result);
      pushLog?.(result.ok ? "success" : "error", result.ok ? t("migrationPlan.logs.verificationPassed") : t("migrationPlan.logs.verificationFailed"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("migrationPlan.errors.verifyRun");
      setError(msg);
      pushLog?.("error", msg);
    } finally {
      setVerifyLoading(false);
    }
  }

  async function handleReadiness() {
    setError("");
    try {
      const result = await fetchMigrationApplyReadiness(authToken, connectionId);
      setReadiness(result);
      pushLog?.(result.ready ? "success" : "info", result.ready ? t("migrationPlan.logs.readinessPassed") : t("migrationPlan.logs.readinessBlocked"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("migrationPlan.errors.readiness");
      setError(msg);
      pushLog?.("error", msg);
    }
  }

  const grouped = useMemo(() => {
    const empty: Record<ConfidenceBand, MigrationCandidate[]> = { high: [], medium: [], low: [], ignore: [] };
    for (const candidate of report?.candidates ?? []) empty[candidate.band].push(candidate);
    return empty;
  }, [report]);

  const visible = grouped[activeBand];
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pagedVisible = visible.slice(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE);
  const selectedVisibleCount = visible.filter((candidate) => selectedCandidateIds.has(candidate.id)).length;
  const allVisibleSelected = visible.length > 0 && selectedVisibleCount === visible.length;

  function toggleCandidateSelection(id: string) {
    setSelectedCandidateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setVisibleSelection(checked: boolean) {
    setSelectedCandidateIds((prev) => {
      const next = new Set(prev);
      for (const candidate of visible) {
        if (checked) next.add(candidate.id);
        else next.delete(candidate.id);
      }
      return next;
    });
  }

  return (
    <section className="panel-large migration-panel">
      <div className="panel-heading">
        <h2>
          <ListChecks style={{ width: 20, height: 20 }} />
          {t("migrationPlan.title")}
        </h2>
        <span className="panel-count">{report?.summary.total ?? 0}</span>
      </div>

      <div className="migration-summary-row">
        {(["high", "medium", "low", "ignore"] as const).map((band) => (
          <button
            key={band}
            type="button"
            className={`migration-band-card band-${band} ${activeBand === band ? "active" : ""}`}
            onClick={() => { setActiveBand(band); setPageIndex(0); }}
          >
            <span>{t(BAND_LABEL_KEYS[band])}</span>
            <strong>{report?.summary[band] ?? 0}</strong>
          </button>
        ))}
        <Button variant="connectionGhost" type="button" className="migration-refresh" onClick={() => void load()} disabled={loading}>
          <RefreshCw style={{ width: 14, height: 14 }} />
          {loading ? "..." : t("migrationPlan.refresh")}
        </Button>
      </div>

      <div className="migration-bulk-toolbar">
        <label className="migration-select-all">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            disabled={visible.length === 0}
            onChange={(event) => setVisibleSelection(event.currentTarget.checked)}
          />
          <span>
            {t("migrationPlan.selectGroup", { selected: selectedVisibleCount, total: visible.length })}
          </span>
        </label>
        <div className="migration-bulk-actions">
          <Button variant="connectionPrimary" type="button"  onClick={() => void handleBulkDecision("approved")} disabled={selectedCandidateIds.size === 0}>
            {t("migrationPlan.approveSelected", { count: selectedCandidateIds.size })}
          </Button>
          <Button variant="connectionGhost" type="button"  onClick={() => void handleBulkDecision("skipped")} disabled={selectedCandidateIds.size === 0}>
            {t("migrationPlan.skipSelected")}
          </Button>
          <Button variant="connectionGhost" type="button"  onClick={() => void handleBulkDecision("pending")} disabled={selectedCandidateIds.size === 0}>
            {t("migrationPlan.setPending")}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="conn-feedback conn-feedback-error config-error-banner">
          <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="migration-layout">
        <div className="migration-candidate-list">
          {pagedVisible.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              className={`migration-candidate ${expanded === candidate.id ? "active" : ""}`}
              onClick={() => setExpanded(expanded === candidate.id ? null : candidate.id)}
            >
              <div className="migration-candidate-main">
                <input
                  className="migration-candidate-check"
                  type="checkbox"
                  checked={selectedCandidateIds.has(candidate.id)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    event.stopPropagation();
                    toggleCandidateSelection(candidate.id);
                  }}
                  aria-label={t("migrationPlan.selectCandidate", { name: candidate.name })}
                />
                <span className={`migration-dot band-${candidate.band}`} />
                <div>
                  <strong>{candidate.catalogRuleName ?? candidate.name}</strong>
                  <span>{candidate.name} · {candidate.source} · {t(CLASS_LABEL_KEYS[candidate.migrationClass])}</span>
                </div>
              </div>
              <span className="migration-score">{Math.round(candidate.confidence * 100)}%</span>
              {expanded === candidate.id ? (
                <div className="migration-detail">
                  <p>{t("migrationPlan.evidence")}</p>
                  <ul>{candidate.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                  {candidate.risks.length ? (
                    <>
                      <p>{t("migrationPlan.risks")}</p>
                      <ul>{candidate.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul>
                    </>
                  ) : null}
                  <p>{t("migrationPlan.recommendedActions")}</p>
                  <ul>{candidate.recommendedActions.map((action) => <li key={action}>{action}</li>)}</ul>
                  <div className="migration-decision-actions">
                    <Button variant="connectionPrimary" type="button"  onClick={(event) => { event.stopPropagation(); void handleDecision(candidate.id, "approved"); }}>
                      {t("migrationPlan.approve")}
                    </Button>
                    <Button variant="connectionPrimary" type="button"  onClick={(event) => { event.stopPropagation(); void handleDecision(candidate.id, "add-to-plan"); }}>
                      {t("migrationPlan.addToPlan")}
                    </Button>
                    <Button variant="connectionGhost" type="button"  onClick={(event) => { event.stopPropagation(); void handleDecision(candidate.id, "record-only"); }}>
                      {t("migrationPlan.recordOnly")}
                    </Button>
                    <Button variant="connectionGhost" type="button"  onClick={(event) => { event.stopPropagation(); void handleDecision(candidate.id, "migrate-artifact"); }}>
                      {t("migrationPlan.migrateArtifact")}
                    </Button>
                    <Button variant="connectionGhost" type="button"  onClick={(event) => { event.stopPropagation(); void handleDecision(candidate.id, "create-catalog-draft"); }}>
                      {t("migrationPlan.createRuleDraft")}
                    </Button>
                    <Button variant="connectionGhost" type="button"  onClick={(event) => { event.stopPropagation(); void handleDecision(candidate.id, "skipped"); }}>
                      {t("migrationPlan.skip")}
                    </Button>
                    <Button variant="connectionGhost" type="button"  onClick={(event) => { event.stopPropagation(); void handleDecision(candidate.id, "pending"); }}>
                      {t("migrationPlan.pending")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </button>
          ))}
          {!loading && visible.length === 0 ? (
            <div className="migration-empty">
              <ShieldAlert style={{ width: 26, height: 26 }} />
              <span>{t("migrationPlan.empty")}</span>
            </div>
          ) : null}
          {visible.length > PAGE_SIZE ? (
            <div className="migration-pagination">
              <Button variant="connectionGhost" type="button"  onClick={() => setPageIndex((value) => Math.max(0, value - 1))} disabled={pageIndex === 0}>
                {t("migrationPlan.previous")}
              </Button>
              <span>{t("migrationPlan.page", { current: pageIndex + 1, total: pageCount })}</span>
              <Button variant="connectionGhost" type="button"  onClick={() => setPageIndex((value) => Math.min(pageCount - 1, value + 1))} disabled={pageIndex >= pageCount - 1}>
                {t("migrationPlan.next")}
              </Button>
            </div>
          ) : null}
        </div>

        <aside className="migration-plan-card">
          <div className="migration-plan-head">
            <div>
              <span>{t("migrationPlan.reviewablePlan")}</span>
              <strong>{t("migrationPlan.itemCount", { count: plan?.items.length ?? 0 })}</strong>
            </div>
            <CheckCircle2 style={{ width: 20, height: 20 }} />
          </div>
          <ol className="migration-action-list">
            {(plan?.items ?? []).slice(0, 6).map((item) => (
              <li key={item.id}>
                <strong>{item.name}</strong>
                <span>{item.actions[0]?.label ?? t("migrationPlan.pendingReview")}</span>
              </li>
            ))}
          </ol>
          <div className="migration-export-actions">
            <Button variant="connectionPrimary" type="button"  onClick={() => void handleDryRun()} disabled={dryRunning}>
              <Play style={{ width: 14, height: 14 }} /> {dryRunning ? "..." : t("migrationPlan.dryRun")}
            </Button>
            <Button variant="connectionGhost" type="button"  onClick={() => void handleVerifyPreview()} disabled={verifyLoading}>
              <ShieldCheck style={{ width: 14, height: 14 }} /> {verifyLoading ? "..." : t("migrationPlan.verifyPreview")}
            </Button>
            <Button variant="connectionGhost" type="button"  onClick={() => void handleVerifyRun()} disabled={verifyLoading}>
              {t("migrationPlan.runVerify")}
            </Button>
            <Button variant="connectionGhost" type="button"  onClick={() => void handleReadiness()}>
              {t("migrationPlan.readiness")}
            </Button>
            <Button variant="connectionPrimary" type="button"  onClick={() => void handleExport("markdown")}>
              <Download style={{ width: 14, height: 14 }} /> Markdown
            </Button>
            <Button variant="connectionGhost" type="button"  onClick={() => void handleExport("bash")}>
              <FileCode2 style={{ width: 14, height: 14 }} /> Bash
            </Button>
            <Button variant="connectionGhost" type="button"  onClick={() => void handleExport("json")}>JSON</Button>
            <Button variant="connectionGhost" type="button"  onClick={() => void handleExport("ansible")}>Ansible</Button>
          </div>
          {reviewQueue.length ? (
            <div className="migration-review-queue">
              <strong>{t("migrationPlan.unknownQueue")}</strong>
              {reviewQueue.slice(0, 5).map((item) => (
                <div key={item.candidate.id}>
                  <span>{item.candidate.name}</span>
                  <small>{item.reason}</small>
                </div>
              ))}
            </div>
          ) : null}
          {exportText ? <textarea className="migration-export-preview" value={exportText} readOnly aria-label={t("migrationPlan.exportPreviewAria")} /> : null}
          {dryRun ? <RunSummary title={t("migrationPlan.dryRunResult")} text={t("migrationPlan.dryRunSummary", { run: dryRun.summary["would-run"], review: dryRun.summary["needs-review"], blocked: dryRun.summary.blocked })} /> : null}
          {verifyPreview ? <RunSummary title={t("migrationPlan.verifyPreview")} text={t("migrationPlan.verifyPreviewSummary", { required: verifyPreview.summary.required, recommended: verifyPreview.summary.recommended, manual: verifyPreview.summary.manual })} /> : null}
          {verifyRun ? <RunSummary title={t("migrationPlan.verifyRun")} text={t("migrationPlan.verifyRunSummary", { passed: verifyRun.summary.passed, failed: verifyRun.summary.failed, skipped: verifyRun.summary.skipped })} /> : null}
          {readiness ? (
            <div className={`migration-readiness ${readiness.ready ? "ready" : "blocked"}`}>
              <strong>{readiness.ready ? t("migrationPlan.applyReady") : t("migrationPlan.applyBlocked")}</strong>
              <span>{t("migrationPlan.readinessSummary", { blockers: readiness.blockers.length, warnings: readiness.warnings.length })}</span>
              {readiness.blockers.slice(0, 4).map((blocker) => <p key={blocker}>{blocker}</p>)}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function RunSummary({ title, text }: { title: string; text: string }) {
  return (
    <div className="migration-verify-preview">
      <div className="migration-dry-run-head">
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}
