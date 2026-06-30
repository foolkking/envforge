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

import type { ActionRunRecord } from "./action-runs.js";
import { evaluateApplyGate, type EnvironmentPlan, type EnvironmentPlanStatus, type EnvironmentPlanType, type PlanApprovalRecord } from "./environment-plan.js";
import { computeEnvironmentPlanHash, verifyEnvironmentPlanHash } from "./plan-hash.js";
import { createId, readRuntimeDatabase, updateRuntimeDatabase, type StoredApplyRun, type StoredEnvironmentPlan } from "./runtime-store.js";

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
    approvalRecord: extras.approvalRecord,
    lastDryRunAt: extras.lastDryRunAt,
    lastDryRunResult: extras.lastDryRunResult,
    verifyResults: extras.verifyResults,
    rollbackResults: extras.rollbackResults,
    history: extras.history ?? [{ at: now, event: "created", actor: userId }]
  };
}

export class PlanAlreadyExistsError extends Error {
  constructor(id: string) {
    super(`Environment Plan already exists: ${id}`);
    this.name = "PlanAlreadyExistsError";
  }
}

export class PlanIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanIntegrityError";
  }
}

export interface ApplyClaim {
  claimId: string;
  planId: string;
  planHash: string;
  idempotencyKey?: string;
  status: "claimed" | "duplicate" | "already-running" | "already-applied";
  existingRunId?: string;
  createdAt: string;
}

function latestApplyRunForPlan(runs: StoredApplyRun[] | undefined, planId: string, planHash?: string): StoredApplyRun | undefined {
  return [...(runs ?? [])]
    .filter((run) => run.planId === planId && (!planHash || run.planHash === planHash))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
}

function assertFrozenPlan(plan: EnvironmentPlan): void {
  if (!plan.immutable || !plan.planHash) {
    throw new PlanIntegrityError("Environment Plan must be frozen with a canonical planHash before persistence.");
  }
  if (!verifyEnvironmentPlanHash(plan)) {
    throw new PlanIntegrityError("Environment Plan hash does not match its immutable specification.");
  }
}

/** Create-only persistence. The immutable Plan payload is never replaced. */
export async function createEnvironmentPlan(plan: EnvironmentPlan, userId: string): Promise<StoredEnvironmentPlan> {
  assertFrozenPlan(plan);
  if (plan.status === "approved" || plan.approvedPlanHash || plan.approvalRecord) {
    throw new PlanIntegrityError("A new Environment Plan cannot enter the store as pre-approved.");
  }
  return updateRuntimeDatabase(async (db) => {
    const list = (db.environmentPlans = db.environmentPlans ?? []);
    if (list.some((row) => row.id === plan.id)) throw new PlanAlreadyExistsError(plan.id);
    const created = toRecord(plan, userId);
    list.push(created);
    return created;
  });
}

/** Compatibility name retained for callers while preserving create-only semantics. */
export const saveEnvironmentPlan = createEnvironmentPlan;

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
    const priorPlan = prior.payload as EnvironmentPlan;
    const next = await mutator(structuredClone(prior));
    const nextPlan = next.payload as EnvironmentPlan;
    if (next.id !== prior.id || next.userId !== prior.userId || nextPlan.id !== priorPlan.id) {
      throw new PlanIntegrityError("Environment Plan record identity and ownership cannot be modified.");
    }
    if (priorPlan.immutable) {
      if (!nextPlan.immutable || nextPlan.planHash !== priorPlan.planHash || !verifyEnvironmentPlanHash(nextPlan)) {
        throw new PlanIntegrityError("Immutable Environment Plan specification cannot be modified after creation.");
      }
    }
    list[idx] = { ...next, updatedAt: new Date().toISOString() };
    return list[idx];
  });
}

