/**
 * executor.ts — 任务执行器
 *
 * Phase 1 hardening (2026-07-08):
 *   Direct playbook/YAML execution is DISABLED. All mutating work must
 *   go through the Environment Plan pipeline:
 *
 *     Recipe Import → Plan → Review → Approval → Immutable Artifact → Apply → Verify → Report
 *
 *   executePlaybookTask, executeBatchCatalogTask, and executeCatalogTask
 *   all return a blocked/failed task with instructions to use the Plan
 *   flow instead. The only trusted mutating entry point is
 *   executeEnvironmentPlan() in engine/managed-execution.ts.
 */

import { Client } from "ssh2";
import fs from "node:fs/promises";
import { createId, readRuntimeDatabase, updateRuntimeDatabase, type StoredConnection, type StoredUserProfile, type StoredTaskHistory } from "./runtime-store.js";
import { decryptStoredFields } from "./connections.js";
import { readUserKey } from "./key-store.js";
import { loadPlaybookFromCatalog, hasPlaybook, parsePlaybook, type BatchRunOptions } from "./engine/index.js";
import type { TaskExecutionLog } from "./engine/types.js";
import { enqueueTask, cancelQueuedTask, getQueuePosition, isConnectionBusy } from "./task-queue.js";
import { listCatalogFromDatabase } from "./database.js";
import { buildRebuildPlan } from "./environment-plan.js";

// ── 任务数据结构 ──────────────────────────────────────────

export interface TaskStep {
  id: string;
  label: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  status: "pending" | "running" | "succeeded" | "failed" | "skipped";
  durationMs: number;
  itemIndex?: number;
}

export interface BatchItem {
  index: number;
  catalogId: string;
  displayName: string;
  status: "pending" | "running" | "succeeded" | "failed" | "skipped";
  error?: string;
}

