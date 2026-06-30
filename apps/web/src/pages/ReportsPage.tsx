import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchEnvironmentPlanReport, listEnvironmentPlans, type PlanListEntry } from "../api";
import type { Locale } from "../lib/types";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";

const REPORT_STATUS_LABEL_KEYS = {
  draft: "plansCenter.statuses.draft",
  "needs-review": "plansCenter.statuses.needsReview",
  approved: "plansCenter.statuses.approved",
  applying: "plansCenter.statuses.applying",
  verifying: "plansCenter.statuses.verifying",
  succeeded: "plansCenter.statuses.succeeded",
  "partially-succeeded": "plansCenter.statuses.partiallySucceeded",
  failed: "plansCenter.statuses.failed",
  "rolled-back": "plansCenter.statuses.rolledBack",
  committed: "plansCenter.statuses.committed"
} as const satisfies Record<NonNullable<PlanListEntry["status"]>, string>;

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
export function ReportsPage({ authToken }: { authToken: string; locale: Locale }) {
  const { t } = useTranslation();
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
      setError(err instanceof Error ? err.message : t("reports.errors.plans"));
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
      setError(err instanceof Error ? err.message : t("reports.errors.report"));
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
          <p className="eyebrow">{t("reports.eyebrow")}</p>
          <h2>{t("reports.title")}</h2>
          <p>{t("reports.intro")}</p>
        </div>
        <Button variant="primary" onClick={() => void load()} disabled={loading}>
          {loading ? t("reports.refreshing") : t("reports.refresh")}
        </Button>
      </section>

      <section className="report-summary-grid" aria-label={t("reports.summaryAria")}>
        {statusSummary.map((item) => (
          <article className={`report-summary-card report-status-${item.status}`} key={item.status}>
            <small>{t(REPORT_STATUS_LABEL_KEYS[item.status])}</small>
            <strong>{item.count}</strong>
          </article>
        ))}
      </section>

      <div className="report-workbench-grid">
        <section className="report-list-panel">
          <header className="report-panel-header">
            <div>
              <p className="eyebrow">{t("reports.terminalPlans")}</p>
              <h3>{t("reports.index")}</h3>
            </div>
            <span>{finished.length}</span>
          </header>
          {finished.length === 0 ? (
            <p className="empty-hint">{t("reports.empty")}</p>
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
                  <Badge tone={statusTone(plan.status ?? "draft")}>{t(REPORT_STATUS_LABEL_KEYS[plan.status ?? "draft"])}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="report-reader-panel">
          {!activeId ? (
            <div className="report-reader-empty">
              <p className="eyebrow">{t("reports.markdownReport")}</p>
              <h3>{t("reports.selectTitle")}</h3>
              <p>{t("reports.selectBody")}</p>
            </div>
          ) : (
            <>
              <header className="report-reader-header">
                <div>
                  <p className="eyebrow">{t("reports.markdownReport")}</p>
                  <h3>{activePlan?.name ?? t("reports.reportFallback")}</h3>
                </div>
                <div className="report-reader-actions">
                  <Button variant="connectionGhost" type="button"  onClick={() => void navigator.clipboard.writeText(report)} disabled={!report}>
                    {t("reports.copy")}
                  </Button>
                  <Button variant="connectionGhost"
                    type="button"

                    onClick={() => downloadReport(activeId, report)}
                    disabled={!report}
                  >
                    {t("reports.download")}
                  </Button>
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

function statusTone(status: string): "ok" | "warn" | "danger" | "neutral" | "info" {
  if (status === "succeeded") return "ok";
  if (status === "failed") return "danger";
  if (status === "rolled-back" || status === "partially-succeeded") return "warn";
  if (status === "committed") return "info";
  return "neutral";
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
