# Phase 5R-A: Data Migration First Closed Loop — Planning Report

- **Date**: 2026-07-09
- **Phase**: 5R-A (planning only — no code changes)
- **Stable baseline**: `a01574d` — Reconcile phase roadmap after inventory graph extension
- **Result**: **PASS**

---

## 1. Baseline

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `a01574d` |
| Commit msg | `Reconcile phase roadmap after inventory graph extension` |
| `git status --short` | `?? docs/audit-report-2026-07-08.md` (pre-existing, unrelated) |
| `origin/main` sync | **Synced** — `0 ahead, 0 behind` |
| Full API suite | 957/957 pass |
| Reconciliation report | `docs/phase-plan-reconciliation-2026-07-09.md` — present |
| Audit report | `docs/audit-report-2026-07-08.md` — present (Critical #1: no DB execution path) |

---

## 2. Reconciliation Context

Per `docs/phase-plan-reconciliation-2026-07-09.md`:

- Phase 4E–4G are completed InventoryGraph extension line — enrichment, route exposure, contract hardening
- Phase 5R resumes the original Phase 5 goal: Data Migration first closed loop
- Phase 8 must not be opened until Phase 5R–7R are complete
- This document's canonical mapping is authoritative

Phase 5R-A is the first phase under the reconciled roadmap. It inherits all Phase 4E–4G hardening (cross-user isolation, shape contracts, API docs) and targets the original Phase 5 that was never started.

---

## 3. Original Data Migration Gap

### 3.1 Audit Finding (Critical #1)

From `docs/audit-report-2026-07-08.md`:

> **#1 数据库数据迁移无执行路径** — Critical — P3
> - `migration-apply-runner.ts` `runAction()` 仅处理 `installPackage/validate/restart/copyConfig`，`export` kind 直接跳过
> - `migration-dry-run.ts:93` — "Exporter action is not directly executable by the SSH apply layer"
> - `migration-exporter.ts` — 四种导出格式均无 export action 处理
> - `managed-adapters.ts` — 无数据库 dump adapter
> - **修复建议**：为 PostgreSQL/MySQL/Redis/MongoDB 创建 DataMigrationAdapter，实现 dump → transfer → restore 流水线

### 3.2 Golden Scenario Gap

From `docs/product/golden-scenarios.md`:

> Scenario 3: "Safe database migration"
> - Aspirational scope: PostgreSQL, MySQL/MariaDB, Redis backup/transfer/restore/verify/rollback
> - Current status: **all unimplemented** — no backup consistency, transfer, restore, query verification, or rollback execution

### 3.3 Why PostgreSQL First

1. PostgreSQL is the most thoroughly *detected* database — `categoryForCandidate()`, `classifyDecision()`, `requiredDecisionsForCandidate()`, `recommendedStrategy()` all have PostgreSQL-specific logic
2. The catalog has a `postgres-profile` capability with `migrate.data: "recommended"` and documented data paths
3. The assessment already produces `"Use pg_dump/pg_restore for logical migration"` as the recommended strategy
4. MySQL, MongoDB, Redis share the same gap but have less existing infrastructure
5. A single-database first closed loop is the minimal path to close the critical audit finding

---

## 4. Current Data Migration Surface Map

### 4.1 Assessment / Strategy Layer (READ-ONLY)

| Surface | File | What It Does | Data Migration Status |
|---|---|---|---|
| PostgreSQL classification | `migration-assessment.ts:469-481` | Pattern-matches `postgres` → `"database"` category | Detection only |
| Statefulness classification | `migration-assessment.ts:483-488` | Marks database as `"stateful"` | Advisory |
| Recommended strategy | `migration-assessment.ts:490-496` | Produces `"Use pg_dump/pg_restore for logical migration."` | **Advisory text only** |
| Required decisions | `migration-assessment.ts:423-467` | Creates `"PostgreSQL data migration strategy"` decision with 4 options | Decision template only |
| Risk reasons | `migration-assessment.ts:500-506` | PostgreSQL-specific: file copy corruption, version mismatch, unknown volume, unknown backup freshness | Advisory |
| `classifyDecision()` | `migration-classifier.ts:707-725` | Sets `touchesDatabase: true` but always `dataStrategyConfirmed: false` | Never auto-approved |
| `reviewStateForCandidate()` | `migration-classifier.ts:990-1013` | Flags: "Database data strategy must be confirmed" | Passive flag |
| Data strategy route | `routes.ts:4832` | `POST /api/migration/sessions/:sessionId/data-decisions` — `strategy: "export-import"` | **Persists decision, doesn't execute** |

### 4.2 Execution / Plan Layer (BLOCKED for data)

| Surface | File | What It Does | Data Migration Status |
|---|---|---|---|
| `MigrationPlanAction` type | `migration-classifier.ts:174` | Defines `"export"` action kind | **Defined but never generated** |
| `actionsForCandidate()` | `migration-classifier.ts:436-500` | Generates `installPackage/copyConfig/validate/restart/review` | **Never generates `export`** |
| `migrationActionToEnvironmentAction()` | `environment-plan.ts:1075-1090` | Maps `MigrationPlanAction` → `EnvironmentPlanAction` | `export` → `review` (manual) |
| `runAction()` | `migration-apply-runner.ts:114-164` | Handles `installPackage/validate/restart/copyConfig` | **`export` falls through to manual review** |
| `buildMigrationDryRun()` | `migration-dry-run.ts:90-94` | Unhandled action kinds → `"blocked"` | **`export` → `"blocked"`** |
| `exportMigrationPlan()` | `migration-exporter.ts:5-9` | Generates json/bash/ansible/markdown | **Read-only, no DB commands** |
| PostgreSQL plan actions | `environment-plan.ts:1280-1310` | `backupFile` for `/etc/postgresql` + `manualStep` | **Human review gate, not automated** |

### 4.3 Adapter Layer (NO DATABASE ADAPTER)

| Surface | File | What It Does | Data Migration Status |
|---|---|---|---|
| `createPackageAdapter()` | `managed-adapters.ts:84` | `installPackage/removePackage/restart` | No DB logic |
| `createConfigWriteAdapter()` | `managed-adapters.ts:194` | `writeConfig/copyConfig` | No DB logic |
| `createSshHardeningAdapter()` | `managed-adapters.ts:303` | SSH config write | No DB logic |
| `adapterForAction()` | `managed-execution.ts:116-133` | Routes to 3 adapters | **No database adapter** |

### 4.4 Safety Layer (PRESERVED)

| Surface | File | What It Does | Status |
|---|---|---|---|
| Legacy apply block | `routes.ts:198-219` | HTTP 410 for all legacy mutation routes | ✅ Active |
| `executePlaybookTask()` | `executor.ts:106-118` | Returns failed — "Direct playbook execution is disabled" | ✅ Active |
| Plan hash verification | `managed-execution.ts:42-49` | `planHash` + `approvedPlanHash` + `approvalRecord.planHash` + `plan.status === "approved"` | ✅ Active |
| `data-strategy-confirm` gate | `environment-plan.ts:204-214` | Approval gate exists in type system | **Gate defined but not enforced for DB actions** |

---

## 5. Current Fact State

| Question | Answer |
|---|---|
| Does a real PostgreSQL migration adapter exist? | **NO** |
| Does a PostgreSQL dry-run / validation path exist? | **NO** — dry-run marks export as `"blocked"` |
| Does a migration execution interface for data exist? | **NO** — `export` kind is defined but never instantiated |
| Does an approval-gated execution path for data exist? | **NO** — `data-strategy-confirm` gate exists but no DB actions reach it |
| Does a rollback / restore strategy exist? | **NO** — `plan-runner.ts` has no database rollback |
| Is there a structured evidence artifact for data migration? | **NO** — only advisory text in assessment |
| Can we prove no secrets are leaked? | **YES** — `SecretRef` uses fingerprints; `redactSecrets()` redacts output; but no DB execution path to leak from |
| Is this all assessment/strategy only? | **YES** — the entire data migration surface is advisory |

**Key assessment**: The gap is not just execution — it's the **entire structured intent → dry-run → evidence → approval chain**. PostgreSQL is detected, classified, and recommended for `pg_dump/pg_restore`, but there's no structured representation of that recommendation, no dry-run evidence, and no approval gate that understands what it's approving.

---

## 6. Execution Safety Decision

**Phase 5R-B will implement the dry-run first closed loop only.**

Real `pg_dump`/`pg_restore` execution remains **intentionally blocked** for the following reasons:

1. **No credential model**: Database credentials are not structured in the migration adapter layer. `Ssh2Executor` can reach the host but has no concept of `PGPASSWORD`, `~/.pgpass`, or connection strings.
2. **No transfer model**: `transferArtifact` action kind exists but is never used. There's no structured artifact transfer between source and target.
3. **No restore safety**: There's no way to verify a restore succeeded without querying the restored database — which requires executable query capability that doesn't exist in the adapter layer.
4. **Secret Transport is out of scope**: Handling database passwords, connection strings, and SSL certificates for data migration requires Secret Transport design, which is a separate phase.

**What "dry-run first closed loop" means**:

- PostgreSQL candidate detected → structured migration intent generated → dry-run evidence computed → approval gate required → evidence artifact output
- The loop closes by transforming the current advisory-only path ("Use pg_dump/pg_restore for logical migration") into a structured, testable, approval-gated artifact
- Real execution ("actually run pg_dump") is deferred to a future phase when credential, transfer, and restore safety are designed

---

## 7. PostgreSQL First Closed Loop Design

### 7.1 Architecture

```
Assessment Layer (existing, UNCHANGED)
  └─ buildAssessmentSummary()
       └─ detects PostgreSQL candidate
       └─ recommends "pg_dump/pg_restore"

                    ↓  Phase 5R-B: new path

Structured Intent Layer (NEW)
  └─ buildPostgresDataMigrationIntent()
       ├─ input: candidate + snapshot + dataDecisions
       ├─ validates: strategy, approval state, evidence completeness
       └─ output: PostgresDataMigrationIntent

Dry-Run Evidence Layer (NEW)
  └─ buildPostgresDataMigrationDryRun()
       ├─ input: PostgresDataMigrationIntent
       ├─ computes: command templates, safety checks, blocked reasons
       ├─ never: executes commands, connects to DB, transfers data
       └─ output: PostgresDataMigrationDryRun (evidence artifact)

Approval Gate Layer (EXISTING, reused)
  ├─ data-strategy-confirm gate (already in EnvironmentPlan)
  └─ execution blocked if: missing approval, missing credentials, unsupported strategy

Environment Plan Integration (EXISTING, reused)
  └─ postgres data migration appears as structured manualStep/evidence
       └─ not as executable action until credential + transfer safety exists
```

### 7.2 Key Types (New)

```typescript
// The structured intent — what the system thinks should happen
interface PostgresDataMigrationIntent {
  candidateId: string;
  serviceName: string;
  sourceHost: string;
  strategy: "logical-dump" | "physical-backup" | "record-only" | "manual" | "blocked";
  estimatedDataPaths: string[];       // from InventoryGraph dataPath nodes
  estimatedConfigPaths: string[];     // from InventoryGraph configFile nodes
  estimatedVolumeBytes?: number;
  dryRunOnly: true;                   // Phase 5R-B: ALWAYS true
  requiredApprovals: string[];        // always includes "data-strategy-confirm"
  blockedReason?: string;             // set when strategy === "blocked"
  commandTemplates: PostgresDataMigrationCommandTemplate[];
}

interface PostgresDataMigrationCommandTemplate {
  id: string;
  label: string;                      // human-readable summary
  template: string;                   // sanitized command template, never executed
  sanitizedNotes: string[];           // safety notes about this command
  requiresSecret: boolean;            // always true → blocks execution
  requiresApproval: boolean;          // always true
  blocked: true;                      // Phase 5R-B: ALWAYS blocked
  blockedReason: string;
}

interface PostgresDataMigrationDryRun {
  intent: PostgresDataMigrationIntent;
  generatedAt: string;
  hostname: string;
  assessment: {
    candidateFound: boolean;
    strategyRecommended: string;
    requiredDecisions: string[];
  };
  readiness: "requires-decision" | "dry-run-ready" | "blocked";
  approvalGates: Array<{
    gate: string;
    satisfied: boolean;
    reason?: string;
  }>;
  commandTemplates: PostgresDataMigrationCommandTemplate[];
  executionBlocked: true;             // Phase 5R-B: ALWAYS true
  executionBlockedReason: string;
  safetyNotes: string[];
}
```

### 7.3 Integration Points

| Integration | How | Risk |
|---|---|---|
| `routes.ts` | Existing `GET /api/migration/sessions/:sessionId/dry-run` already accepts plan dry-run. A new route or extension to the plan endpoint can include PostgreSQL dry-run evidence when a DB candidate exists | **Low** — additive |
| `environment-plan.ts` | `data-strategy-confirm` gate already exists. Phase 5R-B adds structured PostgreSQL evidence to the manualStep/review action so operators know what they're approving | **Low** — gate already defined |
| `migration-assessment.ts` | `buildAssessmentSummary()` already detects PostgreSQL. Phase 5R-B adds `PostgresDataMigrationDryRun` to assessment response as optional structured evidence | **Low** — optional field |
| `migration-dry-run.ts` | Currently marks export as `"blocked"`. Phase 5R-B replaces this with structured PostgreSQL dry-run evidence instead of generic "blocked" | **Low** — improves existing blocked path |
| `inventory-graph.ts` | `ServiceStack` already has `dataPaths`, `configFiles`, `volumes`. Phase 5R-B reads these for `estimatedDataPaths`/`estimatedConfigPaths` | **Low** — read-only |

---

## 8. Approval / Execution Safety Model

### 8.1 Reuse Existing Gates

| Gate | Source | How Reused |
|---|---|---|
| Plan approval | `POST /api/plans/:id/review` → `approved` | Database actions must be in an approved plan |
| Plan hash verification | `managed-execution.ts:42-49` | `planHash` + `approvedPlanHash` must match |
| `data-strategy-confirm` | `environment-plan.ts` approval gate type | Must be acknowledged before the plan can be marked `approved` |
| Approval record timestamp | `routes.ts:3384` area | All acknowledgements must pre-date `planHash` generation |

### 8.2 Phase 5R-B Guard Rails

| Guard | Mechanism | Phase 5R-B |
|---|---|---|
| No real `pg_dump` execution | `commandTemplates[].blocked === true` on all commands | **Hard-coded true** |
| No DB connection | No `Ssh2Executor.exec()` calls with DB commands | **Never called** |
| No data transfer | `transferArtifact` not wired | **Not touched** |
| No credential access | `commandTemplates[].requiresSecret === true` → blocks execution | **Blocks execution** |
| Legacy apply bypass impossible | HTTP 410 guards unchanged | **Untouched** |
| Dry-run always safe | Dry-run only reads assessment data, never mutates | **Read-only** |
| Execution denied without approval | `executionBlockedReason` populated when approval missing | **Always populated** |

### 8.3 Transition to Real Execution (Future)

The dry-run closed loop is designed so that when credential + transfer safety are later addressed, the transition from `blocked: true` to `blocked: false` is a single-field change, not a redesign. The structured intent, command templates, and approval gates remain the same — only the execution guard is relaxed.

---

## 9. Recommended Phase 5R-B Minimal Scope

### 9.1 MUST-HAVE (4 items)

#### M1: PostgreSQL Data Migration Intent Builder

| Detail | Value |
|---|---|
| **Target file** | `apps/api/src/postgres-data-migration.ts` (NEW) |
| **Target function** | `buildPostgresDataMigrationIntent(candidate, snapshot, dataDecisions): PostgresDataMigrationIntent` |
| **Behavior** | Reads candidate + snapshot → determines strategy → computes estimated data paths from InventoryGraph → builds command templates → returns structured intent with `dryRunOnly: true`, `executionBlocked: true` |
| **Why minimal** | Pure data transformation, no SSH, no DB connection, no secrets |
| **Required tests** | PostgreSQL candidate → logical-dump intent; non-PostgreSQL → blocked; missing data paths → records incompleteness; missing data strategy decision → blocked |
| **Safety risk** | **None** — no execution |
| **Compatibility risk** | **Zero** — new file, no existing imports |

#### M2: PostgreSQL Dry-Run Evidence Generator

| Detail | Value |
|---|---|
| **Target file** | `apps/api/src/postgres-data-migration.ts` (NEW, same file) |
| **Target function** | `buildPostgresDataMigrationDryRun(intent): PostgresDataMigrationDryRun` |
| **Behavior** | Takes intent → validates approval gates → checks candidate readiness → populates safety notes → returns structured dry-run evidence with `executionBlocked: true` |
| **Why minimal** | Pure validation + formatting, no SSH, no execution |
| **Required tests** | Dry-run populated with evidence; approval gate check; execution blocked reason populated; safety notes present |
| **Safety risk** | **None** |
| **Compatibility risk** | **Zero** |

#### M3: Wire Dry-Run Evidence into Assessment & Plan

| Detail | Value |
|---|---|
| **Target files** | `migration-assessment.ts` (add optional field), `environment-plan.ts` (minimum enrichment), `routes.ts` (return evidence when available) |
| **Behavior** | When a PostgreSQL candidate exists in the assessment, attach `PostgresDataMigrationDryRun` as optional structured evidence. The dry-run is always computed and always blocks execution |
| **Why minimal** | Optional field — existing consumers ignore it. No new route required — existing dry-run/plan routes can include the evidence |
| **Required tests** | Assessment includes dry-run when PG candidate present; dry-run absent when no PG; dry-run always has execution blocked; existing assessment routes unchanged |
| **Safety risk** | **Low** — read-only evidence attached to existing response shapes |
| **Compatibility risk** | **Low** — additive optional field |

#### M4: Database Migration Safety Tests

| Detail | Value |
|---|---|
| **Target files** | New test file `apps/api/src/engine/tests/postgres-data-migration.test.ts` |
| **Behavior** | Tests covering: PG candidate → intent generation, non-PG → blocked, missing data strategy → blocked, dry-run evidence shape, execution always blocked, no credentials in output, command templates sanitized, existing Phase 1 guards still active (legacy apply routes return 410), Environment Plan approval gates functional |
| **Why minimal** | Tests only — no production logic invented in tests |
| **Required tests** | 10–12 tests (see §11) |
| **Safety risk** | **None** |

### 9.2 NON-MUST (excluded from Phase 5R-B)

| Item | Why Excluded |
|---|---|
| Real pg_dump execution | No credential/transfer safety model |
| DB connection in tests | No test DB required |
| MySQL/MongoDB/Redis support | PostgreSQL first — single-DB closed loop |
| Generic database adapter framework | Premature — one concrete type first |
| Data transfer between hosts | Requires Secret Transport phase |
| Database rollback | Requires restore safety design |
| UI for data migration decisions | No frontend changes in Phase 5R |
| Route split | Phase 6R goal, not Phase 5R |

---

## 10. Explicit Non-Goals

| Non-goal | Reason |
|---|---|
| Real `pg_dump` / `pg_restore` execution | No credential/transfer safety in current adapter layer |
| Real database connection | No test DB infrastructure; would require secrets |
| Data transfer between source and target | Out of scope per charter |
| Database credential handling | Secret Transport is out of scope |
| MySQL / MongoDB / Redis / generic database | PostgreSQL first closed loop only |
| Generic database migration framework | Premature abstraction |
| Database rollback / restore automation | Requires transfer + restore safety |
| UI changes | No frontend in Phase 5R |
| Route split | Phase 6R |
| Runtime schema validation | Phase 6R |
| Secret Transport | Out of scope per charter |
| Conflict Resolver | Out of scope per charter |
| Legacy apply route revival | Must remain HTTP 410 |
| Bypassing Environment Plan approval | Must reuse existing Plan/approval/hash model |

---

## 11. Test and Evidence Plan

### 11.1 Phase 5R-B Must-Add Tests

| # | Test | File | What It Proves |
|---|---|---|---|
| T1 | PostgreSQL candidate → logical-dump intent generated | `postgres-data-migration.test.ts` | Intent builder works |
| T2 | Non-PostgreSQL candidate → `blocked` strategy | Same | Builder rejects unsupported DBs |
| T3 | Missing data strategy decision → `blocked` | Same | Approval gate works |
| T4 | Missing data paths → `blocked` with reason | Same | Incomplete evidence detected |
| T5 | Dry-run evidence shape contract | Same | All fields populated correctly |
| T6 | Execution always blocked in dry-run | Same | `executionBlocked: true`, reason populated |
| T7 | Command templates sanitized — no credentials | Same | `requiresSecret: true`, `blocked: true` |
| T8 | Command templates contain expected pg_dump shape | Same | Templates are structurally correct |
| T9 | Safety notes populated | Same | Operator guidance present |
| T10 | Legacy migration apply route still returns 410 | Same or reuse existing | Phase 1 guard intact |
| T11 | Assessment includes dry-run when PG present | Same | Wiring works |
| T12 | Assessment unchanged when no PG | Same | No regression |

### 11.2 Phase 5R-C Evidence Closure (separate phase)

| # | Evidence |
|---|---|
| E1 | Full API suite rerun (expect ≥967 pass) |
| E2 | TypeScript `npx tsc --noEmit` clean |
| E3 | `npm run build` clean |
| E4 | All new targeted tests pass |
| E5 | PostgreSQL dry-run evidence verified |
| E6 | Execution safety verified |
| E7 | Secret safety regression verified |
| E8 | Environment Plan compatibility verified |
| E9 | Phase 5R-B implementation report |
| E10 | Phase 5R-C evidence closure report |

### 11.3 Commands to Run

```bash
# Type check
cd E:/1project/EnvForge/apps/api && npx tsc --noEmit -p tsconfig.json

# Build
cd E:/1project/EnvForge/apps/api && npm run build

# Full test suite
cd E:/1project/EnvForge/apps/api && npm test

# Targeted new tests
cd E:/1project/EnvForge/apps/api && npm test -- --test-name-pattern="postgres-data-migration"
```

---

## 12. Risk / Safety Notes

### 12.1 Accidental Execution Risk

| Risk | Likelihood | Mitigation |
|---|---|---|
| `blocked: true` flag accidentally removed | Low (hard-coded) | Test T6 asserts `executionBlocked === true` |
| Dry-run somehow triggers real command | **Impossible** — no `Ssh2Executor.exec()` in new code | Structural design guarantee |
| Legacy apply route re-enabled | Low (Phase 1 guards are tested) | Test T10 re-verifies |
| Environment Plan executes DB action | Low (adapterForAction has no DB path) | No DB adapter exists |

### 12.2 Secret Safety

| Risk | Likelihood | Mitigation |
|---|---|---|
| Command templates leak credentials | Low (hard-coded templates, no real values) | Test T7 asserts `requiresSecret: true, blocked: true` |
| `redactSecrets()` misses database password | Low (existing redaction covers DATABASE_URL patterns) | Existing `support-bundle.test.ts` redaction tests pass |
| `SecretRef` leaked via migration intent | **Impossible** — intent uses `fingerprint` only | Phase 4 design contract |

### 12.3 False-Positive PostgreSQL Detection

| Risk | Likelihood | Mitigation |
|---|---|---|
| Non-PostgreSQL candidate classified as PG | Low (existing `categoryForCandidate()` is regex-based but specific) | Test T2 verifies non-PG → blocked |

### 12.4 Compatibility

| Risk | Likelihood | Mitigation |
|---|---|---|
| New optional field breaks existing consumers | **Zero** — optional field, ignored by existing clients | All existing tests pass unchanged |
| Environment Plan gate change affects non-DB plans | Low (gate is additive, not gating) | Test T12 verifies assessment unchanged when no PG |
| Dry-run evidence shape change in future | Low (versioned via `schemaVersion` if needed) | Add `schemaVersion` to dry-run type |

---

## 13. Files Expected to Change in Phase 5R-B

| File | Change type | Why |
|---|---|---|
| `apps/api/src/postgres-data-migration.ts` | **NEW** | PostgreSQL intent builder + dry-run generator |
| `apps/api/src/migration-assessment.ts` | **Modify** (add optional field + import) | Attach `PostgresDataMigrationDryRun` to assessment |
| `apps/api/src/engine/tests/postgres-data-migration.test.ts` | **NEW** | 12 new tests |
| `docs/phase5r-b-postgresql-dry-run-closed-loop-implementation-2026-07-09.md` | **NEW** | Implementation report |

## 14. Files Expected NOT to Change

| File | Reason |
|---|---|
| `apps/api/src/inventory-graph.ts` | Engine frozen |
| `apps/api/src/migration-classifier.ts` | Classification logic unchanged |
| `apps/api/src/migration-apply-runner.ts` | No execution changes |
| `apps/api/src/migration-dry-run.ts` | Existing dry-run unchanged |
| `apps/api/src/migration-exporter.ts` | Export unchanged |
| `apps/api/src/managed-adapters.ts` | No new adapters |
| `apps/api/src/managed-execution.ts` | Execution unchanged |
| `apps/api/src/engine/runner.ts` | Playbook engine unchanged |
| `apps/api/src/executor.ts` | Legacy executor unchanged (guards preserved) |
| `apps/api/src/routes.ts` | Routes unchanged (or minimal additive field in response) |
| `apps/api/src/support-bundle.ts` | Bundle unchanged |
| `apps/api/src/environment-plan.ts` | Plan unchanged (or minimum data-strategy gate wiring) |
| `apps/web/**/*` | No frontend changes |
| All existing test files except new one | Existing test contracts preserved |

---

## 15. Phase 5R-B Implementation Prompt

---

**PROMPT START** — copy everything below to execute Phase 5R-B

---

# Phase 5R-B: PostgreSQL Dry-Run First Closed Loop — Implementation

## Target

Implement the PostgreSQL data migration dry-run first closed loop: structured migration intent generation, dry-run evidence with always-blocked execution, integration into existing assessment/plan surfaces, and full test coverage. **No real pg_dump/pg_restore execution. No real DB connection. No secrets.**

## Non-Goals

- NO real `pg_dump` / `pg_restore` / `pg_basebackup` execution
- NO real database connection in tests or production
- NO data transfer between hosts
- NO credential handling or Secret Transport
- NO MySQL / MongoDB / Redis / generic database support
- NO database rollback / restore automation
- NO UI changes
- NO route split
- NO changes to legacy apply guards (HTTP 410)
- NO new managed adapters
- NO modification to `inventory-graph.ts`, `migration-classifier.ts`, `managed-adapters.ts`, `managed-execution.ts`
- NO modification to `executor.ts` or `engine/runner.ts`

## Step 1: Read these files first (do not modify)

1. `apps/api/src/migration-assessment.ts` — read `AssessmentSummary` interface (find where `enrichedStacks` was added), `buildAssessmentSummary()`, `categoryForCandidate()`, `recommendedStrategy()`, `requiredDecisionsForCandidate()`
2. `apps/api/src/migration-classifier.ts` — read `MigrationPlanAction` types, `MigrationCandidate` type, how candidates carry data paths / service names
3. `apps/api/src/inventory-graph.ts` — read `ServiceStack.dataPaths`, `ServiceStack.configFiles`, `ServiceStack.volumes` — these provide estimated data/config paths
4. `apps/api/src/runtime-store.ts` — read `StoredProbeSnapshot` type, `StoredMigrationDataDecision` type (data strategy: `"logical-dump" | "physical-backup" | "record-only" | "manual" | "blocked"`)
5. `apps/api/src/engine/tests/assessment-summary.test.ts` — understand assessment fixture patterns
6. `apps/api/src/routes.ts` — read the `POST /api/migration/sessions/:sessionId/data-decisions` route to understand data strategy persistence
7. `docs/phase5r-a-data-migration-first-closed-loop-planning-2026-07-09.md` — this planning report (type definitions and architecture)

## Step 2: Create `apps/api/src/postgres-data-migration.ts` (NEW)

### Types to define (matching planning report §7.2):

```typescript
export type PostgresDataMigrationStrategy = "logical-dump" | "physical-backup" | "record-only" | "manual" | "blocked";

export interface PostgresDataMigrationCommandTemplate {
  id: string;
  label: string;
  template: string;             // sanitized, never contains real credentials
  sanitizedNotes: string[];
  requiresSecret: boolean;      // always true → blocks execution
  requiresApproval: boolean;    // always true
  blocked: true;                // hard-coded true for Phase 5R-B
  blockedReason: string;
}

export interface PostgresDataMigrationIntent {
  candidateId: string;
  serviceName: string;
  sourceHost: string;
  strategy: PostgresDataMigrationStrategy;
  estimatedDataPaths: string[];
  estimatedConfigPaths: string[];
  estimatedVolumeBytes?: number;
  dryRunOnly: true;
  requiredApprovals: string[];
  blockedReason?: string;
  commandTemplates: PostgresDataMigrationCommandTemplate[];
}

export interface PostgresDataMigrationDryRun {
  intent: PostgresDataMigrationIntent;
  schemaVersion: "phase5r.dry-run.v1";
  generatedAt: string;
  hostname: string;
  assessment: {
    candidateFound: boolean;
    strategyRecommended: string;
    requiredDecisions: string[];
  };
  readiness: "requires-decision" | "dry-run-ready" | "blocked";
  approvalGates: Array<{
    gate: string;
    satisfied: boolean;
    reason?: string;
  }>;
  commandTemplates: PostgresDataMigrationCommandTemplate[];
  executionBlocked: true;
  executionBlockedReason: string;
  safetyNotes: string[];
}
```

### Function 1: `buildPostgresDataMigrationIntent()`

```typescript
export function buildPostgresDataMigrationIntent(params: {
  candidate: MigrationCandidate;
  snapshot: StoredProbeSnapshot;
  dataDecisions: StoredMigrationDataDecision[];
  host: string;
}): PostgresDataMigrationIntent | null
```

Logic:
1. Verify candidate IS a PostgreSQL candidate (regex `/postgres/i` on candidate name + catalogRuleName)
2. If NOT PostgreSQL → return `null` (not an error — caller handles absence)
3. Determine strategy from `dataDecisions`:
   - Find the decision matching `candidate.id`
   - Map decision strategy to `PostgresDataMigrationStrategy`
   - If no decision → `blocked` with reason "Data strategy not yet decided"
4. Compute estimated data paths:
   - Call `extractInventoryGraph(snapshot)` → find `dataPath` nodes whose label/packageName contains "postgres"
   - Collect their paths
5. Compute estimated config paths:
   - Find `configFile` nodes matching postgres
   - Collect their paths
6. Build command templates (ALWAYS blocked):
   ```typescript
   commandTemplates: [
     {
       id: "pg-dump-custom",
       label: "pg_dump -Fc (custom format)",
       template: "pg_dump -h <source_host> -U <username> -d <dbname> -Fc -f <output_path>",
       sanitizedNotes: ["Credentials must be provided via ~/.pgpass or PGPASSWORD environment variable", "Source host, username, and database name must be confirmed by operator"],
       requiresSecret: true,
       requiresApproval: true,
       blocked: true,
       blockedReason: "Database credential model not yet implemented; execution deferred to future phase"
     },
     // ... similar templates for pg_dumpall, pg_basebackup, pg_restore
   ]
   ```
7. Set `dryRunOnly: true`, populate `requiredApprovals: ["data-strategy-confirm"]`

### Function 2: `buildPostgresDataMigrationDryRun()`

```typescript
export function buildPostgresDataMigrationDryRun(intent: PostgresDataMigrationIntent): PostgresDataMigrationDryRun
```

Logic:
1. Copy intent into dry-run
2. Compute readiness:
   - `intent.blockedReason !== undefined` → `"blocked"`
   - `intent.strategy !== "logical-dump" && intent.strategy !== "physical-backup"` → `"requires-decision"`
   - Otherwise → `"dry-run-ready"`
3. Check approval gates:
   - `data-strategy-confirm`: satisfied if `intent.strategy !== "blocked"`
4. Populate execution blocked reason:
   - Always: `"Real pg_dump/pg_restore execution is not implemented in this phase. Only dry-run evidence is produced. Database credentials, transfer safety, and restore verification must be designed before execution is enabled."`
5. Set `executionBlocked: true`
6. Populate safety notes:
   - "No database connection was made to produce this evidence."
   - "All command templates are sanitized and contain no credentials."
   - "Execution requires: confirmed data strategy, approved Environment Plan, valid source/target connections, database credentials via Secret Transport."
   - "pg_dump/pg_restore may require significant downtime for large databases."

### Function 3: `postgresDataMigrationDryRunForAssessment()`

```typescript
export function postgresDataMigrationDryRunForAssessment(params: {
  candidates: MigrationCandidate[];
  snapshot: StoredProbeSnapshot;
  dataDecisions: StoredMigrationDataDecision[];
  host: string;
}): PostgresDataMigrationDryRun | undefined
```

Logic:
1. Find the first PostgreSQL candidate in `candidates`
2. If none → return `undefined`
3. Call `buildPostgresDataMigrationIntent()` → `buildPostgresDataMigrationDryRun()`
4. Return result

## Step 3: Wire into AssessmentSummary (minimal, additive)

In `apps/api/src/migration-assessment.ts`:

1. Import `PostgresDataMigrationDryRun` type and `postgresDataMigrationDryRunForAssessment` function
2. Add optional field to `AssessmentSummary`:
   ```typescript
   /** Phase 5R-B: PostgreSQL data migration dry-run evidence. Always undefined when no PostgreSQL candidate exists. */
   postgresDataMigrationDryRun?: PostgresDataMigrationDryRun;
   ```
3. In `buildAssessmentSummary()`, after the existing `serviceStacks` and `enrichedStacks` computation:
   ```typescript
   const postgresDryRun = postgresDataMigrationDryRunForAssessment({
     candidates: input.report.candidates,
     snapshot: input.snapshot as StoredProbeSnapshot,
     dataDecisions: input.dataDecisions ?? [],
     host: input.host ?? input.snapshot.system.hostname,
   });
   ```
4. Add `postgresDataMigrationDryRun: postgresDryRun` to the returned summary object

## Step 4: Create tests in `apps/api/src/engine/tests/postgres-data-migration.test.ts` (NEW)

### Test structure

Use pure function tests (no Fastify setup needed — `buildPostgresDataMigrationIntent` and `buildPostgresDataMigrationDryRun` are pure).

### Fixtures

Create a minimal `MigrationCandidate` that looks like a PostgreSQL database:
```typescript
function pgCandidate(overrides?: Partial<MigrationCandidate>): MigrationCandidate {
  return {
    id: "candidate:postgresql",
    name: "PostgreSQL Database",
    catalogRuleName: "postgres-profile",
    catalogRuleId: "postgres-profile",
    category: "database",
    ...overrides
  };
}
```

Create a minimal `StoredProbeSnapshot` (reuse patterns from existing test fixtures).

### Test list (12 tests)

1. **PG candidate → logical-dump intent**: `pgCandidate()` + `dataDecisions` with strategy `"export-import"` → intent with `strategy: "logical-dump"`, `dryRunOnly: true`, command templates populated
2. **Non-PG candidate → null**: `pgCandidate({ name: "nginx", catalogRuleName: "nginx" })` → `buildPostgresDataMigrationIntent` returns `null`
3. **Missing data strategy → blocked**: `pgCandidate()` + `dataDecisions = []` → intent with `strategy: "blocked"`, `blockedReason` populated
4. **Record-only strategy → blocked**: `pgCandidate()` + decision with `strategy: "record-only"` → intent with `strategy: "record-only"` (valid, not blocked but blocked for execution)
5. **Manual strategy → blocked**: `pgCandidate()` + decision with `strategy: "manual"` → intent with `strategy: "manual"`
6. **Dry-run evidence shape contract**: Build intent → build dry-run → assert all top-level keys, `schemaVersion: "phase5r.dry-run.v1"`, `executionBlocked: true`, `executionBlockedReason` non-empty string
7. **Execution always blocked**: For any valid intent, dry-run MUST have `executionBlocked: true` — this is the key safety assertion
8. **Command templates sanitized**: All command templates have `blocked: true`, `requiresSecret: true`, `requiresApproval: true`, no raw credential values in templates
9. **Command templates structurally correct**: `pg_dump` template mentions `-Fc`, `pg_restore` template mentions `-d`, etc.
10. **Safety notes populated**: Dry-run has at least 3 safety notes, all mentioning no-db-connection, no-credentials, approval-required
11. **Approval gates check**: `data-strategy-confirm` gate is `satisfied: true` when strategy is valid, `satisfied: false` when blocked
12. **Data paths from InventoryGraph**: When snapshot has postgres data paths, they appear in `estimatedDataPaths`

## Step 5: Commands to run

```bash
# Type check
cd E:/1project/EnvForge/apps/api && npx tsc --noEmit -p tsconfig.json

# Build
cd E:/1project/EnvForge/apps/api && npm run build

# Targeted new tests
cd E:/1project/EnvForge/apps/api && node --test --test-concurrency=1 dist/engine/tests/postgres-data-migration.test.js

# Full test suite
cd E:/1project/EnvForge/apps/api && npm test
```

## Step 6: Evidence to report

After implementation, report:
1. Total test count (expect ≥969)
2. Pass/fail status
3. `npx tsc --noEmit` status
4. `npm run build` status
5. List of files changed
6. Confirmation: execution always blocked in dry-run
7. Confirmation: no SSH connection, no DB connection, no secrets
8. Confirmation: Environment Plan compatibility preserved

## Step 7: Commit expectation

- Commit message: `Implement PostgreSQL data migration dry-run first closed loop — Phase 5R-B`
- Can commit locally
- Do NOT push (push is Phase 5R-C)

## Step 8: PASS / BLOCKED closure

- **PASS**: All tests pass, typecheck clean, build succeeds, execution always blocked, no secrets in output, existing API suite passes, legacy apply guards intact
- **BLOCKED**: Any test failure, type error, build failure, or if any production code modification attempts real pg_dump execution or DB connection

---

**PROMPT END**

---

## 16. Phase 5R-A Verdict

- **Result**: **PASS**
- **Blockers**: None
- **Stable baseline**: `a01574d`, clean repo, synced with origin, 957/957 tests pass
- **Phase 5R-B ready**: Yes — prompt above is executable
- **Key decisions**:
  - Phase 5R-B implements **dry-run first closed loop only** — no real `pg_dump`/`pg_restore` execution
  - Real execution blocked until credential model, transfer safety, and restore verification are designed
  - PostgreSQL only — MySQL, MongoDB, Redis, generic frameworks are excluded
  - All integration is additive (optional fields on existing types) — zero breaking changes
  - Environment Plan approval gates are reused, not bypassed
  - Legacy apply routes remain HTTP 410

---

*Report generated 2026-07-09. Phase 5R-A planning complete.*
