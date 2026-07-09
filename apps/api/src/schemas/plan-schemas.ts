/**
 * schemas/plan-schemas.ts — Phase 6R-B plan route validators.
 *
 * Runtime schema validation for the three highest-risk plan mutation routes:
 *   POST /api/plans          — create
 *   POST /api/plans/:id/review — review
 *   POST /api/plans/:id/apply  — apply
 *
 * Pure functions, zero dependencies, no side effects.
 */

import {
  ensureObject,
  ensureString,
  ensureNonEmptyString,
  ensureOptionalString,
  ensureBoolean,
  ensureOptionalBoolean,
  ensureEnum,
  ensureStringArray,
  ensureOptionalStringArray,
  ensureObjectArray,
  forbidFields,
  restrictFields,
  type ValidationResult,
} from "./shared.js";

// ══ Shared kind lists ════════════════════════════════════════════════════

const PLAN_SOURCE_KINDS = [
  "capability-selection",
  "recipe",
  "remove-request",
  "config-change",
  "repair-failures",
  "migration-session",
] as const;

type PlanSourceKind = (typeof PLAN_SOURCE_KINDS)[number];

const REVIEW_DECISIONS = ["approved", "rejected"] as const;

const APPLY_ALLOWED_FIELDS = [
  "dryRun",
  "idempotencyKey",
  "targetConnectionId",
] as const;

const APPLY_FORBIDDEN_FIELDS = [
  "plan",
  "path",
  "content",
  "yaml",
  "actions",
  "export",
  "approvals",
  "acknowledged",
  "gateAcknowledgements",
  "acknowledgedActionIds",
  "acknowledgedRisks",
  "acknowledgedConflicts",
  "acknowledgedApprovals",
  "unmanagedRiskAcknowledged",
] as const;

// ══ Create Plan ══════════════════════════════════════════════════════════

export interface ValidatedPlanCreateBody {
  targetConnectionId?: string;
  sourceConnectionId?: string;
  source?: {
    kind: PlanSourceKind;
    [key: string]: unknown;
  };
}

export function validateCreatePlanBody(
  raw: unknown
): ValidationResult<ValidatedPlanCreateBody> {
  const obj = ensureObject(raw);
  if (!obj.ok) return obj;

  const body = obj.value;
  const result: ValidatedPlanCreateBody = {};

  // targetConnectionId (optional string)
  if (Object.prototype.hasOwnProperty.call(body, "targetConnectionId")) {
    const v = ensureNonEmptyString(body.targetConnectionId, "targetConnectionId");
    if (!v.ok) return v;
    result.targetConnectionId = v.value;
  }

  // sourceConnectionId (optional string)
  if (Object.prototype.hasOwnProperty.call(body, "sourceConnectionId")) {
    const v = ensureOptionalString(body.sourceConnectionId, "sourceConnectionId");
    if (!v.ok) return v;
    result.sourceConnectionId = v.value;
  }

  // source (optional object with kind discriminator)
  if (
    body.source !== undefined &&
    body.source !== null
  ) {
    if (typeof body.source !== "object" || Array.isArray(body.source)) {
      return { ok: false, error: "source must be an object.", field: "source" };
    }
    const src = body.source as Record<string, unknown>;

    if (!Object.prototype.hasOwnProperty.call(src, "kind") || typeof src.kind !== "string") {
      return {
        ok: false,
        error: `source.kind is required and must be one of: ${PLAN_SOURCE_KINDS.join(", ")}.`,
        field: "source.kind",
      };
    }

    const kind = src.kind as PlanSourceKind;
    if (!PLAN_SOURCE_KINDS.includes(kind)) {
      return {
        ok: false,
        error: `source.kind must be one of: ${PLAN_SOURCE_KINDS.join(", ")}.`,
        field: "source.kind",
      };
    }

    // Per-kind field validation
    if (kind === "capability-selection") {
      if (
        Object.prototype.hasOwnProperty.call(src, "capabilityIds") &&
        src.capabilityIds !== undefined &&
        src.capabilityIds !== null
      ) {
        const v = ensureStringArray(src.capabilityIds, "source.capabilityIds");
        if (!v.ok) return v;
      }
    }

    if (kind === "recipe") {
      if (
        Object.prototype.hasOwnProperty.call(src, "yaml") &&
        src.yaml !== undefined &&
        src.yaml !== null
      ) {
        const v = ensureString(src.yaml, "source.yaml");
        if (!v.ok) return v;
      }
    }

    if (kind === "remove-request") {
      if (
        Object.prototype.hasOwnProperty.call(src, "packages") &&
        src.packages !== undefined &&
        src.packages !== null
      ) {
        const v = ensureStringArray(src.packages, "source.packages", { allowEmpty: true });
        if (!v.ok) return v;
      }
    }

    if (kind === "config-change") {
      if (Object.prototype.hasOwnProperty.call(src, "path")) {
        const v = ensureNonEmptyString(src.path, "source.path");
        if (!v.ok) return v;
      }
      if (Object.prototype.hasOwnProperty.call(src, "content")) {
        const v = ensureString(src.content, "source.content");
        if (!v.ok) return v;
      }
    }

    if (kind === "repair-failures") {
      if (
        Object.prototype.hasOwnProperty.call(src, "failures") &&
        src.failures !== undefined &&
        src.failures !== null
      ) {
        const v = ensureObjectArray(src.failures, "source.failures");
        if (!v.ok) return v;
      }
    }

    if (kind === "migration-session") {
      if (Object.prototype.hasOwnProperty.call(src, "sessionId")) {
        const v = ensureNonEmptyString(src.sessionId, "source.sessionId");
        if (!v.ok) return v;
      }
    }

    result.source = { kind, ...src };
  }

  return { ok: true, value: result };
}

