import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, History, Play, Upload, X } from "lucide-react";
import {
  createPlaybook,
  applyEnvironmentPlan,
  createEnvironmentPlan,
  deletePlaybook,
  fetchPlaybook,
  fetchPlaybooks,
  restorePlaybookVersion,
  updatePlaybook,
  type CatalogItem,
  type ConnectionProfile,
  type ExecutionTask,
  type StoredPlaybook
} from "../api";
import { PlaybookEditor } from "../components/PlaybookEditor";
import { PlansCenterPanel } from "../components/PlansCenterPanel";
import { DriftPanel, SchedulesPanel, WebhooksPanel } from "./SettingsPage";
import { RunsPanel } from "../components/RunsPanel";
import { ReportsPage } from "./ReportsPage";
import type { Locale } from "../lib/types";
import { confirmDialog } from "../lib/dialogs";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Phase1PlanningPanel } from "../components/Phase1PlanningPanel";

const EMPTY_YAML = `# EnvForge Environment Plan
name: Reviewable Environment Plan
hosts: all

tasks:
  - name: Review before applying
    module: shell
    args:
      cmd: "echo Review this plan before applying it to a target VM"
`;

type OpsTab = "plans" | "runs" | "schedules" | "drift" | "webhooks" | "reports";

export function PlanRecipesPage({
  locale,
  authToken,
  connections,
  playbooks: schedulePlaybooks,
  catalog,
  activeTask,
  onTaskUpdate,
  initialOpsTab
}: {
  locale: Locale;
  authToken: string;
  connections: ConnectionProfile[];
  playbooks: StoredPlaybook[];
  catalog: CatalogItem[];
  activeTask: ExecutionTask | null;
  onTaskUpdate: (task: ExecutionTask) => void;
  initialOpsTab?: OpsTab | null;
}) {
  const { t } = useTranslation();
  const [opsTab, setOpsTab] = useState<OpsTab>(initialOpsTab ?? "plans");
  useEffect(() => {
    if (initialOpsTab) setOpsTab(initialOpsTab);
  }, [initialOpsTab]);
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
  const [execResults, setExecResults] = useState<Array<{ connectionId: string; label: string; planId: string }>>([]);
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
          name: editorName || t("planRecipes.drafts.untitled"),
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
      setSaveError(err instanceof Error ? err.message : t("planRecipes.drafts.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirmDialog({ message: t("planRecipes.drafts.deleteConfirm"), danger: true }))) return;
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
      const launched: Array<{ connectionId: string; label: string; planId: string }> = [];
      for (const connectionId of targetIds) {
        const connection = connections.find((item) => item.id === connectionId);
        const { plan } = await createEnvironmentPlan(authToken, {
          type: "imported-recipe",
          targetConnectionId: connectionId,
          source: { kind: "recipe", yaml: editorYaml, name: editorName || t("planRecipes.drafts.importedRecipe") }
        });
        if (dryRun) await applyEnvironmentPlan(authToken, plan.id, true);
        launched.push({ connectionId, label: connection?.label ?? connectionId, planId: plan.id });
      }
      setExecResults(launched);
    } catch (err) {
      setExecError(err instanceof Error ? err.message : t("planRecipes.drafts.executionFailed"));
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
      <nav className="settings-tabs plan-ops-tabs" aria-label={t("planRecipes.tabs.ariaLabel")}>
        {[
          ["plans", t("planRecipes.tabs.plans")],
          ["runs", t("planRecipes.tabs.runs")],
          ["schedules", t("planRecipes.tabs.schedules")],
          ["drift", t("planRecipes.tabs.drift")],
          ["webhooks", t("planRecipes.tabs.webhooks")],
          ["reports", t("planRecipes.tabs.reports")]
        ].map(([id, label]) => (
          <button key={id} className={opsTab === id ? "active" : ""} type="button" onClick={() => setOpsTab(id as typeof opsTab)}>
            {label}
          </button>
        ))}
      </nav>

      {(opsTab === "schedules" || opsTab === "drift" || opsTab === "webhooks") ? (
        <div className="plan-ops-section-note" style={{ display: "flex", flexDirection: "column", gap: 2, margin: "10px 0 4px" }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", opacity: 0.6 }}>
            {t("planRecipes.automation.eyebrow")}
          </span>
          <strong style={{ fontSize: 14 }}>
            {t("planRecipes.automation.title")}
          </strong>
        </div>
      ) : null}

      {opsTab === "plans" ? (
        <>
      <Phase1PlanningPanel authToken={authToken} />
      <PlansCenterPanel authToken={authToken} locale={locale} />
      <div className="playbook-page" style={{ marginTop: 12 }}>
        <div className="playbook-sidebar">
        <div className="playbook-sidebar-header">
          <Button variant="primary" style={{ flex: 1, fontSize: 13, minHeight: 34, padding: "0 14px" }} onClick={startCreate}>
            + {t("planRecipes.drafts.newDraft")}
          </Button>
          <label className="conn-btn conn-btn-ghost" style={{ flex: 1, justifyContent: "center", fontSize: 13, minHeight: 34, padding: "0 14px", cursor: "pointer" }}>
            <Upload style={{ width: 14, height: 14 }} />
            {t("planRecipes.drafts.importRecipe")}
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
          <p className="empty-hint">{t("planRecipes.drafts.loading")}</p>
        ) : playbooks.length === 0 && !createMode ? (
          <p className="empty-hint">{t("planRecipes.drafts.noDrafts")}</p>
        ) : (
          <div className="playbook-list">
            {playbooks.map((playbook) => (
              <button key={playbook.id} type="button" className={`playbook-list-item ${selectedId === playbook.id ? "active" : ""}`} onClick={() => void handleSelect(playbook.id)}>
                <FileText className="playbook-list-icon" aria-hidden />
                <div className="playbook-list-body">
                  <div className="playbook-list-name">{playbook.name}</div>
                  <div className="playbook-list-meta">{new Date(playbook.updatedAt).toLocaleDateString()}</div>
                </div>
                <Badge tone="neutral">v{playbook.version}</Badge>
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
                <input className="playbook-name-input" placeholder={t("planRecipes.drafts.planName")} value={editorName} onChange={(event) => setEditorName(event.target.value)} />
                <input className="playbook-desc-input" placeholder={t("planRecipes.drafts.description")} value={editorDesc} onChange={(event) => setEditorDesc(event.target.value)} />
              </div>
              <div className="playbook-editor-actions">
                {editingPlaybook ? <Badge tone="neutral">v{editingPlaybook.version}</Badge> : null}
                <Button variant="ghost" style={{ fontSize: 13, minHeight: 34 }} onClick={() => setShowHistory((value) => !value)} disabled={!editingPlaybook}>
                  <History style={{ width: 14, height: 14 }} /> {t("planRecipes.drafts.history")}
                </Button>
                <Button variant="ghost" style={{ fontSize: 13, minHeight: 34 }} onClick={() => setShowMultiTarget((value) => !value)}>
                  {t("planRecipes.drafts.targets")}
                </Button>
                <Button variant="primary" loading={saving} style={{ fontSize: 13, minHeight: 34 }} disabled={saving || !editorYaml.trim()} onClick={() => void handleSave()}>
                  {saving ? t("planRecipes.drafts.saving") : t("planRecipes.drafts.saveDraft")}
                </Button>
                {editingPlaybook ? (
                  <Button variant="ghost" style={{ fontSize: 13, minHeight: 34, color: "var(--ef-danger)" }} onClick={() => void handleDelete(editingPlaybook.id)}>
                    {t("planRecipes.drafts.delete")}
                  </Button>
                ) : null}
              </div>
            </div>

            {saveError ? <p className="connection-error" style={{ margin: "0 0 12px" }}>{saveError}</p> : null}

            {showHistory && editingPlaybook?.history ? (
              <div className="playbook-history-panel">
                <div className="playbook-history-header">
                  <strong>{t("planRecipes.drafts.versionHistory")}</strong>
                  <Button variant="ghost" className="icon-action" onClick={() => setShowHistory(false)}><X style={{ width: 14, height: 14 }} /></Button>
                </div>
                <div className="playbook-history-list">
                  {editingPlaybook.history.map((historyItem) => (
                    <div key={historyItem.version} className="playbook-history-item">
                      <div className="playbook-history-item-meta">
                        <Badge tone="neutral">v{historyItem.version}</Badge>
                        <span style={{ color: "var(--ef-muted)", fontSize: 12 }}>{new Date(historyItem.savedAt).toLocaleString()}</span>
                        {historyItem.comment ? <span style={{ color: "var(--ef-muted)", fontSize: 12 }}>{historyItem.comment}</span> : null}
                      </div>
                      {historyItem.version !== editingPlaybook.version ? (
                        <Button variant="secondary" style={{ fontSize: 12, minHeight: 28, padding: "0 10px" }} onClick={() => void handleRestoreVersion(historyItem.version)}>
                          {t("planRecipes.drafts.restore")}
                        </Button>
                      ) : (
                        <span style={{ color: "#0f766e", fontSize: 12, fontWeight: 700 }}>{t("planRecipes.drafts.currentVersion")}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {showMultiTarget ? (
              <div className="multi-target-panel">
                <div className="multi-target-header">
                  <strong>{t("planRecipes.targets.title")}</strong>
                  <Button variant="ghost" className="icon-action" onClick={() => setShowMultiTarget(false)}><X style={{ width: 14, height: 14 }} /></Button>
                </div>
                {allTags.length > 0 ? (
                  <div className="multi-target-tags">
                    <p style={{ color: "var(--ef-muted)", fontSize: 12, fontWeight: 700, margin: "0 0 6px" }}>{t("planRecipes.targets.byTag")}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {allTags.map((tag) => (
                        <Button key={tag} variant={selectedTags.has(tag) ? "selected" : "ghost"} style={{ fontSize: 12, minHeight: 28, padding: "0 10px" }} onClick={() => setSelectedTags((prev) => {
                          const next = new Set(prev);
                          if (next.has(tag)) next.delete(tag);
                          else next.add(tag);
                          return next;
                        })}>#{tag}</Button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="multi-target-connections">
                  <p style={{ color: "var(--ef-muted)", fontSize: 12, fontWeight: 700, margin: "8px 0 6px" }}>{t("planRecipes.targets.direct")}</p>
                  {probedConnections.length === 0 ? (
                    <p className="empty-hint" style={{ fontSize: 12 }}>{t("planRecipes.targets.noCollected")}</p>
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
                          <span style={{ color: "var(--ef-muted)" }}>{connection.fields.host}</span>
                          {connection.tags?.map((tag) => <Badge key={tag} tone="neutral">#{tag}</Badge>)}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {execError ? <p className="connection-error" style={{ margin: "8px 0 0" }}>{execError}</p> : null}
                {execResults.length > 0 ? (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ color: "var(--ef-success)", fontSize: 12, fontWeight: 700, margin: "0 0 6px" }}>{t("planRecipes.targets.launched", { count: execResults.length })}</p>
                    {execResults.map((result) => <div key={result.planId} style={{ fontSize: 11, color: "var(--ef-muted)" }}>{result.label}: {t("planRecipes.tabs.plans")} {result.planId.slice(0, 12)}</div>)}
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Button variant="secondary" disabled={!hasTargets || executing} onClick={() => void handleMultiExecute(true)}>
                    {t("planRecipes.targets.dryRun")}
                  </Button>
                  <Button variant="primary" disabled={!hasTargets || executing} onClick={() => void handleMultiExecute(false)}>
                    <Play style={{ width: 14, height: 14 }} />
                    {executing ? t("planRecipes.targets.applying") : t("planRecipes.targets.applyReviewed")}
                  </Button>
                </div>
              </div>
            ) : null}

            <PlaybookEditor yaml={editorYaml} onChange={setEditorYaml} locale={locale} />
          </>
        ) : (
          <div className="playbook-empty-state">
            <FileText style={{ width: 44, height: 44, marginBottom: 16, color: "var(--ef-muted)" }} />
            <h3>{t("planRecipes.empty.title")}</h3>
            <p style={{ color: "var(--ef-muted)", fontSize: 14 }}>{t("planRecipes.empty.body")}</p>
            <Button variant="primary" onClick={startCreate}>+ {t("planRecipes.drafts.newDraft")}</Button>
          </div>
        )}
      </div>
      </div>
        </>
      ) : null}

      {opsTab === "runs" ? (
        <RunsPanel authToken={authToken} locale={locale} />
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
        <ReportsPage authToken={authToken} locale={locale} />
      ) : null}
    </div>
  );
}
