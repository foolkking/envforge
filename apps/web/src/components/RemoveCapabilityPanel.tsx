import React, { useState } from "react";
import { applyRemoveCapabilityPlan, createRemoveCapabilityPlan, type RemoveCapabilityPlan } from "../api";
import type { Locale } from "../lib/types";

/**
 * RemoveCapabilityPanel — review and apply a Remove Capability Plan.
 *
 * EnvForge does not expose direct uninstall. This panel walks the operator
 * through the safe path: classify the capability as managed or unmanaged,
 * decide whether to preserve data, generate a Remove Plan, review its risks
 * + items + actions, and apply only after the unmanaged-risk acknowledgement
 * is explicit.
 */
export function RemoveCapabilityPanel({
  authToken,
  connectionId,
  packages,
  source,
  locale,
  onClose
}: {
  authToken: string;
  connectionId: string;
  packages: string[];
  source: string;
  locale: Locale;
  onClose?: () => void;
}) {
  const [managed, setManaged] = useState(false);
  const [preserveData, setPreserveData] = useState(true);
  const [plan, setPlan] = useState<RemoveCapabilityPlan | null>(null);
  const [creating, setCreating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [reviewAck, setReviewAck] = useState(false);
  const [unmanagedAck, setUnmanagedAck] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<string>("");

  async function handleCreate() {
    setCreating(true);
    setError("");
    setResult("");
    try {
      const { plan: created } = await createRemoveCapabilityPlan(authToken, connectionId, packages, source, {
        managedByEnvForge: managed,
        preserveData
      });
      setPlan(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create remove plan.");
    } finally {
      setCreating(false);
    }
  }

  async function handleApply(dryRun: boolean) {
    if (!plan) return;
    setApplying(true);
    setError("");
    setResult("");
    try {
      const outcome = await applyRemoveCapabilityPlan(authToken, connectionId, plan, {
        dryRun,
        acknowledged: reviewAck,
        unmanagedRiskAcknowledged: managed ? true : unmanagedAck
      });
      setResult(
        locale === "zh"
          ? `${dryRun ? "Dry-run" : "Apply"} task ${outcome.taskId} 已提交，处理 ${outcome.packages.length} 个包。`
          : `${dryRun ? "Dry-run" : "Apply"} task ${outcome.taskId} submitted for ${outcome.packages.length} package(s).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed.");
    } finally {
      setApplying(false);
    }
  }

  const unmanaged = !managed;

  return (
    <div className="remove-plan-panel" style={{ background: "var(--ef-surface)", borderRadius: 8, padding: 16, boxShadow: "0 4px 16px rgba(15,23,42,0.08)", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <strong>{locale === "zh" ? "创建能力移除计划" : "Create Remove Capability Plan"}</strong>
        {onClose ? <button type="button" className="conn-btn conn-btn-ghost" onClick={onClose}>x</button> : null}
      </div>
      <p style={{ margin: 0, color: "var(--ef-muted)", fontSize: 13 }}>
        {locale === "zh"
          ? "EnvForge 不提供直接卸载。请审查能力归属、数据保留策略和回滚边界，然后生成可审计的移除计划。"
          : "EnvForge does not expose direct uninstall. Review capability ownership, data preservation, and rollback boundaries before generating an auditable Remove Plan."}
      </p>

      <div className="remove-plan-meta" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
        <div><span style={{ color: "var(--ef-muted)" }}>{locale === "zh" ? "包管理器" : "Package manager"}:</span> <code>{source}</code></div>
        <div><span style={{ color: "var(--ef-muted)" }}>{locale === "zh" ? "包数量" : "Packages"}:</span> {packages.length}</div>
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ef-text)", fontSize: 13, maxHeight: 120, overflow: "auto" }}>
        {packages.slice(0, 30).map((p) => <li key={p}>{p}</li>)}
        {packages.length > 30 ? <li style={{ color: "var(--ef-muted)" }}>+{packages.length - 30} more…</li> : null}
      </ul>

      <fieldset style={{ border: "1px solid var(--ef-border)", borderRadius: 6, padding: 10, display: "grid", gap: 6 }}>
        <legend style={{ fontSize: 12, color: "var(--ef-muted)", padding: "0 6px" }}>{locale === "zh" ? "归属与数据策略" : "Ownership & data strategy"}</legend>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" checked={managed} onChange={(event) => setManaged(event.target.checked)} />
          <span>
            {locale === "zh"
              ? "EnvForge 此前已通过计划安装此能力（已托管）"
              : "EnvForge installed this capability through a prior plan (managed)"}
          </span>
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" checked={preserveData} onChange={(event) => setPreserveData(event.target.checked)} />
          <span>{locale === "zh" ? "保留数据目录（推荐）" : "Preserve data directories (recommended)"}</span>
        </label>
        {unmanaged ? (
          <p style={{ margin: 0, color: "var(--ef-danger)", fontSize: 12 }}>
            {locale === "zh"
              ? "此能力不是由 EnvForge 安装的，移除可能影响未托管工作负载。执行时必须显式确认未托管风险。"
              : "This capability is not EnvForge-managed; removal may affect unmanaged workloads. Apply requires explicit unmanaged-risk acknowledgement."}
          </p>
        ) : null}
      </fieldset>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="conn-btn" onClick={() => void handleCreate()} disabled={creating || packages.length === 0}>
          {creating ? (locale === "zh" ? "生成中..." : "Generating…") : (locale === "zh" ? "生成移除计划" : "Generate Remove Plan")}
        </button>
      </div>

      {plan ? (
        <section style={{ border: "1px solid var(--ef-border)", borderRadius: 6, padding: 10, display: "grid", gap: 8 }}>
          <strong>{plan.name}</strong>
          {plan.review?.reasons?.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--ef-warning)" }}>
              {plan.review.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          ) : null}
          {plan.items?.[0]?.risks?.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#7c2d12" }}>
              {plan.items[0].risks.map((risk) => <li key={risk}>{risk}</li>)}
            </ul>
          ) : null}
          {plan.items?.[0]?.evidence?.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--ef-muted)" }}>
              {plan.items[0].evidence.map((piece, idx) => <li key={`${piece}-${idx}`}>{piece}</li>)}
            </ul>
          ) : null}
          {plan.summary ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, fontSize: 12, color: "var(--ef-text)" }}>
              <span>{locale === "zh" ? "动作" : "Actions"}: {plan.summary.totalActions}</span>
              <span>{locale === "zh" ? "高风险" : "High risk"}: {plan.summary.highRisk}</span>
              <span>{locale === "zh" ? "需 sudo" : "Needs sudo"}: {plan.summary.requiresSudo}</span>
              <span>{locale === "zh" ? "可回滚" : "Rollbackable"}: {plan.summary.rollbackable}</span>
            </div>
          ) : null}

          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
            <input type="checkbox" checked={reviewAck} onChange={(event) => setReviewAck(event.target.checked)} />
              <span>{locale === "zh" ? "我已审查此移除计划的风险与回滚边界。" : "I have reviewed the risks and rollback boundaries of this Remove Plan."}</span>
          </label>
          {unmanaged ? (
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" checked={unmanagedAck} onChange={(event) => setUnmanagedAck(event.target.checked)} />
              <span>{locale === "zh" ? "我承认此移除目标未由 EnvForge 托管，可能影响未托管工作负载。" : "I acknowledge the unmanaged risk of removing software EnvForge did not install."}</span>
            </label>
          ) : null}

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="conn-btn conn-btn-ghost" onClick={() => void handleApply(true)} disabled={applying || !reviewAck}>
              {locale === "zh" ? "预演" : "Dry-run"}
            </button>
            <button
              type="button"
              className="conn-btn"
              onClick={() => void handleApply(false)}
              disabled={applying || !reviewAck || (unmanaged && !unmanagedAck)}
            >
              {locale === "zh" ? "执行移除计划" : "Apply Remove Plan"}
            </button>
          </div>
        </section>
      ) : null}

      {error ? <div style={{ color: "var(--ef-danger)", fontSize: 13 }}>{error}</div> : null}
      {result ? <div style={{ color: "var(--ef-success)", fontSize: 13 }}>{result}</div> : null}
    </div>
  );
}