// ══ Review Plan ═════════════════════════════════════════════════════════

export interface ValidatedPlanReviewBody {
  decision: "approved" | "rejected";
  note?: string;
  acknowledgedRisks?: Array<{ itemId: string; risks: string[] }>;
  acknowledgedConflicts?: Array<{ conflictId: string; resolutionId?: string }>;
  acknowledgedApprovals?: Array<{ itemId: string; gateId: string }>;
}

export function validateReviewPlanBody(
  raw: unknown
): ValidationResult<ValidatedPlanReviewBody> {
  const obj = ensureObject(raw);
  if (!obj.ok) return obj;

  const body = obj.value;

  // plan field is forbidden
  const forbidden = forbidFields(body, ["plan"]);
  if (forbidden) return forbidden;

  // decision (required: "approved" | "rejected")
  const decision = ensureEnum(body.decision, REVIEW_DECISIONS, "decision");
  if (!decision.ok) return decision;

  const result: ValidatedPlanReviewBody = {
    decision: decision.value,
  };

  // note (optional string)
  if (body.note !== undefined && body.note !== null) {
    const v = ensureOptionalString(body.note, "note", { max: 5000 });
    if (!v.ok) return v;
    result.note = v.value;
  }

  // acknowledgedRisks (optional array of objects)
  if (body.acknowledgedRisks !== undefined && body.acknowledgedRisks !== null) {
    const arr = ensureObjectArray(body.acknowledgedRisks, "acknowledgedRisks", {
      allowEmpty: true,
      max: 200,
    });
    if (!arr.ok) return arr;
    for (let i = 0; i < arr.value.length; i++) {
      const item = arr.value[i];
      const id = ensureNonEmptyString(item.itemId, `acknowledgedRisks[${i}].itemId`);
      if (!id.ok) return id;
      const risks = ensureStringArray(item.risks, `acknowledgedRisks[${i}].risks`, {
        allowEmpty: true,
        max: 100,
      });
      if (!risks.ok) return risks;
    }
    result.acknowledgedRisks = arr.value.map((item) => ({
      itemId: item.itemId as string,
      risks: item.risks as string[],
    }));
  }

  // acknowledgedConflicts (optional array of objects)
  if (body.acknowledgedConflicts !== undefined && body.acknowledgedConflicts !== null) {
    const arr = ensureObjectArray(body.acknowledgedConflicts, "acknowledgedConflicts", {
      allowEmpty: true,
      max: 200,
    });
    if (!arr.ok) return arr;
    for (let i = 0; i < arr.value.length; i++) {
      const item = arr.value[i];
      const id = ensureNonEmptyString(
        item.conflictId,
        `acknowledgedConflicts[${i}].conflictId`
      );
      if (!id.ok) return id;
      if (item.resolutionId !== undefined && item.resolutionId !== null) {
        const v = ensureString(
          item.resolutionId,
          `acknowledgedConflicts[${i}].resolutionId`
        );
        if (!v.ok) return v;
      }
    }
    result.acknowledgedConflicts = arr.value.map((item) => ({
      conflictId: item.conflictId as string,
      resolutionId: (item.resolutionId as string) || undefined,
    }));
  }

  // acknowledgedApprovals (optional array of objects)
  if (body.acknowledgedApprovals !== undefined && body.acknowledgedApprovals !== null) {
    const arr = ensureObjectArray(body.acknowledgedApprovals, "acknowledgedApprovals", {
      allowEmpty: true,
      max: 200,
    });
    if (!arr.ok) return arr;
    for (let i = 0; i < arr.value.length; i++) {
      const item = arr.value[i];
      const id = ensureNonEmptyString(
        item.itemId,
        `acknowledgedApprovals[${i}].itemId`
      );
      if (!id.ok) return id;
      const gate = ensureNonEmptyString(
        item.gateId,
        `acknowledgedApprovals[${i}].gateId`
      );
      if (!gate.ok) return gate;
    }
    result.acknowledgedApprovals = arr.value.map((item) => ({
      itemId: item.itemId as string,
      gateId: item.gateId as string,
    }));
  }

  return { ok: true, value: result };
}

// ══ Apply Plan ══════════════════════════════════════════════════════════

export interface ValidatedPlanApplyBody {
  dryRun?: boolean;
  idempotencyKey?: string;
  targetConnectionId?: string;
}

export function validateApplyPlanBody(
  raw: unknown
): ValidationResult<ValidatedPlanApplyBody> {
  const obj = ensureObject(raw);
  if (!obj.ok) return obj;

  const body = obj.value;

  // Forbidden fields
  const forbidden = forbidFields(body, APPLY_FORBIDDEN_FIELDS);
  if (forbidden) return forbidden;

  // Allowed fields only
  const restricted = restrictFields(body, APPLY_ALLOWED_FIELDS);
  if (restricted) return restricted;

  const result: ValidatedPlanApplyBody = {};

  if (Object.prototype.hasOwnProperty.call(body, "dryRun")) {
    const v = ensureBoolean(body.dryRun, "dryRun");
    if (!v.ok) return v;
    result.dryRun = v.value;
  }

  if (Object.prototype.hasOwnProperty.call(body, "idempotencyKey")) {
    const v = ensureString(body.idempotencyKey, "idempotencyKey", { max: 256 });
    if (!v.ok) return v;
    result.idempotencyKey = v.value;
  }

  if (Object.prototype.hasOwnProperty.call(body, "targetConnectionId")) {
    const v = ensureNonEmptyString(body.targetConnectionId, "targetConnectionId");
    if (!v.ok) return v;
    result.targetConnectionId = v.value;
  }

  return { ok: true, value: result };
}
