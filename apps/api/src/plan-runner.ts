/**
 * plan-runner.ts — verify / rollback executors for Environment Plans.
 *
 * The `/api/plans/:id/verify` and `/api/plans/:id/rollback` routes used to
 * return placeholder lists of actions. P0 promotes them to real executors
 * that talk to the target VM through SSH and record per-action outcomes
 * back onto the persisted plan.
 *
 * Each executor walks the plan's actions, runs the appropriate verify or
 * rollback step, and returns structured results that the UI can render.
 *
 * Safety:
 *  - We refuse to run anything against a plan whose `targetConnectionId`
 *    does not belong to the caller's user.
 *  - Verify never mutates the target. Rollback may mutate (restore backups,
 *    uninstall packages installed during apply), but only for actions whose
 *    `canRollback` flag was set when the plan was generated.
 *  - All output is truncated and stored on the plan record so subsequent
 *    reads of the plan can show the most recent run.
 */

import type { Client as SshClient } from "ssh2";
import type { EnvironmentPlan, EnvironmentPlanAction } from "./environment-plan.js";
import { restoreConfigFileFromBackup, validateConfigFile } from "./config-files.js";
import { Ssh2Executor } from "./engine/ssh-executor.js";
import type { StoredConnection } from "./runtime-store.js";
import {
  appendPlanHistory,
  asEnvironmentPlan,
  getEnvironmentPlan,
  mutateEnvironmentPlan,
  type StoredPlanRollbackResult,
  type StoredPlanVerifyResult
} from "./plan-store.js";

const MAX_OUTPUT = 4_000;

function truncate(text: string | undefined): string | undefined {
  if (!text) return text;
  if (text.length <= MAX_OUTPUT) return text;
  return `${text.slice(0, MAX_OUTPUT)}\n…[truncated]`;
}

async function execOnTarget(client: SshClient, command: string, timeoutMs = 20_000) {
  const executor = new Ssh2Executor(client);
  return executor.exec(command, timeoutMs);
}

/**
 * Run every `validate`-kind action plus any explicit `verify` command attached
 * to other actions. Returns one result per executed check.
 */
export async function runPlanVerify(input: {
  client: SshClient;
  plan: EnvironmentPlan;
}): Promise<StoredPlanVerifyResult[]> {
  const results: StoredPlanVerifyResult[] = [];
  const now = () => new Date().toISOString();

  for (const item of input.plan.items) {
    for (const action of item.actions) {
      // Collect every verify command for the action: structured verifySpec
      // wins; fall back to the legacy `verify` string and to the action's
      // own command for `validate` kind.
      const checks: Array<{ command: string; allowFailure?: boolean; description?: string }> = [];
      if (action.verifySpec?.command) checks.push({ command: action.verifySpec.command });
      for (const c of action.verifySpec?.checks ?? []) checks.push(c);
      if (checks.length === 0) {
        const legacyCommand = action.kind === "validate" ? action.command : action.verify;
        if (legacyCommand) checks.push({ command: legacyCommand });
      }
      if (checks.length === 0) {
        if (action.kind === "validate") {
          results.push({
            actionId: action.id,
            label: action.label,
            status: "skipped",
            message: "No verify command attached to this action.",
            ranAt: now()
          });
        }
        continue;
      }
      let aggregateStatus: "passed" | "warning" | "failed" = "passed";
      const outputs: string[] = [];
      const messages: string[] = [];
      try {
        for (const check of checks) {
          const { stdout, stderr, exitCode } = await execOnTarget(input.client, check.command);
          if (stdout || stderr) outputs.push(`$ ${check.command}\n${stdout}\n${stderr}`.trim());
          if (exitCode === 0) continue;
          if (check.allowFailure) {
            aggregateStatus = aggregateStatus === "failed" ? "failed" : "warning";
            messages.push(`${check.description ?? check.command}: exit ${exitCode} (allowFailure)`);
          } else {
            aggregateStatus = "failed";
            messages.push(`${check.description ?? check.command}: exit ${exitCode}`);
            break;
          }
        }
        results.push({
          actionId: action.id,
          label: action.label,
          status: aggregateStatus === "passed"
            ? "passed"
            : aggregateStatus === "warning"
            ? "warning"
            : "failed",
          message: aggregateStatus === "passed"
            ? "All verify checks passed."
            : messages.join("; "),
          output: truncate(outputs.join("\n").trim()),
          ranAt: now()
        });
      } catch (err) {
        results.push({
          actionId: action.id,
          label: action.label,
          status: "failed",
          message: err instanceof Error ? err.message : String(err),
          ranAt: now()
        });
      }
    }
  }

  return results;
}

