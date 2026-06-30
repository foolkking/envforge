/** Approved immutable Environment Plan scheduler. Legacy playbook/catalog schedules never execute. */
import { Client as SshClient } from "ssh2";
import { nextRunAfter, validateCron } from "./cron.js";
import { initializeDatabase } from "./db-sqlite.js";
import { executeEnvironmentPlan } from "./engine/managed-execution.js";
import { asEnvironmentPlan, claimPlanForApply, finalizeApplyClaim, getEnvironmentPlanUnsafe } from "./plan-store.js";
import { computeEnvironmentPlanHash, verifyEnvironmentPlanHash } from "./plan-hash.js";
import { decryptStoredFields } from "./connections.js";
import { readUserKey } from "./key-store.js";
import { readRuntimeDatabase, updateRuntimeDatabase, type StoredSchedule } from "./runtime-store.js";
import { fireWebhooks } from "./webhooks.js";

const TICK_INTERVAL_MS = 30_000;
const WORKER_INTERVAL_MS = 5_000;
let tickerHandle: NodeJS.Timeout | null = null;
let workerHandle: NodeJS.Timeout | null = null;
let workerRuntimePaused = false;
let activeWorkerOperations = 0;

export function startScheduler(): void {
  if (tickerHandle) return;
  workerRuntimePaused = false;
  void initializeNextRunTimes();
  tickerHandle = setInterval(() => { void tick(); }, TICK_INTERVAL_MS);
  workerHandle = setInterval(() => { void runWorkersTick(); }, WORKER_INTERVAL_MS);
  void tick();
  void runWorkersTick();
}

export function stopScheduler(): void {
  if (tickerHandle) clearInterval(tickerHandle);
  if (workerHandle) clearInterval(workerHandle);
  tickerHandle = null;
  workerHandle = null;
}

