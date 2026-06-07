import React, { useEffect, useMemo, useState } from "react";
import { fetchEnvironmentPlanReport, listEnvironmentPlans, type PlanListEntry } from "../api";
import type { Locale } from "../lib/types";

/**
 * ReportsPage — read-only access to plan reports.
 *
 * Every persisted Environment Plan exposes a Markdown report through
 * `/api/plans/:id/report`. The Plans center already has a "View report"
 * button per plan; this page is the cross-plan landing area: it lists
 * every plan grouped by terminal status (succeeded / failed / rolled-back
 * / committed) and lets the operator open each report inline.
 *
 * Reports are evidence — the operator can copy or download them, but the
 * page never offers re-apply or edit actions; those belong in the Plans
 * center where the lifecycle controls live.
 */
export function ReportsPage({ authToken, locale }: { authToken: string; locale: Locale }) {
  const [plans, setPlans] = useState<PlanListEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [report, setReport] = useState<string>("");

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [authToken]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const list = await listEnvironmentPlans(authToken);
      setPlans(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load plans.");
    } finally {
      setLoading(false);
    }
  }

  async function open(id: string) {
    setActiveId(id);
    setReport("");
    try {
      const text = await fetchEnvironmentPlanReport(authToken, id);
      setReport(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report.");
    }
  }

  const finished = plans.filter((p) => ["succeeded", "partially-succeeded", "failed", "rolled-back", "committed"].includes(p.status ?? "draft"));
  const activePlan = finished.find((plan) => plan.id === activeId) ?? null;
  const statusSummary = useMemo(() => {
    const statuses = ["succeeded", "partially-succeeded", "failed", "rolled-back", "committed"] as const;
    return statuses.map((status) => ({
      status,
      count: finished.filter((plan) => plan.status === status).length
    }));
  }, [finished]);

  return (
    <div className="reports-page reports-workspace">
      <section className="report-command-strip">
        <div>
          <p className="eyebrow">{locale === "zh" ? "报告中心" : "Report Center"}</p>
          <h2>{locale === "zh" ? "迁移、重建与修复报告" : "Migration, rebuild, and repair reports"}</h2>
          <p>
            {locale === "zh"
              ? "报告是终态计划的证据出口，只提供查看、复制和下载，不在这里重新执行变更。"
              : "Reports are evidence exports for terminal plans. This page only supports viewing, copying, and downloading."}
          </p>
        </div>
        <button type="button" className="primary-action" onClick={() => void load()} disabled={loading}>
          {loading ? (locale === "zh" ? "刷新中..." : "Refreshing...") : (locale === "zh" ? "刷新报告" : "Refresh reports")}
        </button>
      </section>

      <section className="report-summary-grid" aria-label={locale === "zh" ? "报告状态摘要" : "Report status summary"}>
        {statusSummary.map((item) => (
          <article className={`report-summary-card report-status-${item.status}`} key={item.status}>
            <small>{statusLabel(item.status, locale)}</small>
            <strong>{item.count}</strong>
          </article>
        ))}
      </section>

      <div className="report-workbench-grid">
        <section className="report-list-panel">
          <header className="report-panel-header">
            <div>
              <p className="eyebrow">{locale === "zh" ? "终态计划" : "Terminal plans"}</p>
              <h3>{locale === "zh" ? "报告索引" : "Report index"}</h3>
            </div>
            <span>{finished.length}</span>
          </header>
          {finished.length === 0 ? (
            <p className="empty-hint">
              {locale === "zh" ? "尚无终态计划，执行或验证一些计划后再来。" : "No terminal-state plans yet. Apply / verify some plans first."}
            </p>
          ) : null}
          <ul className="report-list">
            {finished.map((plan) => (
              <li key={plan.id}>
                <button
                  type="button"
                  className={`report-list-item ${plan.id === activeId ? "active" : ""}`}
                  onClick={() => void open(plan.id)}
                >
                  <span>
                    <strong>{plan.name}</strong>
                    <small>{plan.type} · {new Date(plan.updatedAt).toLocaleString()}</small>
                  </span>
                  <code className={`report-status-chip report-status-${plan.status ?? "draft"}`}>{statusLabel(plan.status ?? "draft", locale)}</code>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="report-reader-panel">
          {!activeId ? (
            <div className="report-reader-empty">
              <p className="eyebrow">{locale === "zh" ? "Markdown 报告" : "Markdown report"}</p>
              <h3>{locale === "zh" ? "选择一个报告查看证据内容" : "Select a report to inspect evidence"}</h3>
              <p>{locale === "zh" ? "左侧列表只展示已进入终态的计划。" : "The left list only shows plans that reached a terminal state."}</p>
            </div>
          ) : (
            <>
              <header className="report-reader-header">
                <div>
                  <p className="eyebrow">{locale === "zh" ? "Markdown 报告" : "Markdown report"}</p>
                  <h3>{activePlan?.name ?? (locale === "zh" ? "报告" : "Report")}</h3>
                </div>
                <div className="report-reader-actions">
                  <button type="button" className="conn-btn conn-btn-ghost" onClick={() => void navigator.clipboard.writeText(report)} disabled={!report}>
                    {locale === "zh" ? "复制" : "Copy"}
                  </button>
                  <button
                    type="button"
                    className="conn-btn conn-btn-ghost"
                    onClick={() => downloadReport(activeId, report)}
                    disabled={!report}
                  >
                    {locale === "zh" ? "下载" : "Download"}
                  </button>
                </div>
              </header>
              <textarea className="report-textarea" readOnly value={report} />
            </>
          )}
        </section>
      </div>

      {error ? <div className="report-error">{error}</div> : null}
    </div>
  );
}

function statusLabel(status: NonNullable<PlanListEntry["status"]> | "draft", locale: Locale): string {
  const zh: Record<string, string> = {
    draft: "草稿",
    "needs-review": "待审查",
    approved: "已批准",
    applying: "执行中",
    verifying: "验证中",
    succeeded: "成功",
    "partially-succeeded": "部分成功",
    failed: "失败",
    "rolled-back": "已回滚",
    committed: "已归档"
  };
  return locale === "zh" ? zh[status] ?? status : status;
}

function downloadReport(activeId: string, report: string) {
  const blob = new Blob([report], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plan-${activeId}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
