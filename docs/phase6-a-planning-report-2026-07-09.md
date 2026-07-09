# Phase 6-A: Production Integration / Route Exposure / Assessment Wiring — Planning Report

- **Date**: 2026-07-09
- **Phase**: 6-A (planning only — no code changes)
- **Stable baseline**: `5760e41` — Enrich service stack aggregation with Phase 4 graph surfaces — Phase 5-B
- **Result**: PASS

---

## 1. Baseline

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `5760e41ca9dee24a6b701bc06d1e470185059fed` |
| Commit msg | `Enrich service stack aggregation with Phase 4 graph surfaces — Phase 5-B` |
| `git status --short` | `?? docs/audit-report-2026-07-08.md` (untracked, not relevant) |
| `origin/main` sync | **Synced** — `0 ahead, 0 behind` |
| Full API test suite | **931/931 pass** (15 suites, 0 failures) |
| Key test groups | `inventory-graph.test.ts` (8), `inventory-graph-phase4.test.ts` (38), `service-stack-phase5.test.ts` (31) — all pass |

**Verdict**: Repository is clean, synced, and fully tested. No blockers.

---

## 2. Phase 4 / Phase 5 Data Surface Summary

### 2.1 Already implemented data surfaces (`apps/api/src/inventory-graph.ts`)

**`InventoryGraph`** — typed node/relationship layer over `StoredProbeSnapshot`:
- 15 `InventoryNodeKind`s: `package`, `service`, `port`, `process`, `container`, `configFile`, `dataPath`, `volume`, `secretRef`, `envFile`, `network`, `certificate`, `domain`, `userGroup`, `scheduledTask`
- 15 typed node interfaces (`PackageNode`, `ServiceNode`, `PortNode`, `ProcessNode`, …)
- 16 `RelKind` relationship types (`owns`, `listensOn`, `dependsOn`, `writesTo`, `readsEnv`, `runs`, `mounts`, `attachedTo`, `references`, `invokes`, `serves`, `exposes`, `secures`, `owns`, `provides`, `usesConfig`)
- `extractInventoryGraph(snapshot)` — pure data transformation builder
- Returns: `{ hostname, capturedAt, completeness, nodes: InventoryNode[], rels: InventoryRel[] }`

**`ServiceStack`** — enriched service stack aggregator:
- 9 existing core fields: `id`, `label`, `service`, `packages`, `ports`, `configFiles`, `containers`, `confidence`, `reasoning`
- 10 optional Phase 5-B enrichment fields: `processes`, `dataPaths`, `envFiles`, `secretRefs`, `volumes`, `networks`, `certificates`, `domains`, `usersGroups`, `scheduledTasks`
- `StackEnrichment` metadata: `version`, `sourceGraphNodeCount`, `sourceGraphEdgeCount`, `enrichmentWarnings`
- 10 `Stack*Ref` typed interfaces with `confidence` and `evidence[]`
- `aggregateServiceStacks(graph)` — walks graph via edge-index maps, produces enriched stacks
- Secret safety: `SecretRef` carries only `fingerprint` (DJB2 hash) + `sourceLocation` + `redacted: true`. `EnvFileRef` carries only `keyCount: number`. No raw values.

### 2.2 Already serialized but NOT exposed

Everything in `ServiceStack` and `InventoryGraph` is:
- **Serializable**: plain objects, no functions, no circular references
- **Typed**: full TypeScript interfaces exported from `inventory-graph.ts`
- **Tested**: 77 dedicated tests (8 + 38 + 31)
- **But zero route exposure**: no API endpoint returns either `ServiceStack` or `InventoryGraph`

### 2.3 Exposed internally but NOT in production routes

The `ServiceStack` and `InventoryGraph` types are:
- Exported from `inventory-graph.ts` as `export`
- Imported only by test files and nothing else in the production codebase
- Not visible to any API consumer, frontend, or external client

