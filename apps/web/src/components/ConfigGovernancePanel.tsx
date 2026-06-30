import { Button } from "./ui/Button";
import { FilterPill } from "./ui/FilterPill";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Camera,
  Edit3,
  Eye,
  FileText,
  FolderOpen,
  GitCompare,
  RefreshCw,
  Save,
  ShieldCheck,
  Variable
} from "lucide-react";
import {
  createPlaybook,
  fetchConfigFileDiff,
  fetchConfigFiles,
  createConfigChangePlan,
  createConfigMigrationPlan,
  readRemoteConfigFile,
  validateRemoteConfigFile,
  type ConfigFileContent,
  type ConfigFileInfo,
  type ConfigValidationResult,
  type EnvironmentPlan
} from "../api";
import type { Locale } from "../lib/types";
import { PlanReviewPanel } from "./PlanReviewPanel";

type ViewMode = "view" | "edit" | "diff" | "template";
type FilterMode = "all" | "system" | "user" | "app";

const CATEGORY_KEYS = { all: "configGovernance.categories.all", system: "configGovernance.categories.system", user: "configGovernance.categories.user", app: "configGovernance.categories.app" } as const;
const SOURCE_KEYS = { "catalog-rule": "configGovernance.sources.catalogRule", "system-default": "configGovernance.sources.systemDefault", "user-dotfile": "configGovernance.sources.userDotfile", "package-manager-modified": "configGovernance.sources.packageModified" } as const;
const SENSITIVITY_KEYS = { secret: "configGovernance.sensitivities.secret", review: "configGovernance.sensitivities.review", safe: "configGovernance.sensitivities.safe" } as const;
const DEFAULT_STATUS_KEYS = { default: "configGovernance.statuses.default", modified: "configGovernance.statuses.modified", "user-created": "configGovernance.statuses.userCreated", unknown: "configGovernance.statuses.unknown" } as const;
const STRATEGY_KEYS = { copy: "configGovernance.strategies.copy", "copy-with-review": "configGovernance.strategies.copyReview", "redact-or-confirm": "configGovernance.strategies.redactConfirm", "do-not-copy": "configGovernance.strategies.doNotCopy", "manual-review": "configGovernance.strategies.manualReview" } as const;
const VALIDATION_KEYS = { passed: "configGovernance.validation.passed", failed: "configGovernance.validation.failed", skipped: "configGovernance.validation.skipped" } as const;

