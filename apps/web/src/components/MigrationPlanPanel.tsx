import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileCode2, ListChecks, Play, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  dryRunMigrationPlan,
  exportMigrationPlan,
  fetchMigrationApplyReadiness,
  fetchMigrationCandidates,
  fetchMigrationPlan,
  fetchMigrationReviewQueue,
  fetchMigrationVerifyPreview,
  runMigrationApply,
  runMigrationVerify,
  saveMigrationDecision,
  saveMigrationDecisionsBulk,
  type ConfidenceBand,
  type MigrationApplyReadiness,
  type MigrationApplyResult,
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

export function MigrationPlanPanel({
  locale,
  authToken,
  connectionId,
  pushLog
}: {
  locale: Locale;
  authToken: string;
  connectionId: string;
  pushLog?: (type: "info" | "success" | "error" | "cmd", text: string) => void;
}) {
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
  const [applyResult, setApplyResult] = useState<MigrationApplyResult | null>(null);
  const [allowServiceRestart, setAllowServiceRestart] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dryRunning, setDryRunning] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [applyRunning, setApplyRunning] = useState(false);
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
      pushLog?.("success", locale === "zh" ? "迁移候选与计划已生成" : "Migration candidates and plan generated");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load migration plan";
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
      const msg = err instanceof Error ? err.message : "Save decision failed";
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
      pushLog?.("success", locale === "zh" ? `已批量更新 ${ids.length} 个候选项` : `Updated ${ids.length} candidates`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bulk decision failed";
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
      pushLog?.("success", locale === "zh" ? `${format} 导出已生成` : `${format} export generated`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed";
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
      pushLog?.("success", locale === "zh" ? "预演已完成，未修改远程机器" : "Dry-run completed; remote host was not modified");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Dry-run failed";
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
      pushLog?.("success", locale === "zh" ? "验证预览已生成" : "Verify preview generated");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Verify preview failed";
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
      pushLog?.(result.ok ? "success" : "error", result.ok ? "Verification passed" : "Verification has failures");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Verify run failed";
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
      pushLog?.(result.ready ? "success" : "info", result.ready ? "Apply readiness passed" : "Apply readiness has blockers");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Apply readiness failed";
      setError(msg);
      pushLog?.("error", msg);
    }
  }

  async function handleApply() {
    setError("");
    setApplyRunning(true);
    try {
      pushLog?.("cmd", `envforge migration apply${allowServiceRestart ? " --allow-service-restart" : ""}`);
      const result = await runMigrationApply(authToken, connectionId, {
        restartServices: allowServiceRestart,
        rollbackOnFailure: true,
        requireAllActions: false
      });
      setApplyResult(result);
      pushLog?.(result.ok ? "success" : "error", result.ok ? "Safe apply completed" : result.rolledBack ? "Safe apply failed and rollback ran" : "Safe apply failed");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Apply failed";
      setError(msg);
      pushLog?.("error", msg);
    } finally {
      setApplyRunning(false);
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
          {locale === "zh" ? "迁移候选与环境计划" : "Migration Candidates & Environment Plan"}
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
            <span>{bandLabel(band, locale)}</span>
            <strong>{report?.summary[band] ?? 0}</strong>
          </button>
        ))}
        <button type="button" className="conn-btn conn-btn-ghost migration-refresh" onClick={() => void load()} disabled={loading}>
          <RefreshCw style={{ width: 14, height: 14 }} />
          {loading ? "..." : locale === "zh" ? "刷新分析" : "Refresh"}
        </button>
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
            {locale === "zh"
              ? `选择当前分组 ${selectedVisibleCount}/${visible.length}`
              : `Select current group ${selectedVisibleCount}/${visible.length}`}
          </span>
        </label>
        <div className="migration-bulk-actions">
          <button type="button" className="conn-btn conn-btn-primary" onClick={() => void handleBulkDecision("approved")} disabled={selectedCandidateIds.size === 0}>
            {locale === "zh" ? `批准已选 (${selectedCandidateIds.size})` : `Approve selected (${selectedCandidateIds.size})`}
          </button>
          <button type="button" className="conn-btn conn-btn-ghost" onClick={() => void handleBulkDecision("skipped")} disabled={selectedCandidateIds.size === 0}>
            {locale === "zh" ? "跳过已选" : "Skip selected"}
          </button>
          <button type="button" className="conn-btn conn-btn-ghost" onClick={() => void handleBulkDecision("pending")} disabled={selectedCandidateIds.size === 0}>
            {locale === "zh" ? "设为待定" : "Set pending"}
          </button>
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
                  aria-label={locale === "zh" ? `选择 ${candidate.name}` : `Select ${candidate.name}`}
                />
                <span className={`migration-dot band-${candidate.band}`} />
                <div>
                  <strong>{candidate.catalogRuleName ?? candidate.name}</strong>
                  <span>{candidate.name} · {candidate.source} · {classLabel(candidate.migrationClass, locale)}</span>
                </div>
              </div>
              <span className="migration-score">{Math.round(candidate.confidence * 100)}%</span>
              {expanded === candidate.id ? (
                <div className="migration-detail">
                  <p>{locale === "zh" ? "判断证据" : "Evidence"}</p>
                  <ul>{candidate.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                  {candidate.risks.length ? (
                    <>
                      <p>{locale === "zh" ? "风险" : "Risks"}</p>
                      <ul>{candidate.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul>
                    </>
                  ) : null}
                  <p>{locale === "zh" ? "建议动作" : "Recommended actions"}</p>
                  <ul>{candidate.recommendedActions.map((action) => <li key={action}>{action}</li>)}</ul>
                  <div className="migration-decision-actions">
                    <button type="button" className="conn-btn conn-btn-primary" onClick={(event) => { event.stopPropagation(); void handleDecision(candidate.id, "approved"); }}>
                      {locale === "zh" ? "批准" : "Approve"}
                    </button>
                    <button type="button" className="conn-btn conn-btn-primary" onClick={(event) => { event.stopPropagation(); void handleDecision(candidate.id, "add-to-plan"); }}>
                      {locale === "zh" ? "加入计划" : "Add to plan"}
                    </button>
                    <button type="button" className="conn-btn conn-btn-ghost" onClick={(event) => { event.stopPropagation(); void handleDecision(candidate.id, "record-only"); }}>
                      {locale === "zh" ? "仅记录" : "Record only"}
                    </button>
                    <button type="button" className="conn-btn conn-btn-ghost" onClick={(event) => { event.stopPropagation(); void handleDecision(candidate.id, "migrate-artifact"); }}>
                      {locale === "zh" ? "迁移为产物" : "Migrate artifact"}
                    </button>
                    <button type="button" className="conn-btn conn-btn-ghost" onClick={(event) => { event.stopPropagation(); void handleDecision(candidate.id, "create-catalog-draft"); }}>
                      {locale === "zh" ? "生成规则草稿" : "Create rule draft"}
                    </button>
                    <button type="button" className="conn-btn conn-btn-ghost" onClick={(event) => { event.stopPropagation(); void handleDecision(candidate.id, "skipped"); }}>
                      {locale === "zh" ? "跳过" : "Skip"}
                    </button>
                    <button type="button" className="conn-btn conn-btn-ghost" onClick={(event) => { event.stopPropagation(); void handleDecision(candidate.id, "pending"); }}>
                      {locale === "zh" ? "待定" : "Pending"}
                    </button>
                  </div>
                </div>
              ) : null}
            </button>
          ))}
          {!loading && visible.length === 0 ? (
            <div className="migration-empty">
              <ShieldAlert style={{ width: 26, height: 26 }} />
              <span>{locale === "zh" ? "当前分组没有候选项" : "No candidates in this group"}</span>
            </div>
          ) : null}
          {visible.length > PAGE_SIZE ? (
            <div className="migration-pagination">
              <button type="button" className="conn-btn conn-btn-ghost" onClick={() => setPageIndex((value) => Math.max(0, value - 1))} disabled={pageIndex === 0}>
                {locale === "zh" ? "上一页" : "Previous"}
              </button>
              <span>{locale === "zh" ? `第 ${pageIndex + 1} / ${pageCount} 页` : `Page ${pageIndex + 1} / ${pageCount}`}</span>
              <button type="button" className="conn-btn conn-btn-ghost" onClick={() => setPageIndex((value) => Math.min(pageCount - 1, value + 1))} disabled={pageIndex >= pageCount - 1}>
                {locale === "zh" ? "下一页" : "Next"}
              </button>
            </div>
          ) : null}
        </div>

        <aside className="migration-plan-card">
          <div className="migration-plan-head">
            <div>
              <span>{locale === "zh" ? "可审查计划" : "Reviewable plan"}</span>
              <strong>{plan?.items.length ?? 0} {locale === "zh" ? "项" : "items"}</strong>
            </div>
            <CheckCircle2 style={{ width: 20, height: 20 }} />
          </div>
          <ol className="migration-action-list">
            {(plan?.items ?? []).slice(0, 6).map((item) => (
              <li key={item.id}>
                <strong>{item.name}</strong>
                <span>{item.actions[0]?.label ?? (locale === "zh" ? "等待审查" : "Pending review")}</span>
              </li>
            ))}
          </ol>
          <div className="migration-export-actions">
            <button type="button" className="conn-btn conn-btn-primary" onClick={() => void handleDryRun()} disabled={dryRunning}>
              <Play style={{ width: 14, height: 14 }} /> {dryRunning ? "..." : (locale === "zh" ? "预演" : "Dry run")}
            </button>
            <button type="button" className="conn-btn conn-btn-ghost" onClick={() => void handleVerifyPreview()} disabled={verifyLoading}>
              <ShieldCheck style={{ width: 14, height: 14 }} /> {verifyLoading ? "..." : (locale === "zh" ? "验证预览" : "Verify")}
            </button>
            <button type="button" className="conn-btn conn-btn-ghost" onClick={() => void handleVerifyRun()} disabled={verifyLoading}>
              {locale === "zh" ? "运行验证" : "Run verify"}
            </button>
            <button type="button" className="conn-btn conn-btn-ghost" onClick={() => void handleReadiness()}>
              {locale === "zh" ? "就绪检查" : "Readiness"}
            </button>
            <label className="migration-apply-toggle">
              <input type="checkbox" checked={allowServiceRestart} onChange={(event) => setAllowServiceRestart(event.currentTarget.checked)} />
              <span>{locale === "zh" ? "允许重启服务" : "Allow restart"}</span>
            </label>
            <button type="button" className="conn-btn conn-btn-primary" onClick={() => void handleApply()} disabled={applyRunning}>
              <Play style={{ width: 14, height: 14 }} /> {applyRunning ? (locale === "zh" ? "执行中..." : "Applying...") : (locale === "zh" ? "安全执行" : "Apply safe")}
            </button>
            <button type="button" className="conn-btn conn-btn-primary" onClick={() => void handleExport("markdown")}>
              <Download style={{ width: 14, height: 14 }} /> Markdown
            </button>
            <button type="button" className="conn-btn conn-btn-ghost" onClick={() => void handleExport("bash")}>
              <FileCode2 style={{ width: 14, height: 14 }} /> Bash
            </button>
            <button type="button" className="conn-btn conn-btn-ghost" onClick={() => void handleExport("json")}>JSON</button>
            <button type="button" className="conn-btn conn-btn-ghost" onClick={() => void handleExport("ansible")}>Ansible</button>
          </div>
          {reviewQueue.length ? (
            <div className="migration-review-queue">
              <strong>{locale === "zh" ? "未知项审查队列" : "Unknown Review Queue"}</strong>
              {reviewQueue.slice(0, 5).map((item) => (
                <div key={item.candidate.id}>
                  <span>{item.candidate.name}</span>
                  <small>{item.reason}</small>
                </div>
              ))}
            </div>
          ) : null}
          {exportText ? <textarea className="migration-export-preview" value={exportText} readOnly aria-label={locale === "zh" ? "迁移计划导出预览" : "Migration plan export preview"} /> : null}
          {dryRun ? <RunSummary title={locale === "zh" ? "预演结果" : "Dry-run result"} text={locale === "zh" ? `${dryRun.summary["would-run"]} 个将执行 · ${dryRun.summary["needs-review"]} 个需审查 · ${dryRun.summary.blocked} 个被阻止` : `${dryRun.summary["would-run"]} run · ${dryRun.summary["needs-review"]} review · ${dryRun.summary.blocked} blocked`} /> : null}
          {verifyPreview ? <RunSummary title={locale === "zh" ? "验证预览" : "Verify preview"} text={locale === "zh" ? `${verifyPreview.summary.required} 个必需 · ${verifyPreview.summary.recommended} 个建议 · ${verifyPreview.summary.manual} 个手动` : `${verifyPreview.summary.required} required · ${verifyPreview.summary.recommended} recommended · ${verifyPreview.summary.manual} manual`} /> : null}
          {verifyRun ? <RunSummary title={locale === "zh" ? "验证运行" : "Verify Run"} text={locale === "zh" ? `${verifyRun.summary.passed} 个通过 · ${verifyRun.summary.failed} 个失败 · ${verifyRun.summary.skipped} 个跳过` : `${verifyRun.summary.passed} passed · ${verifyRun.summary.failed} failed · ${verifyRun.summary.skipped} skipped`} /> : null}
          {readiness ? (
            <div className={`migration-readiness ${readiness.ready ? "ready" : "blocked"}`}>
              <strong>{readiness.ready ? (locale === "zh" ? "可安全执行" : "Apply ready") : (locale === "zh" ? "执行被阻止" : "Apply blocked")}</strong>
              <span>{locale === "zh" ? `${readiness.blockers.length} 个阻断项 · ${readiness.warnings.length} 个警告` : `${readiness.blockers.length} blockers · ${readiness.warnings.length} warnings`}</span>
              {readiness.blockers.slice(0, 4).map((blocker) => <p key={blocker}>{blocker}</p>)}
            </div>
          ) : null}
          {applyResult ? (
            <div className={`migration-apply-result ${applyResult.ok ? "ok" : "failed"}`}>
              <div className="migration-dry-run-head">
                <strong>{applyResult.ok ? (locale === "zh" ? "执行完成" : "Apply completed") : applyResult.rolledBack ? (locale === "zh" ? "执行失败并已回滚" : "Apply rolled back") : (locale === "zh" ? "执行失败" : "Apply failed")}</strong>
                <span>{locale === "zh" ? `${applyResult.summary.passed} 个通过 · ${applyResult.summary.failed} 个失败 · ${applyResult.summary.skipped} 个跳过 · ${applyResult.summary.rolledBack} 个已回滚` : `${applyResult.summary.passed} passed · ${applyResult.summary.failed} failed · ${applyResult.summary.skipped} skipped · ${applyResult.summary.rolledBack} rollback`}</span>
              </div>
              <div className="migration-dry-run-list">
                {applyResult.steps.slice(0, 14).map((step, index) => (
                  <div key={`${step.itemId}-${step.action}-${index}`} className={`migration-apply-step apply-${step.status}`}>
                    <span>{step.status}</span>
                    <strong>{step.itemName}</strong>
                    <p>{step.message}</p>
                  </div>
                ))}
              </div>
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

function bandLabel(band: ConfidenceBand, locale: Locale): string {
  const zh: Record<ConfidenceBand, string> = { high: "高置信度", medium: "中置信度", low: "低置信度", ignore: "不建议" };
  const en: Record<ConfidenceBand, string> = { high: "High", medium: "Medium", low: "Low", ignore: "Ignore" };
  return locale === "zh" ? zh[band] : en[band];
}

function classLabel(value: MigrationCandidate["migrationClass"], locale: Locale): string {
  const zh: Record<MigrationCandidate["migrationClass"], string> = {
    "managed-software": "已管理能力",
    "system-baseline": "系统基线",
    "user-dotfile": "用户配置",
    "service-config": "服务配置",
    "language-global-package": "语言全局包",
    "container-workload": "容器负载",
    "manual-install": "手工安装",
    "unknown-review": "待确认",
    "do-not-migrate": "不迁移"
  };
  return locale === "zh" ? zh[value] : value.replace(/-/g, " ");
}