### 2.4 Not implemented and out of scope

- Data Migration (Phase 6 non-goal)
- Secret Transport (Phase 6 non-goal)
- Conflict Resolver (Phase 6 non-goal)
- New frontend visualizations (Phase 6 non-goal)

---

## 3. Production Consumer Surface Map

### 3.1 Current production routes touching service-stack-like data

All assessment/migration routes return `AssessmentSummary` with `AssessmentServiceStack[]`, which is a **parallel type system**, NOT the `ServiceStack` from `inventory-graph.ts`.

| Route | Returns | Uses `ServiceStack`? | Uses `InventoryGraph`? |
|---|---|---|---|
| `GET /api/migration/sessions/:id/assessment` | `AssessmentSummary` | ❌ (own type) | ❌ |
| `GET /api/migration/sessions/:id/assessment/report` | `AssessmentSummary` (JSON/MD) | ❌ (own type) | ❌ |
| `GET /api/migration/sessions/:id/analysis` | `{ session, report, reviewQueue, decisions }` | ❌ | ❌ |
| `GET /api/migration/sessions/:id/failures` | `{ diagnostics: FailureDiagnostic[] }` | ❌ | ❌ |
| `GET /api/migration/sessions/:id/support-bundle` | `SupportBundle` | ❌ | ❌ |
| `GET /api/migration/sessions/:id/report` | `{ session, report }` | ❌ | ❌ |
| `GET /api/connections/:id/migration-candidates` | `{ report, decisions }` | ❌ | ❌ |
| `GET /api/profiles/:id/migration-candidates` | `{ report, decisions }` | ❌ | ❌ |
| `GET /api/connections/:id/migration-review-queue` | `{ queue }` | ❌ | ❌ |
| `GET /api/decision-engine/review-inbox` | `{ items }` | ❌ | ❌ |

**None of these routes import or reference `inventory-graph.ts` in any way.**

### 3.2 Consumer modules that build assessment data

| Module | Key function | Imports from `inventory-graph.ts`? |
|---|---|---|
| `migration-classifier.ts` | `buildMigrationCandidateReport()` | ❌ No |
| `migration-assessment.ts` | `buildAssessmentSummary()` | ❌ No |
| `migration-session.ts` | `buildMigrationSessionArtifacts()` | ❌ No |
| `failure-diagnostics.ts` | `buildFailureDiagnostics()` | ❌ No |
| `support-bundle.ts` | `buildSupportBundle()` | ❌ No |
| `golden-scenario-harness.ts` | scenario validation | ❌ No |
| `capability-catalog-preview.ts` | `CatalogPreviewReview` | ❌ No |
| `decision-engine/*.ts` | review inbox, scores, classify | ❌ No |

### 3.3 The parallel type system

The current assessment path builds `AssessmentServiceStack` from `MigrationCandidate` (flat item classification), **not** from `InventoryGraph` → `ServiceStack`. Key differences:

| Field | `ServiceStack` (inventory-graph) | `AssessmentServiceStack` (assessment) |
|---|---|---|
| Backbone | `service: ServiceNode` | `name: string` |
| Confidence | `"high" \| "medium" \| "low"` | `"high" \| "medium" \| "low" \| "unknown"` |
| Packages | `PackageNode[]` (typed) | N/A (flattened into `evidence[]`) |
| Ports | `PortNode[]` (typed) | N/A (flattened into `evidence[]`) |
| ConfigFiles | `ConfigFileNode[]` (typed) | N/A (flattened into `evidence[]`) |
| Enrichment | `processes`, `dataPaths`, `envFiles`, etc. | N/A — not present |
| Risk | N/A | `"low" \| "medium" \| "high" \| "unknown"` |
| Category | N/A | `web-entry \| app-runtime \| database \| …` |
| Statefulness | N/A | `stateless \| stateful \| mixed \| unknown` |
| Migration readiness | N/A | detailed migration readiness enum |
| Required decisions | N/A | `AssessmentRequiredDecision[]` |