export async function shutdownScheduler(timeoutMs = 5_000): Promise<void> {
  workerRuntimePaused = true;
  stopScheduler();
  const deadline = Date.now() + timeoutMs;
  while (activeWorkerOperations > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  const { checkpointSqliteWal } = await import("./db-sqlite.js");
  await checkpointSqliteWal();
}

async function runBackgroundTaskTelemetry(name: string, fn: () => Promise<void>): Promise<void> {
  const db = await initializeDatabase();
  const now = new Date().toISOString();
  const startTime = Date.now();
  activeWorkerOperations += 1;
  try {
    await db.run(
      `INSERT OR REPLACE INTO background_tasks (name, status, last_run_at, last_success_at, duration_ms, last_error)
       VALUES (?, 'running', ?, NULL, NULL, NULL)`,
      name,
      now
    );
    await fn();
    await db.run(
      `UPDATE background_tasks SET status = 'success', last_success_at = ?, duration_ms = ? WHERE name = ?`,
      new Date().toISOString(),
      Date.now() - startTime,
      name
    );
  } catch (error) {
    await db.run(
      `UPDATE background_tasks SET status = 'failed', duration_ms = ?, last_error = ? WHERE name = ?`,
      Date.now() - startTime,
      error instanceof Error ? error.message : String(error),
      name
    );
  } finally {
    activeWorkerOperations = Math.max(0, activeWorkerOperations - 1);
  }
}

export async function runWorkersTick(): Promise<void> {
  if (workerRuntimePaused) return;
  const { syncCommentsFts, SQLiteQueueProvider } = await import("./runtime-store.js");
  await runBackgroundTaskTelemetry("fts_sync", syncCommentsFts);
  const queue = new SQLiteQueueProvider();
  await runBackgroundTaskTelemetry("notifications_worker", async () => {
    await queue.processNextBatch(20, async (item) => {
      if (item.payload.includes("fail_me")) throw new Error("SMTP server is down (simulated failure)");
    });
  });
}

async function initializeNextRunTimes(): Promise<void> {
  await updateRuntimeDatabase((database) => {
    const now = new Date();
    for (const schedule of database.schedules ?? []) {
      if (!schedule.enabled) continue;
      if (schedule.nextRunAt && new Date(schedule.nextRunAt).getTime() > now.getTime()) continue;
      schedule.nextRunAt = nextRunAfter(schedule.cron, now)?.toISOString();
    }
  });
}

async function tick(): Promise<void> {
  const now = Date.now();
  const database = await readRuntimeDatabase();
  const due = (database.schedules ?? []).filter((schedule) =>
    schedule.enabled && schedule.nextRunAt !== undefined && new Date(schedule.nextRunAt).getTime() <= now
  );
  for (const schedule of due) {
    try {
      await fireApprovedPlanSchedule(schedule);
    } catch (error) {
      await updateScheduleAfterRun(schedule.id, "failed");
      // eslint-disable-next-line no-console
      console.error(`[scheduler] approved Plan schedule ${schedule.id} failed:`, error);
    }
  }
}

export async function runApprovedPlanSchedulesOnceForTests(): Promise<void> {
  await tick();
}

async function fireApprovedPlanSchedule(schedule: StoredSchedule): Promise<void> {
  const database = await readRuntimeDatabase();
  const record = schedule.planId ? await getEnvironmentPlanUnsafe(schedule.planId) : undefined;
  const plan = record?.userId === schedule.userId ? asEnvironmentPlan(record) : undefined;
  const currentHash = plan ? computeEnvironmentPlanHash(plan) : undefined;
  const connection = plan?.targetConnectionId
    ? database.connections.find((candidate) => candidate.id === plan.targetConnectionId && candidate.userId === schedule.userId)
    : undefined;
  const trusted = Boolean(
    plan
    && connection
    && verifyEnvironmentPlanHash(plan)
    && plan.status === "approved"
    && record?.approvalRecord?.planHash === currentHash
    && plan.approvedPlanHash === currentHash
    && schedule.approvedPlanHash === currentHash
  );

  if (!trusted || !plan || !connection || !currentHash) {
    await updateScheduleAfterRun(schedule.id, "skipped");
    await fireWebhooks(schedule.userId, "schedule.fired", {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      planId: schedule.planId,
      approvedPlanHash: schedule.approvedPlanHash,
      status: "skipped",
      reason: "Schedule is not bound to a currently approved immutable Environment Plan.",
      firedAt: new Date().toISOString()
    });
    return;
  }

  const idempotencyKey = `schedule:${schedule.id}:${schedule.nextRunAt ?? "due"}`;
  const claim = schedule.dryRun
    ? undefined
    : await claimPlanForApply({
      planId: plan.id,
      userId: schedule.userId,
      expectedPlanHash: currentHash,
      approvedPlanHash: schedule.approvedPlanHash ?? "",
      idempotencyKey
    });
  if (claim && claim.status !== "claimed") {
    await fireWebhooks(schedule.userId, "schedule.fired", {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      planId: plan.id,
      approvedPlanHash: currentHash,
      status: "skipped",
      reason: `Schedule apply was not claimed: ${claim.status}.`,
      existingRunId: claim.existingRunId,
      firedAt: new Date().toISOString()
    });
    return;
  }

  let execution;
  try {
    execution = await executeEnvironmentPlan({
      userId: schedule.userId,
      plan,
      planHash: currentHash,
      applyRunId: claim?.claimId,
      connection,
      dryRun: schedule.dryRun,
      openClient: () => openScheduledSsh(connection, schedule.userId)
    });
  } catch (error) {
    if (claim) {
      const message = error instanceof Error ? error.message : String(error);
      await finalizeApplyClaim({
        claimId: claim.claimId,
        userId: schedule.userId,
        ok: false,
        error: message,
        responseSnapshot: {
          dryRun: false,
          applyRunId: claim.claimId,
          plan: { ...plan, status: "failed" },
          error: message
        }
      });
    }
    throw error;
  }
  const status = execution.ok ? "succeeded" : "failed";
  if (claim) {
    await finalizeApplyClaim({
      claimId: claim.claimId,
      userId: schedule.userId,
      ok: execution.ok,
      responseSnapshot: {
        dryRun: false,
        applyRunId: claim.claimId,
        plan: { ...plan, status },
        execution
      }
    });
  }
  await updateScheduleAfterRun(schedule.id, status);
  await fireWebhooks(schedule.userId, "schedule.fired", {
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    planId: plan.id,
    approvedPlanHash: currentHash,
    actionRunIds: execution.actionRuns.map((run) => run.id),
    status,
    firedAt: new Date().toISOString()
  });
}

async function updateScheduleAfterRun(id: string, status: StoredSchedule["lastStatus"]): Promise<void> {
  await updateRuntimeDatabase((database) => {
    const schedule = (database.schedules ?? []).find((candidate) => candidate.id === id);
    if (!schedule) return;
    schedule.lastRunAt = new Date().toISOString();
    schedule.lastStatus = status;
    schedule.nextRunAt = nextRunAfter(schedule.cron, new Date())?.toISOString();
  });
}

async function openScheduledSsh(
  connection: { method: string; fields: Record<string, string> },
  userId: string
): Promise<SshClient> {
  const fields = decryptStoredFields(connection.fields);
  const config: Record<string, unknown> = {
    host: fields.host,
    port: Number.parseInt(fields.port ?? "22", 10) || 22,
    username: fields.username,
    readyTimeout: 10_000,
    keepaliveInterval: 30_000,
    keepaliveCountMax: 3
  };
  if (connection.method === "ssh-key") {
    if (fields._keyId) config.privateKey = Buffer.from(await readUserKey(userId, fields._keyId), "utf8");
    else if (fields.privateKeyPath) config.privateKey = await import("node:fs/promises").then((fs) => fs.readFile(fields.privateKeyPath!, "utf8"));
    else throw new Error("Scheduled Plan target has no SSH key configured.");
    if (fields._rawPassphrase) config.passphrase = fields._rawPassphrase;
  } else {
    if (!fields._rawPassword) throw new Error("Scheduled Plan target has no SSH password configured.");
    config.password = fields._rawPassword;
  }
  return new Promise((resolve, reject) => {
    const client = new SshClient();
    const timer = setTimeout(() => { client.destroy(); reject(new Error("Scheduled SSH connection timed out.")); }, 10_000);
    client.once("ready", () => { clearTimeout(timer); resolve(client); });
    client.once("error", (error) => { clearTimeout(timer); reject(error); });
    client.connect(config);
  });
}

export function validateScheduleInput(input: Partial<StoredSchedule>): string | null {
  if (!input.name?.trim()) return "Schedule name is required.";
  if (!input.cron?.trim()) return "Cron expression is required.";
  const cronError = validateCron(input.cron);
  if (cronError) return cronError;
  if (!input.planId || !input.approvedPlanHash) return "planId and approvedPlanHash are required.";
  if (input.playbookId || input.catalogId) return "Schedules cannot reference playbookId or catalogId.";
  return null;
}
