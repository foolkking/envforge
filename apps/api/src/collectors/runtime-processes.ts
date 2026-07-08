/**
 * Collector: runtime-processes (optional)
 * Enumerates running processes via ps.
 */

import type { CollectorResult } from "./types.js";
import type { CollectorModule, CollectorExecutor } from "./runner.js";

export const runtimeProcessesCollector: CollectorModule<string[]> = {
  canRun: () => true,
  async run(_host: string, executor: CollectorExecutor): Promise<CollectorResult<string[]>> {
    const commands: Array<{ command: string; exitCode?: number; timedOut?: boolean }> = [];
    const errors: string[] = [];
    const data: string[] = [];

    try {
      const r = await executor.exec("ps aux --no-headers 2>/dev/null | awk '{print $2,$1,$11}' | head -100 || echo NO_PS");
      commands.push({ command: "ps aux", exitCode: r.exitCode, timedOut: r.timedOut });
      const lines = r.stdout.trim().split("\n").filter(l => l && l !== "NO_PS");
      data.push(...lines);
    } catch (e) {
      errors.push("ps: " + String(e));
    }

    return {
      id: "runtime-processes",
      status: data.length > 0 ? "ok" : "partial",
      completeness: data.length > 0 ? 1 : 0.3,
      commands,
      errors,
      collectedAt: new Date().toISOString(),
      data
    };
  }
};
