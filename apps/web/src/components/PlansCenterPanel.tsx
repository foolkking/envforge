import { Button } from "./ui/Button";
import { FilterPill } from "./ui/FilterPill";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  fetchEnvironmentPlan,
  fetchEnvironmentPlanReport,
  listEnvironmentPlans,
  repairFromVerify,
  rollbackEnvironmentPlan,
  verifyEnvironmentPlan,
  type EnvironmentPlan,
  type EnvironmentPlanType,
  type PlanActionRunRecord,
  type PlanDryRunResult,
  type PlanHistoryEvent,
  type PlanListEntry,
  type PlanRollbackResult,
  type PlanVerifyResult
} from "../api";
import type { Locale } from "../lib/types";
import { PlanReviewPanel } from "./PlanReviewPanel";

const PLAN_FILTERS = ["all", "migration", "rebuild", "change", "remove", "repair", "imported-recipe"] as const;
type PlanFilter = (typeof PLAN_FILTERS)[number];

const FILTER_LABEL_KEYS = {
  all: "plansCenter.filters.all",
  migration: "plansCenter.filters.migration",
  rebuild: "plansCenter.filters.rebuild",
  change: "plansCenter.filters.change",
  remove: "plansCenter.filters.remove",
  repair: "plansCenter.filters.repair",
  "imported-recipe": "plansCenter.filters.importedRecipe"
} as const satisfies Record<PlanFilter, string>;

const STATUS_LABEL_KEYS = {
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
} as const satisfies Record<NonNullable<EnvironmentPlan["status"]>, string>;

/**
 * Lists persisted Environment Plans and lets operators continue the
 * review -> apply -> verify -> rollback lifecycle across sessions.
 */
