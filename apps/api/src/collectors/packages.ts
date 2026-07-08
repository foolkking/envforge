/**
 * Collector: packages (required)
 *
 * Wraps existing apt/rpm/snap/flatpak/npm/pip/gem/cargo/local-bin evidence.
 * In production this runs the full remote-collector script; here we provide
 * the module contract so a future parallel runner can invoke just this section.
 */

import type { CollectorResult } from "./types.js";
import type { CollectorModule, CollectorExecutor } from "./runner.js";

export const packagesCollector: CollectorModule<string[]> = {
  canRun: () => true,
  async run(_host: string, executor: CollectorExecutor): Promise<CollectorResult<string[]>> {
    const start = Date.now();
    const commands: Array<{ command: string; exitCode?: number; timedOut?: boolean }> = [];
    const errors: string[] = [];
    const data: string[] = [];
    const sources = ["apt-mark showmanual", "rpm -qa --qf '%{NAME}|%{VERSION}\n'", "snap list", "flatpak list --app", "npm list -g --depth=0 2>/dev/null", "pip3 list --format=columns 2>/dev/null | tail -n +3", "gem list --local 2>/dev/null"];

    for (const cmd of sources) {
      try {
        const r = await executor.exec(cmd);
        commands.push({ command: cmd, exitCode: r.exitCode, timedOut: r.timedOut });
        if (r.exitCode !== 0 && r.exitCode !== undefined) {
          errors.push(`${cmd.split(" ")[0]} collection exited ${r.exitCode}`);
        }
        if (r.stdout.trim()) data.push(...r.stdout.trim().split("\n").map(l => `[${cmd.split(" ")[0]}] ${l}`));
      } catch (e) {
        errors.push(`${cmd.split(" ")[0]}: ${String(e)}`);
      }
    }

    const succeeded = commands.filter((c) => (c.exitCode ?? 0) === 0 || !c.exitCode).length;
    const completeness = commands.length === 0 ? 0
      : Math.max(0, Math.min(1, succeeded / commands.length));

    return {
      id: "packages",
      status: errors.length === 0 ? "ok"
        : succeeded >= commands.length * 0.5 ? "partial"
        : "failed",
      completeness: Math.round(completeness * 100) / 100,
      commands,
      errors,
      collectedAt: new Date().toISOString(),
      data
    };
  }
};
