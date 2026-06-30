/**
 * CapabilityEditorDrawer.tsx — admin Build-capability authoring surface.
 *
 * Wires the long-orphaned catalog CRUD (`/api/admin/catalog`) to a UI:
 * create a new capability, edit an existing one (basics + components +
 * install playbook YAML + vars schema + guide), preview the rendered
 * playbook, delete user-added items, or reset baseline overrides.
 *
 * Reuses PlaybookEditor (YAML) and SchemaEditor (vars schema). No backend
 * changes — every action maps to an existing admin endpoint.
 */
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Save, Trash2, RotateCcw, Eye, ShieldCheck, AlertTriangle } from "lucide-react";
import {
  fetchAdminCatalogItem,
  createAdminCatalog,
  updateAdminCatalog,
  deleteAdminCatalog,
  resetAdminCatalog,
  fetchPlaybookPreview,
  type AdminCatalogInput,
  type CatalogComponent,
  type VarsSchema
} from "../api";
import type { Locale } from "../lib/types";
import { Button } from "./ui/Button";
import { confirmDialog } from "../lib/dialogs";
import { PlaybookEditor } from "./PlaybookEditor";
import { SchemaEditor } from "./SchemaEditor";

type EditorMode = "create" | "edit";
type CategoryValue = NonNullable<AdminCatalogInput["category"]>;

const CATEGORIES: CategoryValue[] = ["runtime", "developer", "database", "container", "security", "network", "service"];
const SENSITIVITIES: Array<NonNullable<AdminCatalogInput["sensitivity"]>> = ["safe", "review", "privileged"];
const COMPONENT_TYPES: CatalogComponent["type"][] = ["software", "system-command", "system-config"];

const EMPTY_YAML = "version: 1\nactions: []\n";

