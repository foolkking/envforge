# Phase 6R-A: Runtime Schema Validation + Routes Split Planning

- **Date**: 2026-07-09
- **Phase**: 6R-A (planning only — zero implementation)
- **Stable baseline**: `b058ce7` — Implement PostgreSQL data migration dry-run first closed loop
- **Result**: **PASS**

---

## 1. Baseline

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `b058ce7` |
| Commit msg | `Implement PostgreSQL data migration dry-run first closed loop — Phase 5R-B` |
| `origin/main` sync | Synced — `0 ahead, 0 behind` |
| `git status --short` | `?? docs/audit-report-2026-07-08.md` (only untracked) |
| Full API suite | **974/974 pass** (15 suites, 0 failures) |
| Reconciliation report | `docs/phase-plan-reconciliation-2026-07-09.md` — present |
| Phase 5R-A report | `docs/phase5r-a-data-migration-first-closed-loop-planning-2026-07-09.md` — present |
| Phase 5R-B report | `docs/phase5r-b-postgres-dry-run-first-closed-loop-implementation-2026-07-09.md` — present |
| `docs/audit-report-2026-07-08.md` | Present (pre-existing, untracked) |
| Audit finding #2 | `routes.ts` 6504 lines monolithic (now measured at 6539) |
| Audit finding #10.2 | Route 10.2: "无 Zod/TypeBox/Fastify JSON Schema — 所有输入解析为手动类型断言" (FAIL) |

**Baseline verdict**: CLEAN — no unexpected files, HEAD matches expected, remote synced, full suite green.

---

## 2. Reconciliation Context

From `docs/phase-plan-reconciliation-2026-07-09.md` §6.1:

> **Phase 6R** — Original Phase 6: Runtime schema validation + routes split

Phase 6R is the **resumed** original roadmap Phase 6. Previous work labeled "Phase 6" (`3d9d740` + `851c655`) was reclassified as Phase 4F (route exposure extension). The original goal — runtime schema validation for high-risk mutation routes and minimal `routes.ts` split — has never been started.

From `docs/audit-report-2026-07-08.md`:

- **#2 (Critical)**: "routes.ts 6504 行单体巨石" — 6504 lines, ~160 routes, all inline, no domain partitioning
- **§10.1 (FAIL)**: "routes.ts 拆分" — no domain route files
- **§10.2 (FAIL)**: "Runtime Schema Validation" — no Zod/TypeBox/Fastify JSON Schema; all input parsed as manual type assertions

Non-goals inherited from Phase 5R:
- No Data Migration execution
- No Secret Transport
- No Conflict Resolver
- No UI changes
- No broad refactoring
- No PostgreSQL dry-run semantic changes
- No InventoryGraph/ServiceStack semantic changes

---

## 3. Current Route Surface Map

### 3.1 Size Metrics

| Metric | Value |
|---|---|
| `routes.ts` lines | **6539** |
| Route registrations | **228** (`app.get` / `app.post` / `app.put` / `app.patch` / `app.delete`) |
| Manual type assertions (`as T`) | **240** |
| Route groups (section comments) | **32** |
| Disabled legacy mutation routes (410) | **12** |
| Dynamic imports in route handlers | ~30 |
| `preHandler` hooks | **1** (global legacy-mutation gate) |
| Pre-existing Fastify schemas | **0** |

### 3.2 Major Route Groups

