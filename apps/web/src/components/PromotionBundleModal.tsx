/**
 * PromotionBundleModal.tsx — Phase C2 promotion bundle viewer.
 *
 * Shows the PR-ready artifacts that graduate a runtime detection rule to a
 * certified capability: the readiness scorecard, ordered steps, and each
 * generated file with copy + client-side download. Nothing is written to the
 * repo by the API — the developer applies these, runs the gate, and opens a PR.
 */
import React, { useState } from "react";
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
  const zh = locale === "zh";
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
    <div className="cap-editor-overlay" role="dialog" aria-modal="true" aria-label={zh ? "晋升包" : "Promotion bundle"} data-testid="promotion-bundle-modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cap-editor-drawer">
        <header className="cap-editor-header">
          <div>
            <p className="eyebrow">{zh ? "晋升包 · 复制 / 下载后由开发者应用" : "Promotion bundle · copy / download, then apply in code"}</p>
            <h2>{bundle.id}</h2>
          </div>
          <button type="button" className="icon-action ghost-action" onClick={onClose} aria-label={zh ? "关闭" : "Close"}><X aria-hidden /></button>
        </header>

        <div className="cap-editor-body">
          <p className="cap-editor-note">
            {zh
              ? "这些产物不会写入仓库。认证闸门不变:产物落代码 + harness 场景 + 白名单,合并后由 certification:check 认证;运行时永不自动认证。"
              : "These artifacts are not written to the repo. The gate is unchanged — land them in code + a harness scenario + opt-in; certification happens on merge via certification:check. Runtime never auto-certifies."}
          </p>

          <section className="cap-editor-section">
            <ReadinessScorecard readiness={bundle.readiness} locale={locale} />
          </section>

          <section className="cap-editor-section">
            <h3>{zh ? "步骤" : "Steps"}</h3>
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
                  {file.action === "create" ? (zh ? "新建" : "create") : (zh ? "编辑" : "edit")}
                </span>
                <code style={{ fontSize: 11, color: "var(--ef-muted)" }}>{file.path}</code>
                <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  <Button variant="ghost" onClick={() => copy(file)}>
                    {copied === file.path ? <Check aria-hidden /> : <Copy aria-hidden />}{zh ? "复制" : "Copy"}
                  </Button>
                  <Button variant="ghost" onClick={() => download(file)}><Download aria-hidden />{zh ? "下载" : "Download"}</Button>
                </span>
              </h3>
              <pre className="cap-editor-preview">{file.contents}</pre>
            </section>
          ))}
        </div>

        <footer className="cap-editor-footer">
          <div className="cap-editor-footer-right">
            <Button variant="secondary" onClick={onClose}>{zh ? "关闭" : "Close"}</Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