export function PlansCenterPanel({ authToken, locale }: { authToken: string; locale: Locale }) {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<PlanListEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<PlanFilter>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<{
    plan: EnvironmentPlan;
    lastDryRunAt?: string;
    lastDryRunResult?: PlanDryRunResult;
    actionRuns: PlanActionRunRecord[];
    verifyResults: PlanVerifyResult[];
    rollbackResults: PlanRollbackResult[];
    history: PlanHistoryEvent[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState("");

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [authToken]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const list = await listEnvironmentPlans(authToken);
      setPlans(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("plansCenter.errors.list"));
    } finally {
      setLoading(false);
    }
  }

  async function loadActive(id: string) {
    setActiveId(id);
    setReport("");
    setError("");
    try {
      const detail = await fetchEnvironmentPlan(authToken, id);
      setActive(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("plansCenter.errors.load"));
    }
  }

  async function handleVerify() {
    if (!activeId) return;
    setBusy(true);
    setError("");
    try {
      const result = await verifyEnvironmentPlan(authToken, activeId);
      setActive((current) => (current ? { ...current, plan: result.plan, verifyResults: result.results } : current));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("plansCenter.errors.verify"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRollback() {
    if (!activeId) return;
    setBusy(true);
    setError("");
    try {
      const result = await rollbackEnvironmentPlan(authToken, activeId);
      setActive((current) => (current ? { ...current, plan: result.plan, rollbackResults: result.results } : current));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("plansCenter.errors.rollback"));
    } finally {
      setBusy(false);
    }
  }

  async function handleReport() {
    if (!activeId) return;
    setBusy(true);
    setError("");
    try {
      const text = await fetchEnvironmentPlanReport(authToken, activeId);
      setReport(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("plansCenter.errors.report"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRepairFromVerify() {
    if (!activeId) return;
    setBusy(true);
    setError("");
    try {
      const result = await repairFromVerify(authToken, activeId);
      await load();
      await loadActive(result.plan.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("plansCenter.errors.repair"));
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    if (filter === "all") return plans;
    return plans.filter((plan) => plan.type === filter);
  }, [plans, filter]);

  return (
    <section className="plans-center" style={{ padding: 16, background: "var(--ef-surface)", borderRadius: 8, border: "1px solid var(--ef-border)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>{t("plansCenter.title")}</h2>
        <Button variant="connectionGhost" type="button"  onClick={() => void load()} disabled={loading}>
          {loading ? t("plansCenter.refreshing") : t("plansCenter.refresh")}
        </Button>
      </header>

      <div className="plans-toolbar" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {PLAN_FILTERS.map((value) => (
          <FilterPill
            key={value}
            active={filter === value}
            onClick={() => setFilter(value)}
          >
            {t(FILTER_LABEL_KEYS[value])}
            <span style={{ marginLeft: 6, opacity: 0.7 }}>
              ({value === "all" ? plans.length : plans.filter((plan) => plan.type === value).length})
            </span>
          </FilterPill>
        ))}
      </div>

      <div className="plans-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1.8fr)", gap: 12 }}>
        <div style={{ display: "grid", gap: 8, maxHeight: 540, overflow: "auto" }}>
          {filtered.length === 0 ? <div className="filter-status">{t("plansCenter.empty")}</div> : null}
          {filtered.map((plan) => (
            <button
              key={plan.id}
              type="button"
              className={`plan-card ${plan.id === activeId ? "active" : ""}`}
              onClick={() => void loadActive(plan.id)}
              style={{
                padding: 10,
                border: `1px solid ${plan.id === activeId ? "#0ea5e9" : "var(--ef-border)"}`,
                borderRadius: 6,
                background: "var(--ef-surface)",
                textAlign: "left",
                cursor: "pointer"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <strong style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{plan.name}</strong>
                <StatusChip status={plan.status} label={t(STATUS_LABEL_KEYS[plan.status ?? "draft"])} />
              </div>
              <div style={{ fontSize: 11, color: "var(--ef-muted)", marginTop: 4, display: "flex", gap: 8 }}>
                <span>{plan.type}</span>
                <span>·</span>
                <span>{new Date(plan.updatedAt).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--ef-muted)", marginTop: 2, display: "flex", gap: 6 }}>
                {plan.verifyResults.length ? (
                  <span>{t("plansCenter.verifyCount", { passed: plan.verifyResults.filter((row) => row.status === "passed").length, total: plan.verifyResults.length })}</span>
                ) : null}
                {plan.rollbackResults.length ? (
                  <span>{t("plansCenter.rollbackCount", { passed: plan.rollbackResults.filter((row) => row.status === "passed").length, total: plan.rollbackResults.length })}</span>
                ) : null}
              </div>
            </button>
          ))}
        </div>

        <aside style={{ padding: 12, border: "1px solid var(--ef-border)", borderRadius: 6, background: "#fafafa", maxHeight: 540, overflow: "auto" }}>
          {!active ? (
            <p style={{ color: "var(--ef-muted)", fontSize: 13 }}>{t("plansCenter.selectPrompt")}</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <header>
                <strong style={{ fontSize: 16 }}>{active.plan.name}</strong>
                <div style={{ color: "var(--ef-muted)", fontSize: 12 }}>
                  {t("plansCenter.summary", {
                    type: active.plan.type,
                    status: t(STATUS_LABEL_KEYS[active.plan.status ?? "draft"]),
                    actions: active.plan.summary.totalActions,
                    highRisk: active.plan.summary.highRisk,
                    sudo: active.plan.summary.requiresSudo
                  })}
                </div>
              </header>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Button variant="connectionGhost" type="button"  disabled={busy} onClick={() => void handleVerify()}>
                  {t("plansCenter.actions.reverify")}
                </Button>
                <Button variant="connectionGhost" type="button"  disabled={busy} onClick={() => void handleRollback()}>
                  {t("plansCenter.actions.rollback")}
                </Button>
                <Button variant="connectionGhost" type="button"  disabled={busy} onClick={() => void handleReport()}>
                  {t("plansCenter.actions.viewReport")}
                </Button>
                {active.verifyResults.some((row) => row.status === "failed" || row.status === "warning") ? (
                  <Button variant="connection"
                    type="button"

                    disabled={busy}
                    onClick={() => void handleRepairFromVerify()}
                    title={t("plansCenter.actions.repairTitle")}
                  >
                    {t("plansCenter.actions.repairFromVerify")}
                  </Button>
                ) : null}
              </div>

              {planNeedsReview(active.plan) ? (
                <PlanReviewPanel
                  authToken={authToken}
                  plan={active.plan}
                  locale={locale}
                  onChanged={(updated) => {
                    setActive((current) => (current ? { ...current, plan: updated } : current));
                    void load();
                  }}
                />
              ) : null}

              <Section title={t("plansCenter.sections.actions")}>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                  {active.plan.items.flatMap((item) =>
                    item.actions.map((action) => (
                      <li key={action.id}>
                        <span style={{ color: action.risk === "high" ? "var(--ef-danger)" : action.risk === "medium" ? "var(--ef-warning)" : "var(--ef-success)" }}>[{action.risk}]</span>{" "}
                        <strong>{action.kind}</strong> — {action.label}
                      </li>
                    ))
                  )}
                </ul>
              </Section>

              {active.lastDryRunResult ? (
                <Section title={t("plansCenter.sections.dryRun") }>
                  <div style={{ fontSize: 12, color: active.lastDryRunResult.ok ? "var(--ef-success)" : "var(--ef-danger)" }}>
                    [{active.lastDryRunResult.ok ? t("plansCenter.runPassed") : t("plansCenter.runFailed")}]
                    {" "}{active.lastDryRunAt ? new Date(active.lastDryRunAt).toLocaleString() : active.lastDryRunResult.completedAt}
                    {" · "}<code>{active.lastDryRunResult.planHash}</code>
                  </div>
                </Section>
              ) : null}

              {active.actionRuns.length ? (
                <Section title={t("plansCenter.sections.actionRuns")}>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                    {active.actionRuns.map((run) => (
                      <li key={run.id}>
                        <span style={{ color: tone(run.status) }}>[{run.status}]</span>{" "}
                        <strong>{run.actionId}</strong>{run.dryRun ? ` · ${t("plansCenter.dryRunBadge")}` : ""}
                        {run.exitCode !== undefined ? ` · exit ${run.exitCode}` : ""}
                        {run.error ? <span style={{ color: "var(--ef-danger)" }}> · {run.error}</span> : null}
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {active.verifyResults.length ? (
                <Section title={t("plansCenter.sections.verifyResults")}>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                    {active.verifyResults.map((row) => (
                      <li key={row.actionId}>
                        <span style={{ color: tone(row.status) }}>[{row.status}]</span> {row.label}
                        {row.message ? <span style={{ color: "var(--ef-muted)" }}> — {row.message}</span> : null}
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {active.rollbackResults.length ? (
                <Section title={t("plansCenter.sections.rollbackResults")}>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                    {active.rollbackResults.map((row) => (
                      <li key={row.actionId}>
                        <span style={{ color: tone(row.status) }}>[{row.status}]</span> {row.label}
                        {row.message ? <span style={{ color: "var(--ef-muted)" }}> — {row.message}</span> : null}
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {active.history.length ? (
                <Section title={t("plansCenter.sections.history")}>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--ef-muted)" }}>
                    {active.history.map((event, index) => (
                      <li key={`${event.at}-${index}`}>
                        {event.at} · {event.event}
                        {event.note ? ` — ${event.note}` : ""}
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {report ? (
                <Section title={t("plansCenter.sections.markdownReport")}>
                  <textarea readOnly value={report} style={{ width: "100%", minHeight: 200, fontFamily: "monospace", fontSize: 12 }} />
                </Section>
              ) : null}
            </div>
          )}
        </aside>
      </div>

      {error ? <div style={{ color: "var(--ef-danger)", fontSize: 13, marginTop: 8 }}>{error}</div> : null}
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--ef-muted)", marginBottom: 4 }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

function StatusChip({ status, label }: { status: EnvironmentPlan["status"]; label: string }) {
  const safeStatus: NonNullable<EnvironmentPlan["status"]> = status ?? "draft";
  const colorMap: Record<NonNullable<EnvironmentPlan["status"]>, string> = {
    draft: "var(--ef-muted-2)",
    "needs-review": "var(--ef-warning)",
    approved: "var(--ef-info)",
    applying: "#0ea5e9",
    verifying: "#7c3aed",
    succeeded: "var(--ef-success)",
    "partially-succeeded": "#ca8a04",
    failed: "var(--ef-danger)",
    "rolled-back": "#7c2d12",
    committed: "var(--ef-success)"
  };
  return (
    <span
      style={{
        background: colorMap[safeStatus] ?? "var(--ef-muted-2)",
        color: "var(--ef-surface)",
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 999,
        flexShrink: 0
      }}
    >
      {label}
    </span>
  );
}

function tone(status: string): string {
  if (status === "passed") return "var(--ef-success)";
  if (status === "warning") return "#ca8a04";
  if (status === "failed") return "var(--ef-danger)";
  return "var(--ef-muted)";
}

function planNeedsReview(plan: EnvironmentPlan): boolean {
  if (plan.status === "needs-review") return true;
  if ((plan.review.conflicts ?? []).length > 0) return true;
  const ackedRisks = plan.approvals?.risks ?? {};
  for (const item of plan.items) {
    const risks = item.audit?.remainingRisks ?? [];
    if (risks.length === 0) continue;
    const acked = new Set(ackedRisks[item.id] ?? []);
    if (risks.some((risk) => !acked.has(risk))) return true;
  }
  const ackedApprovals = new Set(
    (plan.approvals?.approvals ?? []).map((entry) => `${entry.itemId}::${entry.gateId}`)
  );
  for (const gate of plan.review.approvalsRequired ?? []) {
    if (!ackedApprovals.has(`${gate.itemId}::${gate.id}`)) return true;
  }
  return false;
}
