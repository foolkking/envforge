/**
 * Collector: network (required)
 * Detects listening ports via ss.
 */

import type { CollectorResult } from "./types.js";
import type { CollectorModule, CollectorExecutor } from "./runner.js";

export const networkCollector: CollectorModule<string[]> = {
  canRun: () => true,
  async run(_host: string, executor: CollectorExecutor): Promise<CollectorResult<string[]>> {
    const commands: Array<{ command: string; exitCode?: number; timedOut?: boolean }> = [];
    const errors: string[] = [];
    const data: string[] = [];

    try {
      const r = await executor.exec("ss -tlnp 2>/dev/null | awk 'NR>1{print $4,$6}' || echo NO_SS");
      commands.push({ command: "ss -tlnp", exitCode: r.exitCode, timedOut: r.timedOut });

      const lines = r.stdout.trim().split("\n").filter(l => l && l !== "NO_SS");
      data.push(...lines);
      if (lines.length === 0) errors.push("no listening ports detected (or ss unavailable)");
    } catch (e) {
      errors.push("ss: " + String(e));
    }

    return {
      id: "network",
      status: errors.length === 0 ? "ok"
        : data.length > 0 ? "partial"
        : "failed",
      completeness: errors.length === 0 ? 1
        : data.length > 0 ? 0.5
        : 0,
      commands,
      errors,
      collectedAt: new Date().toISOString(),
      data
    };
  }
};
