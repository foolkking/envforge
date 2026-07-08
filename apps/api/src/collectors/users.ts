/**
 * Collector: users (optional)
 * Enumerates non-system users and groups.
 */

import type { CollectorResult } from "./types.js";
import type { CollectorModule, CollectorExecutor } from "./runner.js";

export const usersCollector: CollectorModule<string[]> = {
  canRun: () => true,
  async run(_host: string, executor: CollectorExecutor): Promise<CollectorResult<string[]>> {
    const commands: Array<{ command: string; exitCode?: number; timedOut?: boolean }> = [];
    const errors: string[] = [];
    const data: string[] = [];

    // Non-system users (UID >= 1000, < 65534)
    try {
      const r = await executor.exec("awk -F: '$3>=1000 && $3<65534{print $1\":\"$6\":\"$7}' /etc/passwd 2>/dev/null || echo NO_PASSWD");
      commands.push({ command: "awk /etc/passwd", exitCode: r.exitCode, timedOut: r.timedOut });
      const lines = r.stdout.trim().split("\n").filter(l => l && l !== "NO_PASSWD");
      data.push(...lines.map(l => `[user] ${l}`));
    } catch (e) {
      errors.push("users: " + String(e));
    }

    // Groups
    try {
      const r = await executor.exec("getent group docker sudo admin 2>/dev/null || echo NO_GROUPS");
      commands.push({ command: "getent group", exitCode: r.exitCode, timedOut: r.timedOut });
      const lines = r.stdout.trim().split("\n").filter(l => l && l !== "NO_GROUPS");
      data.push(...lines.map(l => `[group] ${l}`));
    } catch (e) {
      errors.push("groups: " + String(e));
    }

    return {
      id: "users",
      status: data.length > 0 ? "ok" : "partial",
      completeness: data.length > 0 ? 1 : 0.3,
      commands,
      errors,
      collectedAt: new Date().toISOString(),
      data
    };
  }
};