/** Catalog ids must match [a-z0-9-]{1,60}. Derive a safe slug from a name. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
const ID_RE = /^[a-z0-9-]{1,60}$/;

export function CapabilityEditorDrawer({
  authToken,
  locale,
  mode,
  catalogId,
  prefill,
  onSaved,
  onGotoStandards,
  onClose
}: {
  authToken: string;
  locale: Locale;
  mode: EditorMode;
  catalogId?: string;
  prefill?: Partial<AdminCatalogInput>;
  onSaved: (id: string) => void;
  onGotoStandards?: (id: string) => void;
  onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [id, setId] = useState(prefill?.id ?? "");
  const [idTouched, setIdTouched] = useState(Boolean(prefill?.id));
  const [kind, setKind] = useState<NonNullable<AdminCatalogInput["kind"]>>(prefill?.kind ?? "software");
  const [name, setName] = useState(prefill?.name ?? "");
  const [nameEn, setNameEn] = useState(prefill?.nameEn ?? "");
  const [category, setCategory] = useState<CategoryValue>(prefill?.category ?? "runtime");
  const [summary, setSummary] = useState(prefill?.summary ?? "");
  const [summaryEn, setSummaryEn] = useState(prefill?.summaryEn ?? "");
  const [sensitivity, setSensitivity] = useState<NonNullable<AdminCatalogInput["sensitivity"]>>(prefill?.sensitivity ?? "safe");
  const [imageTone, setImageTone] = useState(prefill?.imageTone ?? "teal");
  const [rating, setRating] = useState<number>(prefill?.rating ?? 0);
  const [deployModes, setDeployModes] = useState<Array<"system" | "docker">>(prefill?.deployModes ?? ["system"]);
  const [hidden, setHidden] = useState<boolean>(prefill?.hidden ?? false);
  const [components, setComponents] = useState<CatalogComponent[]>(prefill?.components ?? []);
  const [yaml, setYaml] = useState(prefill?.playbookYaml ?? EMPTY_YAML);
  const [markdown, setMarkdown] = useState(prefill?.guideMarkdown ?? "");
  const [varsSchema, setVarsSchema] = useState<VarsSchema | null>(prefill?.varsSchema ?? null);

  const [meta, setMeta] = useState<{ isUserAdded: boolean; hasYamlOverride: boolean; hasMarkdownOverride: boolean; hasSchemaOverride: boolean } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (mode !== "edit" || !catalogId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetchAdminCatalogItem(authToken, catalogId)
      .then((detail) => {
        if (cancelled) return;
        const it = detail.item;
        setId(it.id);
        setKind(it.kind);
        setName(it.name);
        setNameEn(it.nameEn);
        setCategory(it.category);
        setSummary(it.summary);
        setSummaryEn(it.summaryEn);
        setSensitivity(it.sensitivity);
        setImageTone(it.imageTone || "teal");
        setRating(it.rating ?? 0);
        setDeployModes(it.deployModes ?? ["system"]);
        setComponents(it.components ?? []);
        setYaml(detail.yaml || EMPTY_YAML);
        setMarkdown(detail.markdown || "");
        setVarsSchema(detail.varsSchema);
        setMeta({
          isUserAdded: detail.isUserAdded,
          hasYamlOverride: detail.hasYamlOverride,
          hasMarkdownOverride: detail.hasMarkdownOverride,
          hasSchemaOverride: detail.hasSchemaOverride
        });
      })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authToken, catalogId, mode]);

  // Create-from-suggestion: derive a slug id from the prefilled name once.
  useEffect(() => {
    if (mode === "create" && !idTouched && !id && (prefill?.name || prefill?.nameEn)) {
      setId(slugify(prefill?.name || prefill?.nameEn || ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildInput(): AdminCatalogInput {
    const input: AdminCatalogInput = {
      kind, name: name.trim(), nameEn: nameEn.trim(), category,
      summary: summary.trim(), summaryEn: summaryEn.trim(),
      sensitivity, imageTone: imageTone.trim() || "teal", rating,
      playbookYaml: yaml, guideMarkdown: markdown,
      components, deployModes, hidden,
      varsSchema: varsSchema ?? null
    };
    if (mode === "create" && id.trim()) input.id = id.trim();
    return input;
  }

  async function handleSave() {
    if (!name.trim()) { setError(t("capabilityEditor.errors.nameRequired")); return; }
    if (mode === "create" && !ID_RE.test(id.trim())) {
      setError(t("capabilityEditor.errors.idInvalid"));
      return;
    }
    if (!yaml.trim()) { setError(t("capabilityEditor.errors.yamlRequired")); return; }
    setSaving(true);
    setError("");
    try {
      const input = buildInput();
      let savedId = catalogId ?? id.trim();
      if (mode === "create") {
        const res = await createAdminCatalog(authToken, input);
        savedId = res.id || id.trim();
        // POST ignores varsSchema; persist it with a follow-up PATCH if set.
        if (varsSchema) await updateAdminCatalog(authToken, savedId, { varsSchema });
      } else if (catalogId) {
        await updateAdminCatalog(authToken, catalogId, input);
      }
      onSaved(savedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("capabilityEditor.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!catalogId) return;
    if (!(await confirmDialog({ message: t("capabilityEditor.deleteConfirm"), danger: true, confirmLabel: t("capabilityEditor.delete"), cancelLabel: t("capabilityEditor.cancel") }))) return;
    setBusy(true);
    setError("");
    try {
      await deleteAdminCatalog(authToken, catalogId);
      onSaved(catalogId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("capabilityEditor.errors.deleteFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!catalogId) return;
    if (!(await confirmDialog({ message: t("capabilityEditor.resetConfirm"), danger: true, confirmLabel: t("capabilityEditor.reset"), cancelLabel: t("capabilityEditor.cancel") }))) return;
    setBusy(true);
    setError("");
    try {
      await resetAdminCatalog(authToken, catalogId);
      onSaved(catalogId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("capabilityEditor.errors.resetFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handlePreview() {
    if (!catalogId) return;
    setPreviewing(true);
    setPreview(null);
    setError("");
    try {
      const res = await fetchPlaybookPreview(authToken, catalogId, {});
      if ("preview" in res) setPreview(res.preview.renderedYaml);
      else setError(res.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("capabilityEditor.errors.previewFailed"));
    } finally {
      setPreviewing(false);
    }
  }

  const canDelete = mode === "edit" && meta?.isUserAdded;
  const canReset = mode === "edit" && meta && (meta.hasYamlOverride || meta.hasMarkdownOverride || meta.hasSchemaOverride);

  return (
    <div className="cap-editor-overlay" role="dialog" aria-modal="true" aria-label={t("capabilityEditor.title")}>
      <div className="cap-editor-drawer">
        <header className="cap-editor-header">
          <div>
            <p className="eyebrow">{t("capabilityEditor.title")}</p>
            <h2>{mode === "create" ? t("capabilityEditor.newCapability") : (name || t("capabilityEditor.editCapability"))}</h2>
          </div>
          <Button variant="ghost" type="button" className="icon-action" onClick={onClose} aria-label={t("capabilityEditor.close")}>
            <X aria-hidden />
          </Button>
        </header>

        {loading ? (
          <div className="cap-editor-body"><p className="empty-hint">{t("capabilityEditor.loading")}</p></div>
        ) : (
          <div className="cap-editor-body">
            {error ? <div className="conn-feedback conn-feedback-error"><AlertTriangle aria-hidden />{error}</div> : null}

            {mode === "create" ? (
              <p className="cap-editor-note">
                {t("capabilityEditor.uncertifiedNote")}
              </p>
            ) : null}

            {/* ① 基本信息 */}
            <section className="cap-editor-section">
              <h3>{t("capabilityEditor.basics")}</h3>
              <div className="cap-editor-grid">
                <label><span>{t("capabilityEditor.nameZh")}</span><input value={name} onChange={(e) => { setName(e.target.value); if (mode === "create" && !idTouched) setId(slugify(e.target.value)); }} /></label>
                <label><span>{t("capabilityEditor.nameEn")}</span><input value={nameEn} onChange={(e) => setNameEn(e.target.value)} /></label>
                <label><span>{t("capabilityEditor.category")}</span>
                  <select value={category} onChange={(e) => setCategory(e.target.value as CategoryValue)}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label><span>{t("capabilityEditor.kind")}</span>
                  <select value={kind} onChange={(e) => setKind(e.target.value as AdminCatalogInput["kind"] as "software" | "combo")}>
                    <option value="software">software</option>
                    <option value="combo">combo</option>
                  </select>
                </label>
                <label><span>{t("capabilityEditor.sensitivity")}</span>
                  <select value={sensitivity} onChange={(e) => setSensitivity(e.target.value as AdminCatalogInput["sensitivity"] as "safe" | "review" | "privileged")}>
                    {SENSITIVITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label><span>{t("capabilityEditor.imageTone")}</span><input value={imageTone} onChange={(e) => setImageTone(e.target.value)} placeholder="teal / blue / slate ..." /></label>
                {mode === "create" ? (
                  <label><span>{t("capabilityEditor.idLabel")}</span>
                    <input value={id} onChange={(e) => { setId(e.target.value); setIdTouched(true); }} placeholder="e.g. my-capability" />
                  </label>
                ) : null}
              </div>
              <label className="cap-editor-full"><span>{t("capabilityEditor.summaryZh")}</span><input value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
              <label className="cap-editor-full"><span>{t("capabilityEditor.summaryEn")}</span><input value={summaryEn} onChange={(e) => setSummaryEn(e.target.value)} /></label>
              <div className="cap-editor-inline">
                <label className="cap-editor-check"><input type="checkbox" checked={deployModes.includes("system")} onChange={(e) => setDeployModes((m) => e.target.checked ? Array.from(new Set([...m, "system"])) : m.filter((x) => x !== "system"))} /> system</label>
                <label className="cap-editor-check"><input type="checkbox" checked={deployModes.includes("docker")} onChange={(e) => setDeployModes((m) => e.target.checked ? Array.from(new Set([...m, "docker"])) : m.filter((x) => x !== "docker"))} /> docker</label>
                <label className="cap-editor-check"><input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> {t("capabilityEditor.hidden")}</label>
              </div>
            </section>

            {/* ② 组件 */}
            <section className="cap-editor-section">
              <h3>{t("capabilityEditor.components")}</h3>
              <div className="cap-editor-components">
                {components.map((c, i) => (
                  <div className="cap-component-row" key={i}>
                    <select value={c.type} onChange={(e) => setComponents((list) => list.map((x, j) => j === i ? { ...x, type: e.target.value as CatalogComponent["type"] } : x))}>
                      {COMPONENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input value={c.label} placeholder={t("capabilityEditor.componentLabelZh")} onChange={(e) => setComponents((list) => list.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                    <input value={c.labelEn} placeholder="label (en)" onChange={(e) => setComponents((list) => list.map((x, j) => j === i ? { ...x, labelEn: e.target.value } : x))} />
                    <input value={c.detail} placeholder={t("capabilityEditor.componentDetail")} onChange={(e) => setComponents((list) => list.map((x, j) => j === i ? { ...x, detail: e.target.value } : x))} />
                    <Button variant="ghost" type="button" className="icon-action" onClick={() => setComponents((list) => list.filter((_, j) => j !== i))} aria-label={t("capabilityEditor.remove")}><Trash2 aria-hidden /></Button>
                  </div>
                ))}
                <Button variant="ghost" onClick={() => setComponents((list) => [...list, { type: "software", label: "", labelEn: "", detail: "" }])}>
                  {t("capabilityEditor.addComponent")}
                </Button>
              </div>
            </section>

            {/* ③ 安装剧本 */}
            <section className="cap-editor-section">
              <h3>{t("capabilityEditor.installPlaybook")}</h3>
              <PlaybookEditor yaml={yaml} onChange={setYaml} locale={locale} />
            </section>

            {/* ④ 参数表单 */}
            <section className="cap-editor-section">
              <h3>{t("capabilityEditor.varsSchema")}</h3>
              <SchemaEditor schema={varsSchema} locale={locale} onChange={setVarsSchema} onClear={() => setVarsSchema(null)} />
            </section>

            {/* ⑤ 指南 */}
            <section className="cap-editor-section">
              <h3>{t("capabilityEditor.guide")}</h3>
              <textarea className="cap-editor-markdown" value={markdown} onChange={(e) => setMarkdown(e.target.value)} placeholder={t("capabilityEditor.guidePlaceholder")} />
            </section>

            {/* 预览结果 */}
            {preview != null ? (
              <section className="cap-editor-section">
                <h3>{t("capabilityEditor.renderedPreview")}</h3>
                <pre className="cap-editor-preview">{preview}</pre>
              </section>
            ) : null}
          </div>
        )}

        <footer className="cap-editor-footer">
          <div className="cap-editor-footer-left">
            {canDelete ? <Button variant="ghost" onClick={() => void handleDelete()} disabled={busy}><Trash2 aria-hidden />{t("capabilityEditor.delete")}</Button> : null}
            {canReset ? <Button variant="ghost" onClick={() => void handleReset()} disabled={busy}><RotateCcw aria-hidden />{t("capabilityEditor.resetBaseline")}</Button> : null}
            {mode === "edit" && catalogId ? (
              <Button variant="ghost" onClick={() => void handlePreview()} loading={previewing}><Eye aria-hidden />{t("capabilityEditor.preview")}</Button>
            ) : null}
            {mode === "edit" && catalogId && onGotoStandards ? (
              <Button variant="ghost" onClick={() => onGotoStandards(catalogId)}><ShieldCheck aria-hidden />{t("capabilityEditor.standards")}</Button>
            ) : null}
          </div>
          <div className="cap-editor-footer-right">
            <Button variant="secondary" onClick={onClose} disabled={saving}>{t("capabilityEditor.cancel")}</Button>
            <Button variant="primary" onClick={() => void handleSave()} loading={saving}><Save aria-hidden />{t("capabilityEditor.save")}</Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