| # | Group | Section Start | Routes | Methods | Risk |
|---|---|---|---|---|---|
| 1 | Health/Ready | L222 | 2 | GET | Low (read-only) |
| 2 | Scan/Snapshots | L235 | 2 | POST, GET | Low (read-only scanner) |
| 3 | Targets (connections) | L260 | 2 | GET, POST | Medium (probe accepts URL) |
| 4 | Catalog read | L311 | 4 | GET | Low (read-only) |
| 5 | Capability catalog preview | L381 | 3 | GET, POST | Low (read-only previews) |
| 6 | Build suggestions | L448 | 1 | GET | Low |
| 7 | Admin capability standards | L522 | 11 | GET,POST,PATCH | **High** (admin mutation) |
| 8 | Catalog vars-schema | L1166 | 4 | GET,POST,DELETE | Medium (admin config mutation) |
| 9 | Catalog preview (commands) | L1252 | 1 | POST | **High** (accepts vars→command) |
| 10 | Migration strategies | L1275 | 1 | GET | Low |
| 11 | User profile /me | L1290 | 12 | GET,PATCH,POST,PUT,DELETE | Medium (mutation + 2FA) |
| 12 | Auth (register/login/oauth) | L1600 | 16 | GET,POST,PATCH | **High** (auth mutation) |
| 13 | Connections CRUD | L2358 | 8 | GET,POST,DELETE,PATCH | Medium (connection mutation) |
| 14 | Profiles CRUD | L2436 | 7 | GET,POST,PATCH,DELETE | Medium |
| 15 | Legacy execute (disabled) | L2517 | 1 | POST | **N/A** (410 blocked) |
| 16 | Impact analysis | L2525 | 2 | GET,POST | Low |
| 17 | Remove capability plan | L2591 | 2 | POST | Medium |
| 18 | Docker compose | L2641 | 1 | GET | Low |
| 19 | Deploy stage (disabled) | L2673 | 2 | GET,POST | **N/A** (410 blocked) |
| 20 | Tasks/Queues | L2706 | 5 | GET | Low (read-only) |
| 21 | Admin users | L2769 | 3 | GET,PUT,POST | **High** (admin mutation) |
| 22 | Extract combo | L2872 | 1 | GET | Low |
| 23 | Diff/Restore | L2912 | 2 | POST | Medium |
| 24 | SSH Keys | L2934 | 3 | POST,GET,DELETE | Medium |
| 25 | Evidence capture/preflight | L2961 | 4 | GET | Low (read-only) |
| 26 | Compatibility check | L3068 | 1 | POST | Low |
| 27 | Connection verify | L3101 | 1 | POST | Medium (SSH verify) |
| 28 | **Environment Plans** | L3142 | 7 | POST,GET | **CRITICAL** (plan create/apply/review/verify/rollback) |
| 29 | Rebuild plan (disabled apply) | L3747 | 3 | POST | **N/A** (410 blocked) |
| 30 | Batch/Multi execute (disabled) | L3776 | 2 | POST | **N/A** (410 blocked) |
| 31 | Task stream/cancel | L3795 | 2 | GET,POST | Low |
| 32 | Playbook CRUD | L3827 | 5 | GET,POST,PATCH,DELETE | Medium |
| 33 | Config files | L3909 | 11 | GET,POST | **High** (config write/change-plan/migration-plan) |
| 34 | Decision engine | L4064 | 8 | GET,PUT,DELETE,PATCH | Medium |
| 35 | **Migration sessions** | L4388 | 18 | GET,POST,PATCH | **CRITICAL** (decisions/data-decisions/dry-run/plan) |
| 36 | Inventory Graph (Phase 6-B) | L4580 | 3 | GET | Low (read-only) |
| 37 | Failure diagnostics | L4612 | 1 | GET | Low |
| 38 | Support bundle | L4642 | 1 | GET | Low |
| 39 | Migration candidates (connection) | L5088 | 6 | GET,POST | Medium |
| 40 | Migration plan (connection) | L5133 | 7 | GET,POST | **High** (dry-run/apply/verify) |
| 41 | Schedules | L5364 | 5 | GET,POST,PATCH,DELETE | Medium |
| 42 | Drift detection | L5398 | 2 | POST,GET | Medium |
| 43 | Webhooks | L5435 | 6 | GET,POST,PATCH,DELETE | Medium |
| 44 | Module docs | L5526 | 1 | GET | Low |
| 45 | API tokens | L5533 | 3 | GET,POST,DELETE | Medium |
| 46 | Admin catalog management | L5603 | 7 | GET,POST,PATCH,DELETE | **High** (admin) |
| 47 | Capability rules | L5918 | 7 | GET,POST,PATCH,DELETE | **High** (admin) |
| 48 | Comments/Likes/Reports | L6049 | 6 | GET,POST | Medium |
| 49 | Admin reports/comments | L6188 | 3 | GET,POST | Medium |
| 50 | Inbox | L6254 | 4 | GET,POST,DELETE | Medium |
| 51 | Suggestions | L6322 | 5 | GET,POST | Medium |

