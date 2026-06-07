import React, { useEffect, useMemo, useState } from "react";
import {
  fetchEnvironmentPlan,
  fetchEnvironmentPlanReport,
  listEnvironmentPlans,
  repairFromVerify,
  rollbackEnvironmentPlan,
  verifyEnvironmentPlan,
  type EnvironmentPlan,
  type EnvironmentPlanType,
  type PlanHistoryEvent,
  type PlanListEntry,
  type PlanRollbackResult,
  type PlanVerifyResult
} from "../api";
import type { Locale } from "../lib/types";
import { PlanReviewPanel } from "./PlanReviewPanel";

/**
 * PlansCenterPanel — list + drill into persisted Environment Plans.
 *
 * EnvForge persists every plan it creates so the operator can resume a
 * review → apply → verify → rollback cycle across sessions. This panel:
 *
 *  - lists plans newest-first with type / status / verify / rollback chips;
 *  - filters by plan type and status;
 *  - drills into a plan to show its actions, verify results, rollback
 *    results, and history;
 *  - lets the operator re-run verify, run rollback, and download the
 *    Markdown report.
 *
 * The component is intentionally read-only for the *creation* of plans —
 * those happen through Migrate / Build / Maintain mode entry points. Here
 * we focus on inspection and lifecycle operations.
 */