These are complementary, not redundant — each serves a different purpose:
- `ServiceStack` = structured evidence graph for the service
- `AssessmentServiceStack` = migration-readiness judgement for the operator

---

## 4. Exposure Gap Analysis

### 4.1 Gap summary

| Question | Answer |
|---|---|
| Can `ServiceStack` be read from any production API response? | **NO** — not returned by any route |
| Can `InventoryGraph` be read from any production API response? | **NO** — not returned by any route |
| Does the assessment path consume `ServiceStack`? | **NO** — uses `AssessmentServiceStack` (parallel type) |
| Does the report path consume `ServiceStack`? | **NO** — markdown report built from `AssessmentSummary` |
| Does the review path consume `ServiceStack`? | **NO** — review decisions from `MigrationCandidate` |
| Are there internal-only data surfaces? | **YES** — `ServiceStack`/`InventoryGraph` exist only in builder/aggregator layer, consumed only by tests |

### 4.2 Classification

This is a **unit-level availability** gap, not a production exposure gap. `ServiceStack` is unit-tested but never wired into any production path. This confirms the earlier Phase 5-A planning assumption: Phase 4/5 built the engine but never connected it.

### 4.3 The specific wiring point

The natural wiring point is `buildAssessmentSummary()` in `migration-assessment.ts`. It already:
1. Receives `StoredProbeSnapshot` (same input `extractInventoryGraph()` needs)
2. Receives `MigrationCandidateReport` (the classified flat items)
3. Produces `AssessmentSummary` with `AssessmentServiceStack[]`

The minimal wiring would:
1. Call `extractInventoryGraph(snapshot)` → `InventoryGraph`
2. Call `aggregateServiceStacks(graph)` → `ServiceStack[]`
3. Add optional `inventoryGraph?` and/or `serviceStacks?` fields to `AssessmentSummary` (or a new route)
4. Add enriched field data to `AssessmentServiceStack` or provide as separate enriched view

---

## 5. Recommended Phase 6-B Minimal Scope

### 5.1 Principle

**Expose, don't redesign.** The enriched data already exists. The only missing piece is a route that returns it.

### 5.2 Recommended changes

#### Change 1: Add `GET /api/migration/sessions/:sessionId/inventory-graph` (NEW route)

| Detail | Value |
|---|---|
| Target file | `apps/api/src/routes.ts` |
| Target location | After existing `:sessionId/assessment` route block |
| Expected behavior | Accept `sessionId`, load session context, extract `InventoryGraph` from `conn.probeSnapshot`, return `{ graph: InventoryGraph }` |
| Why minimal | No changes to existing routes, no schema migration, additive only |
| Required tests | Route test: 200 with valid snapshot, 400/404 for missing snapshot/session |
| Compatibility risk | **Zero** — new route, no existing consumer affected |

#### Change 2: Add `GET /api/migration/sessions/:sessionId/service-stacks` (NEW route)

| Detail | Value |
|---|---|
| Target file | `apps/api/src/routes.ts` |
| Target location | After inventory-graph route |
| Expected behavior | Accept `sessionId`, load context, run `extractInventoryGraph()` + `aggregateServiceStacks()`, return `{ stacks: ServiceStack[] }` |
| Why minimal | Exposes already-built data; no new computation |
| Required tests | Route test: verify stacks contain enriched fields, verify secret safety (no raw values in JSON), verify backward compat (old snapshots → empty enrichment) |
| Compatibility risk | **Zero** — new route |

#### Change 3: Enrich `AssessmentSummary` with optional `enrichedStacks?: ServiceStack[]` field

