import { Button } from "./ui/Button";
/**
 * SchemaEditor — admin 用的 vars.schema.json 表单可视化编辑器。
 *
 * 而不是让 admin 手写 JSON（容易出错、字段名拼错、类型不对），这个组件提供
 * 字段一个个新增 / 编辑 / 删除的 UI。最终的 schema 对象通过 onChange 回传给父
 * 组件，由父组件保存到后端。
 *
 * 支持所有 6 种字段类型 (string / number / boolean / choice / password / port)，
 * 以及高级特性（required / validate 正则 / show_when 条件 / choice 选项 /
 * password 自动生成长度）。
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import type { VarsSchema, VarsSchemaField } from "../api";
import type { Locale } from "../lib/types";
import { confirmDialog } from "../lib/dialogs";

type FieldType = VarsSchemaField["type"];

const TYPE_LABEL_KEYS = {
  string: "schemaEditor.types.string",
  number: "schemaEditor.types.number",
  boolean: "schemaEditor.types.boolean",
  choice: "schemaEditor.types.choice",
  password: "schemaEditor.types.password",
  port: "schemaEditor.types.port"
} as const satisfies Record<FieldType, string>;

const VAR_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]{0,49}$/;

export function SchemaEditor({
  schema,
  onChange,
  onClear
}: {
  /** 当前 schema（null 表示这个 catalog 项还没有 schema） */
  schema: VarsSchema | null;
  locale: Locale;
  /** 用户改了 schema：传新值 */
  onChange: (newSchema: VarsSchema) => void;
  /** 用户点"删除整个 schema"：恢复到基线（或没有 schema） */
  onClear: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const { t } = useTranslation();

  const fields: Array<[string, VarsSchemaField]> = schema ? Object.entries(schema) : [];

  function update(name: string, field: VarsSchemaField) {
    onChange({ ...(schema ?? {}), [name]: field });
  }

  function rename(oldName: string, newName: string, field: VarsSchemaField) {
    if (oldName === newName) return;
    if (!VAR_NAME_REGEX.test(newName)) return;
    if (schema && newName in schema && newName !== oldName) return; // dup
    const next: VarsSchema = {};
    for (const [k, v] of fields) {
      if (k === oldName) next[newName] = field;
      else next[k] = v;
    }
    onChange(next);
  }

  function remove(name: string) {
    if (!schema) return;
    const next = { ...schema };
    delete next[name];
    if (Object.keys(next).length === 0) {
      onClear();
    } else {
      onChange(next);
    }
  }

  function move(name: string, dir: -1 | 1) {
    const idx = fields.findIndex(([k]) => k === name);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= fields.length) return;
    const reordered = [...fields];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    const next: VarsSchema = {};
    for (const [k, v] of reordered) next[k] = v;
    onChange(next);
  }

  function addField(name: string, type: FieldType) {
    if (!VAR_NAME_REGEX.test(name)) return;
    if (schema && name in schema) return;
    const newField = makeDefaultField(type);
    onChange({ ...(schema ?? {}), [name]: newField });
    setAdding(false);
  }

  return (
    <div className="schema-editor">
      <div className="schema-editor-header">
        <div>
          <h4 style={{ margin: 0 }}>{t("schemaEditor.title")}</h4>
          {fields.length > 0 && <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>{t("schemaEditor.fields", { count: fields.length })}</p>}
        </div>
        {fields.length > 0 && (
          <Button variant="ghost"
            type="button"

            onClick={async () => { if (await confirmDialog({ message: t("schemaEditor.clearConfirm"), danger: true })) onClear(); }}
            style={{ color: "var(--ef-danger)", borderColor: "var(--ef-danger)", fontSize: 12 }}
          >
            {t("schemaEditor.clearSchema")}
          </Button>
        )}
      </div>

      {fields.length === 0 ? (
        <div className="schema-editor-empty">
          <p><strong>{t("schemaEditor.emptyTitle")}</strong></p>
          <p style={{ fontSize: 13, color: "var(--ef-muted)" }}>{t("schemaEditor.emptyDesc")}</p>
          {!adding && (
            <Button variant="primary" type="button"  onClick={() => setAdding(true)}>
              {t("schemaEditor.addField")}
            </Button>
          )}
        </div>
      ) : (
        <ol className="schema-fields-list">
          {fields.map(([name, field], i) => (
            <li key={name} className="schema-field-card">
              <div className="schema-field-card-header">
                <input
                  className="schema-field-name-input"
                  value={name}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === name) return;
                    if (!VAR_NAME_REGEX.test(v)) return;
                    rename(name, v, field);
                  }}
                  spellCheck={false}
                  aria-label="var name"
                />
                <select
                  value={field.type}
                  onChange={(e) => {
                    const newType = e.target.value as FieldType;
                    if (newType === field.type) return;
                    // Replacing type — start fresh with defaults
                    update(name, { ...makeDefaultField(newType), label: field.label });
                  }}
                  className="schema-field-type-select"
                >
                  {(Object.keys(TYPE_LABEL_KEYS) as FieldType[]).map((tp) => (
                    <option key={tp} value={tp}>{t(TYPE_LABEL_KEYS[tp])}</option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: 4 }}>
                  <button type="button" className="schema-icon-btn" onClick={() => move(name, -1)} title={t("schemaEditor.moveUp")} disabled={i === 0}><ChevronUp size={14} /></button>
                  <button type="button" className="schema-icon-btn" onClick={() => move(name, 1)} title={t("schemaEditor.moveDown")} disabled={i === fields.length - 1}><ChevronDown size={14} /></button>
                  <button type="button" className="schema-icon-btn schema-icon-danger" onClick={() => remove(name)} title={t("schemaEditor.deleteField")}><Trash2 size={14} /></button>
                </div>
              </div>
              <FieldDetailEditor field={field} onChange={(f) => update(name, f)} />
            </li>
          ))}
        </ol>
      )}

      {fields.length > 0 && !adding && (
        <Button variant="ghost" type="button"  onClick={() => setAdding(true)} style={{ marginTop: 12 }}>
          <Plus size={14} /> {t("schemaEditor.addField")}
        </Button>
      )}

      {adding && (
        <AddFieldForm
          existing={new Set(fields.map(([k]) => k))}
          onAdd={addField}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  );
}