**Total**: 51 route groups, 228 registrations, all in one file.

### 3.3 Mutation Routes (Risk Classification)

#### CRITICAL (plan execution + migration data decisions)

| Route | Method | What It Accepts | Current Validation |
|---|---|---|---|
| `/api/plans` | POST | body.source (6 union kinds), targetConnectionId, sourceConnectionId | Manual field checks per-kind, no schema for union |
| `/api/plans/:id/review` | POST | decision, note, acknowledgedRisks/Conflicts/Approvals | Manual field checks; rejects `plan` field |
| `/api/plans/:id/apply` | POST | dryRun, idempotencyKey, targetConnectionId | Manual `forbiddenFields`/`unknownFields` arrays; hash verification |
| `/api/migration/sessions/:sessionId/decisions` | POST | candidateId/candidateIds, decision, note | `allowedReviewDecisions` array check, max 500 IDs |
| `/api/migration/sessions/:sessionId/data-decisions` | POST | candidateId, strategy, status, paths, note | `allowedStrategies`/`allowedStatuses` arrays, path dedup (max 100) |
| `/api/migration/sessions/:sessionId/dry-run` | POST | (no body) | None — no body validation |
| `/api/connections/:id/migration-plan/apply` | POST | — | **410 blocked** (legacy mutation) |

#### HIGH (config mutation + admin mutation)

| Route | Method | What It Accepts | Current Validation |
|---|---|---|---|
| `/api/connections/:id/configs/change-plan` | POST | path, content | Manual field existence check |
| `/api/admin/capability-standards` | POST | key, name, description, sections[] with schema | Manual field + normalize validation |
| `/api/admin/capability-standards/:id` | PATCH | name, description, status | Manual enum check |
| `/api/admin/capability-rules` | POST/PATCH | capability rule payload | Delegated to `upsertCapabilityRule()` |
| `/api/admin/catalog` | POST/PATCH | catalog item payload | Manual field checks |
| `/api/connections/:id/configs/migration-plan` | POST | paths[], targetConnectionId | Manual array validation |
| `/api/catalog/:id/preview` | POST | vars (form values for command substitution) | Schema-loaded validation from vars-schema |

#### MEDIUM (connection/profile/auth mutation)

| Route | Method | What It Accepts | Current Validation |
|---|---|---|---|
| `/api/connections/connect` | POST | connection fields | Manual field extraction |
| `/api/auth/register` | POST | email, password, name | Manual checks |
| `/api/auth/login` | POST | email, password | Manual checks |
| `/api/me/*` | various | profile, password, 2FA, notification prefs | Manual per-field typeof checks |
| `/api/tokens` | POST | label, scope | Manual label trim check |
| `/api/webhooks` | POST/PATCH | webhook config | Manual field checks |

### 3.4 Disabled Legacy Mutation Routes (410)

All 12 disabled routes are guarded by a single `preHandler` hook (L213-220):

```
POST /api/execute$
POST /api/batch-execute$
POST /api/multi-execute$
POST /api/rebuild-plan/apply$
POST /api/connections/:id/apply-remove-plan$
POST /api/connections/:id/uninstall$
POST /api/connections/:id/configs/write$
POST /api/connections/:id/configs/apply-change-plan$
POST /api/connections/:id/configs/rollback$
POST /api/profiles/:id/deploy-stage$
POST /api/migration/sessions/:sessionId/apply$
POST /api/connections/:id/migration-plan/apply$
```

**Risk**: The preHandler runs before route-level auth — a schema validation at the route level would be a second defense layer. Currently, any mutation that escapes the regex filter goes through with only manual type assertions.

---

## 4. Existing Validation Pattern Audit

### 4.1 Mechanism Inventory