| Detail | Value |
|---|---|
| Target file | `apps/api/src/migration-assessment.ts` |
| Target function | `buildAssessmentSummary()` |
| Expected behavior | After building existing `serviceStacks`, optionally also run `extractInventoryGraph()` + `aggregateServiceStacks()`, attach as `enrichedStacks` |
| Why minimal | Optional field — existing consumers ignore it; new consumers can opt in |
| Required tests | Assessment summary test: verify `enrichedStacks` is present and has correct shape; regression test: old fields unchanged |
| Compatibility risk | **Low** — optional field addition, no field removal or rename |

#### Change 4: Add inventory graph / service stack fields to `SupportBundle`

| Detail | Value |
|---|---|
| Target file | `apps/api/src/support-bundle.ts` |
| Target function | `buildSupportBundle()` |
| Expected behavior | Add optional `inventoryGraph?` and `enrichedStacks?` to `SupportBundle` interface; populate if assessment has them |
| Why minimal | Support bundle already carries assessment data; enriched graph is natural evidence |
| Required tests | Support bundle test: verify new fields present when available, absent when not |
| Compatibility risk | **Low** — optional fields in support bundle export |

#### Change 5: Add `GET /api/connections/:id/inventory-graph` (NEW route)

| Detail | Value |
|---|---|
| Target file | `apps/api/src/routes.ts` |
| Target location | After migration-candidates route block |
| Expected behavior | Accept `connectionId`, load connection, extract `InventoryGraph` from `probeSnapshot`, return `{ graph: InventoryGraph }` |
| Why minimal | Symmetric with session-based route; connection-level view |
| Required tests | Route test: 200 with probed connection, 400 without probeSnapshot |
| Compatibility risk | **Zero** — new route |

### 5.3 Changes NOT recommended for Phase 6-B

The following are explicitly excluded:
- Replacing `AssessmentServiceStack` with `ServiceStack` (breaking change, different semantics)
- Adding `ServiceStack` to every existing route response (bloat without consumer demand)
- Adding frontend routes or UI components
- Adding migration/secret/conflict resolver features
- Renaming or removing any existing field
- Changing the `aggregateServiceStacks()` or `extractInventoryGraph()` contract

---

## 6. Explicit Non-Goals

| Non-goal | Reason |
|---|---|
| Data Migration | Out of scope per Phase 6 charter |
| Secret Transport | Out of scope per Phase 6 charter |
| Conflict Resolver | Out of scope per Phase 6 charter |
| New graph algorithms | Phase 4 already built the graph |
| New service discovery collectors | Phase 3 already built collectors |
| New inventory extraction rules | Phase 4 already built extraction |
| New frontend visualization | No UI changes in Phase 6 |
| Breaking API response changes | All changes are additive (new routes or optional fields) |
| Renaming existing public fields | Backward compatibility required |
| Broad refactor | Not needed for wiring |
| Performance optimization | Not required for route exposure at this scale |
| Security policy change | Existing auth/redaction applied uniformly |

---

## 7. Test and Evidence Plan

### 7.1 Phase 6-B must-add tests

| # | Test | File | What it proves |
|---|---|---|---|
| 1 | `GET /sessions/:id/inventory-graph` returns 200 with valid snapshot | `assessment-routes.test.ts` or new file | Route wired correctly |
| 2 | `GET /sessions/:id/inventory-graph` returns 400/404 for missing snapshot | Same | Error handling |
| 3 | `GET /sessions/:id/service-stacks` returns enriched stacks | Same | Phase 5 data exposed |
| 4 | `GET /sessions/:id/service-stacks` secret safety: no raw values in JSON | Same | Secret safety at route level |
| 5 | `GET /connections/:id/inventory-graph` returns 200 with probed connection | Same | Connection-level exposure |
| 6 | `AssessmentSummary.enrichedStacks` populated when snapshot available | `assessment-summary.test.ts` | Assessment wiring |
| 7 | `AssessmentSummary.enrichedStacks` absent for pre-Phase-5 snapshots | Same | Backward compat |
| 8 | Existing assessment fields unchanged after wiring | Same | Regression |
| 9 | `SupportBundle.inventoryGraph` populated when assessment has it | `support-bundle.test.ts` | Support bundle wiring |
| 10 | `SupportBundle.enrichedStacks` absent when assessment lacks it | Same | Graceful degradation |

