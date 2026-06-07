import React, { useEffect, useState } from "react";
import { FileText, History, Play, Upload, X } from "lucide-react";
import {
  createPlaybook,
  applyEnvironmentPlan,
  createEnvironmentPlan,
  deletePlaybook,
  fetchPlaybook,
  fetchPlaybooks,
  restorePlaybookVersion,
  streamTask,
  updatePlaybook,
  type CatalogItem,
  type ConnectionProfile,
  type ExecutionTask,
  type StoredPlaybook
} from "../api";
import { PlaybookEditor } from "../components/PlaybookEditor";
import { PlansCenterPanel } from "../components/PlansCenterPanel";
import { DriftPanel, SchedulesPanel, WebhooksPanel } from "./SettingsPage";
import type { Locale } from "../lib/types";

const EMPTY_YAML = `# EnvForge Environment Plan
name: Reviewable Environment Plan
hosts: all

tasks:
  - name: Review before applying
    module: shell
    args:
      cmd: "echo Review this plan before applying it to a target VM"
`;

export function PlanRecipesPage({
  locale,
  authToken,
  connections,
  playbooks: schedulePlaybooks,
  catalog,
  activeTask,
  onTaskUpdate
}: {
  locale: Locale;
  authToken: string;
  connections: ConnectionProfile[];
  playbooks: StoredPlaybook[];
  catalog: CatalogItem[];
  activeTask: ExecutionTask | null;
  onTaskUpdate: (task: ExecutionTask) => void;
}) {
  const [opsTab, setOpsTab] = useState<"plans" | "runs" | "schedules" | "drift" | "webhooks" | "reports">("plans");
  const [playbooks, setPlaybooks] = useState<StoredPlaybook[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingPlaybook, setEditingPlaybook] = useState<StoredPlaybook | null>(null);
  const [editorYaml, setEditorYaml] = useState(EMPTY_YAML);
  const [editorName, setEditorName] = useState("");
  const [editorDesc, setEditorDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showMultiTarget, setShowMultiTarget] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [executing, setExecuting] = useState(false);
  const [execError, setExecError] = useState("");
  const [execResults, setExecResults] = useState<Array<{ connectionId: string; label: string; taskId: string }>>([]);
  const [createMode, setCreateMode] = useState(false);

  void activeTask;

  const allTags = Array.from(new Set(connections.flatMap((connection) => connection.tags ?? []))).sort();
  const probedConnections = connections.filter((connection) => connection.status === "probed");
  const hasTargets = selectedTargets.size > 0 || selectedTags.size > 0;

  useEffect(() => {
    if (!authToken) return;
    setLoading(true);
    fetchPlaybooks(authToken).then(setPlaybooks).catch(() => {}).finally(() => setLoading(false));
  }, [authToken]);

  async function handleSelect(id: string) {
    setSelectedId(id);
    setShowHistory(false);
    setCreateMode(false);
    try {
      const playbook = await fetchPlaybook(authToken, id);
      setEditingPlaybook(playbook);
      setEditorYaml(playbook.yaml);
      setEditorName(playbook.name);
      setEditorDesc(playbook.description ?? "");
    } catch {
      // Keep the current selection if a stale row failed to load.
    }
  }

  async function handleSave(comment?: string) {
    setSaving(true);
    setSaveError("");
    try {
      if (createMode) {
        const playbook = await createPlaybook(authToken, {
          name: editorName || "Untitled Environment Plan",
          description: editorDesc,
          yaml: editorYaml,
          sourceKind: "user",
          comment
        });
        setPlaybooks((prev) => [playbook, ...prev]);
        setEditingPlaybook(playbook);
        setSelectedId(playbook.id);
        setCreateMode(false);
      } else if (editingPlaybook) {
        const playbook = await updatePlaybook(authToken, editingPlaybook.id, {
          name: editorName,
          description: editorDesc,
          yaml: editorYaml,
          comment
        });
        setPlaybooks((prev) => prev.map((item) => item.id === playbook.id ? { ...playbook, history: undefined } : item));
        setEditingPlaybook(playbook);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(locale === "zh" ? "确认删除此计划草稿？" : "Delete this plan draft?")) return;
    try {
      await deletePlaybook(authToken, id);
      setPlaybooks((prev) => prev.filter((item) => item.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setEditingPlaybook(null);
      }
    } catch {
      // Keep UI unchanged when deletion fails.
    }
  }

  async function handleRestoreVersion(version: number) {
    if (!editingPlaybook) return;
    try {
      const playbook = await restorePlaybookVersion(authToken, editingPlaybook.id, version);
      setEditingPlaybook(playbook);
      setEditorYaml(playbook.yaml);
      setPlaybooks((prev) => prev.map((item) => item.id === playbook.id ? { ...playbook, history: undefined } : item));
    } catch {
      // Non-blocking history action.
    }
  }

  async function handleMultiExecute(dryRun: boolean) {
    if (!editingPlaybook && !createMode) return;
    setExecuting(true);
    setExecError("");
    setExecResults([]);
    try {
      const targetIds = selectedTargets.size > 0
        ? Array.from(selectedTargets)
        : connections.filter((connection) => connection.tags?.some((tag) => selectedTags.has(tag))).map((connection) => connection.id);
      const launched: Array<{ connectionId: string; label: string; taskId: string }> = [];
      for (const connectionId of targetIds) {
        const connection = connections.find((item) => item.id === connectionId);
        const { plan } = await createEnvironmentPlan(authToken, {
          type: "imported-recipe",
          targetConnectionId: connectionId,
          source: { kind: "recipe", yaml: editorYaml, name: editorName || "Imported Recipe" }
        });
        const reviewedPlan = { ...plan, status: "approved" as const };
        const result = await applyEnvironmentPlan(authToken, reviewedPlan, dryRun, !dryRun);
        if (!result.taskId) continue;
        launched.push({ connectionId, label: connection?.label ?? connectionId, taskId: result.taskId });
        const unsubscribe = streamTask(result.taskId, (task) => {
          onTaskUpdate(task);
          if (task.status === "succeeded" || task.status === "failed" || task.status === "cancelled") unsubscribe();
        }, authToken);
      }
      setExecResults(launched);
    } catch (err) {
      setExecError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setExecuting(false);
    }
  }

  function startCreate() {
    setCreateMode(true);
    setSelectedId(null);
    setEditingPlaybook(null);
    setEditorYaml(EMPTY_YAML);
    setEditorName("");
    setEditorDesc("");
  }

  return (
    <div className="playbook-page-stack">
      <nav className="settings-tabs plan-ops-tabs" aria-label="Environment Plan Operations Center">
        {[
          ["plans", locale === "zh" ? "计划" : "Plans"],
          ["runs", locale === "zh" ? "执行记录" : "Runs"],
          ["schedules", locale === "zh" ? "排程" : "Schedules"],
          ["drift", locale === "zh" ? "漂移" : "Drift"],
          ["webhooks", locale === "zh" ? "外发通知" : "Webhooks"],
          ["reports", locale === "zh" ? "报告" : "Reports"]
        ].map(([id, label]) => (
          <button key={id} className={opsTab === id ? "active" : ""} type="button" onClick={() => setOpsTab(id as typeof opsTab)}>
            {label}
          </button>
        ))}
      </nav>

      {opsTab === "plans" ? (
        <>
      <PlansCenterPanel authToken={authToken} locale={locale} />
      <div className="playbook-page" style={{ marginTop: 12 }}>
        <div className="playbook-sidebar">
        <div className="playbook-sidebar-header">
          <button className="primary-action" type="button" style={{ flex: 1, fontSize: 13, minHeight: 34, padding: "0 14px" }} onClick={startCreate}>
            + {locale === "zh" ? "新建计划草稿" : "New plan draft"}
          </button>
          <label className="conn-btn conn-btn-ghost" style={{ flex: 1, justifyContent: "center", fontSize: 13, minHeight: 34, padding: "0 14px", cursor: "pointer" }}>
            <Upload style={{ width: 14, height: 14 }} />
            {locale === "zh" ? "导入配方" : "Import recipe"}
            <input type="file" accept=".yaml,.yml,.txt" style={{ display: "none" }} onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const content = reader.result as string;
                setCreateMode(true);
                setSelectedId(null);
                setEditingPlaybook(null);
                setEditorYaml(content);
                setEditorName(file.name.replace(/\.(yaml|yml|txt)$/, ""));
                setEditorDesc("");
              };
              reader.readAsText(file);
              event.target.value = "";
            }} />
          </label>
        </div>

        {loading ? (
          <p className="empty-hint">{locale === "zh" ? "正在加载..." : "Loading..."}</p>
        ) : playbooks.length === 0 && !createMode ? (
          <p className="empty-hint">{locale === "zh" ? "暂无计划草稿" : "No plan drafts yet"}</p>
        ) : (
          <div className="playbook-list">
            {playbooks.map((playbook) => (
              <button key={playbook.id} type="button" className={`playbook-list-item ${selectedId === playbook.id ? "active" : ""}`} onClick={() => void handleSelect(playbook.id)}>
                <FileText className="playbook-list-icon" aria-hidden />
                <div className="playbook-list-body">
                  <div className="playbook-list-name">{playbook.name}</div>
                  <div className="playbook-list-meta">{new Date(playbook.updatedAt).toLocaleDateString()}</div>
                </div>
                <span className="playbook-list-badge">v{playbook.version}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="playbook-editor-area">
        {(editingPlaybook || createMode) ? (
          <>
            <div className="playbook-editor-header">
              <div className="playbook-editor-meta-inputs">
                <input className="playbook-name-input" placeholder={locale === "zh" ? "计划名称" : "Plan name"} value={editorName} onChange={(event) => setEditorName(event.target.value)} />
                <input className="playbook-desc-input" placeholder={locale === "zh" ? "说明（可选）" : "Description (optional)"} value={editorDesc} onChange={(event) => setEditorDesc(event.target.value)} />
              </div>
              <div className="playbook-editor-actions">
                {editingPlaybook ? <span className="playbook-version-badge">v{editingPlaybook.version}</span> : null}
                <button className="ghost-action" type="button" style={{ fontSize: 13, minHeight: 34 }} onClick={() => setShowHistory((value) => !value)} disabled={!editingPlaybook}>
                  <History style={{ width: 14, height: 14 }} /> {locale === "zh" ? "版本历史" : "History"}
                </button>
                <button className="ghost-action" type="button" style={{ fontSize: 13, minHeight: 34 }} onClick={() => setShowMultiTarget((value) => !value)}>
                  {locale === "zh" ? "选择目标" : "Targets"}
                </button>
                <button className={`primary-action ${saving ? "btn-loading" : ""}`} type="button" style={{ fontSize: 13, minHeight: 34 }} disabled={saving || !editorYaml.trim()} onClick={() => void handleSave()}>
                  {saving ? (locale === "zh" ? "保存中..." : "Saving...") : (locale === "zh" ? "保存计划草稿" : "Save plan draft")}
                </button>
                {editingPlaybook ? (
                  <button className="ghost-action" type="button" style={{ fontSize: 13, minHeight: 34, color: "#b42318" }} onClick={() => void handleDelete(editingPlaybook.id)}>
                    {locale === "zh" ? "删除" : "Delete"}
                  </button>
                ) : null}
              </div>
            </div>

            {saveError ? <p className="connection-error" style={{ margin: "0 0 12px" }}>{saveError}</p> : null}

            {showHistory && editingPlaybook?.history ? (
              <div className="playbook-history-panel">
                <div className="playbook-history-header">
                  <strong>{locale === "zh" ? "版本历史" : "Version history"}</strong>
                  <button className="ghost-action icon-action" type="button" onClick={() => setShowHistory(false)}><X style={{ width: 14, height: 14 }} /></button>
                </div>
                <div className="playbook-history-list">
                  {editingPlaybook.history.map((historyItem) => (
                    <div key={historyItem.version} className="playbook-history-item">
                      <div className="playbook-history-item-meta">
                        <span className="playbook-version-badge">v{historyItem.version}</span>
                        <span style={{ color: "#64748b", fontSize: 12 }}>{new Date(historyItem.savedAt).toLocaleString()}</span>
                        {historyItem.comment ? <span style={{ color: "#475569", fontSize: 12 }}>{historyItem.comment}</span> : null}
                      </div>
                      {historyItem.version !== editingPlaybook.version ? (
                        <button className="secondary-action" type="button" style={{ fontSize: 12, minHeight: 28, padding: "0 10px" }} onClick={() => void handleRestoreVersion(historyItem.version)}>
                          {locale === "zh" ? "恢复" : "Restore"}
                        </button>
                      ) : (
                        <span style={{ color: "#0f766e", fontSize: 12, fontWeight: 700 }}>{locale === "zh" ? "当前版本" : "Current"}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {showMultiTarget ? (
              <div className="multi-target-panel">
                <div className="multi-target-header">
                  <strong>{locale === "zh" ? "选择目标虚拟机" : "Select target VMs"}</strong>
                  <button className="ghost-action icon-action" type="button" onClick={() => setShowMultiTarget(false)}><X style={{ width: 14, height: 14 }} /></button>
                </div>
                {allTags.length > 0 ? (
                  <div className="multi-target-tags">
                    <p style={{ color: "#475569", fontSize: 12, fontWeight: 700, margin: "0 0 6px" }}>{locale === "zh" ? "按标签选择" : "Select by tag"}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {allTags.map((tag) => (
                        <button key={tag} type="button" className={selectedTags.has(tag) ? "selected-action" : "ghost-action"} style={{ fontSize: 12, minHeight: 28, padding: "0 10px" }} onClick={() => setSelectedTags((prev) => {
                          const next = new Set(prev);
                          if (next.has(tag)) next.delete(tag);
                          else next.add(tag);
                          return next;
                        })}>#{tag}</button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="multi-target-connections">
                  <p style={{ color: "#475569", fontSize: 12, fontWeight: 700, margin: "8px 0 6px" }}>{locale === "zh" ? "或直接选择目标" : "Or select targets directly"}</p>
                  {probedConnections.length === 0 ? (
                    <p className="empty-hint" style={{ fontSize: 12 }}>{locale === "zh" ? "暂无已采集的目标虚拟机" : "No collected target VMs"}</p>
                  ) : (
                    <div style={{ display: "grid", gap: 6 }}>
                      {probedConnections.map((connection) => (
                        <label key={connection.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                          <input type="checkbox" checked={selectedTargets.has(connection.id)} onChange={() => setSelectedTargets((prev) => {
                            const next = new Set(prev);
                            if (next.has(connection.id)) next.delete(connection.id);
                            else next.add(connection.id);
                            return next;
                          })} style={{ accentColor: "#0f766e" }} />
                          <span style={{ fontWeight: 600 }}>{connection.label}</span>
                          <span style={{ color: "#64748b" }}>{connection.fields.host}</span>
                          {connection.tags?.map((tag) => <span key={tag} className="chip-method">#{tag}</span>)}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {execError ? <p className="connection-error" style={{ margin: "8px 0 0" }}>{execError}</p> : null}
                {execResults.length > 0 ? (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ color: "#065f46", fontSize: 12, fontWeight: 700, margin: "0 0 6px" }}>{locale === "zh" ? `已在 ${execResults.length} 台目标上启动` : `Launched on ${execResults.length} target(s)`}</p>
                    {execResults.map((result) => <div key={result.taskId} style={{ fontSize: 11, color: "#64748b" }}>{result.label}: task {result.taskId.slice(0, 12)}</div>)}
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button className="secondary-action" type="button" disabled={!hasTargets || executing} onClick={() => void handleMultiExecute(true)}>
                    {locale === "zh" ? "预演" : "Dry-run"}
                  </button>
                  <button className="primary-action" type="button" disabled={!hasTargets || executing} onClick={() => void handleMultiExecute(false)}>
                    <Play style={{ width: 14, height: 14 }} />
                    {executing ? (locale === "zh" ? "应用中..." : "Applying...") : (locale === "zh" ? "应用已审查计划" : "Apply reviewed plan")}
                  </button>
                </div>
              </div>
            ) : null}

            <PlaybookEditor yaml={editorYaml} onChange={setEditorYaml} locale={locale} />
          </>
        ) : (
          <div className="playbook-empty-state">
            <FileText style={{ width: 44, height: 44, marginBottom: 16, color: "#64748b" }} />
            <h3>{locale === "zh" ? "选择或新建环境计划" : "Select or create an Environment Plan"}</h3>
            <p style={{ color: "#64748b", fontSize: 14 }}>
              {locale === "zh"
                ? "计划用于审查迁移、重建、配置变更和移除能力。所有目标机器变更都应先进入计划。"
                : "Plans review migration, rebuild, config change, and remove flows. Target changes should enter a plan first."}
            </p>
            <button className="primary-action" type="button" onClick={startCreate}>+ {locale === "zh" ? "新建计划草稿" : "New plan draft"}</button>
          </div>
        )}
      </div>
      </div>
        </>
      ) : null}

      {opsTab === "runs" ? (
        <PlanOpsPanel id="runs" title={locale === "zh" ? "执行记录" : "Runs"} body={locale === "zh" ? "查看环境计划执行记录、失败检查、重试决策和修复计划入口。" : "Review Environment Plan runs, failed checks, retry decisions, and repair-plan entry points."} />
      ) : null}
      {opsTab === "schedules" ? (
        <SchedulesPanel locale={locale} authToken={authToken} connections={connections} playbooks={schedulePlaybooks} catalog={catalog} />
      ) : null}
      {opsTab === "drift" ? (
        <DriftPanel locale={locale} authToken={authToken} connections={connections} />
      ) : null}
      {opsTab === "webhooks" ? (
        <WebhooksPanel locale={locale} authToken={authToken} />
      ) : null}
      {opsTab === "reports" ? (
        <PlanOpsPanel id="reports" title={locale === "zh" ? "报告" : "Reports"} body={locale === "zh" ? "打开已审查环境计划、漂移检查和认证检查生成的报告。" : "Open reports generated by reviewed Environment Plans, drift checks, and certification checks."} />
      ) : null}
    </div>
  );
}

function PlanOpsPanel({ id, title, body }: { id: string; title: string; body: string }) {
  return (
    <section className="settings-section" data-testid={`plans-${id}-tab`}>
      <div className="settings-section-header">
        <h3>{title}</h3>
      </div>
      <p className="settings-help">{body}</p>
    </section>
  );
}