| Mechanism | Found? | Location |
|---|---|---|
| Fastify JSON Schema (`schema` option on route) | **NO** | 0 routes use it |
| Zod / TypeBox / Ajv | **NO** | 0 imports in entire codebase |
| TypeScript `as T` assertions | **YES** | 240 uses in `routes.ts` alone |
| Manual `if (!body.field)` checks | **YES** | ~50 routes have ad-hoc field checks |
| `allowedStrategies` / `allowedReviewDecisions` arrays | **YES** | 3 routes (migration decisions, data-decisions, capability-standards) |
| `forbiddenFields` pattern | **YES** | 1 route (`/api/plans/:id/apply` — 12 fields) |
| `typeof` checks | **YES** | ~12 routes (notification prefs, admin users, etc.) |
| `.trim()` / `.filter(Boolean)` guards | **YES** | ~20 routes |
| Route-level `preHandler` hooks | **NO** | Only global legacy-mutation hook |
| Fastify `preValidation` hooks | **NO** | 0 uses |
| Response shape contracts (tests) | **YES** | 17 test files with response shape assertions |

### 4.2 Validation Gaps (Critical Examples)

1. **`POST /api/plans`** — `body.source` is a discriminated union of 6 kinds. Only `kind` is checked; each branch destructures fields with no type checking. A body with `{ kind: "capability-selection", capabilityIds: "not-an-array" }` would pass initial checks and fail deep inside `buildRebuildPlan()`.

2. **`POST /api/plans/:id/review`** — `body.decision` typed as `"approved" | "rejected"` but never validated at runtime. `{ decision: "malicious" }` passes the TypeScript checks.

3. **`POST /api/migration/sessions/:sessionId/decisions`** — `body.decision` validated against `allowedReviewDecisions` array (good), but `body.candidateIds` validated only for length (≤500), not element type. `{ candidateIds: [null, undefined, {}] }` passes validation.

4. **`POST /api/migration/sessions/:sessionId/data-decisions`** — `body.paths` validated via `.filter(Boolean)` on array elements, but elements are not validated as strings. `body.strategy` validated against `allowedStrategies` (good).

5. **`POST /api/connections/:id/configs/change-plan`** — body accepts `{ path, content }` with only truthiness check (`if (!body.path || body.content === undefined)`). No path traversal check, no content size limit.

6. **`POST /api/admin/capability-standards`** — `body.sections` is a deep array of objects with `schema?: unknown`. Each section's fields are only validated by `normalizeStandardProfileSections()` which runs at the function level, not at the route boundary.

### 4.3 Recommended Mechanism for Phase 6R-B

**Recommendation**: **Local schema helpers** using a lightweight hand-rolled approach — no new dependency.

Rationale:
- The project has **zero existing schema library** dependency — adding one would introduce a new supply-chain surface
- The project's input shapes are **well-understood** and limited in variety
- A `schemas/` module with pure TypeScript validation functions achieves the same goal without dependency risk
- Fastify's native `schema` option (JSON Schema) could be used later, but requires understanding of Fastify's schema compilation
- The 974-test safety net catches regression immediately

**Recommended approach**:
```typescript
// schemas/plan-schemas.ts
export function validatePlanCreateBody(body: unknown): 
  { ok: true; value: PlanCreateBody } | { ok: false; error: string; field?: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "body must be an object" };
  // ... field-by-field validation with stable error messages
}
```

This is:
- **Additive** — existing routes wrap their body parsing with a validation call
- **Testable** — pure functions with deterministic output
- **Zero-dependency** — no package.json changes
- **Compatible** — same error shape as existing handlers (`{ error: string }`)
- **Minimal** — no Fastify hook changes, no plugin registration

**Compatibility risk**: Existing clients may send loose input that currently works (e.g., extra fields are silently ignored). Phase 6R-B should start strict and loosen only if real-world breaks are found.

---

## 5. High-Risk API Validation Targets

### Phase 6R-B Recommended Targets (ordered by risk priority)

