/**
 * Collector: compose (optional)
 * Tries to find docker-compose.yml files and inspect running Compose stacks.
 * Skipped when Docker is not installed.
 */

import type { CollectorResult } from "./types.js";
import type { CollectorModule, CollectorExecutor } from "./runner.js";

export const composeCollector: CollectorModule<string[]> = {
  canRun: async (): Promise<boolean> => {
    return true; // compose collector always attempts; docker may not be present
  },
  async run(_host: string, executor: CollectorExecutor): Promise<CollectorResult<string[]>> {
    const commands: Array<{ command: string; exitCode?: number; timedOut?: boolean }> = [];
    const errors: string[] = [];
    const data: string[] = [];
    let foundCompose = false;

    // docker compose ls (modern CLI)
    try {
      const r = await executor.exec("docker compose ls 2>/dev/null || docker-compose ls 2>/dev/null || echo NO_COMPOSE_LS");
      commands.push({ command: "docker compose ls", exitCode: r.exitCode, timedOut: r.timedOut });
      const lines = r.stdout.trim().split("\n").filter(l => l && l !== "NO_COMPOSE_LS");
      if (lines.length > 0) { foundCompose = true; data.push(...lines.map(l => `[compose-ls] ${l}`)); }
    } catch (e) {
      errors.push("docker compose ls: " + String(e));
    }

    // Search for compose files in common locations
    try {
      const r = await executor.exec("find /home /opt /srv /root -maxdepth 4 -name 'docker-compose*.yml' -o -name 'compose*.yaml' 2>/dev/null | head -20 || echo NO_FIND");
      commands.push({ command: "find compose files", exitCode: r.exitCode, timedOut: r.timedOut });
      const lines = r.stdout.trim().split("\n").filter(l => l && l !== "NO_FIND");
      if (lines.length > 0) { foundCompose = true; data.push(...lines.map(l => `[compose-file] ${l}`)); }
    } catch (e) {
      errors.push("find compose files: " + String(e));
    }

    return {
      id: "compose",
      status: foundCompose ? "ok" : "partial",
      completeness: foundCompose ? 1 : 0.5,
      commands,
      errors,
      collectedAt: new Date().toISOString(),
      data
    };
  }
};
