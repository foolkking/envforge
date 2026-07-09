/**
 * schemas/migration-schemas.ts — Phase 6R-B migration decision validators.
 *
 * Runtime schema validation for migration decision routes:
 *   POST /api/migration/sessions/:sessionId/decisions
 *
 * Pure functions, zero dependencies, no side effects.
 */

import {
  ensureObject,
  ensureString,
  ensureOptionalString,
  ensureEnum,
  ensureStringArray,
  type ValidationResult,
} from "./shared.js";

// ══ Shared enums (mirrors runtime-store.ts types) ═══════════════════════

const MIGRATION_DECISIONS = [
  "pending",
  "approved",
  "skipped",
  "ignore",
  "record-only",
  "migrate-artifact",
  "create-catalog-draft",
  "add-to-plan",
  "needs-manual-instruction",
] as const;

type MigrationDecision = (typeof MIGRATION_DECISIONS)[number];

// ══ Migration Decisions Body ════════════════════════════════════════════

export interface ValidatedMigrationDecisionsBody {
  candidateId?: string;
  candidateIds?: string[];
  decision: MigrationDecision;
  note?: string;
}

export function validateMigrationDecisionsBody(
  raw: unknown
): ValidationResult<ValidatedMigrationDecisionsBody> {
  const obj = ensureObject(raw);
  if (!obj.ok) return obj;

  const body = obj.value;

  // candidateId (optional)
  let candidateId: string | undefined;
  if (
    Object.prototype.hasOwnProperty.call(body, "candidateId") &&
    body.candidateId !== undefined &&
    body.candidateId !== null
  ) {
    const v = ensureString(body.candidateId, "candidateId");
    if (!v.ok) return v;
    candidateId = v.value.trim();
  }

  // candidateIds (optional array)
  let candidateIds: string[] | undefined;
  if (
    Object.prototype.hasOwnProperty.call(body, "candidateIds") &&
    body.candidateIds !== undefined &&
    body.candidateIds !== null
  ) {
    const v = ensureStringArray(body.candidateIds, "candidateIds", {
      max: 500,
      allowEmpty: true,
    });
    if (!v.ok) return v;
    candidateIds = v.value;
  }

  // decision (required)
  const decision = ensureEnum(body.decision, MIGRATION_DECISIONS, "decision");
  if (!decision.ok) return decision;

  // note (optional)
  let note: string | undefined;
  if (body.note !== undefined && body.note !== null) {
    const v = ensureOptionalString(body.note, "note", { max: 5000 });
    if (!v.ok) return v;
    note = v.value;
  }

  return {
    ok: true,
    value: {
      candidateId: candidateId || undefined,
      candidateIds,
      decision: decision.value,
      note,
    },
  };
}