### 7.2 Phase 6-C evidence closure (separate phase)

| # | Evidence | What it proves |
|---|---|---|
| 1 | Full API suite rerun (expect ≥941 pass) | No regressions |
| 2 | TypeScript `npx tsc --noEmit` clean | No type errors |
| 3 | `npm run build` clean | Production build passes |
| 4 | Manual curl/JSON inspection of new routes | Real data shape correct |
| 5 | Updated audit report | Phase 6 evidence recorded |

---

## 8. Risk and Compatibility Assessment

### 8.1 Response shape compatibility

- **Risk**: None. All changes are additive (new routes or optional fields).
- **Existing routes**: Unchanged. No field removed or renamed from any existing response.
- **New routes**: Greenfield. No existing consumer expects them.

### 8.2 Fixture churn risk

- **Risk**: None. No existing test fixtures modified — only new test fixtures added.
- The `extractInventoryGraph()` and `aggregateServiceStacks()` functions are already tested with their own fixtures.

### 8.3 Snapshot brittleness

- **Risk**: Low. The extractor already handles missing/empty data surfaces (Phase 4 tests cover this).
- If an old snapshot lacks Phase 3 data surfaces, the graph still builds — it just has fewer node types.

### 8.4 Route-level performance risk

- **Risk**: Low. `extractInventoryGraph()` is O(n) transformation over snapshot data. `aggregateServiceStacks()` walks the graph via edge-index maps. For typical VM snapshots (hundreds of packages, dozens of services), this is ~1-5ms.
- **Mitigation**: The new routes could add a `?format=basic` query param to skip enrichment, but this is premature optimization.

### 8.5 Optional / missing data behavior

- **Risk**: Low. `ServiceStack` enrichment fields are already marked optional (`?`). Pre-Phase-5 snapshots produce stacks without enrichment.
- **Route behavior**: Always returns valid JSON. Missing data → empty arrays or undefined fields.

### 8.6 Backward compatibility for consumers

- **Risk**: None. No existing consumer is removed or changed.
- New fields/extensions are additive; old clients ignore unknown fields.

### 8.7 Secret leak risk

- **Risk**: Very low. `SecretRef` uses `fingerprint` (DJB2 hash), `sourceLocation` (path), `redacted: true`. `EnvFileRef` uses `keyCount: number`. No raw values stored.
- **Route-level verification**: Phase 6-B tests must assert `JSON.stringify(response)` contains no secret-like patterns.

---

## 9. Files Expected to Change in Phase 6-B

| File | Change type | Why |
|---|---|---|
| `apps/api/src/routes.ts` | **Add** 3 new routes | Primary exposure point |
| `apps/api/src/migration-assessment.ts` | **Modify** `AssessmentSummary` + `buildAssessmentSummary()` | Wire enriched stacks into assessment |
| `apps/api/src/support-bundle.ts` | **Modify** `SupportBundle` + `buildSupportBundle()` | Wire graph into support bundle |
| `apps/api/src/engine/tests/assessment-routes.test.ts` | **Add** tests for new routes | Route-level test coverage |
| `apps/api/src/engine/tests/assessment-summary.test.ts` | **Add** tests for enriched fields | Assessment wiring test coverage |
| `apps/api/src/engine/tests/support-bundle.test.ts` | **Add** tests for new fields | Support bundle wiring coverage |

## 10. Files Expected NOT to Change

