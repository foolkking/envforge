import { Button } from "../components/ui/Button";
/**
 * SettingsPage — DEPRECATED page shell.
 *
 * The first-level "Maintain" navigation entry has been removed. Its
 * content was redistributed to:
 *   - Plans      — Schedules / Drift / Webhooks (panels exported below)
 *   - Dashboard  — Account / 2FA / API tokens / Notifications
 *   - Capability Admin → Users & Queues — admin user roles + EnvForge
 *     job queue
 *   - Capability Admin → Package Integrations — rule-level package /
 *     service / config map governance
 *
 * This file is kept around to expose the `SchedulesPanel`,
 * `DriftPanel`, and `WebhooksPanel` named exports consumed by
 * `PlanRecipesPage`. The legacy `SettingsPage` wrapper function and
 * its tab bar are gone — there is no first-level page that mounts
 * them anymore.
 */
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  fetchSchedules, deleteSchedule,
  fetchWebhooks, createWebhook, deleteWebhook, testWebhook,
  setDriftBaseline, runDriftCheck,
  type Schedule, type Webhook, type DriftReport,
  type ConnectionProfile, type StoredPlaybook, type CatalogItem
} from "../api";
import type { Locale } from "../lib/types";
import { useEscapeToClose } from "../lib/useEscapeToClose";
import { toast } from "../lib/dialogs";
import { confirmDialog } from "../lib/dialogs";