| # | Route | Risk Reason | Current Input Shape | Gap | Proposed Schema | Must-Have? |
|---|---|---|---|---|---|---|
| 1 | `POST /api/plans/:id/apply` | Executes plan; accepts command-bearing payload | `{ dryRun?, idempotencyKey?, targetConnectionId? }` + forbiddenFields list | No type-level prevention of extra fields; forbiddenFields checked manually | Validate allowed fields, dryRun boolean, idempotencyKey string | **Yes** |
| 2 | `POST /api/plans/:id/review` | Approves/rejects plan; changes system state | `{ decision, note?, acknowledgedRisks?, acknowledgedConflicts?, acknowledgedApprovals? }` | `decision` not runtime-validated; `plan` rejection is manual | Validate decision enum, forbid plan field, validate arrays | **Yes** |
| 3 | `POST /api/plans` | Creates Environment Plan; 6 kinds of source | `{ type?, targetConnectionId?, source: discriminated union }` | Union branch dispatch by string comparison, no branch validation | Validate common fields + per-kind schema | **Yes** |
| 4 | `POST /api/migration/sessions/:sessionId/decisions` | Sets migration decisions; triggers side effects | `{ candidateId?, candidateIds?, decision, note? }` | candidateIds elements not validated, decision checked via array | Validate decision enum, candidateIds element type, trim | Recommended |
| 5 | `POST /api/migration/sessions/:sessionId/data-decisions` | Sets data strategy; affects migration execution | `{ candidateId?, strategy, status, paths?, note? }` | paths elements not validated as strings; no path sanitization | Validate strategy/status enums, paths element type | Recommended |
| 6 | `POST /api/connections/:id/configs/change-plan` | Creates config mutation plan | `{ path?, content? }` | No path traversal check; no content validation | Validate path format (no `..`), content is string | Defer |
| 7 | `POST /api/admin/capability-standards` | Creates admin standard profile with deep schema | `{ key, name, description?, sections?[] }` | `sections[].schema` is `unknown`; no deep validation | Validate key format, sections array shape | Defer |

### Must-Have for Phase 6R-B

**Targets 1-3**: Plan lifecycle routes — POST `/api/plans` (create), `/api/plans/:id/review`, `/api/plans/:id/apply`. These are the highest-risk mutation surfaces.

### Recommended (if bandwidth allows)

**Targets 4-5**: Migration decision routes — already have partial validation (allowed* arrays) but input element shapes are unvalidated.

### Defer to Phase 6R-C or later

**Targets 6-7**: Admin routes — lower blast radius, admin-only access.

### Must NOT Validate (explicit non-targets)

- Disabled legacy mutation routes (already 410)
- Read-only GET routes (already safe)
- Inventory Graph routes (read-only, well-formed by construction)
- PostgreSQL dry-run surfaces (no input mutation)

---

## 6. Minimal Routes Split Plan

### 6.1 Recommendation: Schema-Only Extraction First

**Phase 6R-B** should extract **only schema helpers** — not route handlers — as the first split step.

**Rationale**: Extracting route handlers immediately risks:
- Circular imports (routes import plan-store, plan-store imports helpers)
- Route registration ordering issues
- Auth hook ordering issues
- Breaking the 974/974 test suite

Extracting schemas is safe because:
- Pure functions with no imports from `routes.ts`
- Can be imported by `routes.ts` with zero structural changes
- All existing route registration order, hooks, and handler closures preserved

### 6.2 Target Files

| File | Purpose | Approx. Lines |
|---|---|---|
| `apps/api/src/schemas/plan-schemas.ts` | Validation functions for plan CRUD routes | ~150 |
| `apps/api/src/schemas/migration-schemas.ts` | Validation functions for migration decision routes | ~100 |
| `apps/api/src/schemas/shared.ts` | Shared validation primitives (validateString, validateEnum, etc.) | ~80 |

**Total new code**: ~330 lines across 3 files. **Zero existing files structurally changed.**

### 6.3 Integration Pattern in routes.ts

```typescript
import { validatePlanCreateBody } from "./schemas/plan-schemas.js";

app.post("/api/plans", async (request, reply) => {
  const user = await getUserByToken(/*...*/);
  if (!user) { reply.code(401); return { error: "Login required." }; }
  
  const parsed = validatePlanCreateBody(request.body);
  if (!parsed.ok) {
    reply.code(400);
    return { error: parsed.error, field: parsed.field };
  }
  const body = parsed.value;
  // ... rest of handler unchanged
});
```

### 6.4 Why NOT Split Route Handlers Yet

| Concern | Mitigation Strategy |
|---|---|
| Circular imports | Defer to Phase 6R-C — create `routes/` directory with `register*Routes()` pattern |
| Test breakage | Tests import `registerRoutes` from `routes.ts` — splitting routes means updating ~17 test files |
| Route ordering | Fastify routes execute in registration order; extracting a group could reorder relative to the global preHandler |
| Auth coupling | Routes share `getUserByToken()`, `readBearerToken()` helpers; extraction requires creating a shared context object |

