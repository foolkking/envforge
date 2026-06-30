import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Database,
  FileText,
  PackageCheck,
  PlayCircle,
  Server,
  ShieldCheck,
  UserRound
} from "lucide-react";
import {
  listEnvironmentPlans,
  type AgentProbeResult,
  type AuthUser,
  type ConnectionProfile,
  type PlanListEntry,
  type UserProfile
} from "../api";
import type { Locale } from "../lib/types";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";

type JumpTarget = "migrate" | "build" | "plans" | "reports" | "catalog";
type PipelineState = "done" | "active" | "blocked" | "idle";
type NoticeTone = "danger" | "warning" | "neutral" | "primary";

export function DashboardPage({
  authToken,
  locale,
  connections,
  authUser,
  activeConnection,
  activeProbe,
  userProfiles,
  inboxUnreadCount,
  onJump,
  onAccount
}: {
  authToken: string;
  locale: Locale;
  connections: ConnectionProfile[];
  authUser: AuthUser | null;
  activeConnection: ConnectionProfile | null;
  activeProbe: AgentProbeResult | null;
  userProfiles: UserProfile[];
  inboxUnreadCount: number;
  onJump?: (page: JumpTarget) => void;
  onAccount?: () => void;
}) {
  const [plans, setPlans] = useState<PlanListEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  useEffect(() => {
    if (!authToken) return;
    setLoading(true);
    setError("");
    listEnvironmentPlans(authToken)
      .then(setPlans)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [authToken]);

  const recentPlans = plans.slice(0, 6);
  const pendingPlans = plans.filter((plan) => plan.status === "draft" || plan.status === "needs-review");
  const approvedPlans = plans.filter((plan) => plan.status === "approved");
  const failedPlans = plans.filter((plan) => plan.status === "failed" || plan.verifyResults.some((result) => result.status === "failed"));
  const latestPlan = plans[0] ?? null;
  const snapshots = userProfiles.filter((profile) => profile.kind === "vm-snapshot").slice(0, 4);
  const reportStatuses: Array<NonNullable<PlanListEntry["status"]>> = ["succeeded", "failed", "rolled-back", "committed"];
  const reports = plans
    .filter((plan) => plan.status ? reportStatuses.includes(plan.status) : false)
    .slice(0, 4);
  const evidenceCount = activeProbe?.counts?.total ?? activeProbe?.software?.length ?? 0;
  const snapshotTime = activeProbe?.collectedAt ?? activeConnection?.lastProbeAt ?? null;

  const runtimeNotices = useMemo(() => {
    const notices: Array<{ title: string; body: string; tone?: NoticeTone }> = [];
    if (connections.length === 0) {
      notices.push({
        title: t("dashboard.notices.noSourceTitle"),
        body: t("dashboard.notices.noSourceBody"),
        tone: "warning"
      });
    }
    if (connections.some((connection) => connection.status === "ssh_failed")) {
      notices.push({
        title: t("dashboard.notices.connectionAttentionTitle"),
        body: t("dashboard.notices.connectionAttentionBody"),
        tone: "danger"
      });
    }
    if (failedPlans.length > 0) {
      notices.push({
        title: t("dashboard.notices.verificationFailureTitle"),
        body: t("dashboard.notices.verificationFailureBody", { count: failedPlans.length }),
        tone: "danger"
      });
    }
    if (pendingPlans.length > 0) {
      notices.push({
        title: t("dashboard.notices.plansWaitingTitle"),
        body: t("dashboard.notices.plansWaitingBody", { count: pendingPlans.length }),
        tone: "neutral"
      });
    }
    if (notices.length === 0) {
      notices.push({
        title: t("dashboard.notices.noBlockingTitle"),
        body: t("dashboard.notices.noBlockingBody"),
        tone: "neutral"
      });
    }
    return notices;
  }, [connections, failedPlans.length, pendingPlans.length, t]);

  const pipelineSteps: Array<{
    id: string;
    title: string;
    body: string;
    metric: string;
    state: PipelineState;
    target: JumpTarget;
    icon: React.ReactNode;
    action: string;
  }> = [
    {
      id: "connect",
      title: t("dashboard.pipeline.connectTitle"),
      body: activeConnection ? `${activeConnection.label} · ${activeConnection.fields.host ?? "-"}` : t("dashboard.pipeline.noSource"),
      metric: String(connections.length),
      state: activeConnection ? "done" : "active",
      target: "migrate",
      icon: <Server aria-hidden />,
      action: t("dashboard.pipeline.openMigrate")
    },
    {
      id: "snapshot",
      title: t("dashboard.pipeline.snapshotTitle"),
      body: snapshotTime ? new Date(snapshotTime).toLocaleString() : t("dashboard.pipeline.waitingSnapshot"),
      metric: evidenceCount ? `${evidenceCount}` : "0",
      state: evidenceCount > 0 ? "done" : activeConnection ? "active" : "idle",
      target: "migrate",
      icon: <Database aria-hidden />,
      action: t("dashboard.pipeline.collectEvidence")
    },
    {
      id: "build",
      title: t("dashboard.pipeline.buildTitle"),
      body: latestPlan ? latestPlan.name : t("dashboard.pipeline.createCertifiedPlan"),
      metric: String(plans.length),
      state: latestPlan ? "done" : evidenceCount > 0 ? "active" : "idle",
      target: "build",
      icon: <PackageCheck aria-hidden />,
      action: t("dashboard.pipeline.openBuild")
    },
    {
      id: "review",
      title: t("dashboard.pipeline.reviewTitle"),
      body: pendingPlans.length ? t("dashboard.pipeline.reviewPending", { count: pendingPlans.length }) : t("dashboard.pipeline.noReviewBacklog"),
      metric: String(pendingPlans.length),
      state: pendingPlans.length ? "active" : latestPlan ? "done" : "idle",
      target: "plans",
      icon: <ShieldCheck aria-hidden />,
      action: t("dashboard.pipeline.openReview")
    },
    {
      id: "apply",
      title: t("dashboard.pipeline.applyTitle"),
      body: failedPlans.length ? t("dashboard.pipeline.failedVerification") : approvedPlans.length ? t("dashboard.pipeline.approvedPlans") : t("dashboard.pipeline.waitingApproval"),
      metric: failedPlans.length ? String(failedPlans.length) : String(approvedPlans.length),
      state: failedPlans.length ? "blocked" : approvedPlans.length ? "active" : latestPlan ? "idle" : "idle",
      target: "plans",
      icon: <PlayCircle aria-hidden />,
      action: t("dashboard.pipeline.viewRuns")
    },
    {
      id: "report",
      title: t("dashboard.pipeline.reportTitle"),
      body: reports[0] ? reports[0].name : t("dashboard.pipeline.reportsAfterCompletion"),
      metric: String(reports.length),
      state: reports.length ? "done" : latestPlan ? "idle" : "idle",
      target: "reports",
      icon: <FileText aria-hidden />,
      action: t("dashboard.pipeline.openReports")
    }
  ];

  function pipelineStateLabel(state: PipelineState): string {
    if (state === "done") return t("dashboard.states.done");
    if (state === "active") return t("dashboard.states.active");
    if (state === "blocked") return t("dashboard.states.blocked");
    return t("dashboard.states.idle");
  }

  const completedSteps = pipelineSteps.filter((step) => step.state === "done").length;
  const nextStep = pipelineSteps.find((step) => step.state === "active" || step.state === "blocked") ?? pipelineSteps[0];
  const healthTone: NoticeTone = failedPlans.length ? "danger" : connections.some((connection) => connection.status === "ssh_failed") ? "warning" : "neutral";

  const resources = [
    {
      title: t("dashboard.resources.sourceTitle"),
      value: activeConnection ? activeConnection.label : t("dashboard.resources.notConnected"),
      meta: activeConnection?.fields.host ?? t("dashboard.resources.connectVm"),
      icon: <Server aria-hidden />,
      action: t("dashboard.resources.manage"),
      target: "migrate" as JumpTarget
    },
    {
      title: t("dashboard.resources.evidenceTitle"),
      value: evidenceCount ? t("dashboard.resources.itemCount", { count: evidenceCount }) : t("dashboard.resources.pending"),
      meta: snapshotTime ? new Date(snapshotTime).toLocaleString() : t("dashboard.resources.snapshotMissing"),
      icon: <Database aria-hidden />,
      action: t("dashboard.resources.collect"),
      target: "migrate" as JumpTarget
    },
    {
      title: t("dashboard.resources.planQueueTitle"),
      value: t("dashboard.resources.pendingCount", { count: pendingPlans.length }),
      meta: latestPlan?.name ?? t("dashboard.resources.noPlans"),
      icon: <ClipboardList aria-hidden />,
      action: t("dashboard.resources.review"),
      target: "plans" as JumpTarget
    },
    {
      title: t("dashboard.resources.reportsTitle"),
      value: `${reports.length}`,
      meta: reports[0] ? new Date(reports[0].updatedAt).toLocaleString() : t("dashboard.resources.waitingResults"),
      icon: <FileText aria-hidden />,
      action: t("dashboard.resources.open"),
      target: "reports" as JumpTarget
    }
  ];

  const settingsShortcuts: Array<{ title: string; value: string; meta: string; icon: React.ReactNode; onClick: () => void }> = [
    ...(onAccount
      ? [{
          title: t("dashboard.settings.accountTitle"),
          value: authUser?.displayName || authUser?.name || t("dashboard.settings.currentAccount"),
          meta: t("dashboard.settings.accountMeta"),
          icon: <UserRound aria-hidden />,
          onClick: onAccount
        }]
      : []),
    {
      title: t("dashboard.settings.automationTitle"),
      value: t("dashboard.settings.automationValue"),
      meta: t("dashboard.settings.automationMeta"),
      icon: <Activity aria-hidden />,
      onClick: () => onJump?.("plans")
    },
    ...(authUser?.role === "admin"
      ? [{
          title: t("dashboard.settings.usersQueuesTitle"),
          value: t("dashboard.settings.governanceValue"),
          meta: t("dashboard.settings.governanceMeta"),
          icon: <ShieldCheck aria-hidden />,
          onClick: () => onJump?.("catalog")
        }]
      : [])
  ];

  return (
    <div className="dashboard-page console-dashboard">
      <section className="console-command-strip">
        <div>
          <p className="eyebrow">{t("dashboard.header.eyebrow")}</p>
          <h2>{t("dashboard.header.title")}</h2>
          <p>{t("dashboard.header.intro")}</p>
        </div>
        <div className="console-command-actions">
          <StatusBadge tone={healthTone} label={failedPlans.length ? t("dashboard.header.actionNeeded") : t("dashboard.header.operational")} />
          <Button variant="primary" onClick={() => onJump?.(nextStep.target)}>
            {nextStep.icon}
            {nextStep.action}
          </Button>
        </div>
      </section>

      <section className="resource-overview-grid" aria-label={t("dashboard.resources.overviewLabel")}>
        {resources.map((resource) => (
          <button className="resource-status-card" type="button" key={resource.title} onClick={() => onJump?.(resource.target)}>
            <span className="resource-status-icon">{resource.icon}</span>
            <span>
              <small>{resource.title}</small>
              <strong>{resource.value}</strong>
              <em>{resource.meta}</em>
            </span>
            <ArrowRight aria-hidden />
          </button>
        ))}
      </section>

      <section className="operations-pipeline-panel">
        <div className="dashboard-section-heading">
          <div>
            <p className="eyebrow">{t("dashboard.pipeline.eyebrow")}</p>
          <h3>{t("dashboard.pipeline.title")}</h3>
          </div>
          <span className="pipeline-score">{completedSteps}/6</span>
        </div>
        <div className="pipeline-track">
          {pipelineSteps.map((step, index) => (
            <button className={`pipeline-step step-${step.state}`} type="button" key={step.id} onClick={() => onJump?.(step.target)}>
              <span className="pipeline-step-index">{index + 1}</span>
              <span className="pipeline-step-icon">{step.icon}</span>
              <span className="pipeline-step-copy">
                <strong>{step.title}</strong>
                <small>{step.body}</small>
              </span>
              <span className="pipeline-step-meta">
                <StatusBadge tone={stateToTone(step.state)} label={pipelineStateLabel(step.state)} />
                <b>{step.metric}</b>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="operations-pipeline-panel account-settings-shortcuts">
        <div className="dashboard-section-heading">
          <div>
            <p className="eyebrow">{t("dashboard.settings.eyebrow")}</p>
            <h3>{t("dashboard.settings.title")}</h3>
          </div>
        </div>
        <div className="resource-overview-grid">
          {settingsShortcuts.map((shortcut) => (
            <button className="resource-status-card" type="button" key={shortcut.title} onClick={shortcut.onClick}>
              <span className="resource-status-icon">{shortcut.icon}</span>
              <span>
                <small>{shortcut.title}</small>
                <strong>{shortcut.value}</strong>
                <em>{shortcut.meta}</em>
              </span>
              <ArrowRight aria-hidden />
            </button>
          ))}
        </div>
      </section>

      <section className="console-workspace-grid">
        <div className="console-main-column">
          <Panel title={t("dashboard.panels.runtimeQueue")} icon={<AlertTriangle aria-hidden />}>
            <div className="notice-list">
              {runtimeNotices.map((notice) => (
                <article className={`runtime-notice notice-${notice.tone ?? "neutral"}`} key={notice.title}>
                  <strong>{notice.title}</strong>
                  <p>{notice.body}</p>
                </article>
              ))}
            </div>
          </Panel>

          <Panel title={t("dashboard.panels.recentPlans")} icon={<Activity aria-hidden />}>
            <ListEmpty items={recentPlans} empty={t("dashboard.panels.noPlans")}>
              {(plan) => (
                <li key={plan.id}>
                  <span>
                    <strong>{plan.name}</strong>
                    <small>{plan.type} · {plan.status ?? "draft"}</small>
                  </span>
                  <time>{new Date(plan.updatedAt).toLocaleString()}</time>
                </li>
              )}
            </ListEmpty>
          </Panel>
        </div>

        <aside className="console-side-column">
          <Panel title={t("dashboard.panels.workspaceContext")} icon={<CircleDot aria-hidden />}>
            <dl className="workspace-context-list">
              <div><dt>{t("dashboard.panels.role")}</dt><dd>{authUser?.role ?? "guest"}</dd></div>
              <div><dt>{t("dashboard.panels.connections")}</dt><dd>{connections.length}</dd></div>
              <div><dt>{t("dashboard.panels.evidence")}</dt><dd>{evidenceCount}</dd></div>
              <div><dt>{t("dashboard.panels.unread")}</dt><dd>{inboxUnreadCount}</dd></div>
            </dl>
          </Panel>

          <Panel title={t("dashboard.panels.snapshotsReports")} icon={<CheckCircle2 aria-hidden />}>
            <ListEmpty items={snapshots} empty={t("dashboard.panels.noSnapshots")}>
              {(profile) => (
                <li key={profile.id}>
                  <span>
                    <strong>{locale === "zh" ? profile.name : profile.nameEn}</strong>
                    <small>{new Date(profile.updatedAt).toLocaleString()}</small>
                  </span>
                </li>
              )}
            </ListEmpty>
            <ListEmpty items={reports} empty={t("dashboard.panels.noReports")}>
              {(plan) => (
                <li key={plan.id}>
                  <span>
                    <strong>{plan.name}</strong>
                    <small>{plan.status ?? "-"} · {new Date(plan.updatedAt).toLocaleString()}</small>
                  </span>
                </li>
              )}
            </ListEmpty>
          </Panel>
        </aside>
      </section>

      {error ? <p className="connection-error">{error}</p> : null}
      {loading ? <p className="empty-hint">{t("dashboard.panels.refreshingPlans")}</p> : null}
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="dashboard-panel">
      <h3>{icon}{title}</h3>
      {children}
    </section>
  );
}

function ListEmpty<T>({ items, empty, children }: { items: T[]; empty: string; children: (item: T) => React.ReactNode }) {
  if (items.length === 0) return <p className="empty-hint">{empty}</p>;
  return <ul className="dashboard-list">{items.map(children)}</ul>;
}

function StatusBadge({ tone, label }: { tone: NoticeTone; label: string }) {
  return <Badge tone={tone === "warning" ? "warn" : tone}>{label}</Badge>;
}

function stateToTone(state: PipelineState): NoticeTone {
  if (state === "blocked") return "danger";
  if (state === "active") return "primary";
  return "neutral";
}
