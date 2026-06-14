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
  const zh = locale === "zh";
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
    if (!name.trim()) { setError(zh ? "请填写能力名称" : "Name is required"); return; }
    if (mode === "create" && !ID_RE.test(id.trim())) {
      setError(zh ? "ID 必填,且只能含小写字母、数字、连字符(1-60 位)" : "ID is required and must match [a-z0-9-]{1,60}");
      return;
    }
    if (!yaml.trim()) { setError(zh ? "安装剧本 (YAML) 不能为空" : "Install playbook YAML is required"); return; }
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
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!catalogId) return;
    if (!window.confirm(zh ? "确认删除该能力?此操作不可撤销。" : "Delete this capability? This cannot be undone.")) return;
    setBusy(true);
    setError("");
    try {
      await deleteAdminCatalog(authToken, catalogId);
      onSaved(catalogId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!catalogId) return;
    if (!window.confirm(zh ? "重置为基线?将丢弃自定义覆盖。" : "Reset to baseline? Custom overrides will be discarded.")) return;
    setBusy(true);
    setError("");
    try {
      await resetAdminCatalog(authToken, catalogId);
      onSaved(catalogId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
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
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  const canDelete = mode === "edit" && meta?.isUserAdded;
  const canReset = mode === "edit" && meta && (meta.hasYamlOverride || meta.hasMarkdownOverride || meta.hasSchemaOverride);

  return (
    <div className="cap-editor-overlay" role="dialog" aria-modal="true" aria-label={zh ? "能力编辑器" : "Capability editor"}>
      <div className="cap-editor-drawer">
        <header className="cap-editor-header">
          <div>
            <p className="eyebrow">{zh ? "能力编辑器" : "Capability editor"}</p>
            <h2>{mode === "create" ? (zh ? "新建能力" : "New capability") : (name || (zh ? "编辑能力" : "Edit capability"))}</h2>
          </div>
          <button type="button" className="icon-action ghost-action" onClick={onClose} aria-label={zh ? "关闭" : "Close"}>
            <X aria-hidden />
          </button>
        </header>

        {loading ? (
          <div className="cap-editor-body"><p className="empty-hint">{zh ? "加载中..." : "Loading..."}</p></div>
        ) : (
          <div className="cap-editor-body">
            {error ? <div className="conn-feedback conn-feedback-error"><AlertTriangle aria-hidden />{error}</div> : null}

            {mode === "create" ? (
              <p className="cap-editor-note">
                {zh
                  ? "新建能力默认未认证,不会立即出现在普通用户的构建页;完善内容后到「标准」推进认证。"
                  : "New capabilities start uncertified and won't appear in the user Build page until certified via Standards."}
              </p>
            ) : null}

            {/* ① 基本信息 */}
            <section className="cap-editor-section">
              <h3>{zh ? "基本信息" : "Basics"}</h3>
              <div className="cap-editor-grid">
                <label><span>{zh ? "名称(中)" : "Name (zh)"}</span><input value={name} onChange={(e) => { setName(e.target.value); if (mode === "create" && !idTouched) setId(slugify(e.target.value)); }} /></label>
                <label><span>{zh ? "名称(英)" : "Name (en)"}</span><input value={nameEn} onChange={(e) => setNameEn(e.target.value)} /></label>
                <label><span>{zh ? "类目" : "Category"}</span>
                  <select value={category} onChange={(e) => setCategory(e.target.value as CategoryValue)}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label><span>{zh ? "类型" : "Kind"}</span>
                  <select value={kind} onChange={(e) => setKind(e.target.value as AdminCatalogInput["kind"] as "software" | "combo")}>
                    <option value="software">software</option>
                    <option value="combo">combo</option>
                  </select>
                </label>
                <label><span>{zh ? "敏感度" : "Sensitivity"}</span>
                  <select value={sensitivity} onChange={(e) => setSensitivity(e.target.value as AdminCatalogInput["sensitivity"] as "safe" | "review" | "privileged")}>
                    {SENSITIVITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label><span>{zh ? "色调" : "Image tone"}</span><input value={imageTone} onChange={(e) => setImageTone(e.target.value)} placeholder="teal / blue / slate ..." /></label>
                {mode === "create" ? (
                  <label><span>{zh ? "ID(必填,小写字母/数字/连字符)" : "ID (required, [a-z0-9-])"}</span>
                    <input value={id} onChange={(e) => { setId(e.target.value); setIdTouched(true); }} placeholder="e.g. my-capability" />
                  </label>
                ) : null}
              </div>
              <label className="cap-editor-full"><span>{zh ? "简介(中)" : "Summary (zh)"}</span><input value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
              <label className="cap-editor-full"><span>{zh ? "简介(英)" : "Summary (en)"}</span><input value={summaryEn} onChange={(e) => setSummaryEn(e.target.value)} /></label>
              <div className="cap-editor-inline">
                <label className="cap-editor-check"><input type="checkbox" checked={deployModes.includes("system")} onChange={(e) => setDeployModes((m) => e.target.checked ? Array.from(new Set([...m, "system"])) : m.filter((x) => x !== "system"))} /> system</label>
                <label className="cap-editor-check"><input type="checkbox" checked={deployModes.includes("docker")} onChange={(e) => setDeployModes((m) => e.target.checked ? Array.from(new Set([...m, "docker"])) : m.filter((x) => x !== "docker"))} /> docker</label>
                <label className="cap-editor-check"><input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> {zh ? "隐藏" : "Hidden"}</label>
              </div>
            </section>

            {/* ② 组件 */}
            <section className="cap-editor-section">
              <h3>{zh ? "组件" : "Components"}</h3>
              <div className="cap-editor-components">
                {components.map((c, i) => (
                  <div className="cap-component-row" key={i}>
                    <select value={c.type} onChange={(e) => setComponents((list) => list.map((x, j) => j === i ? { ...x, type: e.target.value as CatalogComponent["type"] } : x))}>
                      {COMPONENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input value={c.label} placeholder={zh ? "标签(中)" : "label (zh)"} onChange={(e) => setComponents((list) => list.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                    <input value={c.labelEn} placeholder="label (en)" onChange={(e) => setComponents((list) => list.map((x, j) => j === i ? { ...x, labelEn: e.target.value } : x))} />
                    <input value={c.detail} placeholder={zh ? "详情" : "detail"} onChange={(e) => setComponents((list) => list.map((x, j) => j === i ? { ...x, detail: e.target.value } : x))} />
                    <button type="button" className="icon-action ghost-action" onClick={() => setComponents((list) => list.filter((_, j) => j !== i))} aria-label={zh ? "删除" : "Remove"}><Trash2 aria-hidden /></button>
                  </div>
                ))}
                <Button variant="ghost" onClick={() => setComponents((list) => [...list, { type: "software", label: "", labelEn: "", detail: "" }])}>
                  {zh ? "+ 添加组件" : "+ Add component"}
                </Button>
              </div>
            </section>

            {/* ③ 安装剧本 */}
            <section className="cap-editor-section">
              <h3>{zh ? "安装剧本 (YAML)" : "Install playbook (YAML)"}</h3>
              <PlaybookEditor yaml={yaml} onChange={setYaml} locale={locale} />
            </section>

            {/* ④ 参数表单 */}
            <section className="cap-editor-section">
              <h3>{zh ? "参数表单 (Vars Schema)" : "Vars schema"}</h3>
              <SchemaEditor schema={varsSchema} locale={locale} onChange={setVarsSchema} onClear={() => setVarsSchema(null)} />
            </section>

            {/* ⑤ 指南 */}
            <section className="cap-editor-section">
              <h3>{zh ? "指南 (Markdown)" : "Guide (Markdown)"}</h3>
              <textarea className="cap-editor-markdown" value={markdown} onChange={(e) => setMarkdown(e.target.value)} placeholder={zh ? "# 使用指南..." : "# Usage guide..."} />
            </section>

            {/* 预览结果 */}
            {preview != null ? (
              <section className="cap-editor-section">
                <h3>{zh ? "渲染预览" : "Rendered preview"}</h3>
                <pre className="cap-editor-preview">{preview}</pre>
              </section>
            ) : null}
          </div>
        )}

        <footer className="cap-editor-footer">
          <div className="cap-editor-footer-left">
            {canDelete ? <Button variant="ghost" onClick={() => void handleDelete()} disabled={busy}><Trash2 aria-hidden />{zh ? "删除" : "Delete"}</Button> : null}
            {canReset ? <Button variant="ghost" onClick={() => void handleReset()} disabled={busy}><RotateCcw aria-hidden />{zh ? "重置基线" : "Reset"}</Button> : null}
            {mode === "edit" && catalogId ? (
              <Button variant="ghost" onClick={() => void handlePreview()} loading={previewing}><Eye aria-hidden />{zh ? "预览" : "Preview"}</Button>
            ) : null}
            {mode === "edit" && catalogId && onGotoStandards ? (
              <Button variant="ghost" onClick={() => onGotoStandards(catalogId)}><ShieldCheck aria-hidden />{zh ? "去认证标准" : "Standards"}</Button>
            ) : null}
          </div>
          <div className="cap-editor-footer-right">
            <Button variant="secondary" onClick={onClose} disabled={saving}>{zh ? "取消" : "Cancel"}</Button>
            <Button variant="primary" onClick={() => void handleSave()} loading={saving}><Save aria-hidden />{zh ? "保存" : "Save"}</Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
