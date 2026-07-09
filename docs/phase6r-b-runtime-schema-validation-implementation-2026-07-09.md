# Phase 6R-B: Runtime Schema Validation Implementation

- **Date**: 2026-07-09
- **Phase**: 6R-B (implementation)
- **Stable baseline**: `b058ce7` — Implement PostgreSQL data migration dry-run first closed loop
- **Result**: **PASS**

---

## 1. Baseline

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD before | `b058ce7` |
| Commit msg before | `Implement PostgreSQL data migration dry-run first closed loop — Phase 5R-B` |
| `origin/main` sync | Synced — `0 ahead, 0 behind` |
| Full API suite before | 974/974 pass |
| Phase 6R-A report | `docs/phase6r-a-runtime-schema-validation-routes-split-planning-2026-07-09.md` — present |

---

## 2. Files Changed

| File | Change type | Lines |
|---|---|---|
| `apps/api/src/schemas/shared.ts` | **NEW** | ~190 lines — validation primitives (ensureObject, ensureString, ensureEnum, etc.) |
| `apps/api/src/schemas/plan-schemas.ts` | **NEW** | ~260 lines — plan create/review/apply validators |
| `apps/api/src/schemas/migration-schemas.ts` | **NEW** | ~100 lines — migration decision validator |
| `apps/api/src/engine/tests/schema-validation.test.ts` | **NEW** | ~280 lines — 26 tests (18 core + 8 shared primitive tests) |
| `apps/api/src/routes.ts` | **Modify** | +15 lines — 2 imports + 4 validation calls |
| `apps/api/src/engine/tests/plan-apply-security-routes.test.ts` | **Modify** | +5/-3 lines — updated test for stricter boundary behavior |

**Total**: 4 new files (~830 lines), 2 modified files (+20/-3 lines). **Zero npm dependencies. Zero Fastify config changes. Zero route handler extraction.**

---

## 3. Validators Added

### 3.1 `schemas/shared.ts` — Validation Primitives

| Function | Purpose |
|---|---|
| `ensureObject(value)` | Rejects null/undefined/arrays |
| `ensureString(value, field, opts?)` | Type checking + min/max length |
| `ensureNonEmptyString(value, field, opts?)` | String + non-empty after trim |
| `ensureOptionalString(value, field, opts?)` | Undefined/null → undefined, else string |
| `ensureBoolean(value, field)` | Type checking for booleans |
| `ensureOptionalBoolean(value, field)` | Undefined/null → undefined, else boolean |
| `ensureEnum(value, allowed, field)` | String + must be in allowed set |
| `ensureStringArray(value, field, opts?)` | Array + element type + trim + dedup |
| `ensureOptionalStringArray(value, field, opts?)` | Undefined/null → undefined, else string array |
| `ensureObjectArray(value, field, opts?)` | Array + element type checking |
| `forbidFields(body, forbidden)` | Returns error if forbidden fields present |
| `restrictFields(body, allowed)` | Returns error if extra fields present |

All functions return `{ ok: true; value: T } | { ok: false; error: string; field?: string }`. Pure functions, no throws, no side effects.

### 3.2 `schemas/plan-schemas.ts` — Plan Route Validators

| Validator | Target Route | Coverage |
|---|---|---|
| `validateCreatePlanBody` | `POST /api/plans` | Body must be object, source.kind must be valid enum, per-kind field validation |
| `validateReviewPlanBody` | `POST /api/plans/:id/review` | `plan` field forbidden, decision must be "approved" or "rejected", acknowledgement arrays validated |
| `validateApplyPlanBody` | `POST /api/plans/:id/apply` | 14 forbidden fields rejected, 3 allowed fields only, boolean/string type checks |

### 3.3 `schemas/migration-schemas.ts` — Migration Decision Validator

| Validator | Target Route | Coverage |
|---|---|---|
| `validateMigrationDecisionsBody` | `POST /api/migration/sessions/:sessionId/decisions` | Body must be object, decision must be valid enum (9 values), candidateIds must be array of non-empty strings, max 500 items |

---

## 4. Routes Wired

| Route | Validator | Lines Changed |
|---|---|---|
| `POST /api/plans` | `validateCreatePlanBody` | +3 lines (import + validation + early return) |
| `POST /api/plans/:id/review` | `validateReviewPlanBody` | +3 lines |
| `POST /api/plans/:id/apply` | `validateApplyPlanBody` | +3 lines |
| `POST /api/migration/sessions/:sessionId/decisions` | `validateMigrationDecisionsBody` | +3 lines |

Each route adds the validator call **after** auth check and **before** body destructuring. Invalid bodies return 400 with `{ error: "Invalid request body.", details: [...] }`. Valid bodies continue through the existing handler path unchanged.

---

## 5. Tests Added

