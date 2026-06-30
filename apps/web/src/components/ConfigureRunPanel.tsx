import { Button } from "./ui/Button";
/**
 * ConfigureRunPanel — split-pane modal for catalog Playbooks.
 *
 * 三种工作流（schema 决定）：
 *   1. 有 schema 的 Playbook（如 nginx / x-ui-panel / postgres）：
 *      - 阶段 A：左 README，右表单 → 用户点"预览"
 *      - 阶段 B：左 README，右 PreviewPanel（任务/文件/YAML）→ 用户确认安装
 *   2. 没有 schema 的 Playbook（如 git-version-control / htop-tools）：
 *      - 跳过阶段 A，打开时自动获取预览，直接进入阶段 B
 *      - 用户仍能看到任务清单 / 受影响文件 / YAML，确认无误才执行
 *
 * 让所有 Playbook 都走"先预览再执行"的安全流程，避免点齿轮就闷头跑。
 *
 * 预览本身是纯本地计算（不连远端 SSH），即时返回。
 */
import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { X, Eye, EyeOff, RotateCw } from "lucide-react";
import type { CatalogGuide, VarsSchema, VarsSchemaField, PlaybookPreview } from "../api";
import type { Locale } from "../lib/types";
import { renderMarkdownPreview } from "./MarkdownOverlay";
import { PreviewPanel } from "./PreviewPanel";
import { useEscapeToClose } from "../lib/useEscapeToClose";

// Mirrors the server's evalShowWhen — kept identical so what the user sees in
// the form is exactly what the server will validate. Fail-open on parse errors.
function evalShowWhen(expr: string, vars: Record<string, unknown>): boolean {
  const m = expr.match(/^\s*([a-zA-Z_]\w*)\s*(==|!=)\s*(.+?)\s*$/);
  if (!m) return true;
  const [, name, op, rhsRaw] = m;
  const lhs = vars[name];
  let rhs: unknown;
  if (rhsRaw === "true") rhs = true;
  else if (rhsRaw === "false") rhs = false;
  else if (/^-?\d+(?:\.\d+)?$/.test(rhsRaw)) rhs = Number(rhsRaw);
  else if ((rhsRaw.startsWith('"') && rhsRaw.endsWith('"')) || (rhsRaw.startsWith("'") && rhsRaw.endsWith("'"))) {
    rhs = rhsRaw.slice(1, -1);
  } else {
    rhs = rhsRaw;
  }
  // eslint-disable-next-line eqeqeq
  const equal = lhs == rhs;
  return op === "==" ? equal : !equal;
}

/** Initial form values from schema defaults. Booleans always have a default.
 *  schema=null（无 schema）→ 返回空对象。
 */
function initialValues(schema: VarsSchema | null): Record<string, unknown> {
  if (!schema) return {};
  const out: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(schema)) {
    // boolean 字段在 schema 类型定义里 default 是必填，所以一定走这条路径。
    if ("default" in field && field.default !== undefined) {
      out[name] = field.default;
    } else if (field.type === "password") {
      out[name] = ""; // empty → server auto-generates on submit
    } else {
      out[name] = "";
    }
  }
  return out;
}

function fieldLabel(field: VarsSchemaField, locale: Locale): string {
  return locale === "en" && field.labelEn ? field.labelEn : field.label;
}

function fieldHelp(field: VarsSchemaField, locale: Locale): string | undefined {
  return locale === "en" && field.helpEn ? field.helpEn : field.help;
}