export interface ExecutionTask {
  id: string;
  userId: string;
  connectionId: string;
  profileId: string;
  kind: "install-software" | "apply-combo" | "deploy-snapshot" | "batch-install";
  status: "queued" | "pending" | "running" | "succeeded" | "failed" | "cancelled";
  /** 排队中时，前面还有几个任务（0 = 马上轮到） */
  queuePosition?: number;
  steps: TaskStep[];
  items?: BatchItem[];
  dryRun: boolean;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

const taskStore = new Map<string, ExecutionTask>();
const taskSubscribers = new Map<string, Array<(task: ExecutionTask) => void>>();
const cancelFlags = new Map<string, boolean>();

// ── Public API ──────────────────────────────────────────

export function registerBatchTask(
  userId: string,
  connectionId: string,
  items: Array<{ catalogId: string; displayName: string }>,
  dryRun: boolean
): string {
  const taskId = createId("task");
  const task: ExecutionTask = {
    id: taskId,
    userId,
    connectionId,
    profileId: items[0]?.catalogId ?? "batch",
    kind: "batch-install",
    status: "pending",
    steps: [],
    items: items.map((item, index) => ({ index, catalogId: item.catalogId, displayName: item.displayName, status: "pending" })),
    dryRun,
    createdAt: new Date().toISOString()
  };
  taskStore.set(taskId, task);
  return taskId;
}

export async function executeBatchCatalogTask(
  userId: string,
  connection: StoredConnection,
  items: Array<{ catalogId: string; displayName: string }>,
  dryRun: boolean,
  taskId?: string,
  _userVarsByCatalogId?: Record<string, Record<string, unknown>>
): Promise<ExecutionTask> {
  const resolvedTaskId = taskId ?? registerBatchTask(userId, connection.id, items, dryRun);

  // Phase 1: Direct catalog batch execution is blocked. All mutating
  // work must go through the Environment Plan pipeline.
  //
  // The caller should instead:
  //   1. POST /api/plans (capability-selection kind) → create a Rebuild Plan
  //   2. POST /api/plans/:id/review → approve the plan
  //   3. POST /api/plans/:id/apply  → apply the approved immutable artifact
  const task = taskStore.get(resolvedTaskId)!;
  task.status = "failed";
  task.error = "Direct catalog execution is disabled. Create an Environment Plan, review it, approve it, then apply the approved immutable artifact via POST /api/plans.";
  notifySubscribers(task.id, task);
  void persistTaskToHistory(task);
  return task;
}

export async function executeCatalogTask(
  userId: string,
  connection: StoredConnection,
  catalogId: string,
  catalogName: string,
  dryRun: boolean,
  taskId?: string,
  userVars?: Record<string, unknown>
): Promise<ExecutionTask> {
  return executeBatchCatalogTask(
    userId,
    connection,
    [{ catalogId, displayName: catalogName }],
    dryRun,
    taskId,
    userVars ? { [catalogId]: userVars } : undefined
  );
}

/** Direct playbook execution is DISABLED (Phase 1).
 *
 * All mutating work must go through:
 *   Recipe Import → Plan → Review → Approval → Immutable Artifact → Apply → Verify → Report
 *
 * Callers should use POST /api/plans with source.kind="recipe" to create an
 * Imported Recipe Plan, then approve and apply it through the standard
 * Environment Plan pipeline.
 */
export async function executePlaybookTask(
  userId: string,
  connection: StoredConnection,
  _yamlText: string,
  dryRun: boolean,
  taskId?: string,
  _userVars?: Record<string, unknown>
): Promise<ExecutionTask> {
  if (!taskId) taskId = registerBatchTask(userId, connection.id, [{ catalogId: "playbook", displayName: "Playbook" }], dryRun);
  const task = taskStore.get(taskId)!;

  // Phase 1: Direct playbook execution is blocked. We do NOT invoke
  // executePlaybook / runPlaybook / shellModule.run / any SSH mutating path.
  task.status = "failed";
  task.error = "Direct playbook execution is disabled. Import the recipe as an Environment Plan, review it, approve it, then apply the approved immutable artifact.";
  task.completedAt = new Date().toISOString();
  if (task.items?.[0]) { task.items[0].status = "failed"; task.items[0].error = task.error; }
  notifySubscribers(task.id, task);
  void persistTaskToHistory(task);
  return task;
}

export function cancelTask(taskId: string) {
  const task = taskStore.get(taskId);
  if (task && task.status === "queued") {
    // Remove from queue without ever running
    if (cancelQueuedTask(task.connectionId, taskId)) {
      task.status = "cancelled";
      task.completedAt = new Date().toISOString();
      notifySubscribers(taskId, task);
      void persistTaskToHistory(task);
      return;
    }
  }
  // Otherwise let the running task observe the flag
  cancelFlags.set(taskId, true);
}
export function getTask(taskId: string): ExecutionTask | undefined { return taskStore.get(taskId); }

export function subscribeTask(taskId: string, cb: (task: ExecutionTask) => void): () => void {
  const subs = taskSubscribers.get(taskId) ?? [];
  subs.push(cb);
  taskSubscribers.set(taskId, subs);
  return () => { taskSubscribers.set(taskId, (taskSubscribers.get(taskId) ?? []).filter((s) => s !== cb)); };
}

export function notifySubscribersPublic(taskId: string, task: ExecutionTask) { notifySubscribers(taskId, task); }

// ── Legacy functions (kept for compatibility) ──

export function buildInstallTask(userId: string, connection: StoredConnection, profile: StoredUserProfile, dryRun: boolean): ExecutionTask {
  return { id: createId("task"), userId, connectionId: connection.id, profileId: profile.id, kind: "install-software", status: "pending", steps: [], dryRun, createdAt: new Date().toISOString() };
}

export function buildSnapshotDeployTask(userId: string, connection: StoredConnection, profile: StoredUserProfile, dryRun: boolean): ExecutionTask {
  return { id: createId("task"), userId, connectionId: connection.id, profileId: profile.id, kind: "deploy-snapshot", status: "pending", steps: [], dryRun, createdAt: new Date().toISOString() };
}

export async function executeTask(task: ExecutionTask, _connection: StoredConnection): Promise<ExecutionTask> {
  taskStore.set(task.id, task);
  task.status = "succeeded";
  task.completedAt = new Date().toISOString();
  notifySubscribers(task.id, task);
  return task;
}

export function buildPlaybookFromProfile(profile: StoredUserProfile): string {
  const tasks: string[] = [];
  const pkgs = profile.components.filter((c) => c.type === "software").map((c) => c.label.split(" ")[0]);
  if (pkgs.length > 0) {
    tasks.push(`  - name: Install packages\n    module: package\n    args:\n      name:\n${pkgs.map((p) => `        - ${p}`).join("\n")}\n      state: present`);
  }
  for (const comp of profile.components.filter((c) => c.type === "system-command")) {
    tasks.push(`  - name: ${comp.label}\n    module: shell\n    args:\n      cmd: "${comp.detail}"`);
  }
  return `name: ${profile.name}\nhosts: all\n\ntasks:\n${tasks.join("\n\n")}\n`;
}

// ── Helpers ──

function mapStatus(s: TaskExecutionLog["status"]): TaskStep["status"] {
  if (s === "ok" || s === "changed") return "succeeded";
  if (s === "failed") return "failed";
  if (s === "skipped") return "skipped";
  if (s === "running") return "running";
  return "pending";
}

function notifySubscribers(taskId: string, task: ExecutionTask) {
  for (const sub of taskSubscribers.get(taskId) ?? []) sub(task);
}

// ── Task history persistence ──

async function persistTaskToHistory(task: ExecutionTask): Promise<void> {
  try {
    await updateRuntimeDatabase((db) => {
      if (!db.tasks) db.tasks = [];
      const idx = db.tasks.findIndex((t) => t.id === task.id);
      const dbEntry = {
        id: task.id,
        userId: task.userId,
        connectionId: task.connectionId,
        source: task.profileId,
        sourceKind: task.kind === "deploy-snapshot" ? ("captured" as const) : ("catalog" as const),
        status: task.status as any,
        dryRun: task.dryRun,
        steps: task.steps.map((s) => ({
          name: s.label,
          module: s.command,
          status: s.status === "succeeded" ? "ok" as const : s.status === "failed" ? "failed" as const : s.status === "skipped" ? "skipped" as const : s.status === "running" ? "running" as const : "ok" as const,
          durationMs: s.durationMs,
          msg: s.stdout?.slice(0, 200) || undefined
        })),
        startedAt: task.startedAt ?? task.createdAt,
        completedAt: task.completedAt,
        error: task.error
      };

      if (idx >= 0) {
        db.tasks[idx] = dbEntry;
      } else {
        db.tasks.unshift(dbEntry);
      }

      // Keep only last 200 tasks
      if (db.tasks.length > 200) db.tasks = db.tasks.slice(0, 200);

      // Increment catalog install counters for any successfully-installed catalog items.
      if (task.status === "succeeded" && !task.dryRun && task.items) {
        if (!db.catalogStats) db.catalogStats = {};
        for (const item of task.items) {
          if (item.status !== "succeeded") continue;
          if (!item.catalogId || item.catalogId === "playbook" || item.catalogId === "uninstall") continue;
          const existing = db.catalogStats[item.catalogId] ?? { installs: 0, lastInstalledAt: "" };
          existing.installs += 1;
          existing.lastInstalledAt = task.completedAt ?? new Date().toISOString();
          db.catalogStats[item.catalogId] = existing;
        }
      }
    });
  } catch { /* ignore persistence errors */ }

  // Fire webhooks (best-effort, non-blocking from caller's perspective).
  try {
    const { fireWebhooks } = await import("./webhooks.js");
    const eventType = task.status === "succeeded" ? "task.completed" : task.status === "failed" ? "task.failed" : null;
    if (eventType) {
      await fireWebhooks(task.userId, eventType, {
        taskId: task.id,
        connectionId: task.connectionId,
        kind: task.kind,
        status: task.status,
        dryRun: task.dryRun,
        durationMs: task.completedAt && task.startedAt
          ? new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()
          : undefined,
        items: task.items?.map((i) => ({ catalogId: i.catalogId, status: i.status })) ?? undefined,
        error: task.error
      });
    }
  } catch { /* webhooks are best-effort */ }
}

export async function healTaskStates(): Promise<void> {
  try {
    await updateRuntimeDatabase((db) => {
      if (!db.tasks) return;
      let healedCount = 0;
      for (const t of db.tasks) {
        if (t.status === "running" || t.status === "queued") {
          t.status = "failed";
          t.completedAt = new Date().toISOString();
          t.error = "服务重启：任务已意外中断 / Service restarted: Task was interrupted.";
          healedCount++;
        }
      }
      if (healedCount > 0) {
        // eslint-disable-next-line no-console
        console.log(`[executor] Self-healing: Marked ${healedCount} hanging tasks as failed.`);
      }
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[executor] Self-healing failed:", err);
  }
}

