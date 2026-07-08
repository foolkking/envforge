/**
 * 引擎入口
 *
 * Phase 1 hardening (2026-07-08):
 *   executePlaybook() and executeBatchPlaybooks() now require an
 *   ApprovedArtifactExecutionContext. Without it they throw immediately.
 *   The only consumer that supplies this context is
 *   createRecipeArtifactAdapter() in engine/managed-execution.ts, which
 *   is itself only reachable through executeEnvironmentPlan() after
 *   Plan approval + hash verification + apply-gate checks.
 */

import fs from "node:fs/promises";
import { Client } from "ssh2";
import path from "node:path";
import { resolveFromRoot } from "../repo.js";
import { decryptStoredFields } from "../connections.js";
import type { StoredConnection } from "../runtime-store.js";
import { Ssh2Executor } from "./ssh-executor.js";
import { parsePlaybook, runPlaybook, type RunOptions, type RunResult } from "./runner.js";
import { readUserKey } from "../key-store.js";

export type { Playbook, Task, ModuleResult, TaskExecutionLog } from "./types.js";
export type { RunOptions, RunResult };
export { parsePlaybook, runPlaybook };
export { substitute, evalWhen } from "./runner.js";

// ══ Approved-artifact execution context (Phase 1) ═══════════════════

/**
 * Required context for any call to executePlaybook / executeBatchPlaybooks.
 *
 * Only createRecipeArtifactAdapter() inside engine/managed-execution.ts is
 * allowed to supply this context, and only after the Environment Plan has
 * passed planHash verification, approvedPlanHash verification, and the
 * apply-gate audit (evaluateApplyGate).
 */
export interface ApprovedArtifactExecutionContext {
  planId: string;
  planHash: string;
  artifactHash: string;
  actionId: string;
  source: "approved-artifact";
}

// ══ Catalog helpers (read-only) ═════════════════════════════════════

/** 读取 catalog 中的 playbook YAML 文件（优先 admin override，回退到基线） */
export async function loadPlaybookFromCatalog(playbookId: string): Promise<string> {
  const { resolvePlaybookYaml } = await import("../catalog-overrides.js");
  return await resolvePlaybookYaml(playbookId);
}

/** 检查 catalog 中是否存在对应的 playbook（含 override） */
export async function hasPlaybook(playbookId: string): Promise<boolean> {
  const { hasResolvedPlaybook } = await import("../catalog-overrides.js");
  return await hasResolvedPlaybook(playbookId);
}

// ══ executePlaybook — gated behind approved-artifact context ════════

/**
 * Execute a recipe YAML over SSH.
 *
 * Phase 1: this function REQUIRES an ApprovedArtifactExecutionContext.
 * Without it the call throws immediately. The only valid caller is
 * createRecipeArtifactAdapter() in managed-execution.ts, which supplies
 * the context after the Environment Plan has been approved and
 * hash-verified.
 */
export async function executePlaybook(
  yamlText: string,
  connection: StoredConnection,
  options: RunOptions,
  execCtx?: ApprovedArtifactExecutionContext
): Promise<RunResult> {
  if (!execCtx || execCtx.source !== "approved-artifact" || !execCtx.planId || !execCtx.planHash || !execCtx.artifactHash || !execCtx.actionId) {
    throw new Error(
      "Direct playbook execution is disabled. " +
      "Recipe YAML must be imported as an Environment Plan, reviewed, approved, and applied " +
      "through the approved immutable artifact pipeline (executeEnvironmentPlan)."
    );
  }

  const playbook = parsePlaybook(yamlText);

  const client = await connectSsh(connection);
  const executor = new Ssh2Executor(client);
  try {
    return await runPlaybook(playbook, executor, options);
  } finally {
    await executor.close();
    client.end();
  }
}

// ══ Batch execution — blocked (Phase 1) ═════════════════════════════

/**
 * 批量执行多个 Playbook — DISABLED (Phase 1).
 *
 * Direct batch playbook execution from catalog is blocked. Callers must
 * go through the Environment Plan pipeline for each capability.
 */
export interface BatchItemProgress {
  itemIndex: number;
  itemId: string;
  itemName: string;
  status: "pending" | "running" | "succeeded" | "failed" | "skipped";
  ok_count: number;
  changed: number;
  failed: number;
  error?: string;
}