export async function approveEnvironmentPlan(
  id: string,
  userId: string,
  approval: PlanApprovalRecord
): Promise<StoredEnvironmentPlan | undefined> {
  return mutateEnvironmentPlan(id, userId, (record) => {
    const plan = record.payload as EnvironmentPlan;
    assertFrozenPlan(plan);
    const currentHash = computeEnvironmentPlanHash(plan);
    if (approval.planHash !== currentHash || plan.planHash !== currentHash) {
      throw new PlanIntegrityError("Approval planHash does not match the stored Environment Plan.");
    }
    const riskAcks: Record<string, string[]> = {};
    for (const value of approval.acceptedRisks) {
      const separator = value.indexOf("::");
      const itemId = separator >= 0 ? value.slice(0, separator) : "";
      const risk = separator >= 0 ? value.slice(separator + 2) : value;
      riskAcks[itemId] = [...(riskAcks[itemId] ?? []), risk];
    }
    const gate = evaluateApplyGate(plan, {
      risks: riskAcks,
      conflicts: approval.acceptedConflicts.map((value) => {
        const separator = value.indexOf("::");
        return { conflictId: separator >= 0 ? value.slice(0, separator) : value, resolutionId: separator >= 0 ? value.slice(separator + 2) || undefined : undefined };
      }),
      approvals: approval.confirmedGates.map((value) => {
        const separator = value.indexOf("::");
        return { itemId: separator >= 0 ? value.slice(0, separator) : "", gateId: separator >= 0 ? value.slice(separator + 2) : value };
      })
    });
    if (!gate.ok) throw new PlanIntegrityError(`Approval gate refused: ${gate.reasons.join("; ")}`);
    record.status = "approved";
    record.approvalRecord = approval;
    record.payload = {
      ...plan,
      status: "approved",
      approvedPlanHash: currentHash,
      approvedAt: approval.approvedAt,
      approvedBy: approval.approvedBy,
      approvalRecord: approval
    };
    record.history = [
      ...(record.history ?? []),
      { at: approval.approvedAt, event: "reviewed" as const, actor: approval.approvedBy, note: `approved planHash ${currentHash}` }
    ].slice(-100);
    return record;
  });
}

export async function recordPlanDryRun(input: {
  id: string;
  userId: string;
  planHash: string;
  ok: boolean;
  actionRunIds: string[];
  idempotencyKey?: string;
  responseSnapshot?: unknown;
}): Promise<StoredEnvironmentPlan | undefined> {
  return mutateEnvironmentPlan(input.id, input.userId, (record) => {
    const plan = record.payload as EnvironmentPlan;
    if (computeEnvironmentPlanHash(plan) !== input.planHash) {
      throw new PlanIntegrityError("Dry-run result does not match the stored Environment Plan hash.");
    }
    const completedAt = new Date().toISOString();
    record.lastDryRunAt = completedAt;
    record.lastDryRunResult = {
      ok: input.ok,
      planHash: input.planHash,
      idempotencyKey: input.idempotencyKey,
      actionRunIds: [...input.actionRunIds],
      completedAt,
      responseSnapshot: input.responseSnapshot
    };
    return record;
  });
}

