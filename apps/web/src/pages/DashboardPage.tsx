import React, { useEffect, useMemo, useState } from "react";
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
type NoticeTone = "danger" | "warning" | "neutral";

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
  const zh = locale === "zh";

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
        title: zh ? "尚未连接源主机" : "No source host connected",
        body: zh ? "先从迁移页建立连接，再采集主机快照。" : "Connect a source host from Migrate, then capture a HostSnapshot.",
        tone: "warning"
      });
    }
    if (connections.some((connection) => connection.status === "ssh_failed")) {
      notices.push({
        title: zh ? "连接需要检查" : "Connection needs attention",
        body: zh ? "有主机 SSH 连接失败，请重新测试连接或更新凭证。" : "A host failed SSH connection; retest the connection or update credentials.",
        tone: "danger"
      });
    }
    if (failedPlans.length > 0) {
      notices.push({
        title: zh ? "验证失败需要处理" : "Verification failure needs review",
        body: zh ? `${failedPlans.length} 个计划有失败验证，可在计划页生成修复计划。` : `${failedPlans.length} plan(s) have failed verification; create a Repair Plan in Plans.`,
        tone: "danger"
      });
    }
    if (pendingPlans.length > 0) {
      notices.push({
        title: zh ? "计划等待审查" : "Plans waiting for review",
        body: zh ? `${pendingPlans.length} 个计划仍处于草稿或待审查。` : `${pendingPlans.length} plan(s) are still draft / needs-review.`,
        tone: "neutral"
      });
    }
    if (notices.length === 0) {
      notices.push({
        title: zh ? "暂无阻塞事项" : "No blocking notices",
        body: zh ? "当前没有需要立即处理的连接、凭证、验证或报告问题。" : "No immediate connection, credential, verification, or report issue needs action.",
        tone: "neutral"
      });
    }
    return notices;
  }, [connections, failedPlans.length, pendingPlans.length, zh]);

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
      title: zh ? "连接源主机" : "Connect source",
      body: activeConnection ? `${activeConnection.label} · ${activeConnection.fields.host ?? "-"}` : (zh ? "还没有可用连接" : "No source connection yet"),
      metric: String(connections.length),
      state: activeConnection ? "done" : "active",
      target: "migrate",
      icon: <Server aria-hidden />,
      action: zh ? "打开迁移" : "Open Migrate"
    },
    {
      id: "snapshot",
      title: zh ? "采集快照" : "Capture snapshot",
      body: snapshotTime ? new Date(snapshotTime).toLocaleString() : (zh ? "等待主机快照" : "Waiting for HostSnapshot"),
      metric: evidenceCount ? `${evidenceCount}` : "0",
      state: evidenceCount > 0 ? "done" : activeConnection ? "active" : "idle",
      target: "migrate",
      icon: <Database aria-hidden />,
      action: zh ? "采集证据" : "Collect evidence"
    },
    {
      id: "build",
      title: zh ? "生成计划" : "Build plan",
      body: latestPlan ? latestPlan.name : (zh ? "从已认证能力生成重建计划" : "Create a Rebuild Plan from certified capabilities"),
      metric: String(plans.length),
      state: latestPlan ? "done" : evidenceCount > 0 ? "active" : "idle",
      target: "build",
      icon: <PackageCheck aria-hidden />,
      action: zh ? "打开构建" : "Open Build"
    },
    {
      id: "review",
      title: zh ? "审查与批准" : "Review and approve",
      body: pendingPlans.length ? (zh ? `${pendingPlans.length} 个计划等待处理` : `${pendingPlans.length} plan(s) waiting`) : (zh ? "没有待审计划" : "No review backlog"),
      metric: String(pendingPlans.length),
      state: pendingPlans.length ? "active" : latestPlan ? "done" : "idle",
      target: "plans",
      icon: <ShieldCheck aria-hidden />,
      action: zh ? "打开审查" : "Open review"
    },
    {
      id: "apply",
      title: zh ? "执行与验证" : "Apply and verify",
      body: failedPlans.length ? (zh ? "存在失败验证，需要修复" : "Failed verification needs repair") : approvedPlans.length ? (zh ? "有已批准计划可执行" : "Approved plans can be applied") : (zh ? "等待批准后执行" : "Waiting for approval"),
      metric: failedPlans.length ? String(failedPlans.length) : String(approvedPlans.length),
      state: failedPlans.length ? "blocked" : approvedPlans.length ? "active" : latestPlan ? "idle" : "idle",
      target: "plans",
      icon: <PlayCircle aria-hidden />,
      action: zh ? "查看执行" : "View runs"
    },
    {
      id: "report",
      title: zh ? "报告沉淀" : "Report evidence",
      body: reports[0] ? reports[0].name : (zh ? "完成后生成迁移/修复报告" : "Reports appear after completion"),
      metric: String(reports.length),
      state: reports.length ? "done" : latestPlan ? "idle" : "idle",
      target: "reports",
      icon: <FileText aria-hidden />,
      action: zh ? "查看报告" : "Open reports"
    }
  ];

  const completedSteps = pipelineSteps.filter((step) => step.state === "done").length;
  const nextStep = pipelineSteps.find((step) => step.state === "active" || step.state === "blocked") ?? pipelineSteps[0];
  const healthTone: NoticeTone = failedPlans.length ? "danger" : connections.some((connection) => connection.status === "ssh_failed") ? "warning" : "neutral";

  const resources = [
    {
      title: zh ? "源环境" : "Source",
      value: activeConnection ? activeConnection.label : (zh ? "未连接" : "Not connected"),
      meta: activeConnection?.fields.host ?? (zh ? "从迁移页连接 Linux 主机" : "Connect a Linux VM from Migrate"),
      icon: <Server aria-hidden />,
      action: zh ? "管理连接" : "Manage",
      target: "migrate" as JumpTarget
    },
    {
      title: zh ? "证据快照" : "Evidence",
      value: evidenceCount ? `${evidenceCount} ${zh ? "项" : "items"}` : (zh ? "待采集" : "Pending"),
      meta: snapshotTime ? new Date(snapshotTime).toLocaleString() : (zh ? "主机快照尚未生成" : "HostSnapshot has not been captured"),
      icon: <Database aria-hidden />,
      action: zh ? "采集" : "Collect",
      target: "migrate" as JumpTarget
    },
    {
      title: zh ? "计划队列" : "Plan queue",
      value: `${pendingPlans.length} ${zh ? "待审" : "pending"}`,
      meta: latestPlan?.name ?? (zh ? "还没有计划" : "No plans yet"),
      icon: <ClipboardList aria-hidden />,
      action: zh ? "审查" : "Review",
      target: "plans" as JumpTarget
    },
    {
      title: zh ? "报告" : "Reports",
      value: `${reports.length}`,
      meta: reports[0] ? new Date(reports[0].updatedAt).toLocaleString() : (zh ? "等待执行结果" : "Waiting for execution results"),
      icon: <FileText aria-hidden />,
      action: zh ? "查看" : "Open",
      target: "reports" as JumpTarget
    }
  ];

  const settingsShortcuts: Array<{ title: string; value: string; meta: string; icon: React.ReactNode; onClick: () => void }> = [
    ...(onAccount
      ? [{
          title: zh ? "账号与安全" : "Account & security",
          value: authUser?.displayName || authUser?.name || (zh ? "当前账号" : "Current account"),
          meta: zh ? "资料 / 密码 / 2FA / API Token" : "Profile / password / 2FA / API tokens",
          icon: <UserRound aria-hidden />,
          onClick: onAccount
        }]
      : []),
    {
      title: zh ? "自动化" : "Automation",
      value: zh ? "排程 / 漂移 / Webhook" : "Schedules / Drift / Webhooks",
      meta: zh ? "在计划页配置排程、漂移检测与外发通知" : "Configure schedules, drift, and webhooks in Plans",
      icon: <Activity aria-hidden />,
      onClick: () => onJump?.("plans")
    },
    ...(authUser?.role === "admin"
      ? [{
          title: zh ? "用户与队列" : "Users & queues",
          value: zh ? "治理" : "Governance",
          meta: zh ? "在能力管理页管理用户、角色与执行队列" : "Manage users, roles, and queues in Capability Admin",
          icon: <ShieldCheck aria-hidden />,
          onClick: () => onJump?.("catalog")
        }]
      : [])
  ];

  return (
    <div className="dashboard-page console-dashboard">
      <section className="console-command-strip">
        <div>
          <p className="eyebrow">{zh ? "资源控制台" : "Resource console"}</p>
          <h2>{zh ? "从源环境到可审计报告的当前状态" : "Current state from source host to audited report"}</h2>
          <p>
            {zh
              ? "控制台聚焦工作流与资源状态；账号安全、自动化与治理入口见下方「账号与设置」，也可从右上角头像菜单进入。"
              : "Dashboard focuses on resources and workflow. Account security, automation, and governance shortcuts are in the section below, and also in the avatar menu."}
          </p>
        </div>
        <div className="console-command-actions">
          <StatusBadge tone={healthTone} label={failedPlans.length ? (zh ? "需要处理" : "Action needed") : (zh ? "运行正常" : "Operational")} />
          <Button variant="primary" onClick={() => onJump?.(nextStep.target)}>
            {nextStep.icon}
            {nextStep.action}
          </Button>
        </div>
      </section>

      <section className="resource-overview-grid" aria-label={zh ? "资源概览" : "Resource overview"}>
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
            <p className="eyebrow">{zh ? "运维流水线" : "Operations pipeline"}</p>
          <h3>{zh ? "迁移 / 构建 / 审查 / 执行 / 验证 / 报告" : "Migrate / Build / Review / Apply / Verify / Report"}</h3>
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
                <StatusBadge tone={stateToTone(step.state)} label={stateLabel(step.state, zh)} />
                <b>{step.metric}</b>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="operations-pipeline-panel account-settings-shortcuts">
        <div className="dashboard-section-heading">
          <div>
            <p className="eyebrow">{zh ? "账号与设置" : "Account & settings"}</p>
            <h3>{zh ? "账号安全 · 自动化 · 治理" : "Account security · Automation · Governance"}</h3>
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
          <Panel title={zh ? "运行队列" : "Runtime queue"} icon={<AlertTriangle aria-hidden />}>
            <div className="notice-list">
              {runtimeNotices.map((notice) => (
                <article className={`runtime-notice notice-${notice.tone ?? "neutral"}`} key={notice.title}>
                  <strong>{notice.title}</strong>
                  <p>{notice.body}</p>
                </article>
              ))}
            </div>
          </Panel>

          <Panel title={zh ? "最近计划活动" : "Recent plan activity"} icon={<Activity aria-hidden />}>
            <ListEmpty items={recentPlans} empty={zh ? "暂无计划。" : "No plans yet."}>
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
          <Panel title={zh ? "当前工作区" : "Workspace context"} icon={<CircleDot aria-hidden />}>
            <dl className="workspace-context-list">
              <div><dt>{zh ? "身份" : "Role"}</dt><dd>{authUser?.role ?? "guest"}</dd></div>
              <div><dt>{zh ? "连接数" : "Connections"}</dt><dd>{connections.length}</dd></div>
              <div><dt>{zh ? "证据项" : "Evidence"}</dt><dd>{evidenceCount}</dd></div>
              <div><dt>{zh ? "未读通知" : "Unread"}</dt><dd>{inboxUnreadCount}</dd></div>
            </dl>
          </Panel>

          <Panel title={zh ? "快照与报告" : "Snapshots and reports"} icon={<CheckCircle2 aria-hidden />}>
            <ListEmpty items={snapshots} empty={zh ? "暂无快照。" : "No snapshots yet."}>
              {(profile) => (
                <li key={profile.id}>
                  <span>
                    <strong>{zh ? profile.name : profile.nameEn}</strong>
                    <small>{new Date(profile.updatedAt).toLocaleString()}</small>
                  </span>
                </li>
              )}
            </ListEmpty>
            <ListEmpty items={reports} empty={zh ? "暂无报告。" : "No reports yet."}>
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
      {loading ? <p className="empty-hint">{zh ? "正在刷新计划..." : "Refreshing plans..."}</p> : null}
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
  if (state === "active") return "warning";
  return "neutral";
}

function stateLabel(state: PipelineState, zh: boolean): string {
  if (state === "done") return zh ? "完成" : "Done";
  if (state === "active") return zh ? "下一步" : "Next";
  if (state === "blocked") return zh ? "阻塞" : "Blocked";
  return zh ? "等待" : "Waiting";
}
