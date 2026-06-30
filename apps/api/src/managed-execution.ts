/**
 * managed-execution.ts — orchestrates the ActionRunRecord lifecycle
 * for Full Migration Certified capabilities and their managed actions.
 *
 * Every mutating action goes through:
 *
 *   pending → snapshotting → applying → verifying → succeeded
 *                                                  ↘ failed → rolling-back → rolled-back
 *
 * This module wraps the high-risk safe-apply functions in
 * `config-files.ts`, attaches secret redaction to every captured
 * stdout/stderr, and persists the resulting ActionRunRecord on the
 * runtime store so the Plan Report (and the test suite) can replay it.
 *
 * Tests in `engine/tests/managed-execution.test.ts` and
 * `engine/tests/safe-apply.test.ts` exercise this module without
 * needing a live SSH client.
 */

import {
  newActionRunRecord,
  redactSecrets,
  safePreview,
  transition,
  type ActionApplyResult,
  type ActionRollbackResult,
  type ActionRunRecord,
  type ActionSnapshot,
  type ActionVerifyResult,
  type ManagedCapabilityRecord
} from "./action-runs.js";
import type { EnvironmentPlanAction, EnvironmentPlanItem, EnvironmentPlan } from "./environment-plan.js";

/**
 * Surface-level dependency the managed runner needs. We model the
 * dependency as an interface so tests can pass in a mock instead of a
 * live SSH connection.
 */
export interface ManagedExecutionAdapter {
  /** Capture a pre-mutation snapshot (file hash, mode, packages, …). */
  snapshot(action: EnvironmentPlanAction): Promise<ActionSnapshot>;
  /** Perform the apply step. Implementations should NOT redact themselves —
   *  the orchestrator redacts after the call. */
  apply(action: EnvironmentPlanAction): Promise<ActionApplyResult>;
  /** Run the verify command for the action. */
  verify(action: EnvironmentPlanAction): Promise<ActionVerifyResult>;
  /** Restore the snapshot. */
  rollback(action: EnvironmentPlanAction, snapshot: ActionSnapshot | undefined): Promise<ActionRollbackResult>;
  /** Optional callback to capture raw stdout/stderr from the latest step. */
  drainOutput?(): { stdout?: string; stderr?: string };
}

const MUTATING_KINDS = new Set([
  "installPackage",
  "removePackage",
  "writeConfig",
  "copyConfig",
  "transferArtifact",
  "enableService",
  "restartService",
  "reloadService",
  "runCommand",
  "restart",
  "rollback"
]);

/**
 * Run a single action through the managed lifecycle. Returns the
 * final ActionRunRecord (with `succeeded` / `failed` / `rolled-back`
 * status). Caller persists the record via `recordActionRun`.
 */
export async function runManagedAction(input: {
  plan: EnvironmentPlan;
  item: EnvironmentPlanItem;
  action: EnvironmentPlanAction;
  adapter: ManagedExecutionAdapter;
  dryRun?: boolean;
}): Promise<ActionRunRecord> {
  const { plan, item, action, adapter } = input;
  let record: ActionRunRecord = newActionRunRecord({
    planId: plan.id,
    planHash: plan.planHash,
    itemId: item.id,
    actionId: action.id,
    targetConnectionId: action.targetHostId ?? plan.targetConnectionId,
    dryRun: input.dryRun,
    capabilityKey: item.capabilityKey ?? item.audit?.capabilityKey,
    capabilityId: action.capabilityId
  });
  const applyCommand = action.applySpec?.command ?? action.command;
  if (applyCommand) record.commandSummaries.push({ phase: "apply", command: applyCommand });
  const verifyCommands = [
    action.verifySpec?.command,
    ...(action.verifySpec?.checks ?? []).map((check) => check.command),
    action.verify
  ].filter((command): command is string => Boolean(command));
  for (const command of verifyCommands) record.commandSummaries.push({ phase: "verify", command });
  if (action.rollbackSpec?.command ?? action.rollback) {
    record.commandSummaries.push({ phase: "rollback", command: action.rollbackSpec?.command ?? action.rollback ?? "" });
  }

  // Detect-only items must not flow through the mutating runner. They
  // emit a single review action; we mark them as `manual-required` so
  // the Plan Report can list them under "skipped detect-only items"
  // without losing audit detail.
  if ((item.audit?.supportLevel ?? item.supportLevel) === "detect-only") {
    record = transition(record, "manual-required");
    record.error = "Detect-only items must not run through the managed mutating runner.";
    return record;
  }

  if (input.dryRun) {
    record.applyResult = { ok: true, message: "Dry-run: frozen action validated without target mutation.", steps: [] };
    record.exitCode = 0;
    return transition(record, "skipped");
  }

  // Non-mutating actions (`review`, `validate`, `manualStep`) get a
  // direct skip → succeeded transition; nothing to apply.
  if (!MUTATING_KINDS.has(action.kind)) {
    record = transition(record, "skipped");
    return record;
  }

  // 1. Snapshot
  try {
    record = transition(record, "snapshotting");
    record.snapshot = await adapter.snapshot(action);
  } catch (err) {
    record = applyError(record, "snapshot", err, adapter);
    return record;
  }

  // 2. Apply
  let applyResult: ActionApplyResult;
  try {
    record = transition(record, "applying");
    applyResult = await adapter.apply(action);
    record.applyResult = redactApplyResult(applyResult);
    captureStream(record, adapter);
    if (!applyResult.ok) throw new Error(applyResult.message || "apply step reported ok=false");
  } catch (err) {
    record = applyError(record, "apply", err, adapter);
    record = await tryRollback(record, action, adapter);
    return record;
  }

  // 3. Verify
  let verifyResult: ActionVerifyResult;
  try {
    record = transition(record, "verifying");
    verifyResult = await adapter.verify(action);
    record.verifyResult = redactVerifyResult(verifyResult);
    captureStream(record, adapter);
    if (!verifyResult.ok) throw new Error(verifyResult.message || "verify step reported ok=false");
  } catch (err) {
    record = applyError(record, "verify", err, adapter);
    record = await tryRollback(record, action, adapter);
    return record;
  }

  record = transition(record, "succeeded");
  record.exitCode = 0;
  return record;
}

