/**
 * PromotionBundleModal.tsx — Phase C2 promotion bundle viewer.
 *
 * Shows the PR-ready artifacts that graduate a runtime detection rule to a
 * certified capability: the readiness scorecard, ordered steps, and each
 * generated file with copy + client-side download. Nothing is written to the
 * repo by the API — the developer applies these, runs the gate, and opens a PR.
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Copy, Download, Check } from "lucide-react";
import type { Locale } from "../lib/types";
import type { PromotionBundle, PromotionBundleFile } from "../api";
import { Button } from "./ui/Button";
import { ReadinessScorecard } from "./ReadinessScorecard";
import { useEscapeToClose } from "../lib/useEscapeToClose";

export function PromotionBundleModal({
  bundle,
  locale,
  onClose
}: {
  bundle: PromotionBundle;
  locale: Locale;
  onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<string | null>(null);
  useEscapeToClose(onClose);

  function copy(file: PromotionBundleFile) {
    void navigator.clipboard?.writeText(file.contents).then(() => {
      setCopied(file.path);
      window.setTimeout(() => setCopied((cur) => (cur === file.path ? null : cur)), 1500);
    });
  }

  function download(file: PromotionBundleFile) {
    const blob = new Blob([file.contents], { type: file.language === "json" ? "application/json" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.path.split("/").pop() || "artifact.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="cap-editor-overlay" role="dialog" aria-modal="true" aria-label={t("promotionBundle.title")} data-testid="promotion-bundle-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cap-editor-drawer">
        <header className="cap-editor-header">
          <div>
            <p className="eyebrow">{t("promotionBundle.eyebrow")}</p>
            <h2>{bundle.id}</h2>
          </div>
          <Button variant="ghost" type="button" className="icon-action" onClick={onClose} aria-label={t("promotionBundle.close")}><X aria-hidden /></Button>
        </header>

        <div className="cap-editor-body">
          <p className="cap-editor-note">
            {t("promotionBundle.notice")}
          </p>

          <section className="cap-editor-section">
            <ReadinessScorecard readiness={bundle.readiness} locale={locale} />
          </section>

          <section className="cap-editor-section">
            <h3>{t("promotionBundle.steps")}</h3>
            <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: 13 }}>
              {bundle.instructions.map((step, i) => <li key={i}>{step}</li>)}
            </ol>
          </section>

          {bundle.files.map((file) => (
            <section className="cap-editor-section" key={file.path} data-testid={`bundle-file-${file.path}`}>
              <h3 style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span>{file.title}</span>
                <span style={{
                  background: file.action === "create" ? "var(--ef-success-soft)" : "var(--ef-info-soft)",
                  color: file.action === "create" ? "var(--ef-success)" : "var(--ef-info)",
                  borderRadius: 999, padding: "1px 8px", fontSize: 11
                }}>
                  {file.action === "create" ? t("promotionBundle.create") : t("promotionBundle.edit")}
                </span>
                <code style={{ fontSize: 11, color: "var(--ef-muted)" }}>{file.path}</code>
                <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  <Button variant="ghost" onClick={() => copy(file)}>
                    {copied === file.path ? <Check aria-hidden /> : <Copy aria-hidden />}{t("promotionBundle.copy")}
                  </Button>
                  <Button variant="ghost" onClick={() => download(file)}><Download aria-hidden />{t("promotionBundle.download")}</Button>
                </span>
              </h3>
              <pre className="cap-editor-preview">{file.contents}</pre>
            </section>
          ))}
        </div>

        <footer className="cap-editor-footer">
          <div className="cap-editor-footer-right">
            <Button variant="secondary" onClick={onClose}>{t("promotionBundle.close")}</Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