export function SchedulesPanel({
  authToken, connections, playbooks, catalog
}: {
  locale: Locale; authToken: string;
  connections: ConnectionProfile[]; playbooks: StoredPlaybook[]; catalog: CatalogItem[];
}) {
  const { t } = useTranslation();
  const [list, setList] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function reload() {
    setLoading(true); setError("");
    try { setList(await fetchSchedules(authToken)); }
    catch (e) { setError(e instanceof Error ? e.message : t("automationPanels.common.failed")); }
    finally { setLoading(false); }
  }

  useEffect(() => { void reload(); }, [authToken]);

  return (
    <section className="settings-section">
      <div className="settings-section-header">
        <h3>{t("automationPanels.schedules.title")}</h3>
      </div>
      {error && <p className="settings-error">{error}</p>}
      {loading ? <p className="empty-hint"><span className="spinning">↻</span></p> : list.length === 0 ? (
        <p className="empty-hint">{t("automationPanels.schedules.empty")}</p>
      ) : (
        <ul className="settings-list">
          {list.map((s) => (
            <li key={s.id} className="settings-row">
              <div className="settings-row-main">
                <strong>{s.name}</strong>
                <span className="settings-row-meta">
                  <code>{s.cron}</code>
                  {" · "}{s.connectionIds.length > 0 ? t("automationPanels.schedules.targetCount", { count: s.connectionIds.length }) : t("automationPanels.schedules.tags", { tags: s.tags.join(",") || t("automationPanels.common.all") })}
                  {" · "}{s.dryRun ? t("automationPanels.schedules.dryRun") : t("automationPanels.schedules.apply")}
                  {s.nextRunAt ? ` · ${t("automationPanels.schedules.next", { time: new Date(s.nextRunAt).toLocaleString() })}` : ""}
                </span>
              </div>
              <div className="settings-row-actions">
                <Button variant="danger" type="button"  onClick={async () => {
                  if (!(await confirmDialog({ message: t("automationPanels.schedules.deleteConfirm"), danger: true }))) return;
                  await deleteSchedule(authToken, s.id);
                  void reload();
                }}>{t("automationPanels.common.delete")}</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ScheduleForm({
  connections, playbooks, catalog, onCancel, onSubmit
}: {
  connections: ConnectionProfile[];
  playbooks: StoredPlaybook[];
  catalog: CatalogItem[];
  onCancel: () => void;
  onSubmit: (input: Record<string, unknown>) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [cron, setCron] = useState("0 3 * * *");
  const [source, setSource] = useState<"playbook" | "catalog">("playbook");
  const [playbookId, setPlaybookId] = useState("");
  const [catalogId, setCatalogId] = useState("");
  const [connectionIds, setConnectionIds] = useState<string[]>([]);
  const [dryRun, setDryRun] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  useEscapeToClose(onCancel, !submitting);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <section className="profile-modal" style={{ maxWidth: 580 }}>
        <header>
          <div>
            <p className="eyebrow">{t("automationPanels.schedules.form.eyebrow")}</p>
            <h2>{t("automationPanels.schedules.form.title")}</h2>
          </div>
          <Button variant="ghost" type="button" className="icon-action" onClick={onCancel} aria-label={t("automationPanels.common.close")}>×</Button>
        </header>
        <div className="upload-form">
          <label>
            <span>{t("automationPanels.schedules.form.name")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("automationPanels.schedules.form.namePlaceholder")} />
          </label>
          <label>
            <span>{t("automationPanels.schedules.form.cron")}</span>
            <input value={cron} onChange={(e) => setCron(e.target.value)} placeholder="0 3 * * *" />
            <small style={{ color: "var(--ef-muted)", fontSize: 11 }}>
              {t("automationPanels.schedules.form.cronHelp")}
            </small>
          </label>
          <label>
            <span>{t("automationPanels.schedules.form.source")}</span>
            <select value={source} onChange={(e) => setSource(e.target.value as "playbook" | "catalog")}>
              <option value="playbook">{t("automationPanels.schedules.form.playbookSource")}</option>
              <option value="catalog">{t("automationPanels.schedules.form.catalogSource")}</option>
            </select>
          </label>
          {source === "playbook" ? (
            <label>
              <span>{t("automationPanels.schedules.playbook")}</span>
              <select value={playbookId} onChange={(e) => setPlaybookId(e.target.value)}>
                <option value="">— {t("automationPanels.common.select")} —</option>
                {playbooks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          ) : (
            <label>
              <span>{t("automationPanels.schedules.form.capabilityRule")}</span>
              <select value={catalogId} onChange={(e) => setCatalogId(e.target.value)}>
                <option value="">— {t("automationPanels.common.select")} —</option>
                {catalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          <label>
            <span>{t("automationPanels.schedules.form.targetVms")}</span>
            <select multiple value={connectionIds} onChange={(e) => setConnectionIds(Array.from(e.target.selectedOptions).map((o) => o.value))} style={{ height: 120 }}>
              {connections.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label className="toggle-label">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            {t("automationPanels.schedules.form.dryRun")}
          </label>
          {err && <p className="settings-error">{err}</p>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="ghost" type="button"  onClick={onCancel}>{t("automationPanels.common.cancel")}</Button>
            <Button variant="primary"
              type="button"

              disabled={submitting}
              onClick={async () => {
                setErr("");
                if (!name.trim()) { setErr(t("automationPanels.schedules.form.nameRequired")); return; }
                if (source === "playbook" && !playbookId) { setErr(t("automationPanels.schedules.form.playbookRequired")); return; }
                if (source === "catalog" && !catalogId) { setErr(t("automationPanels.schedules.form.catalogRequired")); return; }
                setSubmitting(true);
                try {
                  await onSubmit({
                    name,
                    cron,
                    playbookId: source === "playbook" ? playbookId : undefined,
                    catalogId: source === "catalog" ? catalogId : undefined,
                    connectionIds,
                    tags: [],
                    dryRun,
                    enabled: true
                  });
                } catch (e) {
                  setErr(e instanceof Error ? e.message : t("automationPanels.common.failed"));
                } finally {
                  setSubmitting(false);
                }
              }}
            >{t("automationPanels.common.create")}</Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function DriftPanel({ authToken, connections }: { locale: Locale; authToken: string; connections: ConnectionProfile[] }) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<DriftReport | null>(null);
  const [error, setError] = useState("");
  const [generatedPlanId, setGeneratedPlanId] = useState<string | null>(null);

  /**
   * Convert a drift report into a Repair Plan. Each "removed" software
   * becomes a `package-missing` failure; each "added" software becomes a
   * `verify-failed` entry the operator can review and either keep or
   * remove. The generated plan is a real Environment Plan and follows the
   * standard review → apply → verify → rollback lifecycle.
   */
  async function handleGenerateRepairPlan() {
    if (!report || !activeId) return;
    setBusy(true);
    setError("");
    setGeneratedPlanId(null);
    try {
      const { createEnvironmentPlan } = await import("../api");
      const failures = [
        ...report.removedSoftware.map((s) => ({
          label: t("automationPanels.drift.restoreMissing", { name: s.name }),
          kind: "package-missing" as const,
          packageNames: [s.name],
          severity: "high" as const,
          evidence: [`Drift baseline saw ${s.name} via ${s.source}; current snapshot does not.`]
        })),
        ...report.addedSoftware.map((s) => ({
          label: t("automationPanels.drift.reviewUnauthorised", { name: s.name }),
          kind: "verify-failed" as const,
          severity: "medium" as const,
          evidence: [`Snapshot now contains ${s.name} (${s.source}); baseline did not. Decide whether to remove or accept.`]
        }))
      ];
      if (failures.length === 0) {
        setError(t("automationPanels.drift.noRepairItems"));
        return;
      }
      const { plan } = await createEnvironmentPlan(authToken, {
        type: "repair",
        targetConnectionId: activeId,
        source: { kind: "repair-failures", failures, name: t("automationPanels.drift.repairPlanName") }
      });
      setGeneratedPlanId(plan.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("automationPanels.common.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-section">
      <h3>{t("automationPanels.drift.title")}</h3>
      <p className="settings-help">{t("automationPanels.drift.intro")}</p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <select value={activeId} onChange={(e) => { setActiveId(e.target.value); setReport(null); setError(""); setGeneratedPlanId(null); }} style={{ flex: 1 }}>
          <option value="">— {t("automationPanels.drift.selectVm")} —</option>
          {connections.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <Button variant="ghost"
          type="button"

          disabled={!activeId || busy}
          onClick={async () => {
            setBusy(true); setError(""); setReport(null); setGeneratedPlanId(null);
            try {
              await setDriftBaseline(authToken, activeId);
              setError(t("automationPanels.drift.baselineSaved"));
            } catch (e) { setError(e instanceof Error ? e.message : t("automationPanels.common.failed")); }
            finally { setBusy(false); }
          }}
        >
          {t("automationPanels.drift.setBaseline")}
        </Button>
        <Button variant="primary"
          type="button"

          disabled={!activeId || busy}
          onClick={async () => {
            setBusy(true); setError(""); setReport(null); setGeneratedPlanId(null);
            try {
              setReport(await runDriftCheck(authToken, activeId));
            } catch (e) { setError(e instanceof Error ? e.message : t("automationPanels.common.failed")); }
            finally { setBusy(false); }
          }}
        >
          {t("automationPanels.drift.check")}
        </Button>
      </div>
      {error && <p className="settings-error">{error}</p>}
      {report && (
        <div className="drift-report">
          <p>
            <strong>{report.hasDrift ? t("automationPanels.drift.detected") : t("automationPanels.drift.none")}</strong>
            <span className="settings-row-meta">
              {" · "}baseline: {new Date(report.baselineCapturedAt).toLocaleString()}
              {" · "}checked: {new Date(report.checkedAt).toLocaleString()}
            </span>
          </p>
          {report.addedSoftware.length > 0 && (
            <div className="drift-section">
              <h4>+ {t("automationPanels.drift.added", { count: report.addedSoftware.length })}</h4>
              <ul>
                {report.addedSoftware.map((s) => (
                  <li key={`${s.source}-${s.name}`}><code>{s.name}</code> <span className="settings-row-meta">[{s.source}]</span></li>
                ))}
              </ul>
            </div>
          )}
          {report.removedSoftware.length > 0 && (
            <div className="drift-section">
              <h4>- {t("automationPanels.drift.removed", { count: report.removedSoftware.length })}</h4>
              <ul>
                {report.removedSoftware.map((s) => (
                  <li key={`${s.source}-${s.name}`}><code>{s.name}</code> <span className="settings-row-meta">[{s.source}]</span></li>
                ))}
              </ul>
            </div>
          )}
          {report.hasDrift ? (
            <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
              <Button variant="primary" type="button"  disabled={busy} onClick={() => void handleGenerateRepairPlan()}>
                {t("automationPanels.drift.generateRepair")}
              </Button>
              {generatedPlanId ? (
                <span className="settings-row-meta" style={{ color: "var(--ef-success)" }}>
                  {t("automationPanels.drift.planCreated")}
                  <code>{generatedPlanId}</code>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function WebhooksPanel({ authToken }: { locale: Locale; authToken: string }) {
  const { t } = useTranslation();
  const [list, setList] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: "", url: "", secret: "" });
  const [err, setErr] = useState("");

  async function reload() {
    setLoading(true); setErr("");
    try { setList(await fetchWebhooks(authToken)); }
    catch (e) { setErr(e instanceof Error ? e.message : t("automationPanels.common.failed")); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reload(); }, [authToken]);

  return (
    <section className="settings-section">
      <div className="settings-section-header">
        <h3>{t("automationPanels.webhooks.title")}</h3>
        <Button variant="primary" type="button"  style={{ fontSize: 13 }} onClick={() => setShowForm((v) => !v)}>
          {showForm ? t("automationPanels.webhooks.collapse") : `+ ${t("automationPanels.webhooks.new")}`}
        </Button>
      </div>
      <p className="settings-help">{t("automationPanels.webhooks.intro")}</p>
      {showForm && (
        <div className="upload-form">
          <input placeholder={t("automationPanels.webhooks.label")} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <input placeholder="https://hooks.slack.com/services/..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <input placeholder={t("automationPanels.webhooks.secret")} value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} />
          {err && <p className="settings-error">{err}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="primary" type="button"  onClick={async () => {
              setErr("");
              try {
                await createWebhook(authToken, { ...form, events: ["task.completed", "task.failed", "drift.detected", "schedule.fired"], enabled: true });
                setForm({ label: "", url: "", secret: "" });
                setShowForm(false);
                void reload();
              } catch (e) { setErr(e instanceof Error ? e.message : t("automationPanels.common.failed")); }
            }}>{t("automationPanels.common.create")}</Button>
          </div>
        </div>
      )}
      {loading ? <p className="empty-hint"><span className="spinning">↻</span></p> : list.length === 0 ? (
        <p className="empty-hint">{t("automationPanels.webhooks.empty")}</p>
      ) : (
        <ul className="settings-list">
          {list.map((w) => (
            <li key={w.id} className="settings-row">
              <div className="settings-row-main">
                <strong>{w.label}</strong>
                <span className="settings-row-meta">
                  <code>{w.url}</code> {" · "}{w.events.join(", ")}
                  {w.lastDeliveryStatus ? ` · ${t("automationPanels.webhooks.last", { status: w.lastDeliveryStatus })}` : ""}
                </span>
              </div>
              <div className="settings-row-actions">
                <Button variant="ghost" type="button"  onClick={async () => {
                  const r = await testWebhook(authToken, w.id);
                  toast(`${t("automationPanels.webhooks.testResult")}: ${r.delivered}${r.error ? ` · ${r.error}` : ""}`, r.error ? "error" : "success");
                  void reload();
                }}>{t("automationPanels.webhooks.test")}</Button>
                <Button variant="danger" type="button"  onClick={async () => {
                  if (!(await confirmDialog({ message: t("automationPanels.webhooks.deleteConfirm"), danger: true }))) return;
                  await deleteWebhook(authToken, w.id);
                  void reload();
                }}>{t("automationPanels.common.delete")}</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