Phase 6R-B is schema-only extraction. Phase 6R-C can plan route handler extraction once schemas are in place and well-tested.

### 6.5 Files Expected NOT to Change

- `routes.ts` — logically unchanged; only imports added and body parsing wrapped
- `inventory-graph.ts`, `service-stack.ts` — untouched
- `postgres-data-migration.ts` — untouched
- `migration-assessment.ts` — untouched
- `environment-plan.ts`, `plan-store.ts`, `plan-lifecycle.ts`, `plan-hash.ts` — untouched
- `migration-classifier.ts`, `migration-apply-runner.ts`, `migration-dry-run.ts` — untouched
- `managed-execution.ts`, `managed-adapters.ts` — untouched
- `decision-engine/*` — untouched
- `config-files.ts` — untouched
- All test files except new schema tests — unchanged
- `package.json` — **zero new dependencies**

---

## 7. Runtime Schema Design Requirements

### 7.1 Validation Contract

Every schema validator in Phase 6R-B must:

1. **Accept `unknown`**: `(body: unknown) => { ok: true; value: T } | { ok: false; error: string; field?: string }`
2. **Reject malformed input with 400**: Reply `{ error: string }` with HTTP 400
3. **Never leak stack traces**: Error messages are human-readable descriptions, not `err.message` passthrough
4. **Preserve existing success shapes**: Validated body has the same shape the handler expects — no transformation
5. **Preserve 410 behavior**: Legacy mutation routes remain blocked; the global preHandler is not changed
6. **Preserve auth behavior**: All auth checks (`getUserByToken`) remain in the route handler, not in validators
7. **Be additive**: Existing routes that don't yet use validators continue to work; validation is added route-by-route
8. **Allow for future strictness**: Start permissive (accept unknown extra fields), can tighten later

### 7.2 Anti-Requirements

- **NO** Fastify JSON Schema integration (requires plugin setup, schema compilation)
- **NO** Zod/TypeBox/Ajv dependency
- **NO** Global Fastify `setValidatorCompiler` or `setSchemaErrorFormatter` hooks
- **NO** Response schema migration (output validation)
- **NO** OpenAPI generation
- **NO** Automatic schema inference from TypeScript types

### 7.3 Error Response Format

```typescript
// Consistent with existing error patterns in routes.ts:
{ error: "decision must be one of: pending, approved, skipped, ..." }
{ error: "targetConnectionId is required.", field: "targetConnectionId" }
```

The `field?` property is optional — only present when the error is about a specific field. This matches existing patterns like `{ error: "plan is required." }` and `{ error: "candidateId, strategy, and status are required." }`.

### 7.4 Validation Primitive Library (`schemas/shared.ts`)

```typescript
export function validateString(value: unknown, field: string, opts?: { min?: number; max?: number; trim?: boolean }): string | { error: string; field: string }
export function validateEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T | { error: string; field: string }
export function validateStringArray(value: unknown, field: string, opts?: { max?: number }): string[] | { error: string; field: string }
export function validateObject(value: unknown, field: string): Record<string, unknown> | { error: string; field: string }
export function validateBoolean(value: unknown, field: string): boolean | { error: string; field: string }
```

Each function returns either the parsed value or an error object — not throws. This allows callers to check `typeof result === "object" && "error" in result` without try/catch.

---

## 8. Explicit Non-Goals

Phase 6R (planning + implementation) does NOT:

- Full `routes.ts` rewrite
- Full API schema coverage
- OpenAPI generation
- UI updates
- Data Migration execution
- Secret Transport
- Conflict Resolver
- New auth model
- New permission system
- Changing plan approval semantics
- Changing Environment Plan execution semantics
- Changing InventoryGraph / ServiceStack semantics
- Changing PostgreSQL dry-run semantics
- Restoring legacy mutation routes
- Broad module architecture rewrite
- Extracting route handlers from `routes.ts` (deferred to Phase 6R-C+)
- Adding any npm dependency
- Changing package.json
- Introducing Fastify plugins or hooks
- Validating response shapes (output validation)
- Migrating existing manual validation in low-risk routes

---

