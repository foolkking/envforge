import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  KeyRound,
  X
} from "lucide-react";
import {
  uploadSshKey,
  type AgentProbeResult,
  type ConnectionProfile,
  type SshKeyMeta,
  type SystemConfigItem,
} from "../api";
import type { ConnectionFieldKey, Locale } from "../lib/types";
import { connectionFieldKeys } from "../lib/types";
import { toast } from "../lib/dialogs";
import { confirmDialog } from "../lib/dialogs";
import { useEscapeToClose } from "../lib/useEscapeToClose";
import { MigratePipelinePage } from "./MigratePipelinePage";
import { Button } from "../components/ui/Button";

type ConnectionMethod = "ssh-password" | "ssh-key";

const MACHINE_STATUS_KEYS = {
  probed: "machine.statuses.probed",
  ssh_ok: "machine.statuses.sshOk",
  validated: "machine.statuses.validated",
  ssh_failed: "machine.statuses.sshFailed",
  unreachable: "machine.statuses.unreachable"
} as const satisfies Record<ConnectionProfile["status"], string>;

const HOST_CHECK_STATUS_KEYS = {
  healthy: "machine.hostChecks.healthy",
  warning: "machine.hostChecks.warning",
  failed: "machine.hostChecks.failed"
} as const satisfies Record<SystemConfigItem["status"], string>;

const HOST_CHECK_CATEGORY_KEYS = {
  security: "machine.checkCategories.security",
  network: "machine.checkCategories.network",
  runtime: "machine.checkCategories.runtime",
  service: "machine.checkCategories.service"
} as const satisfies Record<SystemConfigItem["category"], string>;

const MACHINE_FIELD_KEYS = {
  host: "machine.fields.host",
  port: "machine.fields.port",
  username: "machine.fields.username",
  password: "machine.fields.password",
  privateKeyPath: "machine.fields.privateKeyPath",
  passphrase: "machine.fields.passphrase"
} as const satisfies Record<ConnectionFieldKey, string>;

