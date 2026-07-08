/**
 * Collector: OS (required)
 *
 * Collects hostname, uname, OS-release, CPU, memory, disk, uptime.
 * All from the unified bash script sections we already parse — this
 * is a thin typed wrapper over the existing remote-collector.
 */

import type { CollectorResult } from "./types.js";
import type { CollectorModule, CollectorExecutor } from "./runner.js";

export const osCollector: CollectorModule<string[]> = {
  canRun: () => true,
  async run(host: string, executor: CollectorExecutor): Promise<CollectorResult<string[]>> {
    const start = Date.now();
    const commands: Array<{ command: string; exitCode?: number; timedOut?: boolean }> = [];
    const errors: string[] = [];
    const data: string[] = [];

    // hostname
    {
      try {
        const r = await executor.exec("hostname");
        commands.push({ command: "hostname", exitCode: r.exitCode, timedOut: r.timedOut });
        if (r.exitCode !== 0) errors.push("hostname exited non-zero");
        data.push("hostname=" + r.stdout.trim());
      } catch (e) {
        errors.push("hostname: " + String(e));
      }
    }

    // uname
    {
      try {
        const r = await executor.exec("uname -s && uname -m && uname -r");
        commands.push({ command: "uname -s/-m/-r", exitCode: r.exitCode, timedOut: r.timedOut });
        if (r.exitCode !== 0) errors.push("uname exited non-zero");
        data.push("uname=" + r.stdout.trim());
      } catch (e) {
        errors.push("uname: " + String(e));
      }
    }

    // CPU
    {
      try {
        const r = await executor.exec("nproc && cat /proc/cpuinfo 2>/dev/null | grep -m1 'model name' | cut -d: -f2 | xargs");
        commands.push({ command: "nproc; cpuinfo", exitCode: r.exitCode, timedOut: r.timedOut });
        data.push("cpu=" + r.stdout.trim());
      } catch (e) {
        errors.push("cpu: " + String(e));
      }
    }

    // Memory
    {
      try {
        const r = await executor.exec("free -b 2>/dev/null | awk '/^Mem:/{print $2,$4}'");
        commands.push({ command: "free -b", exitCode: r.exitCode, timedOut: r.timedOut });
        data.push("memory(" + r.stdout.trim() + ")");
      } catch (e) {
        errors.push("memory: " + String(e));
      }
    }

    // Disk
    {
      try {
        const r = await executor.exec("df -h / 2>/dev/null | tail -1 | awk '{print $2\"|\"$3\"|\"$4\"|\"$5}'");
        commands.push({ command: "df -h /", exitCode: r.exitCode, timedOut: r.timedOut });
        data.push("disk(" + r.stdout.trim() + ")");
      } catch (e) {
        errors.push("disk: " + String(e));
      }
    }

    // os-release
    {
      try {
        const r = await executor.exec("cat /etc/os-release 2>/dev/null | grep -E '^(PRETTY_NAME|ID|VERSION_ID)=' | head -3");
        commands.push({ command: "cat /etc/os-release", exitCode: r.exitCode, timedOut: r.timedOut });
        data.push(...r.stdout.trim().split("\n").filter(Boolean));
      } catch (e) {
        errors.push("os-release: " + String(e));
      }
    }

    // uptime
    {
      try {
        const r = await executor.exec("uptime -p 2>/dev/null");
        commands.push({ command: "uptime -p", exitCode: r.exitCode, timedOut: r.timedOut });
        data.push("uptime=" + r.stdout.trim());
      } catch (e) {
        errors.push("uptime: " + String(e));
      }
    }

    const failedCommands = commands.filter((c) => (c.exitCode ?? 0) !== 0 || c.timedOut).length;
    const completeness = commands.length === 0 ? 0
      : Math.max(0, 1 - (failedCommands / commands.length + errors.length * 0.1));

    return {
      id: "os",
      status: errors.length > 1 ? (failedCommands > 0 ? "failed" : "partial")
        : errors.length === 1 && data.length > 0 ? "partial"
        : "ok",
      completeness: Math.round(completeness * 100) / 100,
      commands,
      errors,
      collectedAt: new Date().toISOString(),
      data
    };
  }
};