## 9. Test and Evidence Plan

### 9.1 Phase 6R-B Tests (New)

| # | Test | Coverage |
|---|---|---|
| S1 | `validatePlanCreateBody` — valid capability-selection body | Happy path |
| S2 | `validatePlanCreateBody` — valid recipe body | Happy path |
| S3 | `validatePlanCreateBody` — valid config-change body | Happy path |
| S4 | `validatePlanCreateBody` — missing targetConnectionId | 400 path |
| S5 | `validatePlanCreateBody` — unknown source kind | 400 path |
| S6 | `validatePlanCreateBody` — null body | 400 path |
| S7 | `validatePlanCreateBody` — array body (not object) | 400 path |
| S8 | `validatePlanReviewBody` — valid approval | Happy path |
| S9 | `validatePlanReviewBody` — valid rejection | Happy path |
| S10 | `validatePlanReviewBody` — invalid decision | 400 path |
| S11 | `validatePlanReviewBody` — plan field present (forbidden) | 400 path |
| S12 | `validatePlanApplyBody` — valid dryRun | Happy path |
| S13 | `validatePlanApplyBody` — valid non-dryRun | Happy path |
| S14 | `validatePlanApplyBody` — forbidden field (plan) | 400 path |
| S15 | `validatePlanApplyBody` — unknown field | 400 path |
| S16 | Schema functions are pure (no side effects) | Purity |
| S17 | Schema error messages contain no stack traces | Safety |
| S18 | Schema error messages match existing error format | Consistency |

### 9.2 Phase 6R-B Existing Test Regression

| Check | Command | Expected |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | 0 errors |
| Build | `npm run build` | PASS |
| Full API suite | `npm test` | 974+/974+ pass |
| Legacy 410 routes | Existing `plan-apply-security-routes.test.ts` | 12/12 still 410 |
| Auth behavior | Existing auth tests | Unchanged |
| Plan lifecycle | Existing `environment-plan.test.ts`, `plan-security-core.test.ts` | Unchanged |

### 9.3 Phase 6R-C Evidence Requirements

- Route-level integration tests: malformed body → 400, valid body → 200
- Forbidden field tests: plan field in review body → 400
- Authorization: unauthenticated → 401, cross-user isolation → 404
- TypeScript check + build + full suite (as always)
- Evidence report at `docs/phase6r-c-schema-validation-evidence-closure-2026-07-09.md`

---

## 10. Risk / Compatibility Notes

### 10.1 Existing Clients

- **Internal frontend**: All API calls originate from the EnvForge web app. Schema validation is additive — the frontend already sends well-formed payloads. No existing valid request should be rejected.
- **External API consumers**: API tokens route (`/api/tokens`) exists but the consumer surface is small. API token routes are NOT targeted for schema validation in Phase 6R-B.
- **cURL / script consumers**: Could be affected if they send extra fields. Recommendation: start strict but monitor.

### 10.2 Test Risks

- Tests that send invalid bodies and currently get 200 (by accident) would start getting 400. This is the desired behavior — such tests would be updated, not the validation.
- No known test relies on permissive input acceptance — but cannot be 100% certain without running the suite after each schema addition.

### 10.3 Fastify Side Effects

- No Fastify schema compilation → no side effects
- No global hooks → no ordering risks
- Validation functions are pure → no I/O, no state mutation

### 10.4 Import Risks

- `schemas/plan-schemas.ts` imports from `schemas/shared.ts` only
- `schemas/migration-schemas.ts` imports from `schemas/shared.ts` and possibly `runtime-store.ts` for type-only imports of `StoredMigrationDataDecision`
- `routes.ts` imports from `schemas/plan-schemas.ts` and `schemas/migration-schemas.ts`
- No circular import path exists

### 10.5 Error Response Compatibility

Existing error format in routes.ts:
```json
{ "error": "description string" }
{ "error": "description string", "field": "fieldName" }  // rare, ~5 routes
```

Phase 6R-B validators use exactly this format. The optional `field` property is only present when relevant. This is backward-compatible.

---

## 11. Files Expected to Change (Phase 6R-B)