export function ConfigGovernancePanel({
  locale,
  authToken,
  connectionId,
  pushLog
}: {
  locale: Locale;
  authToken: string;
  connectionId: string;
  pushLog?: (type: "info" | "success" | "error" | "cmd", text: string) => void;
}) {
  const { t } = useTranslation();
  const [files, setFiles] = useState<ConfigFileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeFile, setActiveFile] = useState<ConfigFileContent | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("view");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [bakContent, setBakContent] = useState<string | null>(null);
  const [bakLoading, setBakLoading] = useState(false);
  const [validation, setValidation] = useState<ConfigValidationResult | null>(null);
  const [pendingChangePlan, setPendingChangePlan] = useState<EnvironmentPlan | null>(null);
  const [validating, setValidating] = useState(false);
  const [diffSource, setDiffSource] = useState<"snapshot" | "envforge-bak">("envforge-bak");
  const [snapshots, setSnapshots] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem("envforge_config_snapshots") ?? "{}");
    } catch {
      return {};
    }
  });
  const [templateVars, setTemplateVars] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem("envforge_template_vars") ?? "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    void loadFiles();
  }, [connectionId]);

  async function loadFiles() {
    setLoading(true);
    setError("");
    try {
      const result = await fetchConfigFiles(authToken, connectionId);
      setFiles(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load config files";
      setError(msg);
      setFiles([]);
      pushLog?.("error", msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpen(path: string) {
    setError("");
    setActiveFile(null);
    setViewMode("view");
    setSaveMsg("");
    setValidation(null);
    setPendingChangePlan(null);
    pushLog?.("cmd", `cat ${path}`);
    try {
      const content = await readRemoteConfigFile(authToken, connectionId, path);
      setActiveFile(content);
      setEditContent(content.content);
      pushLog?.("success", `${path} (${content.size} bytes)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to read file";
      setError(msg);
      pushLog?.("error", msg);
    }
  }

  async function handleSave() {
    if (!activeFile) return;
    setSaving(true);
    setSaveMsg("");
    pushLog?.("cmd", `envforge config change-plan ${activeFile.path}`);
    try {
      const { plan } = await createConfigChangePlan(authToken, connectionId, activeFile.path, editContent);
      setPendingChangePlan(plan);
      setSaveMsg(t("configGovernance.proposalCreated"));
      setViewMode("diff");
      pushLog?.("success", `${plan.name}: ${plan.summary.totalActions} actions`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setSaveMsg(msg);
      pushLog?.("error", msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleValidate() {
    if (!activeFile) return;
    setValidating(true);
    setValidation(null);
    const command = activeFileInfo?.governance?.validationHint ?? `validate ${activeFile.path}`;
    pushLog?.("cmd", command);
    try {
      const result = await validateRemoteConfigFile(authToken, connectionId, activeFile.path);
      setValidation(result);
      const logType = result.status === "passed" ? "success" : result.status === "failed" ? "error" : "info";
      pushLog?.(logType, `${result.message}${result.command ? ` (${result.command})` : ""}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Validation failed";
      setValidation({
        path: activeFile.path,
        status: "failed",
        stdout: "",
        stderr: msg,
        exitCode: null,
        message: msg,
        durationMs: 0
      });
      pushLog?.("error", msg);
    } finally {
      setValidating(false);
    }
  }

  async function handleAddActiveConfigToPlan() {
    if (!activeFile) return;
    setSaveMsg("");
    pushLog?.("cmd", `envforge plan add-config ${activeFile.path}`);
    try {
      const { plan } = await createConfigMigrationPlan(authToken, connectionId, [activeFile.path]);
      if (plan.export?.yaml) {
        await createPlaybook(authToken, {
          name: `${plan.name}: ${activeFile.path}`,
          description: t("configGovernance.draftDescription"),
          yaml: plan.export.yaml,
          sourceKind: "user",
          comment: "Generated from Config Governance"
        });
      }
      setSaveMsg(t("configGovernance.migrationGenerated", { items: plan.summary.totalItems }));
      pushLog?.("success", `${plan.name}: ${plan.summary.totalActions} actions`);
      setSaveMsg(t("configGovernance.addedToPlan", { path: activeFile.path, items: plan.summary.totalItems, actions: plan.summary.totalActions }));
      pushLog?.("success", t("configGovernance.savedToPlans", { name: plan.name, actions: plan.summary.totalActions }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Create config migration plan failed";
      setSaveMsg(msg);
      pushLog?.("error", msg);
    }
  }

  function handleSnapshot() {
    if (!activeFile) return;
    const next = { ...snapshots, [`${connectionId}::${activeFile.path}`]: activeFile.content };
    setSnapshots(next);
    localStorage.setItem("envforge_config_snapshots", JSON.stringify(next));
    setSaveMsg(t("configGovernance.snapshotSaved"));
    setTimeout(() => setSaveMsg(""), 3000);
  }

  function handleSaveTemplateVars(vars: Record<string, string>) {
    setTemplateVars(vars);
    localStorage.setItem("envforge_template_vars", JSON.stringify(vars));
  }

  useEffect(() => {
    if (viewMode !== "diff" || !activeFile) return;
    let cancelled = false;
    setBakLoading(true);
    setBakContent(null);
    fetchConfigFileDiff(authToken, connectionId, activeFile.path)
      .then((res) => {
        if (!cancelled) setBakContent(res.backup?.content ?? null);
      })
      .catch(() => {
        if (!cancelled) setBakContent(null);
      })
      .finally(() => {
        if (!cancelled) setBakLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewMode, activeFile?.path, authToken, connectionId]);

  const snapshotKey = activeFile ? `${connectionId}::${activeFile.path}` : "";
  const hasSnapshot = Boolean(snapshots[snapshotKey]);
  const filteredFiles = filter === "all" ? files : files.filter((f) => f.category === filter);
  const activeFileInfo = activeFile ? files.find((file) => file.path === activeFile.path) : undefined;

  return (
    <section className="panel-large config-panel">
      <div className="panel-heading">
        <h2>
          <FolderOpen style={{ width: 20, height: 20 }} />
          {t("configGovernance.title")}
        </h2>
        <span className="panel-count">{files.length}</span>
      </div>

      <div className="config-filters">
        {(["all", "system", "user", "app"] as const).map((cat) => (
          <FilterPill
            key={cat}
            active={filter === cat}
            onClick={() => setFilter(cat)}
          >
            {t(CATEGORY_KEYS[cat])} ({cat === "all" ? files.length : files.filter((f) => f.category === cat).length})
          </FilterPill>
        ))}
        <Button variant="connectionGhost" type="button"  onClick={() => void loadFiles()} style={{ marginLeft: "auto" }}>
          <RefreshCw style={{ width: 13, height: 13 }} />
          {t("configGovernance.refresh")}
        </Button>
      </div>

      {error ? (
        <div className="conn-feedback conn-feedback-error config-error-banner">
          <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="config-loading">
          <span className="spinning">↻</span>
          {t("configGovernance.scanning")}
        </div>
      ) : (
        <div className="config-layout">
          <div className="config-file-list">
            {filteredFiles.map((file) => (
              <button
                key={file.path}
                type="button"
                className={`config-file-item ${activeFile?.path === file.path ? "active" : ""}`}
                onClick={() => void handleOpen(file.path)}
              >
                <FileText style={{ width: 14, height: 14, flexShrink: 0 }} />
                <div className="config-file-info">
                  <span className="config-file-path">{file.path}</span>
                  <span className="config-file-meta">
                    <span className={`config-cat-badge config-cat-${file.category}`}>{t(CATEGORY_KEYS[file.category])}</span>
                    {file.associatedSoftware ? <span className="config-sw-badge">{file.associatedSoftware}</span> : null}
                    {file.discovery?.source === "catalog-rule" ? <span className="config-sw-badge">{t("configGovernance.rule")}</span> : null}
                    {file.governance ? <span className="config-sw-badge">{t(DEFAULT_STATUS_KEYS[file.governance.defaultStatus])}</span> : null}
                    <span>{formatSize(file.size)}</span>
                  </span>
                </div>
              </button>
            ))}
            {filteredFiles.length === 0 ? (
              <div className="config-empty">
                <FolderOpen style={{ width: 26, height: 26 }} />
                <strong>{t("configGovernance.emptyTitle")}</strong>
                <span>{t("configGovernance.emptyBody")}</span>
              </div>
            ) : null}
          </div>

          {activeFile ? (
            <div className="config-viewer">
              <div className="config-viewer-header">
                <span className="config-viewer-path">{activeFile.path}</span>
                <div className="config-viewer-actions">
                  <IconModeButton active={viewMode === "view"} title={t("configGovernance.view")} onClick={() => { setViewMode("view"); setEditContent(activeFile.content); }}>
                    <Eye style={{ width: 13, height: 13 }} />
                  </IconModeButton>
                  <IconModeButton active={viewMode === "edit"} title={t("configGovernance.edit")} onClick={() => setViewMode("edit")}>
                    <Edit3 style={{ width: 13, height: 13 }} />
                  </IconModeButton>
                  <IconModeButton
                    active={viewMode === "diff"}
                    title={hasSnapshot ? t("configGovernance.compareSnapshot") : t("configGovernance.noSnapshot")}
                    onClick={() => setViewMode("diff")}
                    disabled={!hasSnapshot}
                  >
                    <GitCompare style={{ width: 13, height: 13 }} />
                  </IconModeButton>
                  <IconModeButton active={viewMode === "template"} title={t("configGovernance.templateVariables")} onClick={() => setViewMode("template")}>
                    <Variable style={{ width: 13, height: 13 }} />
                  </IconModeButton>
                  <span className="config-viewer-sep" />
                  <Button variant="connectionGhost"  type="button" onClick={handleSnapshot} title={t("configGovernance.saveSnapshot")}>
                    <Camera style={{ width: 13, height: 13 }} />
                  </Button>
                  <Button variant="connectionGhost"

                    type="button"
                    onClick={() => void handleValidate()}
                    disabled={validating || !activeFileInfo?.governance?.validationHint}
                    title={activeFileInfo?.governance?.validationHint ?? "No validation hook"}
                  >
                    <ShieldCheck style={{ width: 13, height: 13 }} />
                    {validating ? "..." : t("configGovernance.validateHook")}
                  </Button>
                  <Button variant="connectionPrimary"

                    type="button"
                    onClick={() => void handleAddActiveConfigToPlan()}
                    title={t("configGovernance.addPlanTitle")}
                  >
                    <FileText style={{ width: 13, height: 13 }} />
                    {t("configGovernance.addPlan")}
                  </Button>
                  {viewMode === "edit" ? (
                    <Button variant="connectionPrimary"  type="button" onClick={() => void handleSave()} disabled={saving}>
                      <Save style={{ width: 13, height: 13 }} />
                      {saving ? "..." : t("configGovernance.createProposal")}
                    </Button>
                  ) : null}
                </div>
              </div>

              {saveMsg ? <div className={`config-save-msg ${/fail|denied|error/i.test(saveMsg) ? "error" : "success"}`}>{saveMsg}</div> : null}
              {pendingChangePlan ? (
                <>
                  <PlanReviewPanel
                    authToken={authToken}
                    plan={pendingChangePlan}
                    locale={locale}
                    onChanged={(updated) => setPendingChangePlan(updated)}
                  />
                  <div className="config-governance-note">
                  <div>
                    <strong>{t("configGovernance.pendingPlan")}</strong>
                    <span>{pendingChangePlan.review.reasons.join(" ")}</span>
                    <small>{pendingChangePlan.summary.totalActions} actions · {pendingChangePlan.summary.requiresSudo} sudo · {pendingChangePlan.summary.rollbackable} rollbackable</small>
                  </div>
                  <span className="config-risk-pill risk-review">{pendingChangePlan.status}</span>
                  </div>
                </>
              ) : null}
              {activeFileInfo?.discovery ? (
                <div className="config-governance-note">
                  <div>
                    <strong>{activeFileInfo.discovery.ruleName ?? t(SOURCE_KEYS[activeFileInfo.discovery.source])}</strong>
                    <span>{activeFileInfo.discovery.reasons[0]}</span>
                    {activeFileInfo.governance ? (
                      <small>
                        {t(DEFAULT_STATUS_KEYS[activeFileInfo.governance.defaultStatus])}
                        {" · "}
                        {t(STRATEGY_KEYS[activeFileInfo.governance.migrationStrategy])}
                        {activeFileInfo.governance.validationHint ? ` · ${activeFileInfo.governance.validationHint}` : ""}
                      </small>
                    ) : null}
                  </div>
                  <span className={`config-risk-pill risk-${activeFile.secretScan?.hasSecrets ? "secret" : activeFileInfo.discovery.sensitivity}`}>
                    {activeFile.secretScan?.hasSecrets
                      ? t("configGovernance.secretSignals")
                      : t(SENSITIVITY_KEYS[activeFileInfo.discovery.sensitivity])}
                  </span>
                </div>
              ) : null}
              {activeFileInfo?.governance?.riskNotes.length ? (
                <div className="config-governance-risks">
                  {activeFileInfo.governance.riskNotes.slice(0, 3).map((note) => <span key={note}>{note}</span>)}
                </div>
              ) : null}
              {validation ? (
                <div className={`config-validation-result validation-${validation.status}`}>
                  <div className="config-validation-head">
                    <strong>{t(VALIDATION_KEYS[validation.status])}</strong>
                    {validation.command ? <code>{validation.command}</code> : null}
                    <span>{validation.durationMs}ms</span>
                  </div>
                  <p>{validation.message}</p>
                  {validation.stdout || validation.stderr ? (
                    <pre>{[validation.stdout, validation.stderr].filter(Boolean).join("\n")}</pre>
                  ) : null}
                </div>
              ) : null}
              {activeFile.secretScan?.hasSecrets ? (
                <div className="conn-feedback conn-feedback-error config-error-banner">
                  <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
                  <span>
                    {t("configGovernance.secretWarning")}
                    {" "}
                    {activeFile.secretScan.hits.slice(0, 4).map((hit) => `${hit.pattern}@${hit.line}`).join(", ")}
                  </span>
                </div>
              ) : null}

              {viewMode === "view" ? (
                <pre className="config-code">{activeFile.content}</pre>
              ) : viewMode === "edit" ? (
                <textarea className="config-editor" value={editContent} onChange={(e) => setEditContent(e.target.value)} spellCheck={false} />
              ) : viewMode === "diff" ? (
                <DiffView
                  diffSource={diffSource}
                  onChangeSource={setDiffSource}
                  oldContent={diffSource === "snapshot" ? snapshots[snapshotKey] ?? "" : bakContent ?? ""}
                  newContent={activeFile.content}
                  hasManualSnapshot={hasSnapshot}
                  hasEnvforgeBak={bakContent !== null}
                  bakLoading={bakLoading}
                />
              ) : (
                <TemplateView content={activeFile.content} vars={templateVars} onVarsChange={handleSaveTemplateVars} />
              )}
            </div>
          ) : (
            <div className="config-viewer config-viewer-empty">
              <Eye style={{ width: 32, height: 32, opacity: 0.3 }} />
              <p>{t("configGovernance.selectPrompt")}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function IconModeButton({
  active,
  disabled,
  title,
  onClick,
  children
}: {
  active: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button variant={active ? "connectionPrimary" : "connectionGhost"} type="button" onClick={onClick} disabled={disabled} title={title}>
      {children}
    </Button>
  );
}

function DiffView({
  oldContent,
  newContent,
  diffSource,
  onChangeSource,
  hasManualSnapshot,
  hasEnvforgeBak,
  bakLoading
}: {
  oldContent: string;
  newContent: string;
  diffSource: "snapshot" | "envforge-bak";
  onChangeSource: (s: "snapshot" | "envforge-bak") => void;
  hasManualSnapshot: boolean;
  hasEnvforgeBak: boolean;
  bakLoading: boolean;
}) {
  const { t } = useTranslation();
  const diffLines = useMemo(() => computeDiff(oldContent, newContent), [oldContent, newContent]);
  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    let unchanged = 0;
    for (const line of diffLines) {
      if (line.type === "add") added++;
      else if (line.type === "remove") removed++;
      else unchanged++;
    }
    return { added, removed, unchanged };
  }, [diffLines]);

  return (
    <div className="config-diff">
      <div className="config-diff-source">
        <span className="config-diff-source-label">{t("configGovernance.diff.compare")}</span>
        <Button type="button" variant={diffSource === "envforge-bak" ? "connectionPrimary" : "connectionGhost"} onClick={() => onChangeSource("envforge-bak")} disabled={bakLoading}>
          {t("configGovernance.diff.backup")}
          {bakLoading ? " ..." : !hasEnvforgeBak ? " - none" : ""}
        </Button>
        <Button type="button" variant={diffSource === "snapshot" ? "connectionPrimary" : "connectionGhost"} onClick={() => onChangeSource("snapshot")} disabled={!hasManualSnapshot}>
          {t("configGovernance.diff.snapshot")}
          {!hasManualSnapshot ? " - none" : ""}
        </Button>
      </div>
      <div className="config-diff-stats">
        <span className="diff-stat-added">+{stats.added}</span>
        <span className="diff-stat-removed">-{stats.removed}</span>
        <span className="diff-stat-unchanged">{t("configGovernance.diff.unchanged", { count: stats.unchanged })}</span>
      </div>
      <pre className="config-diff-content">
        {diffLines.map((line, i) => (
          <div key={i} className={`diff-line diff-${line.type}`}>
            <span className="diff-marker">{line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}</span>
            <span className="diff-text">{line.text}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}

function TemplateView({
  content,
  vars,
  onVarsChange
}: {
  content: string;
  vars: Record<string, string>;
  onVarsChange: (vars: Record<string, string>) => void;
}) {
  const { t } = useTranslation();
  const detected = useMemo(() => {
    const patterns = new Set<string>();
    for (const match of content.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) patterns.add(match[1]);
    for (const match of content.matchAll(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/g)) patterns.add(`IP:${match[1]}`);
    for (const match of content.matchAll(/server_name\s+([a-z0-9.-]+\.[a-z]{2,})/gi)) patterns.add(`DOMAIN:${match[1]}`);
    for (const match of content.matchAll(/listen\s+(\d+)/g)) patterns.add(`PORT:${match[1]}`);
    return [...patterns];
  }, [content]);

  const [localVars, setLocalVars] = useState<Record<string, string>>(vars);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");

  function commit(next: Record<string, string>) {
    setLocalVars(next);
    onVarsChange(next);
  }

  const rendered = useMemo(() => {
    let result = content;
    for (const [key, value] of Object.entries(localVars)) {
      if (!value) continue;
      result = result.replace(new RegExp(`\\{\\{\\s*${escapeRegex(key)}\\s*\\}\\}`, "g"), value);
      if (key.startsWith("IP:")) result = result.replace(new RegExp(escapeRegex(key.slice(3)), "g"), value);
      if (key.startsWith("DOMAIN:")) result = result.replace(new RegExp(escapeRegex(key.slice(7)), "g"), value);
      if (key.startsWith("PORT:")) result = result.replace(new RegExp(`\\b${escapeRegex(key.slice(5))}\\b`, "g"), value);
    }
    return result;
  }, [content, localVars]);

  return (
    <div className="config-template">
      <div className="config-template-vars">
        <p className="config-template-title">
          {t("configGovernance.templateVariables")}
          <span className="config-template-hint">
            {t("configGovernance.template.hint")}
          </span>
        </p>
        {detected.length > 0 ? (
          <div className="config-template-detected">
            <span className="config-template-detected-label">{t("configGovernance.template.detected")}</span>
            {detected.map((item) => (
              <button key={item} type="button" className="config-template-detected-pill" onClick={() => commit({ ...localVars, [item]: localVars[item] ?? "" })}>
                {item}
              </button>
            ))}
          </div>
        ) : null}

        <div className="config-template-list">
          {Object.entries(localVars).map(([key, value]) => (
            <div key={key} className="config-template-row">
              <code className="config-template-key">{key}</code>
              <input className="config-template-input" value={value} placeholder={t("configGovernance.template.newValue")} onChange={(e) => commit({ ...localVars, [key]: e.target.value })} />
              <button type="button" className="config-template-remove" onClick={() => {
                const next = { ...localVars };
                delete next[key];
                commit(next);
              }}>
                x
              </button>
            </div>
          ))}
        </div>

        <div className="config-template-add">
          <input placeholder={t("configGovernance.template.variable")} value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          <input placeholder={t("configGovernance.template.replace")} value={newVal} onChange={(e) => setNewVal(e.target.value)} />
          <Button variant="connectionGhost" type="button"  onClick={() => {
            if (!newKey.trim()) return;
            commit({ ...localVars, [newKey.trim()]: newVal });
            setNewKey("");
            setNewVal("");
          }}>
            +
          </Button>
        </div>
      </div>
      <div className="config-template-preview">
        <p className="config-template-preview-label">{t("configGovernance.template.preview")}</p>
        <pre className="config-code">{rendered}</pre>
      </div>
    </div>
  );
}

interface DiffLine {
  type: "add" | "remove" | "same";
  text: string;
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const dp = lcsMatrix(oldLines, newLines);
  const stack: DiffLine[] = [];
  let i = oldLines.length;
  let j = newLines.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({ type: "same", text: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: "add", text: newLines[j - 1] });
      j--;
    } else {
      stack.push({ type: "remove", text: oldLines[i - 1] });
      i--;
    }
  }
  return stack.reverse();
}

function lcsMatrix(a: string[], b: string[]): number[][] {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