export function PlansCenterPanel({ authToken, locale }: { authToken: string; locale: Locale }) {
  const [plans, setPlans] = useState<PlanListEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | EnvironmentPlanType>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<{
    plan: EnvironmentPlan;
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
      setError(err instanceof Error ? err.message : "Failed to list plans.");
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
      setError(err instanceof Error ? err.message : "Failed to load plan.");
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
      setError(err instanceof Error ? err.message : "Verify failed.");
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
      setError(err instanceof Error ? err.message : "Rollback failed.");
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
      setError(err instanceof Error ? err.message : "Report failed.");
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
      // After generating the repair plan we refresh the list and switch
      // focus to the new plan so the operator can review and apply it.
      await load();
      await loadActive(result.plan.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Repair generation failed.");
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    if (filter === "all") return plans;
    return plans.filter((p) => p.type === filter);
  }, [plans, filter]);

  return (
    <section className="plans-center" style={{ padding: 16, background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>{locale === "zh" ? "环境计划" : "Environment Plans"}</h2>
        <button type="button" className="conn-btn conn-btn-ghost" onClick={() => void load()} disabled={loading}>
          {loading ? (locale === "zh" ? "刷新中..." : "Refreshing…") : (locale === "zh" ? "刷新" : "Refresh")}
        </button>
      </header>

      <div className="plans-toolbar" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {(["all", "migration", "rebuild", "change", "remove", "repair", "imported-recipe"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`filter-pill ${filter === value ? "active" : ""}`}
            onClick={() => setFilter(value)}
          >
            {filterLabel(value, locale)}
            <span style={{ marginLeft: 6, opacity: 0.7 }}>
              ({value === "all" ? plans.length : plans.filter((p) => p.type === value).length})
            </span>
          </button>
        ))}
      </div>

      <div className="plans-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1.8fr)", gap: 12 }}>
        <div style={{ display: "grid", gap: 8, maxHeight: 540, overflow: "auto" }}>
          {filtered.length === 0 ? (
            <div className="filter-status">
              {locale === "zh" ? "尚未创建环境计划。先在迁移或构建模式生成计划。" : "No Environment Plans yet. Create one through Migrate / Build / Maintain mode."}
            </div>
          ) : null}
          {filtered.map((plan) => (
            <button
              key={plan.id}
              type="button"
              className={`plan-card ${plan.id === activeId ? "active" : ""}`}
              onClick={() => void loadActive(plan.id)}
              style={{
                padding: 10,
                border: `1px solid ${plan.id === activeId ? "#0ea5e9" : "#e2e8f0"}`,
                borderRadius: 6,
                background: "#fff",
                textAlign: "left",
                cursor: "pointer"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <strong style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{plan.name}</strong>
                <StatusChip status={plan.status} />
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, display: "flex", gap: 8 }}>
                <span>{plan.type}</span>
                <span>·</span>
                <span>{new Date(plan.updatedAt).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2, display: "flex", gap: 6 }}>
                {plan.verifyResults.length ? <span>verify: {plan.verifyResults.filter((r) => r.status === "passed").length}/{plan.verifyResults.length}</span> : null}
                {plan.rollbackResults.length ? <span>rollback: {plan.rollbackResults.filter((r) => r.status === "passed").length}/{plan.rollbackResults.length}</span> : null}
              </div>
            </button>
          ))}
        </div>

        <aside style={{ padding: 12, border: "1px solid #e2e8f0", borderRadius: 6, background: "#fafafa", maxHeight: 540, overflow: "auto" }}>
          {!active ? (
            <p style={{ color: "#64748b", fontSize: 13 }}>
              {locale === "zh" ? "选择左侧计划查看详情、动作、验证结果与回滚结果。" : "Pick a plan on the left to inspect actions, verify results, and rollback results."}
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <header>
                <strong style={{ fontSize: 16 }}>{active.plan.name}</strong>
                <div style={{ color: "#64748b", fontSize: 12 }}>
                  {active.plan.type} · {active.plan.status} · {active.plan.summary.totalActions} actions · {active.plan.summary.highRisk} high risk · {active.plan.summary.requiresSudo} sudo
                </div>
              </header>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" className="conn-btn conn-btn-ghost" disabled={busy} onClick={() => void handleVerify()}>
                  {locale === "zh" ? "重新验证" : "Re-verify"}
                </button>
                <button type="button" className="conn-btn conn-btn-ghost" disabled={busy} onClick={() => void handleRollback()}>
                  {locale === "zh" ? "回滚" : "Rollback"}
                </button>
                <button type="button" className="conn-btn conn-btn-ghost" disabled={busy} onClick={() => void handleReport()}>
                  {locale === "zh" ? "查看报告" : "View report"}
                </button>
                {active.verifyResults.some((row) => row.status === "failed" || row.status === "warning") ? (
                  <button
                    type="button"
                    className="conn-btn"
                    disabled={busy}
                    onClick={() => void handleRepairFromVerify()}
                    title={locale === "zh" ? "根据验证失败结果生成修复计划" : "Generate a Repair Plan from failed verify results"}
                  >
                    {locale === "zh" ? "从失败项生成修复计划" : "Repair from verify"}
                  </button>
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

              <Section title={locale === "zh" ? "动作" : "Actions"}>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                  {active.plan.items.flatMap((item) =>
                    item.actions.map((action) => (
                      <li key={action.id}>
                        <span style={{ color: action.risk === "high" ? "#b91c1c" : action.risk === "medium" ? "#92400e" : "#166534" }}>[{action.risk}]</span>{" "}
                        <strong>{action.kind}</strong> — {action.label}
                      </li>
                    ))
                  )}
                </ul>
              </Section>

              {active.verifyResults.length ? (
                <Section title={locale === "zh" ? "验证结果" : "Verify results"}>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                    {active.verifyResults.map((row) => (
                      <li key={row.actionId}>
                        <span style={{ color: tone(row.status) }}>[{row.status}]</span> {row.label}
                        {row.message ? <span style={{ color: "#64748b" }}> — {row.message}</span> : null}
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {active.rollbackResults.length ? (
                <Section title={locale === "zh" ? "回滚结果" : "Rollback results"}>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                    {active.rollbackResults.map((row) => (
                      <li key={row.actionId}>
                        <span style={{ color: tone(row.status) }}>[{row.status}]</span> {row.label}
                        {row.message ? <span style={{ color: "#64748b" }}> — {row.message}</span> : null}
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {active.history.length ? (
                <Section title={locale === "zh" ? "历史" : "History"}>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#475569" }}>
                    {active.history.map((event, idx) => (
                      <li key={`${event.at}-${idx}`}>
                        {event.at} · {event.event}
                        {event.note ? ` — ${event.note}` : ""}
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {report ? (
                <Section title={locale === "zh" ? "Markdown 报告" : "Markdown report"}>
                  <textarea readOnly value={report} style={{ width: "100%", minHeight: 200, fontFamily: "monospace", fontSize: 12 }} />
                </Section>
              ) : null}
            </div>
          )}
        </aside>
      </div>

      {error ? <div style={{ color: "#b91c1c", fontSize: 13, marginTop: 8 }}>{error}</div> : null}
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

function StatusChip({ status }: { status: EnvironmentPlan["status"] }) {
  const safeStatus: NonNullable<EnvironmentPlan["status"]> = status ?? "draft";
  const colorMap: Record<NonNullable<EnvironmentPlan["status"]>, string> = {
    draft: "#94a3b8",
    "needs-review": "#f59e0b",
    approved: "#2563eb",
    applying: "#0ea5e9",
    verifying: "#7c3aed",
    succeeded: "#16a34a",
    "partially-succeeded": "#ca8a04",
    failed: "#b91c1c",
    "rolled-back": "#7c2d12",
    committed: "#16a34a"
  };
  return (
    <span
      style={{
        background: colorMap[safeStatus] ?? "#94a3b8",
        color: "#fff",
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 999,
        flexShrink: 0
      }}
    >
      {safeStatus}
    </span>
  );
}

function tone(status: PlanVerifyResult["status"] | PlanRollbackResult["status"]): string {
  if (status === "passed") return "#16a34a";
  if (status === "warning") return "#ca8a04";
  if (status === "failed") return "#b91c1c";
  return "#64748b";
}

/**
 * Whether the plan currently needs the operator to interact with the
 * Plan Review gate. Surface the panel when:
 *  - status is `needs-review`; OR
 *  - the plan carries any conflicts; OR
 *  - any plan item has unacknowledged remainingRisks; OR
 *  - any plan item has approval gates that aren't fully acknowledged.
 */
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

function filterLabel(value: "all" | EnvironmentPlanType, locale: Locale): string {
  const zh: Record<string, string> = {
    all: "全部",
    migration: "迁移",
    rebuild: "重建",
    change: "变更",
    remove: "移除",
    repair: "修复",
    "imported-recipe": "导入配方"
  };
  const en: Record<string, string> = {
    all: "All",
    migration: "Migration",
    rebuild: "Rebuild",
    change: "Change",
    remove: "Remove",
    repair: "Repair",
    "imported-recipe": "Imported Recipe"
  };
  return locale === "zh" ? zh[value] ?? value : en[value] ?? value;
}
