/**
 * PromotionControls.tsx — Phase C3 promotion lifecycle UI.
 *
 * Shows a runtime detection rule's promotion status and lets an admin advance
 * it: request promotion, mark in-review, attach a PR url, or send it back to
 * detection-only. The terminal `certified` status is never settable here — it
 * is granted by backend reconciliation only after the promotion PR merges, so
 * the UI shows it as read-only with a "supersedes this override" hint.
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Locale } from "../lib/types";
import type { RulePromotionStatus, RuntimeRuleOverride } from "../api";

const STATUS_LABEL_KEY = {
  "detection-only": "governance.promotion.statuses.detectionOnly",
  "promotion-requested": "governance.promotion.statuses.promotionRequested",
  "bundle-generated": "governance.promotion.statuses.bundleGenerated",
  "in-review": "governance.promotion.statuses.inReview",
  certified: "governance.promotion.statuses.certified"
} as const satisfies Record<RulePromotionStatus, string>;

const STATUS_TONE: Record<RulePromotionStatus, { bg: string; fg: string; border: string }> = {
  "detection-only": { bg: "var(--ef-surface-soft)", fg: "var(--ef-muted)", border: "var(--ef-border)" },
  "promotion-requested": { bg: "var(--ef-warning-soft)", fg: "var(--ef-warning)", border: "var(--ef-warning)" },
  "bundle-generated": { bg: "var(--ef-warning-soft)", fg: "var(--ef-warning)", border: "var(--ef-warning)" },
  "in-review": { bg: "var(--ef-info-soft)", fg: "var(--ef-info)", border: "var(--ef-info)" },
  certified: { bg: "var(--ef-success-soft)", fg: "var(--ef-success)", border: "var(--ef-success)" }
};

export function PromotionBadge({ status, locale }: { status: RulePromotionStatus; locale: Locale }): JSX.Element {
  const { t } = useTranslation();
  const tone = STATUS_TONE[status];
  return (
    <span
      data-testid={`promotion-status-${status}`}
      style={{ background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}`, padding: "2px 8px", borderRadius: 999, fontSize: 11, whiteSpace: "nowrap" }}
    >
      {t(STATUS_LABEL_KEY[status])}
    </span>
  );
}

export function PromotionControls({
  rule,
  locale,
  onSetPromotion,
  onDelete
}: {
  rule: RuntimeRuleOverride;
  locale: Locale;
  onSetPromotion: (id: string, patch: { status?: RulePromotionStatus; prUrl?: string; notes?: string }) => void | Promise<void>;
  onDelete?: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const status = rule.promotion?.status ?? "detection-only";
  const [prUrl, setPrUrl] = useState(rule.promotion?.prUrl ?? "");
  const [busy, setBusy] = useState(false);

  async function set(patch: { status?: RulePromotionStatus; prUrl?: string; notes?: string }) {
    setBusy(true);
    try { await onSetPromotion(rule.id, patch); } finally { setBusy(false); }
  }

  if (status === "certified") {
    return (
      <div style={{ marginTop: 10, padding: 10, border: "1px solid var(--ef-success)", background: "var(--ef-success-soft)", borderRadius: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong>{t("governance.promotion.title")}</strong>
          <PromotionBadge status={status} locale={locale} />
        </div>
        <p style={{ margin: "6px 0 0 0", fontSize: 12, color: "var(--ef-success)" }}>
          {t("governance.promotion.certifiedHint")}
        </p>
        {onDelete ? (
          <button type="button" style={{ marginTop: 8, padding: "4px 10px", color: "var(--ef-danger)" }} onClick={() => onDelete(rule.id)}>
            {t("governance.promotion.deleteSuperseded")}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, padding: 10, border: "1px solid var(--ef-border, var(--ef-border))", borderRadius: 8 }} data-testid={`promotion-controls-${rule.id}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <strong>{t("governance.promotion.title")}</strong>
        <PromotionBadge status={status} locale={locale} />
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {status === "detection-only" ? (
          <button type="button" disabled={busy} style={{ padding: "4px 10px" }} onClick={() => void set({ status: "promotion-requested" })}>
            {t("governance.promotion.requestPromotion")}
          </button>
        ) : null}
        {status === "promotion-requested" || status === "bundle-generated" ? (
          <button type="button" disabled={busy} style={{ padding: "4px 10px" }} onClick={() => void set({ status: "in-review" })}>
            {t("governance.promotion.markInReview")}
          </button>
        ) : null}
        {status !== "detection-only" ? (
          <button type="button" disabled={busy} style={{ padding: "4px 10px" }} onClick={() => void set({ status: "detection-only" })}>
            {t("governance.promotion.backToDetectionOnly")}
          </button>
        ) : null}
      </div>
      <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
        <span style={{ color: "var(--ef-muted)" }}>PR URL</span>
        <input
          value={prUrl}
          onChange={(e) => setPrUrl(e.target.value)}
          placeholder="https://github.com/owner/repo/pull/123"
          style={{ flex: 1, minWidth: 200, padding: "4px 6px", border: "1px solid var(--ef-border)", borderRadius: 6, fontSize: 12 }}
        />
        <button type="button" disabled={busy} style={{ padding: "4px 10px" }} onClick={() => void set({ prUrl, status: status === "detection-only" ? "in-review" : undefined })}>
          {t("governance.promotion.savePr")}
        </button>
      </label>
      <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "var(--ef-muted-2)" }}>
        {t("governance.promotion.hint")}
      </p>
    </div>
  );
}
