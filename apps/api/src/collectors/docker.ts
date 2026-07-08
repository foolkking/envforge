/**
 * Collector: docker (required)
 * Detects Docker containers and images.
 */

import type { CollectorResult } from "./types.js";
import type { CollectorModule, CollectorExecutor } from "./runner.js";

export const dockerCollector: CollectorModule<string[]> = {
  canRun: () => true,
  async run(_host: string, executor: CollectorExecutor): Promise<CollectorResult<string[]>> {
    const commands: Array<{ command: string; exitCode?: number; timedOut?: boolean }> = [];
    const errors: string[] = [];
    const data: string[] = [];

    const dockerCmds = ["docker ps -a --format '{{.ID}}|{{.Image}}|{{.Status}}|{{.Names}}' 2>/dev/null", "docker images --format '{{.Repository}}:{{.Tag}}|{{.ID}}' 2>/dev/null"];

    for (const cmd of dockerCmds) {
      try {
        const r = await executor.exec(cmd);
        commands.push({ command: cmd.slice(0, 60), exitCode: r.exitCode, timedOut: r.timedOut });
        if (r.exitCode !== 0) errors.push(`docker cmd exited ${r.exitCode}`);
        if (r.stdout.trim()) data.push(...r.stdout.trim().split("\n"));
      } catch (e) {
        errors.push("docker: " + String(e));
      }
    }

    const succeeded = commands.filter(c => (c.exitCode ?? 0) === 0).length;
    return {
      id: "docker",
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