function captureStream(record: ActionRunRecord, adapter: ManagedExecutionAdapter): void {
  const drained = adapter.drainOutput?.();
  if (!drained) return;
  if (drained.stdout) {
    const safe = safePreview(drained.stdout);
    record.stdoutPreview = safe.text;
    record.redacted = record.redacted || safe.redacted;
  }
  if (drained.stderr) {
    const safe = safePreview(drained.stderr);
    record.stderrPreview = safe.text;
    record.redacted = record.redacted || safe.redacted;
  }
}

function applyError(
  record: ActionRunRecord,
  phase: "snapshot" | "apply" | "verify",
  err: unknown,
  adapter: ManagedExecutionAdapter
): ActionRunRecord {
  const message = err instanceof Error ? err.message : String(err);
  const safe = redactSecrets(message);
  const next = transition(record, "failed");
  next.error = `[${phase}] ${safe.text}`;
  next.exitCode = 1;
  next.redacted = next.redacted || safe.redacted;
  captureStream(next, adapter);
  return next;
}

async function tryRollback(
  record: ActionRunRecord,
  action: EnvironmentPlanAction,
  adapter: ManagedExecutionAdapter
): Promise<ActionRunRecord> {
  if (!action.canRollback) return record;
  let next = transition(record, "rolling-back");
  try {
    const result = await adapter.rollback(action, next.snapshot);
    next.rollbackResult = redactRollbackResult(result);
    captureStream(next, adapter);
    next = transition(next, result.ok ? "rolled-back" : "rollback-failed");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const safe = redactSecrets(message);
    next.rollbackResult = {
      ok: false,
      steps: [],
      message: safe.text
    };
    next.redacted = next.redacted || safe.redacted;
    next = transition(next, "rollback-failed");
  }
  return next;
}

function redactApplyResult(result: ActionApplyResult): ActionApplyResult {
  return {
    ok: result.ok,
    message: redactSecrets(result.message).text,
    steps: result.steps.map((step) => ({
      label: redactSecrets(step.label).text,
      ok: step.ok,
      message: step.message ? redactSecrets(step.message).text : undefined
    })),
    tempPath: result.tempPath
  };
}

function redactVerifyResult(result: ActionVerifyResult): ActionVerifyResult {
  return {
    ok: result.ok,
    message: redactSecrets(result.message).text,
    checks: result.checks.map((check) => ({
      command: redactSecrets(check.command).text,
      ok: check.ok,
      output: safePreview(check.output).text
    }))
  };
}

function redactRollbackResult(result: ActionRollbackResult): ActionRollbackResult {
  return {
    ok: result.ok,
    message: redactSecrets(result.message).text,
    steps: result.steps.map((step) => ({
      label: redactSecrets(step.label).text,
      ok: step.ok,
      message: step.message ? redactSecrets(step.message).text : undefined
    }))
  };
}

/**
 * Persist an ActionRunRecord into the runtime database. Caps the list
 * to the most recent 1000 entries so the JSON file stays small.
 */
export async function recordActionRun(record: ActionRunRecord): Promise<void> {
  const { updateRuntimeDatabase } = await import("./runtime-store.js");
  await updateRuntimeDatabase((db) => {
    db.actionRuns = db.actionRuns ?? [];
    db.actionRuns.push(record);
    if (db.actionRuns.length > 1000) {
      db.actionRuns.splice(0, db.actionRuns.length - 1000);
    }
  });
}

export async function listActionRunsForPlan(planId: string): Promise<ActionRunRecord[]> {
  const { readRuntimeDatabase } = await import("./runtime-store.js");
  const db = await readRuntimeDatabase();
  return (db.actionRuns ?? []).filter((row) => row.planId === planId);
}

/**
 * Persist a ManagedCapabilityRecord. Called when a successful apply
 * installed packages on the target.
 */
export async function recordManagedCapability(record: ManagedCapabilityRecord): Promise<void> {
  const { updateRuntimeDatabase } = await import("./runtime-store.js");
  await updateRuntimeDatabase((db) => {
    db.managedCapabilities = db.managedCapabilities ?? [];
    db.managedCapabilities.push(record);
  });
}

export async function findManagedCapabilities(filter: {
  capabilityKey?: string;
  catalogId?: string;
  targetHostId?: string;
}): Promise<ManagedCapabilityRecord[]> {
  const { readRuntimeDatabase } = await import("./runtime-store.js");
  const db = await readRuntimeDatabase();
  return (db.managedCapabilities ?? []).filter((row) => {
    if (filter.capabilityKey && row.capabilityKey !== filter.capabilityKey) return false;
    if (filter.catalogId && row.catalogId !== filter.catalogId) return false;
    if (filter.targetHostId && row.targetHostId !== filter.targetHostId) return false;
    return true;
  });
}