/**
 * Roll back what a Plan changed. We honour each action's declared
 * rollback strategy:
 *
 *  - `writeConfig` / `copyConfig`: restore the EnvForge backup of the file.
 *  - `installPackage`: remove the package via the target's package manager.
 *  - `restart`: leave the user a manual instruction (we never auto-stop
 *    arbitrary services here).
 *  - actions with an explicit `rollback` command: run that command.
 *  - other reviewable actions: record as skipped.
 */
export async function runPlanRollback(input: {
  client: SshClient;
  plan: EnvironmentPlan;
  connection: StoredConnection;
}): Promise<StoredPlanRollbackResult[]> {
  const results: StoredPlanRollbackResult[] = [];
  const now = () => new Date().toISOString();

  // Walk actions in reverse so we undo in the opposite order they were applied.
  const actions: Array<{ itemName: string; action: EnvironmentPlanAction }> = [];
  for (const item of input.plan.items) {
    for (const action of item.actions) actions.push({ itemName: item.name, action });
  }

  for (let i = actions.length - 1; i >= 0; i--) {
    const { action } = actions[i];
    if (!action.canRollback) {
      results.push({ actionId: action.id, label: action.label, status: "skipped", message: "Action has no rollback path.", ranAt: now() });
      continue;
    }

    try {
      // Structured rollbackSpec wins over legacy `rollback` string.
      const spec = action.rollbackSpec;
      if (spec?.restoreBackupOf) {
        const restored = await restoreConfigFileFromBackup(input.connection, spec.restoreBackupOf);
        const passed = restored.success !== false;
        results.push({
          actionId: action.id,
          label: action.label,
          status: passed ? "passed" : "failed",
          message: restored.message ?? (passed ? "Restored EnvForge backup." : "Restore failed."),
          ranAt: now()
        });
        continue;
      }
      if (spec?.removeInstalledPackages?.length) {
        const list = spec.removeInstalledPackages.join(" ");
        const cmd = `sudo apt-get -y remove ${list} 2>/dev/null || sudo dnf -y remove ${list} 2>/dev/null || sudo pacman -R --noconfirm ${list} 2>/dev/null || sudo apk del ${list}`;
        const { stdout, stderr, exitCode } = await execOnTarget(input.client, cmd, 60_000);
        if (spec.reloadServices?.length) {
          for (const svc of spec.reloadServices) {
            await execOnTarget(input.client, `sudo systemctl reload ${svc} 2>/dev/null || sudo systemctl restart ${svc} 2>/dev/null || true`).catch(() => undefined);
          }
        }
        results.push({
          actionId: action.id,
          label: action.label,
          status: exitCode === 0 ? "passed" : "failed",
          message: exitCode === 0 ? "Packages removed." : `Package removal returned exit ${exitCode}.`,
          output: truncate(`${stdout}\n${stderr}`.trim()),
          ranAt: now()
        });
        continue;
      }
      if (spec?.command) {
        const { stdout, stderr, exitCode } = await execOnTarget(input.client, spec.command);
        results.push({
          actionId: action.id,
          label: action.label,
          status: exitCode === 0 ? "passed" : "failed",
          message: exitCode === 0 ? "Rollback command succeeded." : `Rollback exited ${exitCode}.`,
          output: truncate(`${stdout}\n${stderr}`.trim()),
          ranAt: now()
        });
        continue;
      }

      // Fall back to historical heuristics for plans built before the
      // structured spec existed.
      if ((action.kind === "writeConfig" || action.kind === "copyConfig" || action.kind === "backupFile" || action.kind === "restoreFile") && action.path) {
        const restored = await restoreConfigFileFromBackup(input.connection, action.path);
        const passed = restored.success !== false;
        results.push({
          actionId: action.id,
          label: action.label,
          status: passed ? "passed" : "failed",
          message: restored.message ?? (passed ? "Config restored from EnvForge backup." : "Restore failed."),
          ranAt: now()
        });
        continue;
      }

      if (action.kind === "installPackage" && action.packageNames?.length) {
        const list = action.packageNames.join(" ");
        const cmd = `sudo apt-get -y remove ${list} 2>/dev/null || sudo dnf -y remove ${list} 2>/dev/null || sudo pacman -R --noconfirm ${list} 2>/dev/null || sudo apk del ${list}`;
        const { stdout, stderr, exitCode } = await execOnTarget(input.client, cmd, 60_000);
        results.push({
          actionId: action.id,
          label: action.label,
          status: exitCode === 0 ? "passed" : "failed",
          message: exitCode === 0 ? "Packages removed." : `Package removal returned exit ${exitCode}.`,
          output: truncate(`${stdout}\n${stderr}`.trim()),
          ranAt: now()
        });
        continue;
      }

      if (action.rollback) {
        const { stdout, stderr, exitCode } = await execOnTarget(input.client, action.rollback);
        results.push({
          actionId: action.id,
          label: action.label,
          status: exitCode === 0 ? "passed" : "failed",
          message: exitCode === 0 ? "Rollback command succeeded." : `Rollback exited ${exitCode}.`,
          output: truncate(`${stdout}\n${stderr}`.trim()),
          ranAt: now()
        });
        continue;
      }

      if ((action.kind === "restartService" || action.kind === "reloadService" || action.kind === "enableService" || action.kind === "restart") && action.serviceName) {
        results.push({
          actionId: action.id,
          label: action.label,
          status: "skipped",
          message: `Service ${action.serviceName} state change is not auto-rolled back; review manually.`,
          ranAt: now()
        });
        continue;
      }

      results.push({
        actionId: action.id,
        label: action.label,
        status: "skipped",
        message: "No rollback strategy was registered for this action kind.",
        ranAt: now()
      });
    } catch (err) {
      results.push({
        actionId: action.id,
        label: action.label,
        status: "failed",
        message: err instanceof Error ? err.message : String(err),
        ranAt: now()
      });
    }
  }

  return results;
}

