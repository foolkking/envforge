/**
 * plan-store.ts — Persistent Environment Plan store.
 *
 * EnvForge's mutation contract:
 *
 *   capability / evidence -> Environment Plan -> review -> apply -> verify -> rollback / report
 *
 * Plans must outlive API restarts so the full cycle can resume cleanly. This
 * module wraps the runtime-store JSON document and exposes a typed CRUD
 * surface that other modules call.
 *
 * Design notes:
 *  - Each Plan is owned by exactly one user (`userId`); admin tooling reads
 *    cross-user plans via {@link listAllEnvironmentPlans}.
 *  - We persist the EnvironmentPlan payload verbatim so future planner
 *    enrichments don't require a schema migration.
 *  - `verifyResults`, `rollbackResults`, and `history` are kept on the stored
 *    record (not on the plan payload) so a single read can power the UI's
 *    apply/verify/rollback dashboards.
 */

import type { EnvironmentPlan, EnvironmentPlanStatus, EnvironmentPlanType } from "./environment-plan.js";
import { readRuntimeDatabase, updateRuntimeDatabase, type StoredEnvironmentPlan } from "./runtime-store.js";

export type StoredPlanVerifyResult = NonNullable<StoredEnvironmentPlan["verifyResults"]>[number];
export type StoredPlanRollbackResult = NonNullable<StoredEnvironmentPlan["rollbackResults"]>[number];
export type StoredPlanHistoryEvent = NonNullable<StoredEnvironmentPlan["history"]>[number];

function toRecord(plan: EnvironmentPlan, userId: string, extras: Partial<StoredEnvironmentPlan> = {}): StoredEnvironmentPlan {
  const now = new Date().toISOString();
  return {
    id: plan.id,
    userId,
    type: plan.type,
    status: plan.status,
    name: plan.name,
    sourceHost: plan.sourceHost,
    targetConnectionId: plan.targetConnectionId,
    createdAt: extras.createdAt ?? now,
    updatedAt: now,
    payload: plan,
    verifyResults: extras.verifyResults,
    rollbackResults: extras.rollbackResults,
    history: extras.history ?? [{ at: now, event: "created", actor: userId }]
  };
}

/** Save a freshly-built plan (or replace an existing one) for `userId`. */
export async function saveEnvironmentPlan(plan: EnvironmentPlan, userId: string): Promise<StoredEnvironmentPlan> {
  return updateRuntimeDatabase(async (db) => {
    const list = (db.environmentPlans = db.environmentPlans ?? []);
    const idx = list.findIndex((row) => row.id === plan.id);
    if (idx >= 0) {
      const prior = list[idx];
      // Preserve original ownership; do not let a different user overwrite a plan
      // they don't own. Routes already enforce this, but we double-check here.
      if (prior.userId !== userId) {
        throw new Error("Plan ownership mismatch.");
      }
      const next = toRecord(plan, userId, {
        createdAt: prior.createdAt,
        verifyResults: prior.verifyResults,
        rollbackResults: prior.rollbackResults,
        history: prior.history
      });
      list[idx] = next;
      return next;
    }
    const created = toRecord(plan, userId);
    list.push(created);
    return created;
  });
}

/** Read a plan owned by `userId`. Returns undefined when not found. */
export async function getEnvironmentPlan(id: string, userId: string): Promise<StoredEnvironmentPlan | undefined> {
  const db = await readRuntimeDatabase();
  const row = db.environmentPlans?.find((plan) => plan.id === id);
  if (!row) return undefined;
  if (row.userId !== userId) return undefined;
  return row;
}

/** Read a plan without ownership filtering — admin / scheduler use only. */
export async function getEnvironmentPlanUnsafe(id: string): Promise<StoredEnvironmentPlan | undefined> {
  const db = await readRuntimeDatabase();
  return db.environmentPlans?.find((plan) => plan.id === id);
}

/** List a user's plans, newest first. */
export async function listEnvironmentPlans(
  userId: string,
  filter?: { type?: EnvironmentPlanType; targetConnectionId?: string; status?: EnvironmentPlanStatus }
): Promise<StoredEnvironmentPlan[]> {
  const db = await readRuntimeDatabase();
  const rows = (db.environmentPlans ?? []).filter((row) => row.userId === userId);
  const filtered = rows.filter((row) => {
    if (filter?.type && row.type !== filter.type) return false;
    if (filter?.targetConnectionId && row.targetConnectionId !== filter.targetConnectionId) return false;
    if (filter?.status && row.status !== filter.status) return false;
    return true;
  });
  return filtered.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** Admin/cross-user listing. */
export async function listAllEnvironmentPlans(): Promise<StoredEnvironmentPlan[]> {
  const db = await readRuntimeDatabase();
  return [...(db.environmentPlans ?? [])].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/**
 * Update mutable fields on a stored plan. The {@link mutator} receives the
 * full record and can overwrite the plan payload, status, verify/rollback
 * results, or history. Concurrency is handled by the runtime-store mutex.
 */
export async function mutateEnvironmentPlan(
  id: string,
  userId: string,
  mutator: (record: StoredEnvironmentPlan) => StoredEnvironmentPlan | Promise<StoredEnvironmentPlan>
): Promise<StoredEnvironmentPlan | undefined> {
  return updateRuntimeDatabase(async (db) => {
    const list = (db.environmentPlans = db.environmentPlans ?? []);
    const idx = list.findIndex((row) => row.id === id);
    if (idx < 0) return undefined;
    const prior = list[idx];
    if (prior.userId !== userId) return undefined;
    const next = await mutator({ ...prior });
    list[idx] = { ...next, updatedAt: new Date().toISOString() };
    return list[idx];
  });
}

export async function appendPlanHistory(
  id: string,
  userId: string,
  event: StoredPlanHistoryEvent["event"],
  note?: string
): Promise<void> {
  await mutateEnvironmentPlan(id, userId, (record) => {
    const entry: StoredPlanHistoryEvent = { at: new Date().toISOString(), event, actor: userId, note };
    record.history = [...(record.history ?? []), entry].slice(-100);
    return record;
  });
}

export async function setPlanStatus(
  id: string,
  userId: string,
  status: EnvironmentPlanStatus,
  note?: string
): Promise<StoredEnvironmentPlan | undefined> {
  return mutateEnvironmentPlan(id, userId, (record) => {
    record.status = status;
    const payload = record.payload as EnvironmentPlan | undefined;
    if (payload) record.payload = { ...payload, status };
    const event: StoredPlanHistoryEvent["event"] =
      status === "rolled-back"
        ? "rolled-back"
        : status === "approved"
        ? "reviewed"
        : status === "applying"
        ? "applied"
        : status === "verifying"
        ? "verified"
        : "reviewed";
    record.history = [
      ...(record.history ?? []),
      { at: new Date().toISOString(), event, actor: userId, note }
    ].slice(-100);
    return record;
  });
}

export async function deleteEnvironmentPlan(id: string, userId: string): Promise<boolean> {
  return updateRuntimeDatabase(async (db) => {
    const list = (db.environmentPlans = db.environmentPlans ?? []);
    const idx = list.findIndex((row) => row.id === id);
    if (idx < 0) return false;
    if (list[idx].userId !== userId) return false;
    list.splice(idx, 1);
    return true;
  });
}

/** Helper used by routes that need to fetch the live plan payload. */
export function asEnvironmentPlan(record: StoredEnvironmentPlan): EnvironmentPlan {
  return record.payload as EnvironmentPlan;
}
