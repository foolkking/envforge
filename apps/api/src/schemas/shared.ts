/**
 * schemas/shared.ts — Phase 6R-B validation primitives.
 *
 * Zero-dependency pure functions for runtime request validation.
 * Each function returns either the parsed value or a structured error.
 * No throws, no side effects, no secret logging.
 */

// ══ Validation Result Shape ══════════════════════════════════════════════

export interface ValidationOk<T> {
  ok: true;
  value: T;
}

export interface ValidationErr {
  ok: false;
  error: string;
  field?: string;
}

export type ValidationResult<T> = ValidationOk<T> | ValidationErr;

// ══ Primitives ═══════════════════════════════════════════════════════════

export function ensureObject(
  value: unknown,
  field?: string
): ValidationResult<Record<string, unknown>> {
  if (value === null || value === undefined) {
    return { ok: false, error: "Request body is required.", field };
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Request body must be a JSON object.", field };
  }
  return { ok: true, value: value as Record<string, unknown> };
}

export function ensureString(
  value: unknown,
  field: string,
  opts?: { min?: number; max?: number }
): ValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: `${field} must be a string.`, field };
  }
  if (opts?.min !== undefined && value.length < opts.min) {
    return { ok: false, error: `${field} must be at least ${opts.min} characters.`, field };
  }
  if (opts?.max !== undefined && value.length > opts.max) {
    return { ok: false, error: `${field} must be at most ${opts.max} characters.`, field };
  }
  return { ok: true, value };
}

export function ensureNonEmptyString(
  value: unknown,
  field: string,
  opts?: { max?: number }
): ValidationResult<string> {
  const r = ensureString(value, field);
  if (!r.ok) return r;
  if (r.value.trim().length === 0) {
    return { ok: false, error: `${field} must not be empty.`, field };
  }
  if (opts?.max !== undefined && r.value.length > opts.max) {
    return { ok: false, error: `${field} must be at most ${opts.max} characters.`, field };
  }
  return { ok: true, value: r.value.trim() };
}

export function ensureOptionalString(
  value: unknown,
  field: string,
  opts?: { max?: number }
): ValidationResult<string | undefined> {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  const r = ensureString(value, field);
  if (!r.ok) return r;
  if (opts?.max !== undefined && r.value.length > opts.max) {
    return { ok: false, error: `${field} must be at most ${opts.max} characters.`, field };
  }
  return { ok: true, value: r.value };
}

export function ensureBoolean(
  value: unknown,
  field: string
): ValidationResult<boolean> {
  if (typeof value !== "boolean") {
    return { ok: false, error: `${field} must be a boolean.`, field };
  }
  return { ok: true, value };
}

export function ensureOptionalBoolean(
  value: unknown,
  field: string
): ValidationResult<boolean | undefined> {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  return ensureBoolean(value, field);
}

export function ensureEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string
): ValidationResult<T> {
  const r = ensureString(value, field);
  if (!r.ok) return r;
  if (!allowed.includes(r.value as T)) {
    return {
      ok: false,
      error: `${field} must be one of: ${allowed.join(", ")}.`,
      field,
    };
  }
  return { ok: true, value: r.value as T };
}

export function ensureStringArray(
  value: unknown,
  field: string,
  opts?: { max?: number; allowEmpty?: boolean }
): ValidationResult<string[]> {
  if (!Array.isArray(value)) {
    return { ok: false, error: `${field} must be an array.`, field };
  }
  if (opts?.max !== undefined && value.length > opts.max) {
    return { ok: false, error: `${field} must have at most ${opts.max} items.`, field };
  }
  if (!opts?.allowEmpty && value.length === 0) {
    return { ok: false, error: `${field} must not be empty.`, field };
  }
  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== "string") {
      return { ok: false, error: `${field}[${i}] must be a string.`, field };
    }
    if (value[i].trim().length === 0) {
      return { ok: false, error: `${field}[${i}] must not be empty.`, field };
    }
  }
  return { ok: true, value: value.map((v) => (v as string).trim()) };
}

export function ensureOptionalStringArray(
  value: unknown,
  field: string,
  opts?: { max?: number }
): ValidationResult<string[] | undefined> {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  return ensureStringArray(value, field, { ...opts, allowEmpty: true });
}

export function ensureObjectArray(
  value: unknown,
  field: string,
  opts?: { max?: number; allowEmpty?: boolean }
): ValidationResult<Record<string, unknown>[]> {
  if (!Array.isArray(value)) {
    return { ok: false, error: `${field} must be an array.`, field };
  }
  if (opts?.max !== undefined && value.length > opts.max) {
    return { ok: false, error: `${field} must have at most ${opts.max} items.`, field };
  }
  if (!opts?.allowEmpty && value.length === 0) {
    return { ok: false, error: `${field} must not be empty.`, field };
  }
  for (let i = 0; i < value.length; i++) {
    if (value[i] === null || typeof value[i] !== "object" || Array.isArray(value[i])) {
      return { ok: false, error: `${field}[${i}] must be an object.`, field };
    }
  }
  return { ok: true, value: value as Record<string, unknown>[] };
}

// ══ Helpers ══════════════════════════════════════════════════════════════

export function forbidFields(
  body: Record<string, unknown>,
  forbidden: readonly string[]
): ValidationErr | null {
  const found = forbidden.filter((f) =>
    Object.prototype.hasOwnProperty.call(body, f)
  );
  if (found.length > 0) {
    return {
      ok: false,
      error: `Request body contains forbidden field(s): ${found.join(", ")}.`,
    };
  }
  return null;
}

export function restrictFields(
  body: Record<string, unknown>,
  allowed: readonly string[]
): ValidationErr | null {
  const unknown = Object.keys(body).filter((f) => !allowed.includes(f));
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `Request body contains unsupported field(s): ${unknown.join(", ")}.`,
    };
  }
  return null;
}
