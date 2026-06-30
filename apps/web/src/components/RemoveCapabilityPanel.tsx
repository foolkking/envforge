import { Button } from "./ui/Button";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { createRemoveCapabilityPlan, type EnvironmentPlan } from "../api";
import type { Locale } from "../lib/types";
import { PlanReviewPanel } from "./PlanReviewPanel";

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
  const { t } = useTranslation();
  const [managed, setManaged] = useState(false);
  const [preserveData, setPreserveData] = useState(true);
  const [plan, setPlan] = useState<EnvironmentPlan | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    setCreating(true);
    setError("");
    try {
      const { plan: created } = await createRemoveCapabilityPlan(authToken, connectionId, packages, source, {
        managedByEnvForge: managed,
        preserveData
      });
      setPlan(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("removeCapability.errors.create"));
    } finally {
      setCreating(false);
    }
  }

  const unmanaged = !managed;

  return (
    <div className="remove-plan-panel" style={{ background: "var(--ef-surface)", borderRadius: 8, padding: 16, boxShadow: "0 4px 16px rgba(15,23,42,0.08)", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <strong>{t("removeCapability.title")}</strong>
        {onClose ? <Button variant="connectionGhost" type="button"  onClick={onClose} aria-label="Close">×</Button> : null}
      </div>
      <p style={{ margin: 0, color: "var(--ef-muted)", fontSize: 13 }}>{t("removeCapability.intro")}</p>

      <div className="remove-plan-meta" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
        <div><span style={{ color: "var(--ef-muted)" }}>{t("removeCapability.packageManager")}:</span> <code>{source}</code></div>
        <div><span style={{ color: "var(--ef-muted)" }}>{t("removeCapability.packages")}:</span> {packages.length}</div>
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ef-text)", fontSize: 13, maxHeight: 120, overflow: "auto" }}>
        {packages.slice(0, 30).map((p) => <li key={p}>{p}</li>)}
        {packages.length > 30 ? <li style={{ color: "var(--ef-muted)" }}>{t("removeCapability.more", { count: packages.length - 30 })}</li> : null}
      </ul>

      <fieldset style={{ border: "1px solid var(--ef-border)", borderRadius: 6, padding: 10, display: "grid", gap: 6 }}>
        <legend style={{ fontSize: 12, color: "var(--ef-muted)", padding: "0 6px" }}>{t("removeCapability.ownership")}</legend>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" checked={managed} onChange={(event) => setManaged(event.target.checked)} />
          <span>{t("removeCapability.managed")}</span>
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" checked={preserveData} onChange={(event) => setPreserveData(event.target.checked)} />
          <span>{t("removeCapability.preserveData")}</span>
        </label>
        {unmanaged ? (
          <p style={{ margin: 0, color: "var(--ef-danger)", fontSize: 12 }}>{t("removeCapability.unmanagedWarning")}</p>
        ) : null}
      </fieldset>

      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="connection" type="button"  onClick={() => void handleCreate()} disabled={creating || packages.length === 0}>
          {creating ? t("removeCapability.generating") : t("removeCapability.generate")}
        </Button>
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
              <span>{t("removeCapability.actions")}: {plan.summary.totalActions}</span>
              <span>{t("removeCapability.highRisk")}: {plan.summary.highRisk}</span>
              <span>{t("removeCapability.needsSudo")}: {plan.summary.requiresSudo}</span>
              <span>{t("removeCapability.rollbackable")}: {plan.summary.rollbackable}</span>
            </div>
          ) : null}

          <PlanReviewPanel authToken={authToken} plan={plan} locale={locale} onChanged={(updated) => setPlan(updated)} />
        </section>
      ) : null}

      {error ? <div style={{ color: "var(--ef-danger)", fontSize: 13 }}>{error}</div> : null}
    </div>
  );
}