export function ConfigureRunPanel({
  guide,
  schema,
  locale,
  isAdmin,
  onClose,
  onPreview,
  onSubmit,
  submitting,
  fieldErrors
}: {
  /** Markdown guide shown on the left side */
  guide: CatalogGuide | null;
  /** vars schema. null 表示这个 Playbook 没有可配置参数（直接进预览阶段） */
  schema: VarsSchema | null;
  locale: Locale;
  /** When true, show a "Edit YAML directly" link for power users */
  isAdmin?: boolean;
  onClose: () => void;
  /**
   * 异步获取预览。返回 preview 数据（成功）或 fieldErrors（schema 校验失败时由
   * 服务端返回）。若返回错误信息，组件不切换到预览视图。
   */
  onPreview: (vars: Record<string, unknown>) => Promise<
    | { ok: true; preview: PlaybookPreview }
    | { ok: false; error?: string; fieldErrors?: Record<string, string> }
  >;
  /** 用户在预览界面点"确认安装"时调用 */
  onSubmit: (vars: Record<string, unknown>) => void;
  /** When the parent is mid-submission (locks the form) */
  submitting?: boolean;
  /** Per-field errors returned from the server (after a failed submission) */
  fieldErrors?: Record<string, string>;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, unknown>>(() => initialValues(schema));
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set());
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [previewing, setPreviewing] = useState(false); // fetching preview from server
  const [preview, setPreview] = useState<PlaybookPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Re-init when schema changes (different Playbook selected, or initial null→object
  // when MarketPage's fetchVarsSchema resolves after the modal has already mounted).
  useEffect(() => {
    setValues(initialValues(schema));
    setLocalErrors({});
    setPreview(null);
    setPreviewError(null);
    // Critical: reset previewing too. Otherwise, when the modal mounts with
    // schema=null (parent's fetchVarsSchema not yet resolved), the auto-preview
    // effect below sets previewing=true, and when schema later becomes non-null,
    // that effect's cleanup marks the in-flight request as "cancelled"; the
    // request's finally then skips setPreviewing(false) because cancelled=true.
    // Result: previewing stuck at true → "生成预览中…" button never recovers.
    setPreviewing(false);
  }, [schema]);

  // 没有 schema 的 Playbook：打开时自动获取预览（不需要用户填表单）。
  // 注意：依赖 schema 而不是 onPreview 引用——onPreview 是父组件的 inline 闭包，
  // 引用每次渲染都变，加进依赖会无限循环。
  useEffect(() => {
    if (schema !== null) return;       // 有 schema 走表单流程，不自动预览
    if (preview !== null) return;      // 已经有预览结果，避免重复请求
    if (previewing) return;            // 已经在请求中
    let cancelled = false;
    setPreviewing(true);
    setPreviewError(null);
    void onPreview({}).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setPreview(result.preview);
      } else {
        setPreviewError(result.error ?? t("configureRun.previewFailed"));
      }
    }).finally(() => {
      // 即使 cancelled 也要清 previewing — 否则父组件 schema 后续变化触发
      // 复位 effect 时会再清一次（cheap），但万一中途 unmount，也不留垃圾 state。
      // cancelled 的请求已经被 if (cancelled) 拦截，不会污染数据。
      if (!cancelled) setPreviewing(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema]);

  // Filter out fields hidden by show_when, in the same order the schema declares them.
  // schema=null（无 schema）→ 空数组
  const visibleFields = useMemo(() => {
    if (!schema) return [];
    return Object.entries(schema).filter(([, field]) =>
      !field.show_when || evalShowWhen(field.show_when, values)
    );
  }, [schema, values]);

  function update(name: string, value: unknown) {
    setValues((prev) => ({ ...prev, [name]: value }));
    // Clear errors for this field as user starts editing
    if (localErrors[name] || fieldErrors?.[name]) {
      setLocalErrors((prev) => { const { [name]: _, ...rest } = prev; return rest; });
    }
  }

  function validateLocally(): boolean {
    const errors: Record<string, string> = {};
    for (const [name, field] of visibleFields) {
      const value = values[name];
      if (field.type === "boolean") continue; // always valid
      if (field.required && (value == null || value === "")) {
        errors[name] = t("configureRun.required");
        continue;
      }
      if (value == null || value === "") continue; // optional empty → skip further checks
      if ((field.type === "string" || field.type === "password") && "validate" in field && field.validate) {
        try {
          if (!new RegExp(field.validate).test(String(value))) {
            errors[name] = t("configureRun.formatMismatch", { pattern: field.validate });
          }
        } catch { /* server-side will catch malformed regex */ }
      }
      if (field.type === "number" || field.type === "port") {
        const n = Number(value);
        if (!Number.isFinite(n)) errors[name] = t("configureRun.numberRequired");
        else if (field.type === "port" && (n < 1 || n > 65535)) errors[name] = t("configureRun.portRange");
        else if (field.type === "number") {
          if ("min" in field && field.min !== undefined && n < field.min) errors[name] = t("configureRun.min", { value: field.min });
          if ("max" in field && field.max !== undefined && n > field.max) errors[name] = t("configureRun.max", { value: field.max });
        }
      }
    }
    setLocalErrors(errors);
    return Object.keys(errors).length === 0;
  }

  /**
   * 把当前表单 values 转换成提交格式（数字转 number、空值剔除让默认值/auto-gen 生效）。
   * 客户端校验 + 转换在这里做一次，预览和真正提交都用它。
   */
  function buildSubmittedVars(): Record<string, unknown> | null {
    if (!validateLocally()) return null;
    const submitted: Record<string, unknown> = {};
    for (const [name, field] of visibleFields) {
      const v = values[name];
      if (v == null || v === "") {
        // 空字符串：password 让服务端 auto-gen，其它让 schema default 填上
        continue;
      }
      if (field.type === "number" || field.type === "port") submitted[name] = Number(v);
      else if (field.type === "boolean") submitted[name] = Boolean(v);
      else submitted[name] = v;
    }
    return submitted;
  }

  /** 用户点"预览"：先做客户端校验，再请求服务端渲染 preview，成功后切视图。 */
  async function handleShowPreview() {
    if (submitting || previewing) return;
    const submitted = buildSubmittedVars();
    if (!submitted) return;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const result = await onPreview(submitted);
      if (result.ok) {
        setPreview(result.preview);
      } else {
        if (result.fieldErrors) {
          // 服务端字段错误覆盖到本地（与 fieldErrors prop 同级）
          setLocalErrors((prev) => ({ ...prev, ...result.fieldErrors! }));
        }
        setPreviewError(result.error ?? t("configureRun.previewFailed"));
      }
    } finally {
      setPreviewing(false);
    }
  }

  function handleBackToEdit() {
    // 没 schema 的 Playbook 没有"编辑"阶段，直接关闭 modal
    if (!schema) {
      onClose();
      return;
    }
    setPreview(null);
    setPreviewError(null);
  }

  function handleConfirm() {
    if (submitting) return;
    // 没 schema 时直接提交空 vars（用 Playbook 自身的默认值）
    if (!schema) {
      onSubmit({});
      return;
    }
    const submitted = buildSubmittedVars();
    if (!submitted) {
      // 不太可能走到这里：能进预览说明已经过校验
      handleBackToEdit();
      return;
    }
    onSubmit(submitted);
  }

  function resetDefaults() {
    setValues(initialValues(schema));
    setLocalErrors({});
  }

  // Combined error map: server-side wins over local
  const errors = { ...localErrors, ...(fieldErrors ?? {}) };
  useEscapeToClose(onClose, !submitting);

  return (
    <div className="markdown-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <article className="configure-run-panel" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <p className="eyebrow">
              {preview
                ? t("configureRun.previewEyebrow")
                : !schema
                  ? t("configureRun.planPreview")
                  : t("configureRun.configurePlan")}
            </p>
            <h2>{guide ? (locale === "zh" ? guide.item.name : guide.item.nameEn) : t("configureRun.configurePlaybook")}</h2>
          </div>
          <Button variant="ghost" className="icon-action" type="button" onClick={onClose} disabled={submitting} aria-label={t("configureRun.close")}>
            <X aria-hidden />
          </Button>
        </header>

        <div className="configure-run-body">
          {/* Left pane: Markdown guide — 在编辑和预览阶段都显示 */}
          <section className="configure-run-guide" aria-label={t("configureRun.guide")}>
            {guide
              ? <div className="markdown-preview">{renderMarkdownPreview(guide.markdown)}</div>
              : <p className="muted">{t("configureRun.noGuide")}</p>}
          </section>

          {/* Right pane: 预览 / 表单 / 加载中
              schema 为 null（无表单）：直接显示预览或加载状态
              schema 非 null：根据 preview 是否已 load 切换表单/预览 */}
          {preview ? (
            <section className="configure-run-form" aria-label={t("configureRun.planPreview")}>
              <PreviewPanel
                preview={preview}
                locale={locale}
                onBack={handleBackToEdit}
                onConfirm={handleConfirm}
                submitting={submitting}
                hideBackButton={!schema}
              />
            </section>
          ) : !schema ? (
            <section className="configure-run-form" aria-label={t("configureRun.loadingPreview")}>
              <div className="configure-run-loading">
                {previewError ? (
                  <>
                    <p className="form-summary-error">{previewError}</p>
                    <Button variant="ghost" type="button"  onClick={onClose}>
                      {t("configureRun.close")}
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="spinning" style={{ fontSize: 28 }}>↻</span>
                    <p className="muted">{t("configureRun.generating")}</p>
                  </>
                )}
              </div>
            </section>
          ) : (
            <section className="configure-run-form" aria-label={t("configureRun.configuration")}>
              <div className="form-fields">
                {visibleFields.map(([name, field]) => (
                  <FormField
                    key={name}
                    name={name}
                    field={field}
                    value={values[name]}
                    onChange={(v) => update(name, v)}
                    error={errors[name]}
                    locale={locale}
                    passwordRevealed={revealedPasswords.has(name)}
                    togglePasswordReveal={() => {
                      setRevealedPasswords((prev) => {
                        const next = new Set(prev);
                        if (next.has(name)) next.delete(name); else next.add(name);
                        return next;
                      });
                    }}
                  />
                ))}
                {visibleFields.length === 0 && (
                  <p className="muted">{t("configureRun.noParameters")}</p>
                )}
              </div>

              <div className="form-actions">
                <Button variant="ghost" type="button"  onClick={resetDefaults} disabled={submitting || previewing}>
                  <RotateCw size={14} /> {t("configureRun.resetDefaults")}
                </Button>
                <Button variant="primary" type="button"  onClick={handleShowPreview} disabled={submitting || previewing}>
                  {previewing ? t("configureRun.generating") : t("configureRun.previewAction")}
                </Button>
              </div>

              {Object.keys(errors).length > 0 && (
                <p className="form-summary-error">
                  {t("configureRun.fixFields")}
                </p>
              )}
              {previewError && (
                <p className="form-summary-error">{previewError}</p>
              )}
            </section>
          )}
        </div>
      </article>
    </div>
  );
}

