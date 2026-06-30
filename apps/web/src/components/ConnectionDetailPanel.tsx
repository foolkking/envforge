import { Button } from "./ui/Button";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Cpu, Edit3, HardDrive, MemoryStick, Server, Trash2, X } from "lucide-react";
import type { ConnectionProfile } from "../api";
import type { Locale } from "../lib/types";

export function ConnectionDetailPanel({
  conn,
  onDelete,
  onUpdate
}: {
  conn: ConnectionProfile;
  locale: Locale;
  onDelete: () => void;
  onUpdate: (input: { label?: string; agentUrl?: string; tags?: string[] }) => void;
}) {
  const { t } = useTranslation();
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
          <StatusIndicator status={conn.status} />
          <span className="conn-detail-updated">
            <Clock style={{ width: 12, height: 12 }} />
            {new Date(conn.updatedAt).toLocaleString()}
          </span>
        </div>
        <div className="conn-detail-top-actions">
          <Button variant="connectionGhost"  type="button" onClick={() => setEditing((value) => !value)} title={t("connectionDetail.edit")}>
            <Edit3 style={{ width: 14, height: 14 }} />
          </Button>
          {confirmDelete ? (
            <div className="conn-delete-confirm">
              <Button variant="danger"  type="button" onClick={onDelete}>
                {t("connectionDetail.confirmDelete")}
              </Button>
              <Button variant="connectionGhost"  type="button" onClick={() => setConfirmDelete(false)}>
                <X style={{ width: 14, height: 14 }} />
              </Button>
            </div>
          ) : (
            <Button variant="connectionGhost" className="conn-btn-danger-text" type="button" onClick={() => setConfirmDelete(true)} title={t("connectionDetail.delete")}>
              <Trash2 style={{ width: 14, height: 14 }} />
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="conn-edit-form">
          <label>
            <span>{t("connectionDetail.label")}</span>
            <input value={label} onChange={(event) => setLabel(event.target.value)} />
          </label>
          <label>
            <span>{t("connectionDetail.tags")}</span>
            <input value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} />
          </label>
          <div className="conn-edit-actions">
            <Button variant="connectionPrimary"  type="button" onClick={saveEdit}>{t("connectionDetail.save")}</Button>
            <Button variant="connectionGhost"  type="button" onClick={() => setEditing(false)}>{t("connectionDetail.cancel")}</Button>
          </div>
        </div>
      ) : null}

      {hasProbe && probe ? (
        <div className="conn-system-grid">
          <SystemCard icon={Server} label={t("connectionDetail.host")} value={probe.system.hostname} sub={probe.system.osPretty} />
          <SystemCard icon={Cpu} label="CPU" value={t("connectionDetail.cores", { count: probe.system.cpu.cores })} sub={probe.system.cpu.model?.slice(0, 32)} />
          <SystemCard icon={MemoryStick} label={t("connectionDetail.memory")} value={`${probe.system.memory.totalGb} GB`} sub={t("connectionDetail.freeMemory", { amount: probe.system.memory.freeGb })} />
          <SystemCard icon={HardDrive} label={t("connectionDetail.disk")} value={probe.system.disk?.usePercent ?? "-"} sub={probe.system.disk ? `${probe.system.disk.used} / ${probe.system.disk.total}` : undefined} />
        </div>
      ) : (
        <div className="conn-feedback conn-feedback-info">
          {t("connectionDetail.noSnapshot")}
        </div>
      )}
    </div>
  );
}

function StatusIndicator({ status }: { status: ConnectionProfile["status"] }) {
  const { t } = useTranslation();
  const ok = status === "ssh_ok" || status === "validated";
  return (
    <span className={`conn-status-pill ${ok ? "ok" : "warn"}`}>
      <span />
      {ok ? t("connectionDetail.collected") : t("connectionDetail.needsCheck")}
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
