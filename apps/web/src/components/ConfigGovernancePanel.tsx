import React, { useEffect, useMemo, useState } from "react";
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
  Undo2,
  Variable
} from "lucide-react";
import {
  createPlaybook,
  fetchConfigFileDiff,
  fetchConfigFiles,
  applyConfigChangePlan,
  createConfigChangePlan,
  createConfigMigrationPlan,
  readRemoteConfigFile,
  rollbackRemoteConfigFile,
  validateRemoteConfigFile,
  type ConfigFileContent,
  type ConfigFileInfo,
  type ConfigValidationResult,
  type EnvironmentPlan
} from "../api";
import type { Locale } from "../lib/types";

type ViewMode = "view" | "edit" | "diff" | "template";
type FilterMode = "all" | "system" | "user" | "app";

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
  const [rollingBack, setRollingBack] = useState(false);
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
      setSaveMsg(locale === "zh" ? "已创建配置变更提案。请审查差异、密钥扫描与验证钩子后再应用。" : "Config Change Plan created. Review diff, secret scan, and validation hook before applying.");
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

  async function handleApplyPendingChange() {
    if (!activeFile || !pendingChangePlan) return;
    setSaving(true);
    setSaveMsg("");
    pushLog?.("cmd", `envforge plan apply ${pendingChangePlan.id}`);
    try {
      const plan = { ...pendingChangePlan, status: "approved" as const };
      const result = await applyConfigChangePlan(authToken, connectionId, plan, activeFile.path, editContent, true);
      setSaveMsg(result.message);
      setValidation(result.validation);
      if (result.success) {
        setActiveFile({ ...activeFile, content: editContent, size: editContent.length });
        setPendingChangePlan(null);
        setViewMode("view");
      }
      pushLog?.(result.success ? "success" : "error", result.message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Apply change plan failed";
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
          description: locale === "zh"
            ? "由配置文件治理面板生成的配置迁移计划草稿。请在计划中审查后再执行。"
            : "Config migration plan draft created from Config Governance. Review it in Plans before applying.",
          yaml: plan.export.yaml,
          sourceKind: "user",
          comment: "Generated from Config Governance"
        });
      }
      setSaveMsg(locale === "zh"
        ? `已生成配置迁移计划：${plan.summary.totalItems} 个配置项。请在计划中审查后应用。`
        : `Config migration plan generated with ${plan.summary.totalItems} item(s). Review it in Plans before apply.`);
      pushLog?.("success", `${plan.name}: ${plan.summary.totalActions} actions`);
      setSaveMsg(locale === "zh"
        ? `已把 ${activeFile.path} 加入计划：${plan.summary.totalItems} 个配置项，${plan.summary.totalActions} 个动作。请先审查再执行。`
        : `Added ${activeFile.path} to Plans: ${plan.summary.totalItems} config item(s), ${plan.summary.totalActions} action(s). Review before apply.`);
      pushLog?.("success", locale === "zh" ? `${plan.name}：${plan.summary.totalActions} 个动作已保存到计划` : `${plan.name}: ${plan.summary.totalActions} actions saved to Plans`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Create config migration plan failed";
      setSaveMsg(msg);
      pushLog?.("error", msg);
    }
  }

  async function handleRollback() {
    if (!activeFile) return;
    const ok = window.confirm(locale === "zh" ? "确定要从 EnvForge 备份恢复这个配置文件吗？" : "Restore this config file from the EnvForge backup?");
    if (!ok) return;
    setRollingBack(true);
    setValidation(null);
    pushLog?.("cmd", `rollback ${activeFile.path}.envforge.bak`);
    try {
      const result = await rollbackRemoteConfigFile(authToken, connectionId, activeFile.path);
      setSaveMsg(result.message);
      if (result.validation) setValidation(result.validation);
      const content = await readRemoteConfigFile(authToken, connectionId, activeFile.path);
      setActiveFile(content);
      setEditContent(content.content);
      setViewMode("view");
      pushLog?.("success", result.message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Rollback failed";
      setSaveMsg(msg);
      pushLog?.("error", msg);
    } finally {
      setRollingBack(false);
    }
  }

  function handleSnapshot() {
    if (!activeFile) return;
    const next = { ...snapshots, [`${connectionId}::${activeFile.path}`]: activeFile.content };
    setSnapshots(next);
    localStorage.setItem("envforge_config_snapshots", JSON.stringify(next));
    setSaveMsg(locale === "zh" ? "快照已保存，可用于后续对比" : "Snapshot saved for later comparison");
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
          {locale === "zh" ? "配置变更治理" : "Config Change Proposals"}
        </h2>
        <span className="panel-count">{files.length}</span>
      </div>

      <div className="config-filters">
        {(["all", "system", "user", "app"] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            className={`filter-pill ${filter === cat ? "active" : ""}`}
            onClick={() => setFilter(cat)}
          >
            {categoryLabel(cat, locale)} ({cat === "all" ? files.length : files.filter((f) => f.category === cat).length})
          </button>
        ))}
        <button type="button" className="conn-btn conn-btn-ghost" onClick={() => void loadFiles()} style={{ marginLeft: "auto" }}>
          <RefreshCw style={{ width: 13, height: 13 }} />
          {locale === "zh" ? "刷新" : "Refresh"}
        </button>
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
          {locale === "zh" ? "正在扫描配置文件..." : "Scanning config files..."}
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
                    <span className={`config-cat-badge config-cat-${file.category}`}>{categoryLabel(file.category, locale)}</span>
                    {file.associatedSoftware ? <span className="config-sw-badge">{file.associatedSoftware}</span> : null}
                    {file.discovery?.source === "catalog-rule" ? <span className="config-sw-badge">{locale === "zh" ? "规则" : "rule"}</span> : null}
                    {file.governance ? <span className="config-sw-badge">{defaultStatusLabel(file.governance.defaultStatus, locale)}</span> : null}
                    <span>{formatSize(file.size)}</span>
                  </span>
                </div>
              </button>
            ))}
            {filteredFiles.length === 0 ? (
              <div className="config-empty">
                <FolderOpen style={{ width: 26, height: 26 }} />
                <strong>{locale === "zh" ? "暂未加载到配置文件" : "No config files loaded"}</strong>
                <span>
                  {locale === "zh"
                    ? "如果上方提示 SSH key 缺失，请重新上传密钥或修复连接后刷新。"
                    : "If the banner says the SSH key is missing, re-upload the key or edit the connection, then refresh."}
                </span>
              </div>
            ) : null}
          </div>

          {activeFile ? (
            <div className="config-viewer">
              <div className="config-viewer-header">
                <span className="config-viewer-path">{activeFile.path}</span>
                <div className="config-viewer-actions">
                  <IconModeButton active={viewMode === "view"} title={locale === "zh" ? "查看" : "View"} onClick={() => { setViewMode("view"); setEditContent(activeFile.content); }}>
                    <Eye style={{ width: 13, height: 13 }} />
                  </IconModeButton>
                  <IconModeButton active={viewMode === "edit"} title={locale === "zh" ? "编辑候选内容" : "Edit candidate change"} onClick={() => setViewMode("edit")}>
                    <Edit3 style={{ width: 13, height: 13 }} />
                  </IconModeButton>
                  <IconModeButton
                    active={viewMode === "diff"}
                    title={hasSnapshot ? (locale === "zh" ? "对比快照" : "Compare with snapshot") : (locale === "zh" ? "暂无快照可对比" : "No snapshot to compare")}
                    onClick={() => setViewMode("diff")}
                    disabled={!hasSnapshot}
                  >
                    <GitCompare style={{ width: 13, height: 13 }} />
                  </IconModeButton>
                  <IconModeButton active={viewMode === "template"} title={locale === "zh" ? "模板变量" : "Template variables"} onClick={() => setViewMode("template")}>
                    <Variable style={{ width: 13, height: 13 }} />
                  </IconModeButton>
                  <span className="config-viewer-sep" />
                  <button className="conn-btn conn-btn-ghost" type="button" onClick={handleSnapshot} title={locale === "zh" ? "保存当前内容为快照" : "Save snapshot"}>
                    <Camera style={{ width: 13, height: 13 }} />
                  </button>
                  <button
                    className="conn-btn conn-btn-ghost"
                    type="button"
                    onClick={() => void handleValidate()}
                    disabled={validating || !activeFileInfo?.governance?.validationHint}
                    title={activeFileInfo?.governance?.validationHint ?? "No validation hook"}
                  >
                    <ShieldCheck style={{ width: 13, height: 13 }} />
                    {validating ? "..." : locale === "zh" ? "验证钩子" : "Validate hook"}
                  </button>
                  <button
                    className="conn-btn conn-btn-primary"
                    type="button"
                    onClick={() => void handleAddActiveConfigToPlan()}
                    title={locale === "zh" ? "把此配置文件作为显式迁移项加入计划草稿" : "Add this config file as an explicit migration plan item"}
                  >
                    <FileText style={{ width: 13, height: 13 }} />
                    {locale === "zh" ? "加入迁移计划" : "Add config to plan"}
                  </button>
                  <button
                    className="conn-btn conn-btn-ghost"
                    type="button"
                    onClick={() => void handleRollback()}
                    disabled={rollingBack}
                    title={locale === "zh" ? "从 .envforge.bak 恢复" : "Restore from .envforge.bak"}
                  >
                    <Undo2 style={{ width: 13, height: 13 }} />
                    {rollingBack ? "..." : locale === "zh" ? "回滚变更" : "Rollback change"}
                  </button>
                  {viewMode === "edit" ? (
                    <button className="conn-btn conn-btn-primary" type="button" onClick={() => void handleSave()} disabled={saving}>
                      <Save style={{ width: 13, height: 13 }} />
                      {saving ? "..." : locale === "zh" ? "提交变更提案" : "Create Change Proposal"}
                    </button>
                  ) : null}
                  {pendingChangePlan ? (
                    <button className="conn-btn conn-btn-primary" type="button" onClick={() => void handleApplyPendingChange()} disabled={saving}>
                      <ShieldCheck style={{ width: 13, height: 13 }} />
                      {saving ? "..." : locale === "zh" ? "验证并应用计划" : "Validate & Apply Plan"}
                    </button>
                  ) : null}
                </div>
              </div>

              {saveMsg ? <div className={`config-save-msg ${/fail|denied|error/i.test(saveMsg) ? "error" : "success"}`}>{saveMsg}</div> : null}
              {pendingChangePlan ? (
                <div className="config-governance-note">
                  <div>
                    <strong>{locale === "zh" ? "待审查配置变更计划" : "Pending Config Change Plan"}</strong>
                    <span>{pendingChangePlan.review.reasons.join(" ")}</span>
                    <small>{pendingChangePlan.summary.totalActions} actions · {pendingChangePlan.summary.requiresSudo} sudo · {pendingChangePlan.summary.rollbackable} rollbackable</small>
                  </div>
                  <span className="config-risk-pill risk-review">{pendingChangePlan.status}</span>
                </div>
              ) : null}
              {activeFileInfo?.discovery ? (
                <div className="config-governance-note">
                  <div>
                    <strong>{activeFileInfo.discovery.ruleName ?? sourceLabel(activeFileInfo.discovery.source, locale)}</strong>
                    <span>{activeFileInfo.discovery.reasons[0]}</span>
                    {activeFileInfo.governance ? (
                      <small>
                        {defaultStatusLabel(activeFileInfo.governance.defaultStatus, locale)}
                        {" · "}
                        {migrationStrategyLabel(activeFileInfo.governance.migrationStrategy, locale)}
                        {activeFileInfo.governance.validationHint ? ` · ${activeFileInfo.governance.validationHint}` : ""}
                      </small>
                    ) : null}
                  </div>
                  <span className={`config-risk-pill risk-${activeFile.secretScan?.hasSecrets ? "secret" : activeFileInfo.discovery.sensitivity}`}>
                    {activeFile.secretScan?.hasSecrets
                      ? (locale === "zh" ? "发现敏感线索" : "secret signals")
                      : sensitivityLabel(activeFileInfo.discovery.sensitivity, locale)}
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
                    <strong>{validationStatusLabel(validation.status, locale)}</strong>
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
                    {locale === "zh" ? "内容中可能包含密钥，请在迁移或应用变更前审查：" : "Possible secrets found; review before migration or applying this change:"}
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
                  locale={locale}
                  diffSource={diffSource}
                  onChangeSource={setDiffSource}
                  oldContent={diffSource === "snapshot" ? snapshots[snapshotKey] ?? "" : bakContent ?? ""}
                  newContent={activeFile.content}
                  hasManualSnapshot={hasSnapshot}
                  hasEnvforgeBak={bakContent !== null}
                  bakLoading={bakLoading}
                />
              ) : (
                <TemplateView locale={locale} content={activeFile.content} vars={templateVars} onVarsChange={handleSaveTemplateVars} />
              )}
            </div>
          ) : (
            <div className="config-viewer config-viewer-empty">
              <Eye style={{ width: 32, height: 32, opacity: 0.3 }} />
              <p>{locale === "zh" ? "选择左侧文件查看归属、风险，并创建配置变更提案" : "Select a file to inspect ownership, risk, and create a config change proposal"}</p>
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
    <button className={`conn-btn ${active ? "conn-btn-primary" : "conn-btn-ghost"}`} type="button" onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

function DiffView({
  locale,
  oldContent,
  newContent,
  diffSource,
  onChangeSource,
  hasManualSnapshot,
  hasEnvforgeBak,
  bakLoading
}: {
  locale: Locale;
  oldContent: string;
  newContent: string;
  diffSource: "snapshot" | "envforge-bak";
  onChangeSource: (s: "snapshot" | "envforge-bak") => void;
  hasManualSnapshot: boolean;
  hasEnvforgeBak: boolean;
  bakLoading: boolean;
}) {
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
        <span className="config-diff-source-label">{locale === "zh" ? "对比版本:" : "Compare against:"}</span>
        <button type="button" className={`conn-btn ${diffSource === "envforge-bak" ? "conn-btn-primary" : "conn-btn-ghost"}`} onClick={() => onChangeSource("envforge-bak")} disabled={bakLoading}>
          {locale === "zh" ? "原始备份" : "Original backup"}
          {bakLoading ? " ..." : !hasEnvforgeBak ? " - none" : ""}
        </button>
        <button type="button" className={`conn-btn ${diffSource === "snapshot" ? "conn-btn-primary" : "conn-btn-ghost"}`} onClick={() => onChangeSource("snapshot")} disabled={!hasManualSnapshot}>
          {locale === "zh" ? "手动快照" : "Manual snapshot"}
          {!hasManualSnapshot ? " - none" : ""}
        </button>
      </div>
      <div className="config-diff-stats">
        <span className="diff-stat-added">+{stats.added}</span>
        <span className="diff-stat-removed">-{stats.removed}</span>
        <span className="diff-stat-unchanged">{stats.unchanged} {locale === "zh" ? "行未变" : "unchanged"}</span>
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
  locale,
  content,
  vars,
  onVarsChange
}: {
  locale: Locale;
  content: string;
  vars: Record<string, string>;
  onVarsChange: (vars: Record<string, string>) => void;
}) {
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
          {locale === "zh" ? "模板变量" : "Template variables"}
          <span className="config-template-hint">
            {locale === "zh" ? "迁移到新服务器时替换 IP、域名或端口" : "Replace IPs, domains, or ports before migrating"}
          </span>
        </p>
        {detected.length > 0 ? (
          <div className="config-template-detected">
            <span className="config-template-detected-label">{locale === "zh" ? "检测到:" : "Detected:"}</span>
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
              <input className="config-template-input" value={value} placeholder={locale === "zh" ? "新值" : "New value"} onChange={(e) => commit({ ...localVars, [key]: e.target.value })} />
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
          <input placeholder={locale === "zh" ? "变量名" : "Variable name"} value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          <input placeholder={locale === "zh" ? "替换值" : "Replace with"} value={newVal} onChange={(e) => setNewVal(e.target.value)} />
          <button type="button" className="conn-btn conn-btn-ghost" onClick={() => {
            if (!newKey.trim()) return;
            commit({ ...localVars, [newKey.trim()]: newVal });
            setNewKey("");
            setNewVal("");
          }}>
            +
          </button>
        </div>
      </div>
      <div className="config-template-preview">
        <p className="config-template-preview-label">{locale === "zh" ? "替换预览" : "Preview"}</p>
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

function categoryLabel(category: FilterMode | ConfigFileInfo["category"], locale: Locale): string {
  if (category === "all") return locale === "zh" ? "全部" : "All";
  if (category === "system") return locale === "zh" ? "系统" : "System";
  if (category === "user") return locale === "zh" ? "用户" : "User";
  return locale === "zh" ? "应用" : "App";
}

function sourceLabel(source: NonNullable<ConfigFileInfo["discovery"]>["source"], locale: Locale): string {
  const zh: Record<typeof source, string> = {
    "catalog-rule": "Catalog 规则",
    "system-default": "系统配置",
    "user-dotfile": "用户配置",
    "package-manager-modified": "包管理器变更"
  };
  const en: Record<typeof source, string> = {
    "catalog-rule": "Catalog rule",
    "system-default": "System config",
    "user-dotfile": "User dotfile",
    "package-manager-modified": "Package-modified"
  };
  return locale === "zh" ? zh[source] : en[source];
}

function sensitivityLabel(sensitivity: NonNullable<ConfigFileInfo["discovery"]>["sensitivity"], locale: Locale): string {
  if (sensitivity === "secret") return locale === "zh" ? "敏感" : "secret";
  if (sensitivity === "review") return locale === "zh" ? "需审查" : "review";
  return locale === "zh" ? "安全" : "safe";
}

function defaultStatusLabel(status: NonNullable<ConfigFileInfo["governance"]>["defaultStatus"], locale: Locale): string {
  const zh: Record<typeof status, string> = {
    default: "默认",
    modified: "已修改",
    "user-created": "用户创建",
    unknown: "未知状态"
  };
  const en: Record<typeof status, string> = {
    default: "default",
    modified: "modified",
    "user-created": "user-created",
    unknown: "unknown"
  };
  return locale === "zh" ? zh[status] : en[status];
}

function migrationStrategyLabel(strategy: NonNullable<ConfigFileInfo["governance"]>["migrationStrategy"], locale: Locale): string {
  const zh: Record<typeof strategy, string> = {
    copy: "可复制",
    "copy-with-review": "审查后复制",
    "redact-or-confirm": "脱敏或确认",
    "do-not-copy": "禁止复制",
    "manual-review": "人工审查"
  };
  const en: Record<typeof strategy, string> = {
    copy: "copy",
    "copy-with-review": "copy after review",
    "redact-or-confirm": "redact or confirm",
    "do-not-copy": "do not copy",
    "manual-review": "manual review"
  };
  return locale === "zh" ? zh[strategy] : en[strategy];
}

function validationStatusLabel(status: ConfigValidationResult["status"], locale: Locale): string {
  if (status === "passed") return locale === "zh" ? "验证通过" : "Validation passed";
  if (status === "failed") return locale === "zh" ? "验证失败" : "Validation failed";
  return locale === "zh" ? "已跳过验证" : "Validation skipped";
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
