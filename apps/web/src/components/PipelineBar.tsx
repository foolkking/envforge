import { useEffect, useState } from "react";
import { CheckCircle2, CircleDot, Circle, AlertTriangle } from "lucide-react";
import { listEnvironmentPlans, type AgentProbeResult, type ConnectionProfile, type PlanListEntry } from "../api";
import type { Locale, Page } from "../lib/types";
import { PIPELINE, pipelineStepForPage, type PipelineStepId } from "../lib/nav";

type PipelineState = "done" | "active" | "blocked" | "idle";

/**
 * Derives the six-step mainline state from app-level data. Mirrors the logic
 * in DashboardPage so the persistent bar and the dashboard panel agree, while
 * keeping the (working) dashboard untouched. Step metadata/order comes from
 * the shared PIPELINE constant in lib/nav.
 */
function usePipelineState(
  authToken: string,
  connections: ConnectionProfile[],
  activeConnection: ConnectionProfile | null,
  activeProbe: AgentProbeResult | null
): Record<PipelineStepId, PipelineState> {
  const [plans, setPlans] = useState<PlanListEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!authToken) {
      setPlans([]);
      return;
    }
    listEnvironmentPlans(authToken)
      .then((list) => { if (!cancelled) setPlans(list); })
      .catch(() => { if (!cancelled) setPlans([]); });
    return () => { cancelled = true; };
  }, [authToken]);

  const evidenceCount = activeProbe?.counts?.total ?? activeProbe?.software?.length ?? 0;
  const latestPlan = plans[0] ?? null;
  const pendingPlans = plans.filter((p) => p.status === "draft" || p.status === "needs-review");
  const approvedPlans = plans.filter((p) => p.status === "approved");
  const failedPlans = plans.filter((p) => p.status === "failed" || p.verifyResults.some((r) => r.status === "failed"));
  const reportStatuses: Array<NonNullable<PlanListEntry["status"]>> = ["succeeded", "failed", "rolled-back", "committed"];
  const reports = plans.filter((p) => (p.status ? reportStatuses.includes(p.status) : false));

  return {
    connect: activeConnection ? "done" : "active",
    snapshot: evidenceCount > 0 ? "done" : activeConnection ? "active" : "idle",
    build: latestPlan ? "done" : evidenceCount > 0 ? "active" : "idle",
    review: pendingPlans.length ? "active" : latestPlan ? "done" : "idle",
    apply: failedPlans.length ? "blocked" : approvedPlans.length ? "active" : "idle",
    report: reports.length ? "done" : "idle"
  };
}

function stateIcon(state: PipelineState) {
  if (state === "done") return <CheckCircle2 aria-hidden />;
  if (state === "blocked") return <AlertTriangle aria-hidden />;
  if (state === "active") return <CircleDot aria-hidden />;
  return <Circle aria-hidden />;
}

export function PipelineBar({
  authToken,
  locale,
  connections,
  activeConnection,
  activeProbe,
  currentPage,
  onNavigate
}: {
  authToken: string;
  locale: Locale;
  connections: ConnectionProfile[];
  activeConnection: ConnectionProfile | null;
  activeProbe: AgentProbeResult | null;
  currentPage: Page;
  onNavigate: (page: Page, view?: string) => void;
}) {
  const states = usePipelineState(authToken, connections, activeConnection, activeProbe);
  const activeStepId = pipelineStepForPage(currentPage);
  const zh = locale === "zh";

  return (
    <nav className="pipeline-bar" aria-label={zh ? "运维流水线" : "Operations pipeline"}>
      <span className="pipeline-bar-eyebrow">{zh ? "流程" : "Flow"}</span>
      <ol className="pipeline-bar-track">
        {PIPELINE.map((step, index) => {
          const state = states[step.id];
          const isCurrent = step.id === activeStepId;
          return (
            <li key={step.id} className="pipeline-bar-item">
              <button
                type="button"
                className={`pipeline-bar-step state-${state}${isCurrent ? " is-current" : ""}`}
                aria-current={isCurrent ? "step" : undefined}
                title={step.label[locale]}
                onClick={() => onNavigate(step.page, step.view)}
              >
                <span className="pipeline-bar-index">{index + 1}</span>
                <span className="pipeline-bar-icon">{stateIcon(state)}</span>
                <span className="pipeline-bar-label">{step.label[locale]}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
