/**
 * ArchetypeRuleDrawer.tsx — author a runtime detection rule (Phase B2).
 *
 * Admin fills a small set of essential fields for the "native" archetype;
 * the backend `nativeRule` factory expands them into a full
 * CatalogDetectionRule. These rules EXTEND migrate detection only — they
 * never enter Build certification (surfaced as a clear notice).
 *
 * Flow: edit fields → Preview (generate, no persist) → Save (persist +
 * refresh the merged detection view).
 */
import React, { useState } from "react";
import { X, Eye, Save, AlertTriangle } from "lucide-react";
import {
  generateCapabilityRule,
  saveCapabilityRule,
  type CatalogDetectionRule,
  type RuleReadiness,
  type RuntimeRuleOverride
} from "../api";
import type { Locale } from "../lib/types";
import { Button } from "./ui/Button";
import { ReadinessScorecard } from "./ReadinessScorecard";

const CATEGORIES = ["runtime", "developer", "database", "container", "security", "network", "service"];
const DATA_MODES = ["none", "optional", "recommended"] as const;
const STRATEGIES = ["package-only", "template-or-copy", "copy-with-review", "manual-review"] as const;
const RISKS = ["safe", "review", "privileged"] as const;

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}
const toList = (s: string): string[] => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
const toPorts = (s: string): number[] => toList(s).map((x) => Number(x)).filter((n) => Number.isFinite(n));