export interface BatchRunOptions {
  dryRun: boolean;
  /** 每个 item 状态变化时触发 */
  onItemProgress?: (progress: BatchItemProgress) => void;
  /** 每个 item 内的 task 进度（与单 playbook 相同） */
  onTaskProgress?: (itemIndex: number, log: import("./types.js").TaskExecutionLog) => void;
  /** 检查取消标志 */
  isCancelled?: () => boolean;
  /**
   * Per-item user vars (form values). Map: catalogId → vars.
   * Items not in the map run with no overrides (Playbook YAML defaults only).
   */
  userVarsByCatalogId?: Record<string, Record<string, unknown>>;
}

export interface BatchRunResult {
  ok: boolean;
  totalItems: number;
  succeededItems: number;
  failedItems: number;
  itemResults: BatchItemProgress[];
}

/**
 * Direct batch playbook execution is DISABLED (Phase 1).
 *
 * Each capability should be applied through its own Environment Plan:
 *   POST /api/plans → review → approve → apply
 */
export async function executeBatchPlaybooks(
  _items: Array<{ catalogId: string; displayName: string }>,
  _connection: StoredConnection,
  options: BatchRunOptions,
  _execCtx?: ApprovedArtifactExecutionContext
): Promise<BatchRunResult> {
  const itemResults: BatchItemProgress[] = (_items ?? []).map((item, index) => ({
    itemIndex: index,
    itemId: item.catalogId,
    itemName: item.displayName,
    status: "failed" as const,
    ok_count: 0,
    changed: 0,
    failed: 1,
    error: "Direct batch playbook execution is disabled. Create individual Environment Plans for each capability, review, approve, and apply them through the approved immutable artifact pipeline."
  }));

  for (const result of itemResults) {
    options.onItemProgress?.(result);
  }

  return {
    ok: false,
    totalItems: (_items ?? []).length,
    succeededItems: 0,
    failedItems: (_items ?? []).length,
    itemResults
  };
}

// ══ SSH helpers (internal) ══════════════════════════════════════════

async function connectSsh(connection: StoredConnection): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    const timer = setTimeout(() => { client.destroy(); reject(new Error("SSH connection timed out (10s)")); }, 10000);

    client.on("ready", () => { clearTimeout(timer); resolve(client); });
    client.on("error", (err) => { clearTimeout(timer); reject(err); });

    const decrypted = decryptStoredFields(connection.fields);
    const host = decrypted.host;
    const port = parseInt(decrypted.port ?? "22", 10) || 22;
    const username = decrypted.username;

    const connectConfig: Record<string, unknown> = { host, port, username };

    if (connection.method === "ssh-key") {
      const keyId = decrypted._keyId;
      if (keyId) {
        // Use Web-uploaded key from key-store
        readUserKey(connection.userId, keyId).then((privateKey) => {
          connectConfig.privateKey = Buffer.from(privateKey, "utf8");
          const passphrase = decrypted._rawPassphrase;
          if (passphrase) connectConfig.passphrase = passphrase;
          client.connect(connectConfig as Parameters<Client["connect"]>[0]);
        }).catch((err) => {
          clearTimeout(timer);
          reject(new Error(`Failed to load SSH key: ${err instanceof Error ? err.message : err}`));
        });
        return;
      }
      const keyPath = decrypted.privateKeyPath;
      if (!keyPath) {
        clearTimeout(timer);
        reject(new Error("SSH key path not configured"));
        return;
      }
      fs.readFile(keyPath, "utf8").then((privateKey) => {
        connectConfig.privateKey = privateKey;
        const passphrase = decrypted._rawPassphrase;
        if (passphrase) connectConfig.passphrase = passphrase;
        client.connect(connectConfig as Parameters<Client["connect"]>[0]);
      }).catch((err) => {
        clearTimeout(timer);
        reject(new Error(`Failed to read SSH key: ${err.message}`));
      });
    } else {
      const password = decrypted._rawPassword;
      if (!password) {
        clearTimeout(timer);
        reject(new Error("No stored password (please reconnect)"));
        return;
      }
      connectConfig.password = password;
      client.connect(connectConfig as Parameters<Client["connect"]>[0]);
    }
  });
}