| File | Change | Lines |
|---|---|---|
| `apps/api/src/schemas/shared.ts` | **NEW** — validation primitives | ~80 |
| `apps/api/src/schemas/plan-schemas.ts` | **NEW** — plan route validators | ~150 |
| `apps/api/src/schemas/migration-schemas.ts` | **NEW** — migration decision validators | ~100 |
| `apps/api/src/engine/tests/schema-validation.test.ts` | **NEW** — 18 tests | ~300 |
| `apps/api/src/routes.ts` | **Modify** — add schema imports, wrap 3-5 route bodies | +15 lines, ~10 lines changed per route |

**Total**: 4 new files (~630 lines), 1 modified file (~+15 lines, minimal handler wrapping).

---

## 12. Phase 6R-B Implementation Prompt

```
进入 Phase 6R-B：Runtime Schema Validation Implementation。

目标：为高风险 plan 路由增加 runtime schema validation，提取 schemas/ 目录作为 routes.ts 最小拆分的起步。只做 schema extraction，不做 route handler 提取。

严格边界：
- 只改 routes.ts 的 import 和 body 解析（每个路由 ~3-5 行改动）
- 只新增 schemas/ 目录（3 个小文件）
- 不改 route handler 逻辑
- 不改 Fastify 配置
- 不改 preHandler / hooks
- 不新增 npm 依赖
- 不做 route handler 提取
- 不破坏 974/974 suite

执行步骤：

1. 创建 `apps/api/src/schemas/shared.ts`
   - 实现 validateString / validateEnum / validateStringArray / validateObject / validateBoolean
   - 每个函数签名: (value: unknown, field: string, opts?) => T | { error: string; field: string }
   - 不 throw，返回 error 对象

2. 创建 `apps/api/src/schemas/plan-schemas.ts`
   - validatePlanCreateBody(body: unknown) — 6 source kinds
   - validatePlanReviewBody(body: unknown) — decision enum + forbidden plan field
   - validatePlanApplyBody(body: unknown) — dryRun/idempotencyKey/targetConnectionId + forbidden fields
   - 每个返回 { ok: true; value } | { ok: false; error; field? }

3. 创建 `apps/api/src/schemas/migration-schemas.ts`
   - validateMigrationDecisionsBody(body: unknown) — decision enum + candidateIds validation
   - validateDataDecisionsBody(body: unknown) — strategy/status enum + paths validation

4. 修改 `apps/api/src/routes.ts`
   - 添加 schemas/ imports（3 imports）
   - POST /api/plans: 在 body cast 之前调用 validatePlanCreateBody，400 时早返回
   - POST /api/plans/:id/review: 同上，用 validatePlanReviewBody
   - POST /api/plans/:id/apply: 同上，用 validatePlanApplyBody
   - POST /api/migration/sessions/:sessionId/decisions: 同上，用 validateMigrationDecisionsBody
   - POST /api/migration/sessions/:sessionId/data-decisions: 同上，用 validateDataDecisionsBody

5. 创建 `apps/api/src/engine/tests/schema-validation.test.ts`
   - 18 tests (S1-S18 per §9.1)
   - Pure function tests — no Fastify instance needed

6. 验证
   - npx tsc --noEmit → 0 errors
   - npm run build → PASS
   - npm test → ≥974 pass (新增 ~18 tests)
   - git diff 确认 routes.ts 改动 ≤50 lines
   - git diff --stat 确认无意外文件

7. 产生证据报告
   - docs/phase6r-b-schema-validation-implementation-2026-07-09.md
   - 记录: baseline, files changed, tests added, full suite result, routes.ts diff stat
   - Result: PASS / BLOCKED

PASS 条件：
- TypeScript 0 errors
- Build PASS
- ≥974 pass (existing), +~18 new tests
- routes.ts 改动 ≤50 lines (only imports + body validation wrapping)
- 零新增 npm 依赖
- legacy 410 行为不变
- plan lifecycle 测试不变
```

---

## 13. Phase 6R-C Prompt (Preview)

After Phase 6R-B passes:
- Route-level integration tests using `Fastify.inject()` with malformed bodies
- Verify 400 responses for each new schema
- Verify existing success paths unchanged
- Evidence report closure
- Push

---

*Report generated 2026-07-09. Phase 6R-A planning complete. Ready for Phase 6R-B implementation.*
