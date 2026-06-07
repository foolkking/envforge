import { Client } from "ssh2";
import type { StoredConnection } from "./runtime-store.js";
import type { MigrationPlan, MigrationPlanAction, MigrationPlanItem } from "./migration-classifier.js";
import { decryptStoredFields } from "./connections.js";
import { readUserKey } from "./key-store.js";
import { Ssh2Executor } from "./engine/ssh-executor.js";
import type { SshExecutor } from "./engine/types.js";
import { packageModule } from "./engine/modules/package.js";
import { serviceModule } from "./engine/modules/service.js";

export interface MigrationApplyOptions {
  restartServices?: boolean;
  rollbackOnFailure?: boolean;
  requireAllActions?: boolean;
}

export interface MigrationApplyStep {
  itemId: string;
  itemName: string;
  action: MigrationPlanAction["kind"] | "rollback";
  label: string;
  status: "passed" | "failed" | "skipped" | "rolled-back";
  changed: boolean;
  message: string;
  stdout?: string;
  stderr?: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

export interface MigrationApplyResult {
  sourceHost: string;
  generatedAt: string;
  ok: boolean;
  rolledBack: boolean;
  summary: {
    passed: number;
    failed: number;
    skipped: number;
    rolledBack: number;
    total: number;
  };
  steps: MigrationApplyStep[];
}

type RollbackAction =
  | { kind: "removePackages"; item: MigrationPlanItem; packages: string[] }
  | { kind: "restoreService"; item: MigrationPlanItem; serviceName: string; wasActive: boolean };

const SAFE_COMMAND = /^[a-zA-Z0-9_./:=@,+ -]{1,300}$/;

export async function runMigrationApplyPlan(
  userId: string,
  connection: StoredConnection,
  plan: MigrationPlan,
  options: MigrationApplyOptions = {}
): Promise<MigrationApplyResult> {
  const client = await connect(connection, userId);
  const executor = new Ssh2Executor(client);
  try {
    return await applyMigrationPlanWithExecutor(plan, executor, options);
  } finally {
    await executor.close().catch(() => undefined);
    client.end();
  }
}

export async function applyMigrationPlanWithExecutor(
  plan: MigrationPlan,
  executor: SshExecutor,
  options: MigrationApplyOptions = {}
): Promise<MigrationApplyResult> {
  const steps: MigrationApplyStep[] = [];
  const rollbacks: RollbackAction[] = [];
  let failed = false;

  for (const item of plan.items) {
    if (item.userDecision !== "approved" && item.userDecision !== "add-to-plan" && item.userDecision !== "migrate-artifact") {
      steps.push(makeInstantStep(item, "review", "User approval required before apply.", "skipped", "Candidate was not approved."));
      continue;
    }

    for (const action of item.actions) {
      if (failed) {
        steps.push(makeInstantStep(item, action.kind, action.label, "skipped", "Skipped because an earlier action failed."));
        continue;
      }
      const result = await runAction(executor, item, action, rollbacks, options);
      steps.push(result);
      if (result.status === "failed") failed = true;
    }
  }

  let rolledBack = false;
  if (failed && options.rollbackOnFailure !== false && rollbacks.length > 0) {
    rolledBack = true;
    for (const rollback of rollbacks.reverse()) {
      steps.push(await runRollback(executor, rollback));
    }
  }

  const summary = summarize(steps);
  return {
    sourceHost: plan.sourceHost,
    generatedAt: new Date().toISOString(),
    ok: summary.failed === 0 && (!options.requireAllActions || summary.skipped === 0),
    rolledBack,
    summary,
    steps
  };
}

async function runAction(
  executor: SshExecutor,
  item: MigrationPlanItem,
  action: MigrationPlanAction,
  rollbacks: RollbackAction[],
  options: MigrationApplyOptions
): Promise<MigrationApplyStep> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  try {
    if (action.kind === "installPackage") {
      const packages = dedupe(action.packageNames?.filter(Boolean) ?? [item.name]);
      const before = await installedPackages(executor, packages);
      const result = await packageModule.run(executor, { name: packages, state: "present", update_cache: true }, false);
      const installedByThisRun = packages.filter((pkg) => !before.has(pkg));
      if (!result.failed && installedByThisRun.length > 0) rollbacks.push({ kind: "removePackages", item, packages: installedByThisRun });
      return finishStep(item, action.kind, action.label, result.failed ? "failed" : "passed", result.changed, result.msg, startedAt, startMs, result.stdout, result.stderr);
    }

    if (action.kind === "validate") {
      const command = action.command?.trim();
      if (!command || !SAFE_COMMAND.test(command)) {
        return finishStep(item, action.kind, action.label, "failed", false, `Unsafe or empty validation command: ${command ?? "(empty)"}`, startedAt, startMs);
      }
      const result = await executor.exec(command);
      return finishStep(item, action.kind, action.label, result.exitCode === 0 ? "passed" : "failed", false, result.exitCode === 0 ? "Validation passed." : `Validation failed with exit code ${result.exitCode}.`, startedAt, startMs, result.stdout, result.stderr);
    }

    if (action.kind === "restart") {
      if (!options.restartServices) {
        return finishStep(item, action.kind, action.label, "skipped", false, "Service restart is disabled for this apply run.", startedAt, startMs);
      }
      const serviceName = action.serviceName?.trim();
      if (!serviceName || !/^[a-zA-Z0-9._@-]{1,80}$/.test(serviceName)) {
        return finishStep(item, action.kind, action.label, "failed", false, `Unsafe or empty service name: ${serviceName ?? "(empty)"}`, startedAt, startMs);
      }
      const wasActive = (await executor.exec(`systemctl is-active --quiet ${serviceName}`)).exitCode === 0;
      const result = await serviceModule.run(executor, { name: serviceName, state: "restarted", ignore_missing: true }, false);
      if (!result.failed) rollbacks.push({ kind: "restoreService", item, serviceName, wasActive });
      return finishStep(item, action.kind, action.label, result.failed ? "failed" : "passed", result.changed, result.msg, startedAt, startMs, result.stdout, result.stderr);
    }

    if (action.kind === "copyConfig") {
      return finishStep(item, action.kind, action.label, options.requireAllActions ? "failed" : "skipped", false, "Config copy requires source/target diff approval and is not auto-applied by the safe MVP.", startedAt, startMs);
    }

    return finishStep(item, action.kind, action.label, options.requireAllActions ? "failed" : "skipped", false, "Manual review action; no remote change was made.", startedAt, startMs);
  } catch (err) {
    return finishStep(item, action.kind, action.label, "failed", false, err instanceof Error ? err.message : "Apply action failed.", startedAt, startMs);
  }
}

