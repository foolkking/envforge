/**
 * Collector: cron-timers (optional)
 * Enumerates cron jobs and systemd timers.
 */

import type { CollectorResult } from "./types.js";
import type { CollectorModule, CollectorExecutor } from "./runner.js";

export const cronTimersCollector: CollectorModule<string[]> = {
  canRun: () => true,
  async run(_host: string, executor: CollectorExecutor): Promise<CollectorResult<string[]>> {
    const commands: Array<{ command: string; exitCode?: number; timedOut?: boolean }> = [];
    const errors: string[] = [];
    const data: string[] = [];
    const scanCmds = [
      "crontab -l 2>/dev/null || echo NO_USER_CRON",
      "systemctl list-timers --no-pager --no-legend 2>/dev/null | head -20 || echo NO_TIMERS",
      "cat /etc/cron.d/* 2>/dev/null | grep -v '^#' | grep -v '^$' | head -20 || echo NO_CRON_D",
    ];

    for (const cmd of scanCmds) {
      try {
        const r = await executor.exec(cmd);
        commands.push({ command: cmd.slice(0, 60), exitCode: r.exitCode, timedOut: r.timedOut });
        const lines = r.stdout.trim().split("\n").filter(l => l && !l.startsWith("NO_"));
        data.push(...lines);
      } catch (e) {
        errors.push("cron: " + String(e));
      }
    }

    return {
      id: "cron-timers",
      status: data.length > 0 ? "ok" : "partial",
      completeness: data.length > 0 ? 1 : 0.3,
      commands,
      errors,
      collectedAt: new Date().toISOString(),
      data
    };
  }
};
