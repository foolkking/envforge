import React from "react";
import type { PreflightCheck, PreflightReport } from "../api";
import type { Locale } from "../lib/types";

const STATUS_ICON: Record<PreflightCheck["status"], string> = {
  pass: "✓",
  warn: "!",
  fail: "x",
  skipped: "-"
};

const STATUS_COLOR: Record<PreflightCheck["status"], string> = {
  pass: "#16a34a",
  warn: "#d97706",
  fail: "#dc2626",
  skipped: "#94a3b8"
};

export function PreflightPanel({
  report,
  loading,
  locale,
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
  if (loading) {
    return (
      <div className="preflight-panel">
        <p className="preflight-loading">
          <span className="spinning">...</span>
          {locale === "zh" ? "正在检查计划应用条件..." : "Checking plan apply conditions..."}
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
          {locale === "zh" ? "计划应用前检查" : "Plan preflight checks"}
          <span className="preflight-meta">
            {" "}· {report.summary.pass} pass · {report.summary.warn} warn · {report.summary.fail} fail · {report.durationMs}ms
          </span>
        </p>
        {onClose ? (
          <button type="button" className="ghost-action" onClick={onClose} style={{ fontSize: 12, padding: "4px 8px" }}>x</button>
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
          <button
            type="button"
            className={blocked ? "ghost-action" : "primary-action"}
            onClick={onProceed}
            disabled={proceedDisabled}
          >
            {blocked
              ? (locale === "zh" ? "带风险应用计划" : "Apply plan despite failures")
              : (locale === "zh" ? "应用已审查计划" : "Apply reviewed plan")}
          </button>
        </footer>
      ) : null}
    </div>
  );
}