export async function claimPlanForApply(args: {
  planId: string;
  userId: string;
  expectedPlanHash: string;
  approvedPlanHash: string;
  idempotencyKey?: string;
}): Promise<ApplyClaim> {
  return updateRuntimeDatabase((db) => {
    db.environmentPlans = db.environmentPlans ?? [];
    db.applyRuns = db.applyRuns ?? [];
    db.applyIdempotencyRecords = db.applyIdempotencyRecords ?? [];

    const row = db.environmentPlans.find((candidate) => candidate.id === args.planId && candidate.userId === args.userId);
    if (!row) throw new PlanIntegrityError("Environment Plan not found for apply claim.");
    const plan = row.payload as EnvironmentPlan;
    const currentHash = computeEnvironmentPlanHash(plan);
    if (
      !verifyEnvironmentPlanHash(plan)
      || currentHash !== args.expectedPlanHash
      || plan.planHash !== args.expectedPlanHash
      || args.approvedPlanHash !== args.expectedPlanHash
    ) {
      throw new PlanIntegrityError("Apply claim rejected because the Environment Plan hash does not match.");
    }

    const now = new Date().toISOString();
    if (args.idempotencyKey) {
      const duplicate = db.applyIdempotencyRecords.find((record) =>
        record.userId === args.userId
        && record.planId === args.planId
        && record.key === args.idempotencyKey
      );
      if (duplicate) {
        if (duplicate.planHash !== args.expectedPlanHash) {
          throw new PlanIntegrityError("Idempotency key was already used for a different Environment Plan hash.");
        }
        return {
          claimId: duplicate.applyRunId,
          planId: args.planId,
          planHash: duplicate.planHash,
          idempotencyKey: args.idempotencyKey,
          status: "duplicate" as const,
          existingRunId: duplicate.applyRunId,
          createdAt: duplicate.createdAt
        };
      }
    }

    if (row.status === "applying" || plan.status === "applying") {
      const existing = row.activeApplyRunId ?? latestApplyRunForPlan(db.applyRuns, args.planId, args.expectedPlanHash)?.id;
      return {
        claimId: existing ?? createId("apply"),
        planId: args.planId,
        planHash: args.expectedPlanHash,
        idempotencyKey: args.idempotencyKey,
        status: "already-running" as const,
        existingRunId: existing,
        createdAt: now
      };
    }
    if (["succeeded", "partially-succeeded", "committed"].includes(row.status) || ["succeeded", "partially-succeeded", "committed"].includes(plan.status)) {
      const existing = latestApplyRunForPlan(db.applyRuns, args.planId, args.expectedPlanHash)?.id;
      return {
        claimId: existing ?? createId("apply"),
        planId: args.planId,
        planHash: args.expectedPlanHash,
        idempotencyKey: args.idempotencyKey,
        status: "already-applied" as const,
        existingRunId: existing,
        createdAt: now
      };
    }
    if (
      row.status !== "approved"
      || plan.status !== "approved"
      || plan.approvedPlanHash !== args.expectedPlanHash
      || row.approvalRecord?.planHash !== args.expectedPlanHash
      || plan.approvalRecord?.planHash !== args.expectedPlanHash
    ) {
      throw new PlanIntegrityError("Only hash-approved Environment Plans can be claimed for apply.");
    }

    const claimId = createId("apply");
    const run: StoredApplyRun = {
      id: claimId,
      userId: args.userId,
      planId: args.planId,
      planHash: args.expectedPlanHash,
      idempotencyKey: args.idempotencyKey,
      status: "running",
      createdAt: now,
      updatedAt: now
    };
    db.applyRuns.push(run);
    if (db.applyRuns.length > 1000) db.applyRuns.splice(0, db.applyRuns.length - 1000);
    if (args.idempotencyKey) {
      db.applyIdempotencyRecords.push({
        key: args.idempotencyKey,
        userId: args.userId,
        planId: args.planId,
        planHash: args.expectedPlanHash,
        applyRunId: claimId,
        status: "running",
        createdAt: now,
        updatedAt: now
      });
      if (db.applyIdempotencyRecords.length > 1000) {
        db.applyIdempotencyRecords.splice(0, db.applyIdempotencyRecords.length - 1000);
      }
    }
    row.status = "applying";
    row.updatedAt = now;
    row.activeApplyRunId = claimId;
    row.activeApplyPlanHash = args.expectedPlanHash;
    row.payload = { ...plan, status: "applying" };
    row.history = [
      ...(row.history ?? []),
      { at: now, event: "applied" as const, actor: args.userId, note: `claimed managed apply ${args.expectedPlanHash}` }
    ].slice(-100);

    return {
      claimId,
      planId: args.planId,
      planHash: args.expectedPlanHash,
      idempotencyKey: args.idempotencyKey,
      status: "claimed" as const,
      createdAt: now
    };
  });
}

