import React, { useState } from "react";
import { Clock, Cpu, Edit3, HardDrive, MemoryStick, Server, Trash2, X } from "lucide-react";
import type { ConnectionProfile } from "../api";
import type { Locale } from "../lib/types";

export function ConnectionDetailPanel({
  conn,
  locale,
  onDelete,
  onUpdate
}: {
  conn: ConnectionProfile;
  locale: Locale;
  onDelete: () => void;
  onUpdate: (input: { label?: string; agentUrl?: string; tags?: string[] }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(conn.label);
  const [tagsInput, setTagsInput] = useState(conn.tags?.join(", ") ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const probe = conn.probeSnapshot;
  const hasProbe = Boolean(probe);

  function saveEdit() {
    onUpdate({
      label: label.trim() || conn.label,
      tags: tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean)
    });
    setEditing(false);
  }

  return (
    <div className="conn-detail-card">
      <div className="conn-detail-top">
        <div className="conn-detail-top-left">
          <StatusIndicator status={conn.status} locale={locale} />
          <span className="conn-detail-updated">
            <Clock style={{ width: 12, height: 12 }} />
            {new Date(conn.updatedAt).toLocaleString()}
          </span>
        </div>
        <div className="conn-detail-top-actions">
          <button className="conn-btn conn-btn-ghost" type="button" onClick={() => setEditing((value) => !value)} title={locale === "zh" ? "编辑连接" : "Edit connection"}>
            <Edit3 style={{ width: 14, height: 14 }} />
          </button>
          {confirmDelete ? (
            <div className="conn-delete-confirm">
              <button className="conn-btn conn-btn-danger" type="button" onClick={onDelete}>
                {locale === "zh" ? "确认删除" : "Confirm"}
              </button>
              <button className="conn-btn conn-btn-ghost" type="button" onClick={() => setConfirmDelete(false)}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>
          ) : (
            <button className="conn-btn conn-btn-ghost conn-btn-danger-text" type="button" onClick={() => setConfirmDelete(true)} title={locale === "zh" ? "删除连接" : "Delete connection"}>
              <Trash2 style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="conn-edit-form">
          <label>
            <span>{locale === "zh" ? "连接名称" : "Connection label"}</span>
            <input value={label} onChange={(event) => setLabel(event.target.value)} />
          </label>
          <label>
            <span>{locale === "zh" ? "标签（逗号分隔）" : "Tags, comma separated"}</span>
            <input value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} />
          </label>
          <div className="conn-edit-actions">
            <button className="conn-btn conn-btn-primary" type="button" onClick={saveEdit}>{locale === "zh" ? "保存" : "Save"}</button>
            <button className="conn-btn conn-btn-ghost" type="button" onClick={() => setEditing(false)}>{locale === "zh" ? "取消" : "Cancel"}</button>
          </div>
        </div>
      ) : null}

      {hasProbe && probe ? (
        <div className="conn-system-grid">
          <SystemCard icon={Server} label={locale === "zh" ? "主机" : "Host"} value={probe.system.hostname} sub={probe.system.osPretty} />
          <SystemCard icon={Cpu} label="CPU" value={`${probe.system.cpu.cores} cores`} sub={probe.system.cpu.model?.slice(0, 32)} />
          <SystemCard icon={MemoryStick} label={locale === "zh" ? "内存" : "Memory"} value={`${probe.system.memory.totalGb} GB`} sub={`${probe.system.memory.freeGb} GB ${locale === "zh" ? "可用" : "free"}`} />
          <SystemCard icon={HardDrive} label={locale === "zh" ? "磁盘" : "Disk"} value={probe.system.disk?.usePercent ?? "-"} sub={probe.system.disk ? `${probe.system.disk.used} / ${probe.system.disk.total}` : undefined} />
        </div>
      ) : (
        <div className="conn-feedback conn-feedback-info">
          {locale === "zh" ? "尚未采集主机快照。请使用下方的采集按钮。" : "No HostSnapshot collected yet. Use the collection action below."}
        </div>
      )}
    </div>
  );
}

function StatusIndicator({ status, locale }: { status: ConnectionProfile["status"]; locale: Locale }) {
  const ok = status === "ssh_ok" || status === "validated";
  return (
    <span className={`conn-status-pill ${ok ? "ok" : "warn"}`}>
      <span />
      {ok ? (locale === "zh" ? "已采集" : "Collected") : (locale === "zh" ? "需检查" : "Needs check")}
    </span>
  );
}

function SystemCard({
  icon: Icon,
  label,
  value,
  sub
}: {
  icon: typeof Server;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="conn-sys-card">
      <Icon style={{ width: 16, height: 16 }} />
      <div>
        <span className="conn-sys-label">{label}</span>
        <strong>{value}</strong>
        {sub ? <span className="conn-sys-sub">{sub}</span> : null}
      </div>
    </div>
  );
}