export function ArchetypeRuleDrawer({
  authToken,
  locale,
  existing,
  onSaved,
  onClose
}: {
  authToken: string;
  locale: Locale;
  existing?: RuntimeRuleOverride | null;
  onSaved: () => void;
  onClose: () => void;
}): JSX.Element {
  const zh = locale === "zh";
  const seed = (existing?.input ?? {}) as Record<string, any>;

  const [displayName, setDisplayName] = useState<string>(seed.displayName ?? "");
  const [id, setId] = useState<string>(existing?.id ?? seed.id ?? "");
  const [idTouched, setIdTouched] = useState<boolean>(Boolean(existing));
  const [capabilityKey, setCapabilityKey] = useState<string>(seed.capabilityKey ?? "");
  const [category, setCategory] = useState<string>(seed.category ?? "service");
  const [apt, setApt] = useState<string>((seed.detect?.packages?.apt ?? []).join(", "));
  const [binaries, setBinaries] = useState<string>((seed.detect?.binaries ?? []).join(", "));
  const [systemd, setSystemd] = useState<string>((seed.detect?.systemd ?? []).join(", "));
  const [ports, setPorts] = useState<string>((seed.detect?.ports ?? []).join(", "));
  const [configFiles, setConfigFiles] = useState<string>((seed.configFiles ?? []).join("\n"));
  const [configGlobs, setConfigGlobs] = useState<string>((seed.configGlobs ?? []).join("\n"));
  const [pkgApt, setPkgApt] = useState<string>((seed.crossDistro?.packageMap?.apt ?? seed.detect?.packages?.apt ?? []).join(", "));
  const [pkgDnf, setPkgDnf] = useState<string>((seed.crossDistro?.packageMap?.dnf ?? []).join(", "));
  const [validate, setValidate] = useState<string>((seed.migrate?.validate ?? []).join("\n"));
  const [dataMode, setDataMode] = useState<string>(seed.migrate?.data ?? "none");
  const [strategy, setStrategy] = useState<string>(seed.migrate?.strategy ?? "manual-review");
  const [restartServices, setRestartServices] = useState<string>((seed.migrate?.restartServices ?? []).join(", "));
  const [risk, setRisk] = useState<string>(seed.security?.risk ?? "review");
  const [securityNotes, setSecurityNotes] = useState<string>((seed.security?.notes ?? []).join("\n"));

  const [preview, setPreview] = useState<CatalogDetectionRule | null>(null);
  const [readiness, setReadiness] = useState<RuleReadiness | null>(existing?.readiness ?? null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function buildParams(): Record<string, unknown> {
    const aptPkgs = toList(pkgApt);
    const dnfPkgs = toList(pkgDnf);
    const services = toList(restartServices);
    const detect: Record<string, unknown> = { packages: { apt: toList(apt) }, binaries: toList(binaries) };
    if (toList(systemd).length) (detect as any).systemd = toList(systemd);
    if (toPorts(ports).length) (detect as any).ports = toPorts(ports);
    return {
      id: id.trim(),
      displayName: displayName.trim(),
      capabilityKey: capabilityKey.trim(),
      category,
      supportLevel: "full-migration",
      detect,
      ...(toList(configFiles).length ? { configFiles: toList(configFiles) } : {}),
      ...(toList(configGlobs).length ? { configGlobs: toList(configGlobs) } : {}),
      // references must be non-empty; default to a dependency on the key.
      references: [{ pattern: capabilityKey.trim() || id.trim(), type: "serviceDependency" }],
      migrationCompleteness: { configOnly: "partial", missingRisks: [] },
      security: { risk, notes: toList(securityNotes) },
      crossDistro: {
        packageMap: { apt: aptPkgs.length ? aptPkgs : toList(apt), dnf: dnfPkgs.length ? dnfPkgs : toList(apt) },
        serviceMap: { debian: services, rhel: services, fedora: services, arch: services, alpine: services }
      },
      migrate: {
        data: dataMode,
        strategy,
        ...(services.length ? { restartServices: services } : {}),
        validate: toList(validate).length ? toList(validate) : ["true"]
      }
    };
  }

  async function handlePreview() {
    setBusy(true); setError(""); setPreview(null); setConflict(null);
    try {
      const res = await generateCapabilityRule(authToken, "native", buildParams());
      setPreview(res.rule);
      setConflict(res.conflict);
      setReadiness(res.readiness ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally { setBusy(false); }
  }

  async function handleSave() {
    if (!displayName.trim()) { setError(zh ? "请填写名称" : "Name is required"); return; }
    if (!/^[a-z0-9-]{1,60}$/.test(id.trim())) { setError(zh ? "ID 必填,只能含小写字母/数字/连字符" : "ID required: [a-z0-9-]{1,60}"); return; }
    if (!capabilityKey.trim()) { setError(zh ? "请填写 capabilityKey" : "capabilityKey is required"); return; }
    setBusy(true); setError("");
    try {
      await saveCapabilityRule(authToken, "native", buildParams(), existing?.id);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="cap-editor-overlay" role="dialog" aria-modal="true" aria-label={zh ? "新建检测规则" : "Detection rule"}>
      <div className="cap-editor-drawer">
        <header className="cap-editor-header">
          <div>
            <p className="eyebrow">{zh ? "检测规则 · 原生原型" : "Detection rule · native archetype"}</p>
            <h2>{existing ? (existing.rule.displayName || existing.id) : (zh ? "新建检测规则" : "New detection rule")}</h2>
          </div>
          <button type="button" className="icon-action ghost-action" onClick={onClose} aria-label={zh ? "关闭" : "Close"}><X aria-hidden /></button>
        </header>

        <div className="cap-editor-body">
          <p className="cap-editor-note">
            {zh
              ? "检测规则只扩展迁移分析对源主机软件的识别,不进入 Build 完整迁移认证(认证仍需 harness 场景 + 白名单,走开发流程)。"
              : "Detection rules only extend what migrate recognizes on source hosts. They never enter Build certification (which still needs a harness scenario + opt-in via the dev flow)."}
          </p>
          {error ? <div className="conn-feedback conn-feedback-error"><AlertTriangle aria-hidden />{error}</div> : null}
          {conflict ? <div className="conn-feedback conn-feedback-error"><AlertTriangle aria-hidden />{conflict}</div> : null}

          {readiness ? (
            <section className="cap-editor-section">
              <ReadinessScorecard readiness={readiness} locale={locale} />
            </section>
          ) : null}

          <section className="cap-editor-section">
            <h3>{zh ? "身份" : "Identity"}</h3>
            <div className="cap-editor-grid">
              <label><span>{zh ? "名称" : "Name"}</span><input value={displayName} onChange={(e) => { setDisplayName(e.target.value); if (!idTouched) setId(slugify(e.target.value)); }} /></label>
              <label><span>ID</span><input value={id} disabled={Boolean(existing)} onChange={(e) => { setId(e.target.value); setIdTouched(true); }} placeholder="e.g. acme-widget" /></label>
              <label><span>capabilityKey</span><input value={capabilityKey} onChange={(e) => setCapabilityKey(e.target.value)} placeholder="e.g. service.acme-widget" /></label>
              <label><span>{zh ? "类目" : "Category"}</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              </label>
            </div>
          </section>

          <section className="cap-editor-section">
            <h3>{zh ? "检测信号" : "Detection signals"}</h3>
            <div className="cap-editor-grid">
              <label><span>{zh ? "apt 包(逗号分隔)" : "apt packages (comma)"}</span><input value={apt} onChange={(e) => setApt(e.target.value)} /></label>
              <label><span>{zh ? "二进制" : "Binaries"}</span><input value={binaries} onChange={(e) => setBinaries(e.target.value)} /></label>
              <label><span>systemd</span><input value={systemd} onChange={(e) => setSystemd(e.target.value)} placeholder="nginx.service" /></label>
              <label><span>{zh ? "端口" : "Ports"}</span><input value={ports} onChange={(e) => setPorts(e.target.value)} placeholder="80, 443" /></label>
            </div>
          </section>

          <section className="cap-editor-section">
            <h3>{zh ? "配置路径" : "Config paths"}</h3>
            <label className="cap-editor-full"><span>{zh ? "文件(每行一个)" : "Files (one per line)"}</span><textarea className="cap-editor-markdown" value={configFiles} onChange={(e) => setConfigFiles(e.target.value)} /></label>
            <label className="cap-editor-full"><span>{zh ? "通配(每行一个)" : "Globs (one per line)"}</span><textarea className="cap-editor-markdown" value={configGlobs} onChange={(e) => setConfigGlobs(e.target.value)} /></label>
          </section>

          <section className="cap-editor-section">
            <h3>{zh ? "跨发行版包名" : "Cross-distro packages"}</h3>
            <div className="cap-editor-grid">
              <label><span>apt</span><input value={pkgApt} onChange={(e) => setPkgApt(e.target.value)} placeholder={zh ? "留空则同检测 apt" : "defaults to detect apt"} /></label>
              <label><span>dnf</span><input value={pkgDnf} onChange={(e) => setPkgDnf(e.target.value)} placeholder={zh ? "留空则同检测 apt" : "defaults to detect apt"} /></label>
            </div>
          </section>

          <section className="cap-editor-section">
            <h3>{zh ? "迁移与安全" : "Migrate & security"}</h3>
            <div className="cap-editor-grid">
              <label><span>{zh ? "数据" : "Data"}</span><select value={dataMode} onChange={(e) => setDataMode(e.target.value)}>{DATA_MODES.map((d) => <option key={d} value={d}>{d}</option>)}</select></label>
              <label><span>{zh ? "策略" : "Strategy"}</span><select value={strategy} onChange={(e) => setStrategy(e.target.value)}>{STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
              <label><span>{zh ? "重启服务" : "Restart services"}</span><input value={restartServices} onChange={(e) => setRestartServices(e.target.value)} placeholder="nginx" /></label>
              <label><span>{zh ? "风险" : "Risk"}</span><select value={risk} onChange={(e) => setRisk(e.target.value)}>{RISKS.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
            </div>
            <label className="cap-editor-full"><span>{zh ? "验证命令(每行一个)" : "Validate commands (one per line)"}</span><textarea className="cap-editor-markdown" value={validate} onChange={(e) => setValidate(e.target.value)} placeholder="systemctl is-active nginx" /></label>
            <label className="cap-editor-full"><span>{zh ? "安全说明(每行一个)" : "Security notes (one per line)"}</span><textarea className="cap-editor-markdown" value={securityNotes} onChange={(e) => setSecurityNotes(e.target.value)} /></label>
          </section>

          {preview ? (
            <section className="cap-editor-section">
              <h3>{zh ? "生成的规则预览" : "Generated rule preview"}</h3>
              <pre className="cap-editor-preview">{JSON.stringify(preview, null, 2)}</pre>
            </section>
          ) : null}
        </div>

        <footer className="cap-editor-footer">
          <div className="cap-editor-footer-left">
            <Button variant="ghost" onClick={() => void handlePreview()} loading={busy}><Eye aria-hidden />{zh ? "预览" : "Preview"}</Button>
          </div>
          <div className="cap-editor-footer-right">
            <Button variant="secondary" onClick={onClose} disabled={busy}>{zh ? "取消" : "Cancel"}</Button>
            <Button variant="primary" onClick={() => void handleSave()} loading={busy}><Save aria-hidden />{zh ? "保存" : "Save"}</Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
