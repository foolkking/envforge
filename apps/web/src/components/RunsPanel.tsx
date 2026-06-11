import { useEffect, useState } from "react";
import { fetchTaskHistory, type TaskHistoryEntry } from "../api";
import type { Locale } from "../lib/types";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";

/**
 * RunsPanel — execution history for the Plans center "Runs" tab.
 *
 * Reads `/api/tasks` (fetchTaskHistory) and renders each run with its
 * step states, duration, and failure reason. Reuses the existing
 * `.task-history-*` styles. Replaces the former empty PlanOpsPanel
 * placeholder.
 */
function statusIcon(status: TaskHistoryEntry["status"]): string {
  switch (status) {
    case "succeeded": return "✓";
    case "failed": return "✗";
    case "cancelled": return "⊘";
    default: return "●";
  }
}

export function RunsPanel({ authToken, locale }: { authToken: string; locale: Locale }) {
  const zh = locale === "zh";
  const [runs, setRuns] = useState<TaskHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setRuns(await fetchTaskHistory(authToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load runs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [authToken]);

  return (
    <section className="settings-section" data-testid="plans-runs-tab">
      <div className="settings-section-header">
        <h3>{zh ? "执行记录" : "Runs"}</h3>
        <Button variant="ghost" onClick={() => void load()} disabled={loading}>
          {loading ? (zh ? "刷新中..." : "Refreshing...") : (zh ? "刷新" : "Refresh")}
        </Button>
      </div>
      <p className="settings-help">
        {zh
          ? "环境计划与能力的执行历史，含步骤状态、耗时与失败原因。"
          : "Execution history of Environment Plans and capabilities, with step status, duration, and failure reasons."}
      </p>
      {error ? <p className="connection-error">{error}</p> : null}
      {runs.length === 0 && !loading ? (
        <p className="empty-hint">{zh ? "暂无执行记录。" : "No runs yet."}</p>
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
                    {run.dryRun ? <Badge tone="info">{zh ? "预演" : "dry-run"}</Badge> : null}
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
