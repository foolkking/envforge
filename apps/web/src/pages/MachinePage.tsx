import React, { useEffect, useState } from "react";
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
import type { Locale } from "../lib/types";
import { connectionFields, connectionFieldKeys } from "../lib/types";
import { MigratePipelinePage } from "./MigratePipelinePage";
import { Button } from "../components/ui/Button";

type TextDict = {
  appName: string;
  subtitle: string;
  migrate: string;
  build: string;
  search: string;
  filter: string;
  connectTitle: string;
  connectHint: string;
  runScan: string;
  upload: string;
  selected: string;
  software: string;
  configs: string;
  addToVm: string;
  guest: string;
  login: string;
  register: string;
  logout: string;
  editProfile: string;
  profile: string;
  uploads: string;
  language: string;
  locked: string;
  connection: string;
  connected: string;
  disconnected: string;
  connectBtn: string;
  privacyNote: string;
  installCommand: string;
  packageAlias: string;
  agentUrl: string;
  agentProbe: string;
  agentOnline: string;
  agentOffline: string;
  probing: string;
  realData: string;
};

type ConnectionMethod = "ssh-password" | "ssh-key";

export function MachinePage({
  t,
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
  pushLog
}: {
  t: TextDict;
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
}) {
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
    ? `${hostChecks.length} ${locale === "zh" ? "项" : "total"} · ${hostCheckReviewCount} ${locale === "zh" ? "需关注" : "review"}`
    : "-";
  const hostCheckStatusSummary = hostChecks.length > 0
    ? [
        `${hostCheckCounts.healthy} ${locale === "zh" ? "健康" : "healthy"}`,
        `${hostCheckCounts.warning} ${locale === "zh" ? "警告" : "warning"}`,
        `${hostCheckCounts.failed} ${locale === "zh" ? "失败" : "failed"}`
      ].join(" · ")
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
    if (!connection) return locale === "zh" ? "未选择主机" : "No host selected";
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
    return raw ? new Date(raw).toLocaleString() : (locale === "zh" ? "未采集" : "No snapshot");
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
    const message = isCurrent
      ? (locale === "zh" ? "这是当前选中的连接。删除后会自动切换到其他连接，或清空当前主机。确认删除？" : "This is the current connection. Deleting it will switch to another connection or clear the current host. Delete it?")
      : (locale === "zh" ? "确认删除这个连接？" : "Delete this connection?");
    if (!confirm(message)) return;
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
          <span>{locale === "zh" ? "当前主机" : "Current host"}</span>
          <select
            value={activeConnectionId ?? ""}
            onChange={(event) => {
              if (event.target.value) onSelectConnection(event.target.value);
            }}
          >
            <option value="">{locale === "zh" ? "未选择主机" : "No host selected"}</option>
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connectionHostName(connection)} @ {connection.fields.host ?? "-"} · {authType(connection)} · {statusLabel(connection.status, locale)}
              </option>
            ))}
          </select>
        </label>
        <div className="host-context-meta">
          <span><strong>{locale === "zh" ? "认证" : "Auth"}</strong>{authType(activeConn)}</span>
          <span><strong>{locale === "zh" ? "状态" : "Status"}</strong>{activeConn ? statusLabel(activeConn.status, locale) : "-"}</span>
          <span><strong>{locale === "zh" ? "快照" : "Snapshot"}</strong>{snapshotTime(activeConn, activeProbe)}</span>
        </div>
        <div className="host-context-actions">
          <Button variant="secondary" onClick={() => setConnectionManagerOpen(true)}>
            {locale === "zh" ? "管理连接" : "Manage connections"}
          </Button>
          <Button variant="primary" onClick={() => setShowNewForm((value) => !value)}>
            {showNewForm ? (locale === "zh" ? "收起新建" : "Collapse") : (locale === "zh" ? "+ 新建连接" : "+ New connection")}
          </Button>
        </div>
      </section>

      {showNewForm ? (
        <section className="connection-card connection-create-card">
          <div>
            <h2>{t.connectTitle}</h2>
            <p>{t.connectHint}</p>
          </div>
          <select value={method} onChange={(event) => onMethod(event.target.value as ConnectionMethod)}>
            <option value="ssh-password">SSH Password</option>
            <option value="ssh-key">SSH Key</option>
          </select>
          <div className="connection-fields">
            {connectionFields[method].map((field, index) => {
              const key = connectionFieldKeys[method][index];
              if (key === "privateKeyPath" && method === "ssh-key") {
                return (
                  <div key={key} className="ssh-key-selector">
                    {sshKeys.length > 0 ? (
                      <select value={selectedKeyId} onChange={(event) => setSelectedKeyId(event.target.value)} style={{ flex: 1 }}>
                        <option value="">{locale === "zh" ? "选择已上传的密钥" : "Select uploaded key"}</option>
                        {sshKeys.map((sshKey) => <option key={sshKey.id} value={sshKey.id}>{sshKey.label}</option>)}
                      </select>
                    ) : null}
                    <Button variant="ghost" style={{ fontSize: 13, minHeight: 38, padding: "0 12px" }} onClick={() => setShowKeyUpload((value) => !value)}>
                      {showKeyUpload ? (locale === "zh" ? "收起" : "Collapse") : (locale === "zh" ? "+ 上传密钥" : "+ Upload key")}
                    </Button>
                  </div>
                );
              }
              return (
                <input
                  key={key}
                  placeholder={field}
                  type={field.toLowerCase().includes("password") || field.toLowerCase().includes("passphrase") ? "password" : "text"}
                  value={fields[key] ?? ""}
                  onChange={(event) => setFields((previous) => ({ ...previous, [key]: event.target.value }))}
                />
              );
            })}
          </div>
          {method === "ssh-key" && showKeyUpload ? (
            <div className="ssh-key-upload-panel">
              <p className="eyebrow" style={{ color: "#475569", margin: "0 0 8px" }}>{locale === "zh" ? "粘贴 SSH 私钥内容" : "Paste SSH private key"}</p>
              <input placeholder={locale === "zh" ? "密钥标签（可选）" : "Key label (optional)"} value={keyUploadLabel} onChange={(event) => setKeyUploadLabel(event.target.value)} style={{ marginBottom: 8, width: "100%", border: "1px solid #d7dde4", borderRadius: 8, minHeight: 36, padding: "0 10px", font: "inherit" }} />
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
                    alert(err instanceof Error ? err.message : "Upload failed");
                  } finally {
                    setKeyUploading(false);
                  }
                }}
                style={{ marginTop: 8, fontSize: 13, minHeight: 36 }}
              >
                {keyUploading ? (locale === "zh" ? "上传中..." : "Uploading...") : (locale === "zh" ? "保存密钥" : "Save key")}
              </Button>
            </div>
          ) : null}
          {connectionProfile?.status === "probed" ? <p className="connection-note success-note"><CheckCircle2 aria-hidden />{locale === "zh" ? "SSH 已连接，真实系统信息已采集。" : "SSH connected. Real system data collected."}</p> : null}
          {connectionProfile?.status === "ssh_failed" ? <p className="connection-error">{locale === "zh" ? "SSH 失败：" : "SSH failed: "}{connectionProfile.sshError}</p> : null}
          {connectionProfile && connectionProfile.status !== "probed" && connectionProfile.status !== "ssh_failed" ? <p className="connection-note">{locale === "zh" ? "连接档案已保存。" : "Connection profile saved."}</p> : null}
          {connectionError ? <p className="connection-error">{connectionError}</p> : null}
          {probing ? <p className="connection-note probing-note">{locale === "zh" ? "正在通过 SSH 连接并采集主机快照..." : "Connecting via SSH and collecting HostSnapshot..."}</p> : null}
          <Button variant="primary" onClick={connect} disabled={probing}>
            {probing ? <span className="spinning">...</span> : <KeyRound aria-hidden />}
            {probing ? (locale === "zh" ? "连接中..." : "Connecting...") : t.connectBtn}
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
        onOpenHostDetails={() => setHostDetailsOpen(true)}
        pushLog={pushLog}
      />

      {connectionManagerOpen ? (
        <div className="drawer-overlay" role="dialog" aria-modal="true">
          <aside className="connection-manager-drawer">
            <header className="drawer-header">
              <div>
                <p className="eyebrow">{locale === "zh" ? "连接上下文" : "Connection context"}</p>
                <h2>{locale === "zh" ? "管理连接" : "Manage connections"}</h2>
              </div>
              <Button variant="ghost" className="icon-action" onClick={() => setConnectionManagerOpen(false)} aria-label="Close">
                <X aria-hidden />
              </Button>
            </header>
            <div className="connection-manager-toolbar">
              <input
                value={connectionSearch}
                onChange={(event) => setConnectionSearch(event.target.value)}
                placeholder={locale === "zh" ? "搜索主机名、IP、标签或状态" : "Search hostname, IP, tag, or status"}
              />
              <Button variant="primary" onClick={() => { setShowNewForm(true); setConnectionManagerOpen(false); }}>
                {locale === "zh" ? "+ 新建连接" : "+ New connection"}
              </Button>
            </div>
            <div className="connection-manager-list">
              {filteredConnections.length === 0 ? (
                <p className="empty-hint">{locale === "zh" ? "没有匹配的连接。" : "No matching connections."}</p>
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
                    <span>{connection.fields.host ?? "-"} · {authType(connection)} · {statusLabel(connection.status, locale)}</span>
                    <small>{locale === "zh" ? "最近快照" : "Last snapshot"}: {snapshotTime(connection)}</small>
                  </button>
                  <div className="connection-manager-actions">
                    <button className="conn-btn conn-btn-ghost" type="button" onClick={() => startEditConnection(connection)}>{locale === "zh" ? "编辑" : "Edit"}</button>
                    <button className="conn-btn conn-btn-ghost" type="button" onClick={() => void onReprobe(connection.id)}>{locale === "zh" ? "重新采集主机快照" : "Collect HostSnapshot"}</button>
                    <Button variant="danger" onClick={() => void deleteManagedConnection(connection)}>{locale === "zh" ? "删除" : "Delete"}</Button>
                  </div>
                  {editingConnId === connection.id ? (
                    <div className="connection-manager-edit">
                      <label>
                        <span>{locale === "zh" ? "连接名称" : "Connection label"}</span>
                        <input value={editLabel} onChange={(event) => setEditLabel(event.target.value)} />
                      </label>
                      <label>
                        <span>{locale === "zh" ? "标签（逗号分隔）" : "Tags, comma separated"}</span>
                        <input value={editTags} onChange={(event) => setEditTags(event.target.value)} />
                      </label>
                      <div>
                        <Button variant="primary" onClick={() => void saveManagedConnection(connection)}>{locale === "zh" ? "保存" : "Save"}</Button>
                        <Button variant="ghost" onClick={() => setEditingConnId(null)}>{locale === "zh" ? "取消" : "Cancel"}</Button>
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
                <p className="eyebrow">{locale === "zh" ? "主机详情" : "Host details"}</p>
                <h2>{connectionHostName(activeConn)}</h2>
              </div>
              <Button variant="ghost" className="icon-action" onClick={() => setHostDetailsOpen(false)} aria-label="Close">
                <X aria-hidden />
              </Button>
            </header>
            <dl className="host-details-list">
              <div><dt>{locale === "zh" ? "地址" : "Address"}</dt><dd>{connectionAddress(activeConn)}</dd></div>
              <div><dt>{locale === "zh" ? "认证方式" : "Auth type"}</dt><dd>{authType(activeConn)}</dd></div>
              <div><dt>{locale === "zh" ? "状态" : "Status"}</dt><dd>{statusLabel(activeConn.status, locale)}</dd></div>
              <div><dt>{locale === "zh" ? "最近快照" : "Last snapshot"}</dt><dd>{snapshotTime(activeConn, activeProbe)}</dd></div>
              {activeProbe ? (
                <>
                  <div><dt>Kernel</dt><dd>{activeProbe.system.release}</dd></div>
                  <div><dt>Architecture</dt><dd>{activeProbe.system.arch}</dd></div>
                  <div><dt>Platform</dt><dd>{activeProbe.system.platform}</dd></div>
                  <div><dt>Uptime</dt><dd>{activeProbe.system.uptimeText ?? "-"}</dd></div>
                  <div><dt>CPU model</dt><dd>{activeProbe.system.cpu.model ?? "-"}</dd></div>
                  <div><dt>{locale === "zh" ? "证据数量" : "Evidence count"}</dt><dd>{activeProbe.counts?.total ?? activeProbe.software.length}</dd></div>
                </>
              ) : (
                <div><dt>{locale === "zh" ? "主机快照" : "HostSnapshot"}</dt><dd>{locale === "zh" ? "尚未采集" : "Not collected"}</dd></div>
              )}
            </dl>
            {activeProbe ? (
              <section className="host-check-details">
                <div className="host-check-details-head">
                  <div>
                    <p className="eyebrow">{locale === "zh" ? "主机检查" : "Host checks"}</p>
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
                          <small>{hostCheckCategoryLabel(item.category, locale)} · {item.lastChanged}</small>
                        </div>
                        <span>{hostCheckStatusLabel(item.status, locale)}</span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="host-summary-empty">{locale === "zh" ? "当前主机快照没有主机检查结果。" : "This HostSnapshot has no host check results."}</p>
                )}
              </section>
            ) : null}
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function statusLabel(status: ConnectionProfile["status"], locale: Locale): string {
  const labels: Record<ConnectionProfile["status"], { zh: string; en: string }> = {
    probed: { zh: "已采集", en: "Collected" },
    ssh_ok: { zh: "SSH 成功", en: "SSH OK" },
    validated: { zh: "已保存", en: "Saved" },
    ssh_failed: { zh: "SSH 失败", en: "SSH failed" },
    unreachable: { zh: "不可达", en: "Unreachable" }
  };
  return locale === "zh" ? labels[status].zh : labels[status].en;
}

function hostCheckStatusLabel(status: SystemConfigItem["status"], locale: Locale): string {
  const labels: Record<SystemConfigItem["status"], { zh: string; en: string }> = {
    healthy: { zh: "健康", en: "Healthy" },
    warning: { zh: "需关注", en: "Needs review" },
    failed: { zh: "失败", en: "Failed" }
  };
  return locale === "zh" ? labels[status].zh : labels[status].en;
}

function hostCheckCategoryLabel(category: SystemConfigItem["category"], locale: Locale): string {
  const labels: Record<SystemConfigItem["category"], { zh: string; en: string }> = {
    security: { zh: "安全", en: "Security" },
    network: { zh: "网络", en: "Network" },
    runtime: { zh: "运行时", en: "Runtime" },
    service: { zh: "服务", en: "Service" }
  };
  return locale === "zh" ? labels[category].zh : labels[category].en;
}
