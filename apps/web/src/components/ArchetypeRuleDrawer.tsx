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
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      setError(err instanceof Error ? err.message : t("archetypeRule.errors.previewFailed"));
    } finally { setBusy(false); }
  }

  async function handleSave() {
    if (!displayName.trim()) { setError(t("archetypeRule.errors.nameRequired")); return; }
    if (!/^[a-z0-9-]{1,60}$/.test(id.trim())) { setError(t("archetypeRule.errors.idInvalid")); return; }
    if (!capabilityKey.trim()) { setError(t("archetypeRule.errors.capabilityKeyRequired")); return; }
    setBusy(true); setError("");
    try {
      await saveCapabilityRule(authToken, "native", buildParams(), existing?.id);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("archetypeRule.errors.saveFailed"));
    } finally { setBusy(false); }
  }

  return (
    <div className="cap-editor-overlay" role="dialog" aria-modal="true" aria-label={t("archetypeRule.dialogLabel")}>
      <div className="cap-editor-drawer">
        <header className="cap-editor-header">
          <div>
            <p className="eyebrow">{t("archetypeRule.eyebrow")}</p>
            <h2>{existing ? (existing.rule.displayName || existing.id) : t("archetypeRule.newRule")}</h2>
          </div>
          <Button variant="ghost" type="button" className="icon-action" onClick={onClose} aria-label={t("archetypeRule.close")}><X aria-hidden /></Button>
        </header>

        <div className="cap-editor-body">
          <p className="cap-editor-note">
            {t("archetypeRule.notice")}
          </p>
          {error ? <div className="conn-feedback conn-feedback-error"><AlertTriangle aria-hidden />{error}</div> : null}
          {conflict ? <div className="conn-feedback conn-feedback-error"><AlertTriangle aria-hidden />{conflict}</div> : null}

          {readiness ? (
            <section className="cap-editor-section">
              <ReadinessScorecard readiness={readiness} locale={locale} />
            </section>
          ) : null}

          <section className="cap-editor-section">
            <h3>{t("archetypeRule.identity")}</h3>
            <div className="cap-editor-grid">
              <label><span>{t("archetypeRule.name")}</span><input value={displayName} onChange={(e) => { setDisplayName(e.target.value); if (!idTouched) setId(slugify(e.target.value)); }} /></label>
              <label><span>ID</span><input value={id} disabled={Boolean(existing)} onChange={(e) => { setId(e.target.value); setIdTouched(true); }} placeholder="e.g. acme-widget" /></label>
              <label><span>capabilityKey</span><input value={capabilityKey} onChange={(e) => setCapabilityKey(e.target.value)} placeholder="e.g. service.acme-widget" /></label>
              <label><span>{t("archetypeRule.category")}</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              </label>
            </div>
          </section>

          <section className="cap-editor-section">
            <h3>{t("archetypeRule.detectionSignals")}</h3>
            <div className="cap-editor-grid">
              <label><span>{t("archetypeRule.aptPackages")}</span><input value={apt} onChange={(e) => setApt(e.target.value)} /></label>
              <label><span>{t("archetypeRule.binaries")}</span><input value={binaries} onChange={(e) => setBinaries(e.target.value)} /></label>
              <label><span>systemd</span><input value={systemd} onChange={(e) => setSystemd(e.target.value)} placeholder="nginx.service" /></label>
              <label><span>{t("archetypeRule.ports")}</span><input value={ports} onChange={(e) => setPorts(e.target.value)} placeholder="80, 443" /></label>
            </div>
          </section>

          <section className="cap-editor-section">
            <h3>{t("archetypeRule.configPaths")}</h3>
            <label className="cap-editor-full"><span>{t("archetypeRule.files")}</span><textarea className="cap-editor-markdown" value={configFiles} onChange={(e) => setConfigFiles(e.target.value)} /></label>
            <label className="cap-editor-full"><span>{t("archetypeRule.globs")}</span><textarea className="cap-editor-markdown" value={configGlobs} onChange={(e) => setConfigGlobs(e.target.value)} /></label>
          </section>

          <section className="cap-editor-section">
            <h3>{t("archetypeRule.crossDistroPackages")}</h3>
            <div className="cap-editor-grid">
              <label><span>apt</span><input value={pkgApt} onChange={(e) => setPkgApt(e.target.value)} placeholder={t("archetypeRule.defaultsToDetectApt")} /></label>
              <label><span>dnf</span><input value={pkgDnf} onChange={(e) => setPkgDnf(e.target.value)} placeholder={t("archetypeRule.defaultsToDetectApt")} /></label>
            </div>
          </section>

          <section className="cap-editor-section">
            <h3>{t("archetypeRule.migrateSecurity")}</h3>
            <div className="cap-editor-grid">
              <label><span>{t("archetypeRule.data")}</span><select value={dataMode} onChange={(e) => setDataMode(e.target.value)}>{DATA_MODES.map((d) => <option key={d} value={d}>{d}</option>)}</select></label>
              <label><span>{t("archetypeRule.strategy")}</span><select value={strategy} onChange={(e) => setStrategy(e.target.value)}>{STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
              <label><span>{t("archetypeRule.restartServices")}</span><input value={restartServices} onChange={(e) => setRestartServices(e.target.value)} placeholder="nginx" /></label>
              <label><span>{t("archetypeRule.risk")}</span><select value={risk} onChange={(e) => setRisk(e.target.value)}>{RISKS.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
            </div>
            <label className="cap-editor-full"><span>{t("archetypeRule.validateCommands")}</span><textarea className="cap-editor-markdown" value={validate} onChange={(e) => setValidate(e.target.value)} placeholder="systemctl is-active nginx" /></label>
            <label className="cap-editor-full"><span>{t("archetypeRule.securityNotes")}</span><textarea className="cap-editor-markdown" value={securityNotes} onChange={(e) => setSecurityNotes(e.target.value)} /></label>
          </section>

          {preview ? (
            <section className="cap-editor-section">
              <h3>{t("archetypeRule.generatedPreview")}</h3>
              <pre className="cap-editor-preview">{JSON.stringify(preview, null, 2)}</pre>
            </section>
          ) : null}
        </div>

        <footer className="cap-editor-footer">
          <div className="cap-editor-footer-left">
            <Button variant="ghost" onClick={() => void handlePreview()} loading={busy}><Eye aria-hidden />{t("archetypeRule.preview")}</Button>
          </div>
          <div className="cap-editor-footer-right">
            <Button variant="secondary" onClick={onClose} disabled={busy}>{t("archetypeRule.cancel")}</Button>
            <Button variant="primary" onClick={() => void handleSave()} loading={busy}><Save aria-hidden />{t("archetypeRule.save")}</Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