async function runRollback(executor: SshExecutor, rollback: RollbackAction): Promise<MigrationApplyStep> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  try {
    if (rollback.kind === "removePackages") {
      const result = await packageModule.run(executor, { name: rollback.packages, state: "absent", update_cache: false }, false);
      return finishStep(rollback.item, "rollback", `Rollback installed packages: ${rollback.packages.join(", ")}`, result.failed ? "failed" : "rolled-back", result.changed, result.msg, startedAt, startMs, result.stdout, result.stderr);
    }
    if (!rollback.wasActive) {
      const result = await serviceModule.run(executor, { name: rollback.serviceName, state: "stopped", ignore_missing: true }, false);
      return finishStep(rollback.item, "rollback", `Restore service state: ${rollback.serviceName}`, result.failed ? "failed" : "rolled-back", result.changed, result.msg, startedAt, startMs, result.stdout, result.stderr);
    }
    return finishStep(rollback.item, "rollback", `Restore service state: ${rollback.serviceName}`, "rolled-back", false, "Service was active before apply; no rollback stop needed.", startedAt, startMs);
  } catch (err) {
    return finishStep(rollback.item, "rollback", "Rollback failed", "failed", false, err instanceof Error ? err.message : "Rollback failed.", startedAt, startMs);
  }
}

async function installedPackages(executor: SshExecutor, packages: string[]): Promise<Set<string>> {
  const installed = new Set<string>();
  for (const pkg of packages) {
    if (!/^[a-zA-Z0-9._@/+:-]{1,100}$/.test(pkg)) continue;
    const result = await executor.exec(`(dpkg-query -W -f='\${Status}' ${pkg} 2>/dev/null | grep -q "install ok installed") || rpm -q ${pkg} >/dev/null 2>&1`);
    if (result.exitCode === 0) installed.add(pkg);
  }
  return installed;
}

function makeInstantStep(
  item: MigrationPlanItem,
  action: MigrationApplyStep["action"],
  label: string,
  status: MigrationApplyStep["status"],
  message: string
): MigrationApplyStep {
  const now = new Date().toISOString();
  return { itemId: item.id, itemName: item.name, action, label, status, changed: false, message, startedAt: now, completedAt: now, durationMs: 0 };
}

function finishStep(
  item: MigrationPlanItem,
  action: MigrationApplyStep["action"],
  label: string,
  status: MigrationApplyStep["status"],
  changed: boolean,
  message: string,
  startedAt: string,
  startMs: number,
  stdout = "",
  stderr = ""
): MigrationApplyStep {
  return {
    itemId: item.id,
    itemName: item.name,
    action,
    label,
    status,
    changed,
    message,
    stdout: stdout.slice(0, 4000),
    stderr: stderr.slice(0, 4000),
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startMs
  };
}

function summarize(steps: MigrationApplyStep[]): MigrationApplyResult["summary"] {
  return {
    passed: steps.filter((step) => step.status === "passed").length,
    failed: steps.filter((step) => step.status === "failed").length,
    skipped: steps.filter((step) => step.status === "skipped").length,
    rolledBack: steps.filter((step) => step.status === "rolled-back").length,
    total: steps.length
  };
}

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}

async function connect(connection: StoredConnection, userId: string): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    const timer = setTimeout(() => { client.destroy(); reject(new Error("SSH timeout")); }, 10000);
    client.on("ready", () => { clearTimeout(timer); resolve(client); });
    client.on("error", (err) => { clearTimeout(timer); reject(err); });

    const decrypted = decryptStoredFields(connection.fields);
    const cfg: Record<string, unknown> = {
      host: decrypted.host,
      port: parseInt(decrypted.port ?? "22", 10) || 22,
      username: decrypted.username,
      readyTimeout: 10000,
      keepaliveInterval: 30000,
      keepaliveCountMax: 3
    };

    if (connection.method === "ssh-key") {
      const keyId = decrypted._keyId;
      if (keyId) {
        readUserKey(userId, keyId)
          .then((key) => {
            cfg.privateKey = Buffer.from(key, "utf8");
            if (decrypted._rawPassphrase) cfg.passphrase = decrypted._rawPassphrase;
            client.connect(cfg as any);
          })
          .catch((err) => { clearTimeout(timer); reject(err); });
        return;
      }
      reject(new Error("No uploaded SSH key is available for apply."));
      return;
    }

    const password = decrypted._rawPassword;
    if (!password) {
      clearTimeout(timer);
      reject(new Error("No SSH password is available for apply."));
      return;
    }
    cfg.password = password;
    client.connect(cfg as any);
  });
}
