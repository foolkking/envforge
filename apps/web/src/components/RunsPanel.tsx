import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { commandPhase2Run, fetchTaskHistory, listPhase1Projects, listPhase2Runs, type Phase2Run, type TaskHistoryEntry } from "../api";
import type { Locale } from "../lib/types";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

/** Execution history for the Plans center Runs tab. */
function statusIcon(status: TaskHistoryEntry["status"]): string {
  switch (status) {
    case "succeeded": return "✓";
    case "failed": return "✕";
    case "cancelled": return "⊘";
    default: return "●";
  }
}

export function RunsPanel({ authToken }: { authToken: string; locale: Locale }) {
  const { t } = useTranslation();
  const [runs, setRuns] = useState<TaskHistoryEntry[]>([]);
  const [durableRuns, setDurableRuns] = useState<Phase2Run[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const projects=await listPhase1Projects(authToken);
      const [legacy,durable]=await Promise.all([fetchTaskHistory(authToken),Promise.all(projects.map(project=>listPhase2Runs(authToken,project.workspaceId,project.id)))]);
      setRuns(legacy);setDurableRuns(durable.flat());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("runs.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [authToken]);
  async function command(run:Phase2Run,action:"pause"|"resume"|"cancel"){setLoading(true);setError("");try{await commandPhase2Run(authToken,run,action,t(`runs.durable.${action}Reason`));await load();}catch(err){setError(err instanceof Error?err.message:t("runs.loadFailed"));setLoading(false);}}

  return (
    <section className="settings-section" data-testid="plans-runs-tab">
      <div className="settings-section-header">
        <h3>{t("runs.title")}</h3>
        <Button variant="ghost" onClick={() => void load()} disabled={loading}>
          {loading ? t("runs.refreshing") : t("runs.refresh")}
        </Button>
      </div>
      <p className="settings-help">{t("runs.intro")}</p>
      {error ? <p className="connection-error">{error}</p> : null}
      <div className="task-history-list" data-testid="durable-runs-list">
        <h4>{t("runs.durable.title")}</h4>
        {durableRuns.length===0&&!loading?<p className="empty-hint">{t("runs.durable.empty")}</p>:durableRuns.map(run=><article key={run.id} className={`task-history-entry status-${run.state}`}>
          <div className="task-history-header"><Badge tone={run.state==="succeeded"?"ok":run.state==="failed"||run.state==="attention-required"?"danger":"info"}>{t(`runs.durable.states.${run.state}`,{defaultValue:run.state})}</Badge><strong>{run.runType}</strong><span className="task-history-time">{new Date(run.createdAt).toLocaleString()}</span></div>
          <div className="task-history-steps"><code title={run.planHash}>{t("runs.durable.planHash")}: {run.planHash.slice(0,12)}</code><code title={run.approvalHash}>{t("runs.durable.approvalHash")}: {run.approvalHash.slice(0,12)}</code><span>v{run.version}</span></div>
          <div className="task-history-meta">{["running","waiting"].includes(run.state)?<Button variant="ghost" onClick={()=>void command(run,"pause")} disabled={loading}>{t("runs.durable.pause")}</Button>:null}{run.state==="paused"?<Button variant="ghost" onClick={()=>void command(run,"resume")} disabled={loading}>{t("runs.durable.resume")}</Button>:null}{["queued","running","waiting","paused"].includes(run.state)?<Button variant="ghost" onClick={()=>void command(run,"cancel")} disabled={loading}>{t("runs.durable.cancel")}</Button>:null}</div>
        </article>)}
      </div>
      {runs.length === 0 && !loading ? (
        <p className="empty-hint">{t("runs.empty")}</p>
      ) : (
        <div className="task-history-list">
          {runs.map((run) => {
            const durationMs = run.completedAt
              ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
              : null;
            return (
              <article key={run.id} className={`task-history-entry status-${run.status}`}>
                <div className="task-history-header">
                  <span className={`task-history-status status-${run.status}`}>{statusIcon(run.status)}</span>
                  <span className="task-history-source">{run.source}</span>
                  <div className="task-history-meta">
                    {run.dryRun ? <Badge tone="info">{t("runs.dryRun")}</Badge> : null}
                    <span className="task-history-time">{new Date(run.startedAt).toLocaleString()}</span>
                    {durationMs != null ? <span className="task-history-duration">{(durationMs / 1000).toFixed(1)}s</span> : null}
                  </div>
                </div>
                {run.error ? <div className="task-history-error">{run.error}</div> : null}
                {run.steps.length > 0 ? (
                  <div className="task-history-steps">
                    {run.steps.map((step, index) => (
                      <span key={index} className={`task-history-step step-${step.status}`} title={step.msg}>{step.name}</span>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
