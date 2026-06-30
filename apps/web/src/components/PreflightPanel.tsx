import { Button } from "./ui/Button";
import React from "react";
import { useTranslation } from "react-i18next";
import type { PreflightCheck, PreflightReport } from "../api";
import type { Locale } from "../lib/types";

const STATUS_ICON: Record<PreflightCheck["status"], string> = {
  pass: "✓",
  warn: "!",
  fail: "x",
  skipped: "-"
};

const STATUS_COLOR: Record<PreflightCheck["status"], string> = {
  pass: "var(--ef-success)",
  warn: "var(--ef-warning)",
  fail: "var(--ef-danger)",
  skipped: "var(--ef-muted-2)"
};

export function PreflightPanel({
  report,
  loading,
  onClose,
  onProceed,
  proceedDisabled
}: {
  report: PreflightReport | null;
  loading: boolean;
  locale: Locale;
  onClose?: () => void;
  onProceed?: () => void;
  proceedDisabled?: boolean;
}) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <div className="preflight-panel">
        <p className="preflight-loading">
          <span className="spinning">...</span>
          {t("preflight.loading")}
        </p>
      </div>
    );
  }
  if (!report) return null;

  const blocked = report.summary.fail > 0;

  return (
    <div className={`preflight-panel ${blocked ? "preflight-panel-blocked" : ""}`}>
      <header className="preflight-header">
        <p className="preflight-title">
          {t("preflight.title")}
          <span className="preflight-meta">
            {" · "}{t("preflight.summary", { pass: report.summary.pass, warn: report.summary.warn, fail: report.summary.fail, duration: report.durationMs })}
          </span>
        </p>
        {onClose ? (
          <Button variant="ghost" type="button"  onClick={onClose} aria-label="Close" style={{ fontSize: 14, padding: "4px 8px" }}>×</Button>
        ) : null}
      </header>
      <ul className="preflight-checks">
        {report.checks.map((check) => (
          <li key={check.id} className={`preflight-check preflight-${check.status}`}>
            <span className="preflight-status" style={{ color: STATUS_COLOR[check.status] }}>
              {STATUS_ICON[check.status]}
            </span>
            <span className="preflight-label">{check.label}</span>
            <span className="preflight-detail">{check.detail}</span>
          </li>
        ))}
      </ul>
      {onProceed ? (
        <footer className="preflight-footer">
          <Button
            type="button"
            variant={blocked ? "ghost" : "primary"}
            onClick={onProceed}
            disabled={proceedDisabled}
          >
            {blocked ? t("preflight.proceedWithFailures") : t("preflight.applyReviewed")}
          </Button>
        </footer>
      ) : null}
    </div>
  );
}