// ─── Subviews ──────────────────────────────────────────────────────────────

function AddFieldForm({
  existing, onAdd, onCancel
}: {
  existing: Set<string>;
  onAdd: (name: string, type: FieldType) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("string");
  const valid = VAR_NAME_REGEX.test(name) && !existing.has(name);
  return (
    <div className="schema-add-form">
      <h5 style={{ margin: "0 0 8px" }}>{t("schemaEditor.add.title")}</h5>
      <div className="schema-add-row">
        <input
          placeholder={t("schemaEditor.add.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          spellCheck={false}
          autoFocus
        />
        <select value={type} onChange={(e) => setType(e.target.value as FieldType)}>
          {(Object.keys(TYPE_LABEL_KEYS) as FieldType[]).map((tp) => (
            <option key={tp} value={tp}>{t(TYPE_LABEL_KEYS[tp])}</option>
          ))}
        </select>
        <Button variant="primary" type="button"  onClick={() => onAdd(name, type)} disabled={!valid}>
          {t("schemaEditor.add.submit")}
        </Button>
        <Button variant="ghost" type="button"  onClick={onCancel}>
          {t("schemaEditor.add.cancel")}
        </Button>
      </div>
      {name && !valid && (
        <p className="schema-hint-error">
          {existing.has(name) ? t("schemaEditor.add.duplicate") : t("schemaEditor.add.invalid")}
        </p>
      )}
    </div>
  );
}

function FieldDetailEditor({
  field, onChange
}: {
  field: VarsSchemaField;
  onChange: (f: VarsSchemaField) => void;
}) {
  const { t: translate } = useTranslation();
  const t = {
    label: translate("schemaEditor.detail.label"),
    labelEn: translate("schemaEditor.detail.labelEn"),
    help: translate("schemaEditor.detail.help"),
    helpEn: translate("schemaEditor.detail.helpEn"),
    required: translate("schemaEditor.detail.required"),
    defaultStr: translate("schemaEditor.detail.default"),
    defaultBool: translate("schemaEditor.detail.default"),
    defaultNum: translate("schemaEditor.detail.defaultNumber"),
    validate: translate("schemaEditor.detail.validate"),
    placeholder: translate("schemaEditor.detail.placeholder"),
    showWhen: translate("schemaEditor.detail.showWhen"),
    min: translate("schemaEditor.detail.min"),
    max: translate("schemaEditor.detail.max"),
    step: translate("schemaEditor.detail.step"),
    generateLength: translate("schemaEditor.detail.generateLength"),
    revealAfterRun: translate("schemaEditor.detail.revealAfterRun"),
    choiceOptions: translate("schemaEditor.detail.options"),
    addOption: translate("schemaEditor.detail.addOption"),
    removeOption: translate("schemaEditor.detail.removeOption")
  };

  // Common rows for all types
  const commonRows = (
    <>
      <Row>
        <Col label={t.label} required>
          <input value={field.label} onChange={(e) => onChange({ ...field, label: e.target.value })} />
        </Col>
        <Col label={t.labelEn}>
          <input value={field.labelEn ?? ""} onChange={(e) => onChange({ ...field, labelEn: e.target.value || undefined })} />
        </Col>
      </Row>
      <Row>
        <Col label={t.help} full>
          <textarea rows={2} value={field.help ?? ""} onChange={(e) => onChange({ ...field, help: e.target.value || undefined })} />
        </Col>
      </Row>
      <Row>
        <Col label={t.helpEn} full>
          <textarea rows={2} value={field.helpEn ?? ""} onChange={(e) => onChange({ ...field, helpEn: e.target.value || undefined })} />
        </Col>
      </Row>
      <Row>
        <Col label={t.showWhen}>
          <input
            value={field.show_when ?? ""}
            onChange={(e) => onChange({ ...field, show_when: e.target.value || undefined })}
            placeholder="use_proxy == true"
            spellCheck={false}
          />
        </Col>
        {field.type !== "boolean" && (
          <Col label={t.required}>
            <label className="schema-toggle">
              <input
                type="checkbox"
                checked={field.required ?? false}
                onChange={(e) => onChange({ ...field, required: e.target.checked || undefined })}
              />
              <span>{field.required ? "✓" : "—"}</span>
            </label>
          </Col>
        )}
      </Row>
    </>
  );

  return (
    <div className="schema-field-detail">
      {commonRows}
      {field.type === "string" && (
        <>
          <Row>
            <Col label={t.defaultStr}>
              <input value={field.default ?? ""} onChange={(e) => onChange({ ...field, default: e.target.value || undefined })} />
            </Col>
            <Col label={t.placeholder}>
              <input value={field.placeholder ?? ""} onChange={(e) => onChange({ ...field, placeholder: e.target.value || undefined })} />
            </Col>
          </Row>
          <Row>
            <Col label={t.validate} full>
              <input
                value={field.validate ?? ""}
                onChange={(e) => onChange({ ...field, validate: e.target.value || undefined })}
                placeholder="^[a-zA-Z0-9.-]+$"
                spellCheck={false}
              />
            </Col>
          </Row>
        </>
      )}
      {field.type === "number" && (
        <Row>
          <Col label={t.defaultNum}>
            <input type="number" value={field.default ?? ""} onChange={(e) => onChange({ ...field, default: e.target.value === "" ? undefined : Number(e.target.value) })} />
          </Col>
          <Col label={t.min}>
            <input type="number" value={field.min ?? ""} onChange={(e) => onChange({ ...field, min: e.target.value === "" ? undefined : Number(e.target.value) })} />
          </Col>
          <Col label={t.max}>
            <input type="number" value={field.max ?? ""} onChange={(e) => onChange({ ...field, max: e.target.value === "" ? undefined : Number(e.target.value) })} />
          </Col>
          <Col label={t.step}>
            <input type="number" value={field.step ?? ""} onChange={(e) => onChange({ ...field, step: e.target.value === "" ? undefined : Number(e.target.value) })} />
          </Col>
        </Row>
      )}
      {field.type === "boolean" && (
        <Row>
          <Col label={t.defaultBool}>
            <label className="schema-toggle">
              <input
                type="checkbox"
                checked={field.default}
                onChange={(e) => onChange({ ...field, default: e.target.checked })}
              />
              <span>{field.default ? "true" : "false"}</span>
            </label>
          </Col>
        </Row>
      )}
      {field.type === "port" && (
        <Row>
          <Col label={t.defaultNum}>
            <input type="number" min={1} max={65535} value={field.default ?? ""} onChange={(e) => onChange({ ...field, default: e.target.value === "" ? undefined : Number(e.target.value) })} />
          </Col>
        </Row>
      )}
      {field.type === "password" && (
        <Row>
          <Col label={t.generateLength}>
            <input type="number" min={8} max={128} value={field.generate_length ?? 24} onChange={(e) => onChange({ ...field, generate_length: Number(e.target.value) || 24 })} />
          </Col>
          <Col label={t.revealAfterRun}>
            <label className="schema-toggle">
              <input
                type="checkbox"
                checked={field.reveal_after_run ?? false}
                onChange={(e) => onChange({ ...field, reveal_after_run: e.target.checked || undefined })}
              />
              <span>{field.reveal_after_run ? "✓" : "—"}</span>
            </label>
          </Col>
          <Col label={t.validate} full>
            <input
              value={field.validate ?? ""}
              onChange={(e) => onChange({ ...field, validate: e.target.value || undefined })}
              placeholder="^[A-Za-z0-9_-]+$"
              spellCheck={false}
            />
          </Col>
        </Row>
      )}
      {field.type === "choice" && (
        <ChoiceOptionsEditor field={field} onChange={onChange} t={t} />
      )}
    </div>
  );
}

function ChoiceOptionsEditor({
  field, onChange, t
}: {
  field: Extract<VarsSchemaField, { type: "choice" }>;
  onChange: (f: VarsSchemaField) => void;
  t: { defaultStr: string; choiceOptions: string; addOption: string; removeOption: string };
}) {
  const { t: translate } = useTranslation();
  function updateOpt(idx: number, opt: { value: string; label: string; labelEn?: string }) {
    const next = [...field.options];
    next[idx] = opt;
    onChange({ ...field, options: next });
  }
  function addOpt() {
    onChange({ ...field, options: [...field.options, { value: `option${field.options.length + 1}`, label: "" }] });
  }
  function removeOpt(idx: number) {
    onChange({ ...field, options: field.options.filter((_, i) => i !== idx) });
  }
  return (
    <>
      <Row>
        <Col label={t.defaultStr}>
          <select value={field.default ?? ""} onChange={(e) => onChange({ ...field, default: e.target.value || undefined })}>
            <option value="">{translate("schemaEditor.detail.noDefault")}</option>
            {field.options.map((o) => <option key={o.value} value={o.value}>{o.label || o.value}</option>)}
          </select>
        </Col>
      </Row>
      <Row>
        <Col label={t.choiceOptions} full>
          <div className="schema-options-list">
            {field.options.map((opt, idx) => (
              <div key={idx} className="schema-option-row">
                <input
                  placeholder="value"
                  value={opt.value}
                  onChange={(e) => updateOpt(idx, { ...opt, value: e.target.value })}
                  className="schema-option-value"
                  spellCheck={false}
                />
                <input
                  placeholder={translate("schemaEditor.detail.optionLabel")}
                  value={opt.label}
                  onChange={(e) => updateOpt(idx, { ...opt, label: e.target.value })}
                />
                <input
                  placeholder={translate("schemaEditor.detail.optionLabelEn")}
                  value={opt.labelEn ?? ""}
                  onChange={(e) => updateOpt(idx, { ...opt, labelEn: e.target.value || undefined })}
                />
                <button type="button" className="schema-icon-btn schema-icon-danger" onClick={() => removeOpt(idx)} title={t.removeOption}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <Button variant="ghost" type="button" className="small" onClick={addOpt} style={{ marginTop: 6 }}>
            {t.addOption}
          </Button>
        </Col>
      </Row>
    </>
  );
}

// ─── Layout helpers ────────────────────────────────────────────────────────

function Row({ children }: { children: React.ReactNode }) {
  return <div className="schema-form-row">{children}</div>;
}

function Col({ label, children, required, full }: { label: string; children: React.ReactNode; required?: boolean; full?: boolean }) {
  return (
    <label className={`schema-form-col ${full ? "full" : ""}`}>
      <span className="schema-form-label">
        {label}{required && <span style={{ color: "var(--ef-danger)", marginLeft: 4 }}>*</span>}
      </span>
      {children}
    </label>
  );
}

// ─── Defaults ──────────────────────────────────────────────────────────────

function makeDefaultField(type: FieldType): VarsSchemaField {
  switch (type) {
    case "string":
      return { type: "string", label: "" };
    case "number":
      return { type: "number", label: "" };
    case "boolean":
      return { type: "boolean", label: "", default: false };
    case "choice":
      return { type: "choice", label: "", options: [{ value: "option1", label: "Option 1" }] };
    case "password":
      return { type: "password", label: "", generate_length: 24, reveal_after_run: true };
    case "port":
      return { type: "port", label: "" };
  }
}