| # | Test | Result |
|---|---|---|
| S1 | `validateCreatePlanBody` — valid capability-selection | PASS |
| S2 | `validateCreatePlanBody` — valid recipe | PASS |
| S3 | `validateCreatePlanBody` — valid config-change | PASS |
| S4 | `validateCreatePlanBody` — missing source.kind | PASS |
| S5 | `validateCreatePlanBody` — unknown source.kind | PASS |
| S6 | `validateCreatePlanBody` — null body | PASS |
| S7 | `validateCreatePlanBody` — array body | PASS |
| S8 | `validateReviewPlanBody` — approved | PASS |
| S9 | `validateReviewPlanBody` — rejected + note | PASS |
| S10 | `validateReviewPlanBody` — invalid decision | PASS |
| S11 | `validateReviewPlanBody` — forbidden plan field | PASS |
| S12 | `validateApplyPlanBody` — dryRun=true | PASS |
| S13 | `validateApplyPlanBody` — full non-dryRun | PASS |
| S14 | `validateApplyPlanBody` — forbidden field (plan) | PASS |
| S15 | `validateApplyPlanBody` — unknown field | PASS |
| S16 | `validateMigrationDecisionsBody` — valid with candidateIds | PASS |
| S17 | `validateMigrationDecisionsBody` — candidateIds not array | PASS |
| S18 | `validateMigrationDecisionsBody` — candidateIds non-string | PASS |
| SS1 | Validation error shape stable | PASS |
| SS2 | No stack traces in errors | PASS |
| SS3 | No secret-like values | PASS |
| SS4 | `ensureString` rejects non-strings | PASS |
| SS5 | `ensureEnum` rejects unknown values | PASS |
| SS6 | `ensureStringArray` trims whitespace | PASS |
| SS7 | `forbidFields` rejects forbidden | PASS |
| SS8 | `restrictFields` rejects unsupported | PASS |

**Targeted**: 26/26 pass (100%).

The existing security test `plan-apply-security-routes.test.ts` was minimally updated: the payload-injection test now expects 400 (schema boundary rejection) instead of 404 (DB lookup). This is a **security hardening** — forbidden fields are rejected before any DB access.

---

## 6. Commands Run

| Command | Result |
|---|---|
| `npx tsc -p apps/api/tsconfig.json --noEmit` | **CLEAN** — 0 errors |
| `npm run build` | **PASS** |
| `node --test apps/api/dist/engine/tests/schema-validation.test.js` | **26/26 pass** |
| `node --test --test-concurrency=1 apps/api/dist/engine/tests` (full suite) | **1000/1000 pass** (15 suites, 0 failures) |

---

## 7. Validation Error Shape

```json
// Valid body:
// → continues through existing handler, success response unchanged

// Invalid body:
{
  "error": "Invalid request body.",
  "details": [
    {
      "ok": false,
      "error": "decision must be one of: approved, rejected.",
      "field": "decision"
    }
  ]
}
```

Key properties:
- Stable 400 status code for all validation failures
- `error` field is a human-readable string, never a stack trace
- `details` array contains per-field validation results
- No raw input values echoed in errors (no secret leakage)
- Compatible with existing error patterns in routes.ts

---

## 8. Compatibility Notes

- All existing routes continue to work unchanged — validators only inspect, never mutate
- Auth ordering preserved — validation runs after `getUserByToken()`, not before
- Legacy mutation routes (12 patterns) remain 410 via the existing `preHandler` hook — untouched
- Existing plan security tests updated for stricter boundary (400 vs 404 on payload injection) — this is a **strengthening**, not a regression
- Zero npm dependencies added — no package.json changes
- Zero Fastify plugin/hook changes
- All route handlers remain in `routes.ts` — no handler extraction performed
- PostgreSQL dry-run, InventoryGraph, ServiceStack, Secret Transport, Conflict Resolver — all untouched

---

## 9. Explicit Non-Goals Honored

| Non-goal | Status |
|---|---|
| No npm dependency added | ✅ Zero package.json changes |
| No Zod / TypeBox / Ajv | ✅ Pure TypeScript functions only |
| No Fastify global config changes | ✅ No plugin/hook changes |
| No route handler extraction | ✅ All handlers remain in routes.ts |
| No new product features | ✅ Validators are purely additive safety |
| No UI changes | ✅ None |
| No Data Migration dry-run semantic changes | ✅ Untouched |
| No PostgreSQL migration intent/dry-run builder changes | ✅ Untouched |
| No Environment Plan execution semantic changes | ✅ Untouched |
| No plan approval semantic changes | ✅ Untouched |
| No InventoryGraph/ServiceStack changes | ✅ Untouched |
| No Secret Transport / Conflict Resolver changes | ✅ Untouched |
| No legacy mutation route revival | ✅ 12 routes still 410 |
| 974/974 suite preserved → 1000/1000 | ✅ +26 new tests |

---

## 10. HEAD After

| Item | Value |
|---|---|
| HEAD after | (to be filled after commit) |
| Commit message | `Add runtime schema validation for high-risk routes` |
| Pushed | No (push is Phase 6R-C) |

---

## 11. Next Step

**Phase 6R-C**: Runtime Schema Validation Evidence Closure — push to origin, produce evidence report, verify execution safety.

---

*Report generated 2026-07-09. Phase 6R-B implementation complete.*