export function MachinePage({
  locale,
  connections,
  activeConnectionId,
  connected,
  connectionProfile,
  connectionError,
  probeResult,
  probing,
  method,
  onMethod,
  onConnect,
  onSelectConnection,
  onReprobe,
  onScan,
  authToken,
  sshKeys,
  onSshKeysChange,
  onDeleteConnection,
  onUpdateConnection,
  pushLog,
  onNavigateToPlans
}: {
  locale: Locale;
  connections: ConnectionProfile[];
  activeConnectionId: string | null;
  connected: boolean;
  connectionProfile: ConnectionProfile | null;
  connectionError: string;
  probeResult: AgentProbeResult | null;
  probing: boolean;
  method: ConnectionMethod;
  onMethod: (method: ConnectionMethod) => void;
  onConnect: (fields: Record<string, string>, agentUrl: string) => void;
  onSelectConnection: (id: string) => void;
  onReprobe: (id: string) => Promise<void>;
  onScan: () => Promise<void> | void;
  authToken: string;
  sshKeys: SshKeyMeta[];
  onSshKeysChange: (keys: SshKeyMeta[]) => void;
  onDeleteConnection: (id: string) => Promise<void> | void;
  onUpdateConnection: (id: string, input: { label?: string; agentUrl?: string; tags?: string[] }) => Promise<void> | void;
  pushLog?: (type: "info" | "success" | "error" | "cmd", text: string) => void;
  /** Phase 3: navigate to the Plan center after a migration plan is created. */
  onNavigateToPlans?: () => void;
}) {
  const { t: i18nT } = useTranslation();
  const [fields, setFields] = useState<Record<string, string>>({ port: "22" });
  const [showNewForm, setShowNewForm] = useState(connections.length === 0);
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [showKeyUpload, setShowKeyUpload] = useState(false);
  const [keyUploadText, setKeyUploadText] = useState("");
  const [keyUploadLabel, setKeyUploadLabel] = useState("");
  const [keyUploading, setKeyUploading] = useState(false);
  const [connectionManagerOpen, setConnectionManagerOpen] = useState(false);
  const [connectionSearch, setConnectionSearch] = useState("");
  const [editingConnId, setEditingConnId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editTags, setEditTags] = useState("");
  const [hostDetailsOpen, setHostDetailsOpen] = useState(false);
  useEscapeToClose(() => setConnectionManagerOpen(false), connectionManagerOpen);
  useEscapeToClose(() => setHostDetailsOpen(false), hostDetailsOpen);

  const activeConn = connections.find((connection) => connection.id === activeConnectionId);
  const activeProbe = probeResult ?? activeConn?.probeSnapshot;

  const hostChecks = activeProbe?.configChecklist ?? [];
  const hostCheckCounts = hostChecks.reduce<Record<SystemConfigItem["status"], number>>(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { healthy: 0, warning: 0, failed: 0 }
  );
  const hostCheckReviewCount = hostCheckCounts.warning + hostCheckCounts.failed;
  const hostCheckSummary = hostChecks.length > 0
    ? i18nT("machine.hostChecks.summary", { total: hostChecks.length, review: hostCheckReviewCount })
    : "-";
  const hostCheckStatusSummary = hostChecks.length > 0
    ? i18nT("machine.hostChecks.statuses", { healthy: hostCheckCounts.healthy, warning: hostCheckCounts.warning, failed: hostCheckCounts.failed })
    : "";
  const filteredConnections = connections.filter((connection) => {
    const q = connectionSearch.trim().toLowerCase();
    if (!q) return true;
    return [
      connection.label,
      connection.fields.host,
      connection.method,
      connection.status,
      connection.probeSnapshot?.system.hostname,
      ...(connection.tags ?? [])
    ].filter(Boolean).join(" ").toLowerCase().includes(q);
  });

  useEffect(() => {
    if (connections.length > 0 && connected) setShowNewForm(false);
  }, [connections.length, connected]);

  function connectionHostName(connection: ConnectionProfile | undefined): string {
    if (!connection) return i18nT("machine.noHost");
    return connection.probeSnapshot?.system.hostname || connection.label || connection.fields.host || connection.id;
  }

  function connectionAddress(connection: ConnectionProfile | undefined): string {
    if (!connection) return "-";
    return `${connection.fields.host ?? "-"}:${connection.fields.port ?? "22"}`;
  }

  function authType(connection: ConnectionProfile | undefined): string {
    if (!connection) return "-";
    return connection.method === "ssh-key" ? "ssh-key" : "password";
  }

  function snapshotTime(connection: ConnectionProfile | undefined, probe?: AgentProbeResult | null): string {
    const raw = probe?.collectedAt ?? connection?.probeSnapshot?.collectedAt ?? connection?.lastProbeAt ?? connection?.updatedAt;
    return raw ? new Date(raw).toLocaleString() : i18nT("machine.noSnapshot");
  }

  function startEditConnection(connection: ConnectionProfile) {
    setEditingConnId(connection.id);
    setEditLabel(connection.label);
    setEditTags(connection.tags?.join(", ") ?? "");
  }

  async function saveManagedConnection(connection: ConnectionProfile) {
    await onUpdateConnection(connection.id, {
      label: editLabel.trim() || connection.label,
      tags: editTags.split(",").map((tag) => tag.trim()).filter(Boolean)
    });
    setEditingConnId(null);
  }

  async function deleteManagedConnection(connection: ConnectionProfile) {
    const isCurrent = connection.id === activeConnectionId;
    const message = isCurrent ? i18nT("machine.deleteCurrentConfirm") : i18nT("machine.deleteConfirm");
    if (!(await confirmDialog({ message, danger: true }))) return;
    const next = connections.find((item) => item.id !== connection.id);
    await onDeleteConnection(connection.id);
    if (isCurrent && next) onSelectConnection(next.id);
  }

  async function collectHostSnapshot() {
    await onScan();
  }

  function connect() {
    const connectFields = { ...fields };
    if (method === "ssh-key" && selectedKeyId) connectFields._keyId = selectedKeyId;
    onConnect(connectFields, "");
  }

  return (
    <div className="page-stack migrate-review-page">
      <section className="host-context-toolbar">
        <label className="host-switcher">
          <span>{i18nT("machine.currentHost")}</span>
          <select
            value={activeConnectionId ?? ""}
            onChange={(event) => {
              if (event.target.value) onSelectConnection(event.target.value);
            }}
          >
            <option value="">{i18nT("machine.noHost")}</option>
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connectionHostName(connection)} @ {connection.fields.host ?? "-"} · {authType(connection)} · {i18nT(MACHINE_STATUS_KEYS[connection.status])}
              </option>
            ))}
          </select>
        </label>
        <div className="host-context-meta">
          <span><strong>{i18nT("machine.auth")}</strong>{authType(activeConn)}</span>
          <span><strong>{i18nT("machine.status")}</strong>{activeConn ? i18nT(MACHINE_STATUS_KEYS[activeConn.status]) : "-"}</span>
          <span><strong>{i18nT("machine.snapshot")}</strong>{snapshotTime(activeConn, activeProbe)}</span>
        </div>
        <div className="host-context-actions">
          <Button variant="secondary" onClick={() => setConnectionManagerOpen(true)}>
            {i18nT("machine.manageConnections")}
          </Button>
          <Button variant="primary" onClick={() => setShowNewForm((value) => !value)}>
            {showNewForm ? i18nT("machine.collapseNew") : i18nT("machine.newConnection")}
          </Button>
        </div>
      </section>

      {showNewForm ? (
        <section className="connection-card connection-create-card">
          <div>
            <h2>{i18nT("machine.connectTitle")}</h2>
            <p>{i18nT("machine.connectHint")}</p>
          </div>
          <select value={method} onChange={(event) => onMethod(event.target.value as ConnectionMethod)}>
            <option value="ssh-password">{i18nT("machine.sshPassword")}</option>
            <option value="ssh-key">{i18nT("machine.sshKey")}</option>
          </select>
          <div className="connection-fields">
            {connectionFieldKeys[method].map((key) => {
              if (key === "privateKeyPath" && method === "ssh-key") {
                return (
                  <div key={key} className="ssh-key-selector">
                    {sshKeys.length > 0 ? (
                      <select value={selectedKeyId} onChange={(event) => setSelectedKeyId(event.target.value)} style={{ flex: 1 }}>
                        <option value="">{i18nT("machine.selectUploadedKey")}</option>
                        {sshKeys.map((sshKey) => <option key={sshKey.id} value={sshKey.id}>{sshKey.label}</option>)}
                      </select>
                    ) : null}
                    <Button variant="ghost" style={{ fontSize: 13, minHeight: 38, padding: "0 12px" }} onClick={() => setShowKeyUpload((value) => !value)}>
                      {showKeyUpload ? i18nT("machine.collapseNew") : i18nT("machine.uploadKey")}
                    </Button>
                  </div>
                );
              }
              return (
                <input
                  key={key}
                  placeholder={i18nT(MACHINE_FIELD_KEYS[key])}
                  type={key === "password" || key === "passphrase" ? "password" : "text"}
                  value={fields[key] ?? ""}
                  onChange={(event) => setFields((previous) => ({ ...previous, [key]: event.target.value }))}
                />
              );
            })}
          </div>
          {method === "ssh-key" && showKeyUpload ? (
            <div className="ssh-key-upload-panel">
              <p className="eyebrow" style={{ color: "var(--ef-muted)", margin: "0 0 8px" }}>{i18nT("machine.pastePrivateKey")}</p>
              <input placeholder={i18nT("machine.keyLabel")} value={keyUploadLabel} onChange={(event) => setKeyUploadLabel(event.target.value)} style={{ marginBottom: 8, width: "100%", border: "1px solid #d7dde4", borderRadius: 8, minHeight: 36, padding: "0 10px", font: "inherit" }} />
              <textarea placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" value={keyUploadText} onChange={(event) => setKeyUploadText(event.target.value)} rows={6} style={{ width: "100%", fontFamily: "monospace", fontSize: 12, border: "1px solid #d7dde4", borderRadius: 8, padding: 10, resize: "vertical" }} />
              <Button
                variant="primary"
                disabled={!keyUploadText.trim() || keyUploading || !authToken}
                onClick={async () => {
                  if (!authToken) return;
                  setKeyUploading(true);
                  try {
                    const meta = await uploadSshKey(authToken, keyUploadLabel || "My key", keyUploadText.trim());
                    onSshKeysChange([...sshKeys, meta]);
                    setSelectedKeyId(meta.id);
                    setKeyUploadText("");
                    setKeyUploadLabel("");
                    setShowKeyUpload(false);
                  } catch (err) {
                    toast(err instanceof Error ? err.message : i18nT("machine.uploadFailed"), "error");
                  } finally {
                    setKeyUploading(false);
                  }
                }}
                style={{ marginTop: 8, fontSize: 13, minHeight: 36 }}
              >
                {keyUploading ? i18nT("machine.uploading") : i18nT("machine.saveKey")}
              </Button>
            </div>
          ) : null}
          {connectionProfile?.status === "probed" ? <p className="connection-note success-note"><CheckCircle2 aria-hidden />{i18nT("machine.sshConnected")}</p> : null}
          {connectionProfile?.status === "ssh_failed" ? <p className="connection-error">{i18nT("machine.sshFailed")}{connectionProfile.sshError}</p> : null}
          {connectionProfile && connectionProfile.status !== "probed" && connectionProfile.status !== "ssh_failed" ? <p className="connection-note">{i18nT("machine.profileSaved")}</p> : null}
          {connectionError ? <p className="connection-error">{connectionError}</p> : null}
          {probing ? <p className="connection-note probing-note">{i18nT("machine.probing")}</p> : null}
          <Button variant="primary" onClick={connect} disabled={probing}>
            {probing ? <span className="spinning">...</span> : <KeyRound aria-hidden />}
            {probing ? i18nT("machine.connecting") : i18nT("machine.connectBtn")}
          </Button>
        </section>
      ) : null}

      <MigratePipelinePage
        locale={locale}
        authToken={authToken}
        connectionId={activeConnectionId}
        activeConnection={activeConn}
        activeProbe={activeProbe}
        connected={connected}
        connections={connections}
        onCollectSnapshot={collectHostSnapshot}
        onOpenHostDetails={() => activeConn ? setHostDetailsOpen(true) : setConnectionManagerOpen(true)}
        pushLog={pushLog}
        onPlanCreated={() => onNavigateToPlans?.()}
      />

      {connectionManagerOpen ? (
        <div className="drawer-overlay" role="dialog" aria-modal="true">
          <aside className="connection-manager-drawer">
            <header className="drawer-header">
              <div>
                <p className="eyebrow">{i18nT("machine.context")}</p>
                <h2>{i18nT("machine.manageConnections")}</h2>
              </div>
              <Button variant="ghost" className="icon-action" onClick={() => setConnectionManagerOpen(false)} aria-label={i18nT("machine.close")}>
                <X aria-hidden />
              </Button>
            </header>
            <div className="connection-manager-toolbar">
              <input
                value={connectionSearch}
                onChange={(event) => setConnectionSearch(event.target.value)}
                placeholder={i18nT("machine.searchConnections")}
              />
              <Button variant="primary" onClick={() => { setShowNewForm(true); setConnectionManagerOpen(false); }}>
                {i18nT("machine.newConnection")}
              </Button>
            </div>
            <div className="connection-manager-list">
              {filteredConnections.length === 0 ? (
                <p className="empty-hint">{i18nT("machine.noMatching")}</p>
              ) : filteredConnections.map((connection) => (
                <article className={`connection-manager-row ${connection.id === activeConnectionId ? "active" : ""}`} key={connection.id}>
                  <button
                    className="connection-manager-select"
                    type="button"
                    onClick={() => {
                      onSelectConnection(connection.id);
                      setConnectionManagerOpen(false);
                    }}
                  >
                    <strong>{connectionHostName(connection)}</strong>
                    <span>{connection.fields.host ?? "-"} · {authType(connection)} · {i18nT(MACHINE_STATUS_KEYS[connection.status])}</span>
                    <small>{i18nT("machine.lastSnapshot")}: {snapshotTime(connection)}</small>
                  </button>
                  <div className="connection-manager-actions">
                    <Button variant="connectionGhost"  type="button" onClick={() => startEditConnection(connection)}>{i18nT("machine.edit")}</Button>
                    <Button variant="connectionGhost"  type="button" onClick={() => void onReprobe(connection.id)}>{i18nT("machine.collectSnapshot")}</Button>
                    <Button variant="danger" onClick={() => void deleteManagedConnection(connection)}>{i18nT("machine.delete")}</Button>
                  </div>
                  {editingConnId === connection.id ? (
                    <div className="connection-manager-edit">
                      <label>
                        <span>{i18nT("machine.connectionLabel")}</span>
                        <input value={editLabel} onChange={(event) => setEditLabel(event.target.value)} />
                      </label>
                      <label>
                        <span>{i18nT("machine.tags")}</span>
                        <input value={editTags} onChange={(event) => setEditTags(event.target.value)} />
                      </label>
                      <div>
                        <Button variant="primary" onClick={() => void saveManagedConnection(connection)}>{i18nT("machine.save")}</Button>
                        <Button variant="ghost" onClick={() => setEditingConnId(null)}>{i18nT("machine.cancel")}</Button>
                      </div>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </aside>
        </div>
      ) : null}

      {hostDetailsOpen && activeConn ? (
        <div className="drawer-overlay" role="dialog" aria-modal="true">
          <aside className="host-details-drawer">
            <header className="drawer-header">
              <div>
                <p className="eyebrow">{i18nT("machine.hostDetails")}</p>
                <h2>{connectionHostName(activeConn)}</h2>
              </div>
              <Button variant="ghost" className="icon-action" onClick={() => setHostDetailsOpen(false)} aria-label={i18nT("machine.close")}>
                <X aria-hidden />
              </Button>
            </header>
            <dl className="host-details-list">
              <div><dt>{i18nT("machine.address")}</dt><dd>{connectionAddress(activeConn)}</dd></div>
              <div><dt>{i18nT("machine.authType")}</dt><dd>{authType(activeConn)}</dd></div>
              <div><dt>{i18nT("machine.status")}</dt><dd>{i18nT(MACHINE_STATUS_KEYS[activeConn.status])}</dd></div>
              <div><dt>{i18nT("machine.lastSnapshot")}</dt><dd>{snapshotTime(activeConn, activeProbe)}</dd></div>
              {activeProbe ? (
                <>
                  <div><dt>{i18nT("machine.kernel")}</dt><dd>{activeProbe.system.release}</dd></div>
                  <div><dt>{i18nT("machine.architecture")}</dt><dd>{activeProbe.system.arch}</dd></div>
                  <div><dt>{i18nT("machine.platform")}</dt><dd>{activeProbe.system.platform}</dd></div>
                  <div><dt>{i18nT("machine.uptime")}</dt><dd>{activeProbe.system.uptimeText ?? "-"}</dd></div>
                  <div><dt>{i18nT("machine.cpuModel")}</dt><dd>{activeProbe.system.cpu.model ?? "-"}</dd></div>
                  <div><dt>{i18nT("machine.evidenceCount")}</dt><dd>{activeProbe.counts?.total ?? activeProbe.software.length}</dd></div>
                </>
              ) : (
                <div><dt>{i18nT("machine.hostSnapshot")}</dt><dd>{i18nT("machine.notCollected")}</dd></div>
              )}
            </dl>
            {activeProbe ? (
              <section className="host-check-details">
                <div className="host-check-details-head">
                  <div>
                    <p className="eyebrow">{i18nT("machine.hostChecks.title")}</p>
                    <h3>{hostCheckSummary}</h3>
                  </div>
                  <span>{hostCheckStatusSummary}</span>
                </div>
                {hostChecks.length > 0 ? (
                  <div className="host-check-list">
                    {hostChecks.map((item) => (
                      <article className={`host-check-row status-${item.status}`} key={item.id}>
                        <div>
                          <strong>{item.label}</strong>
                          <small>{i18nT(HOST_CHECK_CATEGORY_KEYS[item.category])} · {item.lastChanged}</small>
                        </div>
                        <span>{i18nT(HOST_CHECK_STATUS_KEYS[item.status])}</span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="host-summary-empty">{i18nT("machine.hostChecks.empty")}</p>
                )}
              </section>
            ) : null}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