export async function finalizeApplyClaim(input: {
  claimId: string;
  userId: string;
  ok: boolean;
  responseSnapshot?: unknown;
  error?: string;
}): Promise<StoredApplyRun | undefined> {
  return updateRuntimeDatabase((db) => {
    const run = (db.applyRuns ?? []).find((candidate) => candidate.id === input.claimId && candidate.userId === input.userId);
    if (!run) return undefined;
    const now = new Date().toISOString();
    const status = input.ok ? "succeeded" : "failed";
    run.status = status;
    run.responseSnapshot = input.responseSnapshot;
    run.error = input.error;
    run.updatedAt = now;
    run.completedAt = now;

    const idem = (db.applyIdempotencyRecords ?? []).find((record) =>
      record.userId === run.userId
      && record.planId === run.planId
      && record.planHash === run.planHash
      && record.applyRunId === run.id
    );
    if (idem) {
      idem.status = status;
      idem.responseSnapshot = input.responseSnapshot;
      idem.updatedAt = now;
    }

    const row = (db.environmentPlans ?? []).find((candidate) => candidate.id === run.planId && candidate.userId === run.userId);
    if (row && row.activeApplyRunId === run.id) {
      const plan = row.payload as EnvironmentPlan;
      row.status = input.ok ? "succeeded" : "failed";
      row.payload = { ...plan, status: row.status as EnvironmentPlanStatus };
      row.updatedAt = now;
      row.activeApplyRunId = undefined;
      row.activeApplyPlanHash = undefined;
      row.history = [
        ...(row.history ?? []),
        {
          at: now,
          event: "applied" as const,
          actor: input.userId,
          note: `managed apply ${input.ok ? "succeeded" : "failed"} for ${run.planHash}`
        }
      ].slice(-100);
    }
    return run;
  });
}

export async function getApplyRunResponse(runId: string, userId: string): Promise<unknown | undefined> {
  const db = await readRuntimeDatabase();
  const run = (db.applyRuns ?? []).find((candidate) => candidate.id === runId && candidate.userId === userId);
  if (!run) return undefined;
  if (run.responseSnapshot !== undefined) return run.responseSnapshot;
  return {
    dryRun: false,
    duplicate: true,
    applyRun: {
      id: run.id,
      planId: run.planId,
      planHash: run.planHash,
      status: run.status,
      idempotencyKey: run.idempotencyKey,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      completedAt: run.completedAt
    }
  };
}

export async function appendActionRunRecord(id: string, userId: string, run: ActionRunRecord): Promise<void> {
  await updateRuntimeDatabase((db) => {
    const plan = db.environmentPlans?.find((row) => row.id === id && row.userId === userId);
    if (!plan) throw new PlanIntegrityError("Cannot append an action run to a missing Environment Plan.");
    const payload = plan.payload as EnvironmentPlan;
    if (
      run.planId !== id
      || run.planHash !== payload.planHash
      || run.targetConnectionId !== payload.targetConnectionId
      || !payload.items.some((item) => item.actions.some((action) => action.id === run.actionId))
    ) {
      throw new PlanIntegrityError("ActionRunRecord is not bound to this Plan hash, target, and action.");
    }
    db.actionRuns = db.actionRuns ?? [];
    db.actionRuns.push(run);
    if (db.actionRuns.length > 1000) db.actionRuns.splice(0, db.actionRuns.length - 1000);
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
  if (status === "approved") {
    throw new PlanIntegrityError("Approved status can only be established by hash-bound approveEnvironmentPlan().");
  }
  return mutateEnvironmentPlan(id, userId, (record) => {
    record.status = status;
    const payload = record.payload as EnvironmentPlan | undefined;
    if (payload) record.payload = { ...payload, status };
    const event: StoredPlanHistoryEvent["event"] =
      status === "rolled-back"
        ? "rolled-back"
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

export const updateEnvironmentPlanStatus = setPlanStatus;

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