| File | Reason |
|---|---|
| `apps/api/src/inventory-graph.ts` | Phase 4/5 contract is complete and correct |
| `apps/api/src/engine/tests/inventory-graph.test.ts` | Phase 4 extraction contract unchanged |
| `apps/api/src/engine/tests/inventory-graph-phase4.test.ts` | Phase 4 extraction contract unchanged |
| `apps/api/src/engine/tests/service-stack-phase5.test.ts` | Phase 5 aggregation contract unchanged |
| `apps/api/src/migration-classifier.ts` | Flat classification path not in scope |
| `apps/api/src/collectors/data-surfaces.ts` | Collector contract unchanged |
| `apps/api/src/runtime-store.ts` | Data model unchanged |
| `apps/api/src/capability-catalog-preview.ts` | Unrelated to inventory/stack exposure |
| `apps/api/src/decision-engine/*.ts` | Unrelated to inventory/stack exposure |
| `apps/api/src/golden-scenario-harness.ts` | Golden scenarios can be wired in future phase |
| `apps/web/**/*` | No frontend changes in Phase 6 |

---

## 11. Phase 6-B Implementation Prompt

---

**PROMPT START** — copy everything below to execute Phase 6-B

---

# Phase 6-B: Production Integration — Route Exposure & Assessment Wiring

## Target

Wire Phase 5 enriched `ServiceStack` and Phase 4 `InventoryGraph` into production API routes so they are readable by API consumers.

## Non-Goals

- NO Data Migration
- NO Secret Transport
- NO Conflict Resolver
- NO changes to `inventory-graph.ts`, `extractInventoryGraph()`, or `aggregateServiceStacks()`
- NO changes to `migration-classifier.ts`
- NO frontend/UI changes
- NO renaming of existing public fields
- NO breaking API response changes (all changes are additive)

## Step 1: Read these files first (do not modify)

1. `apps/api/src/routes.ts` — find the `:sessionId/assessment` route block (~line 4516-4541) and `:sessionId/support-bundle` block (~line 4607)
2. `apps/api/src/migration-assessment.ts` — read `AssessmentSummary` interface and `buildAssessmentSummary()` function signature
3. `apps/api/src/support-bundle.ts` — read `SupportBundle` interface and `buildSupportBundle()` function signature
4. `apps/api/src/migration-session.ts` — read `buildSessionArtifacts()` to understand the `context` shape
5. `apps/api/src/inventory-graph.ts` — read exports: `extractInventoryGraph`, `aggregateServiceStacks`, `ServiceStack`, `InventoryGraph`

## Step 2: Add new routes in `apps/api/src/routes.ts`

### Route A: `GET /api/migration/sessions/:sessionId/inventory-graph`
- Auth: require valid user token (same as existing assessment routes)
- Load session context via `loadMigrationSessionContext()`
- If no session → 404
- If no `conn.probeSnapshot` → 400 with `{ error: "No snapshot available." }`
- Import `extractInventoryGraph` from `../inventory-graph.js`
- Call `extractInventoryGraph(conn.probeSnapshot)` → return `{ graph }`

### Route B: `GET /api/migration/sessions/:sessionId/service-stacks`
- Same auth/loading as Route A
- Import `extractInventoryGraph` + `aggregateServiceStacks`
- Call `extractInventoryGraph()` → `aggregateServiceStacks()` → return `{ stacks }`

### Route C: `GET /api/connections/:id/inventory-graph`
- Auth: require valid user token (same as existing connection routes)
- Load connection from DB
- If no connection → 404
- If no `probeSnapshot` → 400 with `{ error: "Probe this connection before requesting inventory graph." }`
- Call `extractInventoryGraph(conn.probeSnapshot)` → return `{ graph }`

## Step 3: Enrich `AssessmentSummary` in `apps/api/src/migration-assessment.ts`

- Import `extractInventoryGraph` + `aggregateServiceStacks` + `ServiceStack` from `../inventory-graph.js`
- Add optional field to `AssessmentSummary`: `enrichedStacks?: ServiceStack[]`
- In `buildAssessmentSummary()`, after building existing `serviceStacks`, run:
  ```ts
  const graph = extractInventoryGraph(input.snapshot as StoredProbeSnapshot);
  const enrichedStacks = aggregateServiceStacks(graph);
  ```
