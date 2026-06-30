/**
 * ReadinessScorecard.tsx — renders the Phase C certification-readiness audit.
 *
 * Shows the 13 Full Migration sections with pass/fail state and, for failing
 * sections, the concrete reasons. Used in the runtime detection-rule drawer
 * and registry. This is diagnostic only — detection rules never auto-certify;
 * the scorecard tells an admin what a promotion still needs.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle } from "lucide-react";
import type { Locale } from "../lib/types";
import type { RuleReadiness } from "../api";
import { REQUIREMENT_I18N_KEYS } from "../pages/governance/shared";

const SECTION_ORDER = [
  "identity", "detection", "install", "config", "data", "references",
  "validate", "rollback", "security", "crossDistro", "conflicts", "planIntegration", "harness"
] as const;

/** Tailwind-free score chip color by readiness band. */
function scoreTone(score: number): { bg: string; fg: string; border: string } {
  if (score >= 100) return { bg: "var(--ef-success-soft)", fg: "var(--ef-success)", border: "var(--ef-success)" };
  if (score >= 60) return { bg: "var(--ef-warning-soft)", fg: "var(--ef-warning)", border: "var(--ef-warning)" };
  return { bg: "var(--ef-danger-soft)", fg: "var(--ef-danger)", border: "var(--ef-danger)" };
}

export function ReadinessChip({ readiness, locale }: { readiness: RuleReadiness; locale: Locale }): JSX.Element {
  const { t } = useTranslation();
  const total = SECTION_ORDER.length;
  const passed = total - readiness.missingRequirements.length;
  const tone = scoreTone(readiness.certificationScore);
  return (
    <span
      data-testid="readiness-chip"
      title={t("governance.readiness.chipTitle")}
      style={{
        background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}`,
        padding: "2px 8px", borderRadius: 999, fontSize: 11, whiteSpace: "nowrap"
      }}
    >
      {passed}/{total} · {readiness.certificationScore}%
    </span>
  );
}

export function ReadinessScorecard({ readiness, locale }: { readiness: RuleReadiness; locale: Locale }): JSX.Element {
  const { t } = useTranslation();
  const total = SECTION_ORDER.length;
  const passed = total - readiness.missingRequirements.length;
  return (
    <div data-testid="readiness-scorecard" style={{ border: "1px solid var(--ef-border, var(--ef-border))", borderRadius: 8, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <strong>{t("governance.readiness.title")}</strong>
        <ReadinessChip readiness={readiness} locale={locale} />
      </div>
      <p style={{ margin: "0 0 8px 0", color: "var(--ef-muted)", fontSize: 12 }}>
        {t("governance.readiness.intro")}
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 2 }}>
        {SECTION_ORDER.map((section) => {
          const result = readiness.sectionResults[section];
          if (!result) return null;
          const label = t(REQUIREMENT_I18N_KEYS[section] ?? section);
          return (
            <li key={section} style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "2px 0", fontSize: 12 }}>
              {result.ok
                ? <CheckCircle2 size={14} color="var(--ef-success)" aria-hidden style={{ marginTop: 1, flexShrink: 0 }} />
                : <XCircle size={14} color="var(--ef-warning)" aria-hidden style={{ marginTop: 1, flexShrink: 0 }} />}
              <span style={{ color: result.ok ? "var(--ef-success)" : "var(--ef-warning)", fontWeight: 500 }}>{label}</span>
              {!result.ok && result.reasons.length > 0 ? (
                <span style={{ color: "var(--ef-muted-2)" }}>— {result.reasons.join("; ")}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p style={{ margin: "8px 0 0 0", color: "var(--ef-muted-2)", fontSize: 11 }}>
        {`${passed}/${total} ${t("governance.readiness.passingSuffix")}`}
      </p>
    </div>
  );
}
