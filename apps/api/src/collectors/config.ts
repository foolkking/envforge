/**
 * Collector: config (optional)
 * Discovers config files from common paths.
 */

import type { CollectorResult } from "./types.js";
import type { CollectorModule, CollectorExecutor } from "./runner.js";

const CONFIG_PATHS = [
  "/etc/nginx", "/etc/apache2", "/etc/caddy", "/etc/postgresql", "/etc/mysql",
  "/etc/redis", "/etc/mongod", "/etc/gitea", "/etc/ssh/sshd_config",
  "/etc/ufw", "/etc/fail2ban", "/etc/systemd/system",
];

export const configCollector: CollectorModule<string[]> = {
  canRun: () => true,
  async run(_host: string, executor: CollectorExecutor): Promise<CollectorResult<string[]>> {
    const commands: Array<{ command: string; exitCode?: number; timedOut?: boolean }> = [];
    const errors: string[] = [];
    const data: string[] = [];

    const pathList = CONFIG_PATHS.map(p => `"${p}"`).join(" ");
    const cmd = `for d in ${pathList}; do [ -d "$d" ] && echo "DIR: $d" && ls "$d"/*.conf "$d"/*.yml "$d"/*.yaml "$d"/*.toml "$d"/conf.d/*.conf 2>/dev/null | head -20; done; echo DONE`;

    try {
      const r = await executor.exec(cmd);
      commands.push({ command: "enumerate config dirs", exitCode: r.exitCode, timedOut: r.timedOut });
      const lines = r.stdout.trim().split("\n").filter(l => l && l !== "DONE");
      data.push(...lines);
    } catch (e) {
      errors.push("config enum: " + String(e));
    }

    return {
      id: "config",
      status: errors.length === 0 && data.length > 0 ? "ok"
        : data.length > 0 ? "partial" : "partial",
      completeness: data.length > 0 ? 1 : errors.length === 0 ? 0.3 : 0,
      commands,
      errors,
      collectedAt: new Date().toISOString(),
      data
    };
  }
};