// ─── Single field renderer ──────────────────────────────────────────────────

function FormField({
  name,
  field,
  value,
  onChange,
  error,
  locale,
  passwordRevealed,
  togglePasswordReveal
}: {
  name: string;
  field: VarsSchemaField;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
  locale: Locale;
  passwordRevealed: boolean;
  togglePasswordReveal: () => void;
}) {
  const { t } = useTranslation();
  const label = fieldLabel(field, locale);
  const help = fieldHelp(field, locale);
  const fieldId = `var-${name}`;

  return (
    <div className={`form-field ${error ? "has-error" : ""}`}>
      <label htmlFor={fieldId} className="form-field-label">
        {label}
        {field.required && <span className="form-required" aria-label={t("configureRun.requiredAria")}>*</span>}
        <code className="form-var-name">{name}</code>
      </label>

      {(() => {
        switch (field.type) {
          case "string":
            return <input id={fieldId} type="text" value={String(value ?? "")} placeholder={field.placeholder ?? ""}
              onChange={(e) => onChange(e.target.value)} />;
          case "number":
            return <input id={fieldId} type="number" value={value === undefined || value === "" ? "" : Number(value)}
              min={field.min} max={field.max} step={field.step}
              onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />;
          case "port":
            return <input id={fieldId} type="number" value={value === undefined || value === "" ? "" : Number(value)}
              min={1} max={65535}
              onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />;
          case "boolean":
            return (
              <label className="form-toggle">
                <input id={fieldId} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
                <span>{Boolean(value) ? t("configureRun.enabled") : t("configureRun.disabled")}</span>
              </label>
            );
          case "choice":
            return (
              <select id={fieldId} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
                <option value="">{t("configureRun.none")}</option>
                {field.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {locale === "en" && opt.labelEn ? opt.labelEn : opt.label}
                  </option>
                ))}
              </select>
            );
          case "password":
            return (
              <div className="form-password-wrap">
                <input id={fieldId} type={passwordRevealed ? "text" : "password"}
                  value={String(value ?? "")}
                  placeholder={t("configureRun.autoGenerate")}
                  onChange={(e) => onChange(e.target.value)}
                  autoComplete="new-password" />
                <button type="button" className="form-password-toggle" onClick={togglePasswordReveal} aria-label={passwordRevealed ? t("configureRun.hidePassword") : t("configureRun.showPassword")}>
                  {passwordRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            );
        }
      })()}

      {help && !error && <p className="form-field-help">{help}</p>}
      {error && <p className="form-field-error">{error}</p>}
    </div>
  );
}