- Attach `enrichedStacks` to the returned `AssessmentSummary`
- If snapshot lacks Phase 3 data surfaces, `aggregateServiceStacks()` gracefully returns stacks without enrichment — still attach them (they still have the 9 core fields)

## Step 4: Enrich `SupportBundle` in `apps/api/src/support-bundle.ts`

- Add optional `inventoryGraph?` and `enrichedStacks?` fields to `SupportBundle`
- In `buildSupportBundle()`, if assessment is present and has `enrichedStacks`, include them
- Do NOT re-extract the graph — reuse from assessment

## Step 5: Add tests

### Test file: `apps/api/src/engine/tests/inventory-graph-routes.test.ts` (NEW)

1. `GET /sessions/:id/inventory-graph` returns 200 with valid session+snapshot
2. `GET /sessions/:id/inventory-graph` returns 404 for unknown session
3. `GET /sessions/:id/inventory-graph` returns 400 for session without snapshot
4. `GET /sessions/:id/service-stacks` returns 200 with enriched stacks
5. `GET /sessions/:id/service-stacks` — verify `processes`, `dataPaths`, `envFiles` populated when edges exist in graph
6. `GET /sessions/:id/service-stacks` — verify no raw secret values in JSON response (stringify + assert no "password"/"secret"/"key" patterns in values)
7. `GET /sessions/:id/service-stacks` — verify `enrichment.version` is `"phase5.stack.v1"`
8. `GET /connections/:id/inventory-graph` returns 200 with probed connection
9. `GET /connections/:id/inventory-graph` returns 400 without probeSnapshot

### Test file: `apps/api/src/engine/tests/assessment-summary.test.ts` (MODIFY)

10. `buildAssessmentSummary` produces `enrichedStacks` field when snapshot has software
11. `buildAssessmentSummary` enriched stacks contain `processes` when process edges exist
12. `buildAssessmentSummary` regression: existing `serviceStacks` field unchanged

### Test file: `apps/api/src/engine/tests/support-bundle.test.ts` (MODIFY)

13. `SupportBundle` includes `inventoryGraph` when assessment has it
14. `SupportBundle` omits `inventoryGraph` when assessment is undefined

## Step 6: Commands to run

```bash
# Type check
cd E:/1project/EnvForge/apps/api && npx tsc --noEmit -p tsconfig.json

# Build
cd E:/1project/EnvForge/apps/api && npm run build

# Full test suite
cd E:/1project/EnvForge/apps/api && npm test

# Targeted new tests
cd E:/1project/EnvForge/apps/api && npm test -- --test-name-pattern="inventory-graph-routes"
```

## Step 7: Evidence to report

After implementation, report:
1. Total test count (expect ≥945)
2. Pass/fail status
3. `npx tsc --noEmit` status
4. `npm run build` status
5. List of files changed
6. Secret safety verification: `JSON.stringify()` of new route responses contains no secrets

## Step 8: Commit expectation

- Commit message: `Expose InventoryGraph and enriched ServiceStack via assessment routes — Phase 6-B`
- Can commit locally
- Do NOT push (push is Phase 6-C)

## Step 9: PASS / BLOCKED closure

- **PASS**: All tests pass, typecheck clean, build succeeds, new routes return correct data shapes, no secret leaks detected
- **BLOCKED**: Any test failure, type error, build failure, or if `inventory-graph.ts` needs modification to support the wiring

---

**PROMPT END**

---

## 12. Phase 6-A Verdict

- **Result**: **PASS**
- **Blockers**: None
- **Stable baseline**: `5760e41`, clean repo, synced with origin, 931/931 tests pass
- **Phase 6-B ready**: Yes — prompt above is executable