/**
 * High-level helper used by the `/api/plans/:id/verify` route: opens a
 * connection, runs verify, persists the results onto the plan, and returns
 * them along with the refreshed plan record.
 */
export async function verifyPlanAndPersist(input: {
  planId: string;
  userId: string;
  connection: StoredConnection;
  openClient: () => Promise<SshClient>;
}): Promise<{ results: StoredPlanVerifyResult[]; plan: EnvironmentPlan } | undefined> {
  const record = await getEnvironmentPlan(input.planId, input.userId);
  if (!record) return undefined;
  const plan = asEnvironmentPlan(record);
  const client = await input.openClient();
  let results: StoredPlanVerifyResult[];
  try {
    results = await runPlanVerify({ client, plan });
  } finally {
    try { client.end(); } catch { /* swallow */ }
  }
  const failed = results.some((row) => row.status === "failed");
  const updated = await mutateEnvironmentPlan(input.planId, input.userId, (row) => {
    row.verifyResults = results;
    const status = failed ? "failed" : "succeeded";
    row.status = status;
    const payload = row.payload as EnvironmentPlan;
    row.payload = { ...payload, status };
    return row;
  });
  await appendPlanHistory(input.planId, input.userId, "verified", failed ? "verify reported failures" : "verify passed");
  return { results, plan: asEnvironmentPlan(updated ?? record) };
}

/**
 * High-level helper used by the `/api/plans/:id/rollback` route.
 */
export async function rollbackPlanAndPersist(input: {
  planId: string;
  userId: string;
  connection: StoredConnection;
  openClient: () => Promise<SshClient>;
}): Promise<{ results: StoredPlanRollbackResult[]; plan: EnvironmentPlan } | undefined> {
  const record = await getEnvironmentPlan(input.planId, input.userId);
  if (!record) return undefined;
  const plan = asEnvironmentPlan(record);
  const client = await input.openClient();
  let results: StoredPlanRollbackResult[];
  try {
    results = await runPlanRollback({ client, plan, connection: input.connection });
  } finally {
    try { client.end(); } catch { /* swallow */ }
  }
  const updated = await mutateEnvironmentPlan(input.planId, input.userId, (row) => {
    row.rollbackResults = results;
    row.status = "rolled-back";
    const payload = row.payload as EnvironmentPlan;
    row.payload = { ...payload, status: "rolled-back" };
    return row;
  });
  await appendPlanHistory(input.planId, input.userId, "rolled-back", `${results.filter((r) => r.status === "passed").length}/${results.length} rollback steps succeeded`);
  return { results, plan: asEnvironmentPlan(updated ?? record) };
}
