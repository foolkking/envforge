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
import type { Locale } from "../lib/types";
import type { RulePromotionStatus, RuntimeRuleOverride } from "../api";

const STATUS_LABEL: Record<RulePromotionStatus, { zh: string; en: string }> = {
  "detection-only": { zh: "仅检测", en: "Detection-only" },
  "promotion-requested": { zh: "已申请晋升", en: "Promotion requested" },
  "bundle-generated": { zh: "已生成晋升包", en: "Bundle generated" },
  "in-review": { zh: "评审中 (PR)", en: "In review (PR)" },
  certified: { zh: "已认证", en: "Certified" }
};

const STATUS_TONE: Record<RulePromotionStatus, { bg: string; fg: string; border: string }> = {
  "detection-only": { bg: "var(--ef-surface-soft)", fg: "var(--ef-muted)", border: "var(--ef-border)" },
  "promotion-requested": { bg: "var(--ef-warning-soft)", fg: "var(--ef-warning)", border: "var(--ef-warning)" },
  "bundle-generated": { bg: "var(--ef-warning-soft)", fg: "var(--ef-warning)", border: "var(--ef-warning)" },
  "in-review": { bg: "var(--ef-info-soft)", fg: "var(--ef-info)", border: "var(--ef-info)" },
  certified: { bg: "var(--ef-success-soft)", fg: "var(--ef-success)", border: "var(--ef-success)" }
};

export function PromotionBadge({ status, locale }: { status: RulePromotionStatus; locale: Locale }): JSX.Element {
  const tone = STATUS_TONE[status];
  return (
    <span
      data-testid={`promotion-status-${status}`}
      style={{ background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}`, padding: "2px 8px", borderRadius: 999, fontSize: 11, whiteSpace: "nowrap" }}
    >
      {STATUS_LABEL[status][locale === "zh" ? "zh" : "en"]}
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
  const zh = locale === "zh";
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
          <strong>{zh ? "晋升状态" : "Promotion"}</strong>
          <PromotionBadge status={status} locale={locale} />
        </div>
        <p style={{ margin: "6px 0 0 0", fontSize: 12, color: "var(--ef-success)" }}>
          {zh
            ? "对应规则已落入静态基线并通过认证,此运行时规则已被取代,可安全删除。"
            : "The matching rule landed in the static baseline and is certified; this runtime override is superseded and can be safely deleted."}
        </p>
        {onDelete ? (
          <button type="button" style={{ marginTop: 8, padding: "4px 10px", color: "var(--ef-danger)" }} onClick={() => onDelete(rule.id)}>
            {zh ? "删除已取代的规则" : "Delete superseded rule"}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, padding: 10, border: "1px solid var(--ef-border, var(--ef-border))", borderRadius: 8 }} data-testid={`promotion-controls-${rule.id}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <strong>{zh ? "晋升状态" : "Promotion"}</strong>
        <PromotionBadge status={status} locale={locale} />
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {status === "detection-only" ? (
          <button type="button" disabled={busy} style={{ padding: "4px 10px" }} onClick={() => void set({ status: "promotion-requested" })}>
            {zh ? "申请晋升" : "Request promotion"}
          </button>
        ) : null}
        {status === "promotion-requested" || status === "bundle-generated" ? (
          <button type="button" disabled={busy} style={{ padding: "4px 10px" }} onClick={() => void set({ status: "in-review" })}>
            {zh ? "标记评审中" : "Mark in-review"}
          </button>
        ) : null}
        {status !== "detection-only" ? (
          <button type="button" disabled={busy} style={{ padding: "4px 10px" }} onClick={() => void set({ status: "detection-only" })}>
            {zh ? "退回仅检测" : "Back to detection-only"}
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
          {zh ? "保存 PR" : "Save PR"}
        </button>
      </label>
      <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "var(--ef-muted-2)" }}>
        {zh
          ? "认证仍由合并后的 certification:check 授予;此处仅跟踪进度,不会自动认证。"
          : "Certification is still granted by certification:check after merge; this only tracks progress and never auto-certifies."}
      </p>
    </div>
  );
}
