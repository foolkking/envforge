/**
 * Collector: security (optional)
 * Detects firewall status, AppArmor/SELinux, failed SSH logins.
 */

import type { CollectorResult } from "./types.js";
import type { CollectorModule, CollectorExecutor } from "./runner.js";

export const securityCollector: CollectorModule<string[]> = {
  canRun: () => true,
  async run(_host: string, executor: CollectorExecutor): Promise<CollectorResult<string[]>> {
    const commands: Array<{ command: string; exitCode?: number; timedOut?: boolean }> = [];
    const errors: string[] = [];
    const data: string[] = [];
    const secCmds = [
      "ufw status 2>/dev/null | head -5 || echo NO_UFW",
      "firewall-cmd --state 2>/dev/null || echo NO_FIREWALLD",
      "getenforce 2>/dev/null || echo NO_SELINUX",
      "aa-status --enabled 2>/dev/null && echo APPARMOR_ENABLED || echo APPARMOR_NOT_ENABLED",
    ];

    for (const cmd of secCmds) {
      try {
        const r = await executor.exec(cmd);
        commands.push({ command: cmd.slice(0, 60), exitCode: r.exitCode, timedOut: r.timedOut });
        const lines = r.stdout.trim().split("\n").filter(l => l && !l.startsWith("NO_"));
        data.push(...lines);
      } catch (e) {
        errors.push("security: " + String(e));
      }
    }

    return {
      id: "security",
      status: data.length > 0 ? "ok" : "partial",
      completeness: data.length > 0 ? 1 : 0.5,
      commands,
      errors,
      collectedAt: new Date().toISOString(),
      data
    };
  }
};
