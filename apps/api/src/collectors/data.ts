/**
 * Collector: data (optional)
 * Discovers data directories and sizes.
 */

import type { CollectorResult } from "./types.js";
import type { CollectorModule, CollectorExecutor } from "./runner.js";

const DATA_DIRS = [
  "/var/lib/postgresql", "/var/lib/mysql", "/var/lib/mongodb",
  "/var/lib/redis", "/var/lib/gitea", "/var/lib/docker/volumes",
  "/var/www", "/srv", "/opt", "/home/*/data",
];

export const dataCollector: CollectorModule<string[]> = {
  canRun: () => true,
  async run(_host: string, executor: CollectorExecutor): Promise<CollectorResult<string[]>> {
    const commands: Array<{ command: string; exitCode?: number; timedOut?: boolean }> = [];
    const errors: string[] = [];
    const data: string[] = [];

    const pathList = DATA_DIRS.map(p => `"${p}"`).join(" ");
    const cmd = `for d in ${pathList}; do [ -d "$d" ] && echo "DATA_DIR size=$(du -sh "$d" 2>/dev/null | cut -f1) path=$d"; done; echo DONE`;

    try {
      const r = await executor.exec(cmd);
      commands.push({ command: "enumerate data dirs", exitCode: r.exitCode, timedOut: r.timedOut });
      const lines = r.stdout.trim().split("\n").filter(l => l && l !== "DONE");
      data.push(...lines);
    } catch (e) {
      errors.push("data enum: " + String(e));
    }

    return {
      id: "data",
      status: data.length > 0 ? "ok" : "partial",
      completeness: data.length > 0 ? 1 : 0.3,
      commands,
      errors,
      collectedAt: new Date().toISOString(),
      data
    };
  }
};
