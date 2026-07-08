/**
 * Collector: systemd (required)
 * Detects enabled and running systemd services.
 */

import type { CollectorResult } from "./types.js";
import type { CollectorModule, CollectorExecutor } from "./runner.js";

export const systemdCollector: CollectorModule<string[]> = {
  canRun: () => true,
  async run(_host: string, executor: CollectorExecutor): Promise<CollectorResult<string[]>> {
    const commands: Array<{ command: string; exitCode?: number; timedOut?: boolean }> = [];
    const errors: string[] = [];
    const data: string[] = [];

    const cmds: Array<[string, string]> = [
      ["systemctl list-units --type=service --state=running --no-legend --no-pager 2>/dev/null | awk '{print $1}'", "running"],
      ["systemctl list-unit-files --type=service --state=enabled --no-legend --no-pager 2>/dev/null | awk '{print $1}'", "enabled"],
    ];

    for (const [cmd, label] of cmds) {
      try {
        const r = await executor.exec(cmd);
        commands.push({ command: `systemctl list ${label}`, exitCode: r.exitCode, timedOut: r.timedOut });
        if (r.exitCode !== 0) errors.push(`systemctl ${label} exited ${r.exitCode}`);
        if (r.stdout.trim()) data.push(...r.stdout.trim().split("\n").map(l => `[${label}] ${l}`));
      } catch (e) {
        errors.push(`systemd ${label}: ${String(e)}`);
      }
    }

    const succeeded = commands.filter(c => (c.exitCode ?? 0) === 0).length;
    return {
      id: "systemd",
      status: succeeded === commands.length ? "ok"
        : succeeded > 0 ? "partial"
        : "failed",
      completeness: commands.length === 0 ? 0 : Math.round((succeeded / commands.length) * 100) / 100,
      commands,
      errors,
      collectedAt: new Date().toISOString(),
      data
    };
  }
};
