---
title: 'Phase 7-A: Production Consumer Hardening / Contract Stability — Planning Report'
status: archived
classification: historical-evidence
not_source_of_truth: true
original_path: phase7-a-production-consumer-hardening-planning-2026-07-09.md
archived_at: '2026-07-19'
source_sha256: 57a30af22752e2a0ffdf9efad8ab0fbcee5674347cf9329203bdd068bdcfa305
---

> 历史证据：保留原始内容、日期和当时结论。不得作为当前设计或当前代码事实源；使用前必须在当前 HEAD 重新验证。

# Phase 7-A: Production Consumer Hardening / Contract Stability — Planning Report

- **Date**: 2026-07-09
- **Phase**: 7-A (planning only — no code changes)
- **Stable baseline**: `851c655` — Close Phase 6 production exposure evidence
- **Result**: **PASS**

---

## 1. Baseline

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `851c6556660d28678d24dbf44bd517584cf6ea48` |
| Commit msg | `Close Phase 6 production exposure evidence` |
| `git status --short` | `?? docs/audit-report-2026-07-08.md` (untracked, not relevant) |
| `origin/main` sync | **Synced** — `0 ahead, 0 behind` |
| Full API test suite | **947/947 pass** (15 suites, 0 failures) |
| Phase 6-A report | `docs/phase6-a-planning-report-2026-07-09.md` — present |
| Phase 6-B report | `docs/phase6-b-implementation-report-2026-07-09.md` — present |
| Phase 6-C report | `docs/phase6-c-browser-api-evidence-closure-2026-07-09.md` — present |

**Verdict**: Repository is clean, synced, and fully tested. No blockers.

---

## 2. Phase 6 Surface Summary

Six public-facing surfaces were added or extended in Phase 6-B. All are additive — no existing response shapes were modified, no fields renamed or removed.

### 2.1 New Routes (3)

| # | Route | Auth | Success Response | Error Responses |
|---|---|---|---|---|
| S1 | `GET /api/migration/sessions/:sessionId/inventory-graph` | Bearer token | `{ graph: InventoryGraph }` | 401/404/400 |
| S2 | `GET /api/migration/sessions/:sessionId/service-stacks` | Bearer token | `{ stacks: ServiceStack[] }` | 401/404/400 |
| S3 | `GET /api/connections/:id/inventory-graph` | Bearer token | `{ graph: InventoryGraph }` | 401/404/400 |

### 2.2 Extended Types (3)

| # | Type | Field | Type | Populated By |
|---|---|---|---|---|
| S4 | `AssessmentSummary` | `enrichedStacks?` | `ServiceStack[]` | `buildAssessmentSummary()` via `extractInventoryGraph()` + `aggregateServiceStacks()` |
| S5 | `SupportBundle` | `inventoryGraph?` | `InventoryGraph` | `buildSupportBundle()` from `input.inventoryGraph` |
| S6 | `SupportBundle` | `enrichedStacks?` | `ServiceStack[]` | `buildSupportBundle()` from `input.enrichedStacks ?? assessment?.enrichedStacks` |

### 2.3 Files Changed in Phase 6

| File | Change |
|---|---|
| `apps/api/src/routes.ts` | +3 routes (S1, S2, S3); +1 import |
| `apps/api/src/migration-assessment.ts` | +`enrichedStacks` field (S4); +2 imports; +2 lines in `buildAssessmentSummary()` |
| `apps/api/src/support-bundle.ts` | +`inventoryGraph` + `enrichedStacks` fields (S5, S6); +2 input fields; +1 import; +1 wiring line |
| `apps/api/src/engine/tests/inventory-graph-routes.test.ts` | NEW — 10 route-level tests |
| `apps/api/src/engine/tests/assessment-summary.test.ts` | +4 enriched-stack tests |
| `apps/api/src/engine/tests/support-bundle.test.ts` | +2 bundle wiring tests |

### 2.4 Test Coverage for Phase 6 Surfaces

| Surface | Tests | File | Count |
|---|---|---|---|
| S1 (Session inventory-graph) | 200/404/400/401 | inventory-graph-routes.test.ts | 4 |
| S2 (Session service-stacks) | 200/enrichment/secret-safety/401 | inventory-graph-routes.test.ts | 4 |
| S3 (Connection inventory-graph) | 200/400/404/401 | inventory-graph-routes.test.ts | 4 |
| S4 (Assessment enrichedStacks) | populated/not-alter-existing/empty/read-only | assessment-summary.test.ts | 4 |
| S5/S6 (SupportBundle fields) | propagated/omitted-when-absent | support-bundle.test.ts | 2 |

**Total**: 18 tests covering Phase 6 surfaces (10 route + 4 assessment + 2 support bundle + 2 shared auth).

---

## 3. Contract Surface Audit

### 3.1 S1: `GET /api/migration/sessions/:sessionId/inventory-graph`

| Detail | Value |
|---|---|
| **Source file** | `apps/api/src/routes.ts:4580-4588` |
| **Current response shape** | `{ graph: { hostname, capturedAt, completeness, nodes: InventoryNode[], rels: InventoryRel[] } }` |
| **Optional / required** | `graph` always present (200); `nodes`/`rels` always arrays (may be empty) |
| **Empty-state behavior** | Snapshot with no software → `graph.nodes = []`, `graph.rels = []` |
| **Error behavior** | 401 (no auth), 404 (session not found), 400 (no snapshot) |
| **Session loading** | Uses `loadMigrationSessionContext()` — loads session + connection + decisions in one call |
| **Current tests** | 4 tests: 200 valid, 404 unknown, 400 no snapshot, 401 no auth |
| **Missing tests** | Empty-graph 200 (snapshot with no software), cross-user isolation, response shape regression |
| **Compatibility risk** | **Low** — new route, no existing consumers. `InventoryGraph` shape is determined by `extractInventoryGraph()` which may gain new node kinds in future phases |
| **Recommended hardening** | Add empty-graph test; add response shape contract test (verify top-level keys, node kind list) |

### 3.2 S2: `GET /api/migration/sessions/:sessionId/service-stacks`

| Detail | Value |
|---|---|
| **Source file** | `apps/api/src/routes.ts:4590-4599` |
| **Current response shape** | `{ stacks: ServiceStack[] }` where each stack has 9 core + 10 optional enrichment fields + `enrichment` metadata |
| **Optional / required** | `stacks` always array; enrichment fields are `T[] \| undefined` (NOT empty arrays when absent) |
| **Empty-state behavior** | No services in graph → `stacks: []` |
| **Error behavior** | 401/404/400 (same pattern as S1) |
| **Re-computation** | Re-runs `extractInventoryGraph()` + `aggregateServiceStacks()` on every request — no caching |
| **Current tests** | 4 tests: 200 with stacks, enrichment metadata, secret safety (regex), auth |
| **Missing tests** | Empty-stacks 200, pre-Phase-3 snapshot compat, enrichment field completeness, response shape regression |
| **Compatibility risk** | **Low-Medium** — `ServiceStack` has 20 fields; future Phase enrichment may add more optional fields. Clients that iterate all keys may need updates |
| **Recommended hardening** | Add empty-stacks test; add enrichment field shape test; add response shape contract test |

### 3.3 S3: `GET /api/connections/:id/inventory-graph`

| Detail | Value |
|---|---|
| **Source file** | `apps/api/src/routes.ts:4601-4610` |
| **Current response shape** | `{ graph: InventoryGraph }` — identical shape to S1 |
| **Optional / required** | Same as S1 |
| **Empty-state behavior** | Same as S1 |
| **Error behavior** | 401/404/400 |
| **Session context** | Does NOT use `loadMigrationSessionContext()` — uses direct DB read + `find()`. This is intentional (connection-level, not session-level) but creates a different authz model |
| **Current tests** | 4 tests: 200 with probed, 400 no probe, 404 unknown, 401 no auth |
| **Missing tests** | Cross-user isolation (User A → User B's connection), empty-graph 200, response shape regression |
| **Compatibility risk** | **Medium** — Cross-user isolation is implicit (filtered by `userId`) but NOT tested. If the filter is accidentally removed, one user could see another's graph |
| **Recommended hardening** | **CRITICAL**: Add cross-user isolation test; add empty-graph test; add response shape contract test |

### 3.4 S4: `AssessmentSummary.enrichedStacks?: ServiceStack[]`

| Detail | Value |
|---|---|
| **Source file** | `apps/api/src/migration-assessment.ts:137, 177-178` |
| **Current type** | `ServiceStack[] \| undefined` |
| **Computed in** | `buildAssessmentSummary()` — always computed when snapshot is available |
| **Redaction** | `redactAssessment()` recursively processes the entire object tree, including enrichedStacks. `SecretRef` nodes already carry only `fingerprint` + `sourceLocation` — structurally safe even before redaction |
| **Existing consumers** | `buildSupportBundle()` reads `assessment?.enrichedStacks` for auto-propagation; no other production consumer |
| **Current tests** | 4 tests: populated, doesn't alter serviceStacks, empty when no software, read-only boundary |
| **Missing tests** | Double-redaction integrity (redactAssessment doesn't corrupt ServiceStack structure), pre-Phase-4 snapshot compat |
| **Compatibility risk** | **Low** — Optional field, existing consumers ignore it. The `redactAssessment()` pass is idempotent |
| **Recommended hardening** | Add test verifying enrichedStacks structure survives `redactAssessment()` intact |

### 3.5 S5/S6: `SupportBundle.inventoryGraph?` / `SupportBundle.enrichedStacks?`

| Detail | Value |
|---|---|
| **Source file** | `apps/api/src/support-bundle.ts:65-67, 146-147` |
| **Current type** | `InventoryGraph \| undefined`, `ServiceStack[] \| undefined` |
| **Auto-propagation** | `enrichedStacks: input.enrichedStacks ?? assessment?.enrichedStacks` — auto-populates from assessment when not explicitly provided |
| **Route wiring** | `routes.ts:4671-4682` — passes `assessment` (which has `enrichedStacks`) to `buildSupportBundle()`; does NOT pass `inventoryGraph` explicitly, so `inventoryGraph` is always undefined in the support bundle response |
| **Current tests** | 2 tests: enrichedStacks propagated from input, omitted when not provided |
| **Missing tests** | Auto-propagation from assessment (assessment WITH enrichedStacks, input WITHOUT override), markdown output doesn't contain enrichedStacksRaw data leaks |
| **Compatibility risk** | **Medium** — The auto-propagation path (`assessment?.enrichedStacks`) is NOT tested. If `assessment.enrichedStacks` is populated but `input.enrichedStacks` is undefined, the bundle SHOULD get them; this path is untested |
| **Recommended hardening** | Add auto-propagation test; verify markdown output doesn't leak enriched data; verify `inventoryGraph` stays undefined when route doesn't pass it |

---

## 4. Consumer Compatibility Map

### 4.1 Actual Current Consumers

| Consumer | File | What It Consumes | How | Status |
|---|---|---|---|---|
| Inventory-graph route | `routes.ts:4580-4588` | `extractInventoryGraph()` | Direct call | ✅ Tested |
| Service-stacks route | `routes.ts:4590-4599` | `extractInventoryGraph()` + `aggregateServiceStacks()` | Direct call | ✅ Tested |
| Connection-graph route | `routes.ts:4601-4610` | `extractInventoryGraph()` | Direct call | ✅ Tested |
| Assessment builder | `migration-assessment.ts:177-178` | `extractInventoryGraph()` + `aggregateServiceStacks()` | Builds `enrichedStacks` | ✅ Tested |
| Support bundle builder | `support-bundle.ts:146-147` | `input.inventoryGraph`, `input.enrichedStacks ?? assessment?.enrichedStacks` | Pass-through + auto-propagation | ⚠️ Partial |
| Support bundle route | `routes.ts:4671-4682` | Passes `assessment` to `buildSupportBundle()` | Indirect | ⚠️ Not tested for auto-propagation |

### 4.2 Tests-Only Consumers

| Consumer | File | What It References | Notes |
|---|---|---|---|
| Golden scenario harness | `golden-scenario-harness.ts:154` | `run.assertions.push("service-stacks")` | Only marks an assertion string — does NOT read new surfaces |
| Golden scenario tests | `golden-scenarios.test.ts:23` | `run.assertions.includes("service-stacks")` | Same |
| Inventory graph tests | `inventory-graph.test.ts` | `extractInventoryGraph()` | Phase 1/4 engine tests |
| Inventory graph Phase 4 tests | `inventory-graph-phase4.test.ts` | All exports from `inventory-graph.ts` | Phase 4-B data surface tests |
| Service stack Phase 5 tests | `service-stack-phase5.test.ts` | `extractInventoryGraph()`, `aggregateServiceStacks()` | Phase 5-B enrichment tests |

### 4.3 Possible Future Consumers (NOT current)

| Area | Notes |
|---|---|
| Frontend (`apps/web`) | **Zero references** to `enrichedStacks`, `InventoryGraph`, `ServiceStack`, `inventory-graph` route, or `service-stacks` route. The `AssessmentServiceStack` type in `web/src/api.ts:2952-2967` is a separate frontend-copy of the assessment stack type — NOT the inventory-graph `ServiceStack` |
| `AssessmentExperience.tsx` | References `serviceStacks` (the `AssessmentServiceStack[]` field, NOT `enrichedStacks`) |
| `MigratePipelinePage.tsx` | References `serviceStacks` via same assessment field |
| Playwright tests | Reference `relatedServiceStackIds` (assessment type), not enriched stacks |
| Docs | `docs/product/service-stack-model.md:29` has an `interface ServiceStack` example — but it's a conceptual doc, not an API contract reference |
| Catalog / Decision Engine | Zero references to `inventory-graph.ts` |

### 4.4 No Consumer Found

| Surface | Status |
|---|---|
| `SupportBundle.inventoryGraph` | **Zero production consumers** — the support bundle route never sets it; only the type field exists |
| `SupportBundle.enrichedStacks` | **One consumer** (`buildSupportBundle()` auto-propagation), but untested for the auto-propagation path |

---

## 5. Stability Gap Analysis

### 5.1 Contract Stability Gaps

| # | Gap | Severity | Evidence |
|---|---|---|---|
| G1 | **No response shape contract tests** — Changing a field name or removing a node kind would not be caught by any test | **Medium** | The route tests verify status codes + a few assertions (e.g., "graph has nodes array"), but don't validate the full response shape or key set. A regression that accidentally drops `hostname` from `InventoryGraph` would NOT be caught |
| G2 | **No cross-user isolation test for connection route** — S3 filters by `c.userId === user.id` but this is untested | **High** | `routes.ts:4606`: `db.connections.find((c) => c.id === id && c.userId === user.id)` — if this filter is accidentally removed, cross-user data leak occurs |
| G3 | **Support bundle auto-propagation untested** — `assessment.enrichedStacks` → bundle path is not verified | **Medium** | `support-bundle.ts:147`: `enrichedStacks: input.enrichedStacks ?? assessment?.enrichedStacks` — the `??` fallback path is never exercised in tests |
| G4 | **No version negotiation mechanism** — `enrichment.version: "phase5.stack.v1"` is hardcoded. Future phases may add fields; consumers have no way to request a specific version | **Low** | Hardcoded string at `inventory-graph.ts:1413`. Future-proof but not yet needed |
| G5 | **No API documentation for new routes** — No doc describes the 3 new routes, their response shapes, or which fields are optional | **Medium** | Zero references in `docs/` to the new routes, `InventoryGraph`, or `enrichedStacks` |

### 5.2 Empty-State and Edge-Case Gaps

| # | Gap | Severity | Evidence |
|---|---|---|---|
| G6 | **No route-level empty-graph test** — When a probed connection has zero software, S1/S3 should return 200 with `{ graph: { nodes: [], rels: [] } }` | **Low** | Phase 4 tests verify `extractInventoryGraph()` handles empty snapshots, but route-level tests don't |
| G7 | **No route-level empty-stacks test** — When graph has no service nodes, S2 should return 200 with `{ stacks: [] }` | **Low** | Same — engine-level tested, route-level not |
| G8 | **No pre-Phase-3 snapshot test at route level** — Old snapshots predating data surfaces should produce valid (but less rich) graphs | **Low** | Engine-level tested in Phase 4 tests |

### 5.3 Secret Safety and Data Integrity Gaps

| # | Gap | Severity | Evidence |
|---|---|---|---|
| G9 | **Secret safety only verified by regex** — `inventory-graph-routes.test.ts` test 6 uses `/password\|secret\|private[-_]?key/i` regex. This catches obvious leaks but wouldn't catch, e.g., a `fingerprint` field that accidentally contains a credential substring | **Low** | `SecretRef.fingerprint` is a DJB2 hash — structurally safe. Regex test is supplementary |
| G10 | **No structural secret safety test** — No test verifies that `SecretRef` nodes ALWAYS have `redacted: true`, `fingerprint` (never raw value), and `keyCount` (never key names) | **Low** | Engine-level tests (Phase 4) cover this. Route-level test is redundant but would provide defense-in-depth |
| G11 | **Double redaction integrity untested** — `redactAssessment()` runs over `enrichedStacks` but there's no test that it doesn't corrupt ServiceStack structure (e.g., transforming `port: 5432` into `"REDACTED"`) | **Low** | `redactAssessment()` only redacts strings matching secret patterns. Numeric fields (port, pid) are safe |

### 5.4 Consistency Gaps

| # | Gap | Severity | Evidence |
|---|---|---|---|
| G12 | **Enrichment field undefined-vs-empty-array consistency** — Code uses `processes.length > 0 ? processes : undefined`. This is correct (undefined, not []), but no test asserts it | **Low** | Code is correct; test would be a regression guard |
| G13 | **Session vs Connection auth model difference** — S1/S2 use `loadMigrationSessionContext()` (loads session+connection+decisions together); S3 uses direct DB `find()` (loads only connection). This is semantically correct but inconsistent in implementation pattern | **Low** | Both are correct; the difference is intentional (session routes need context, connection route doesn't) |
| G14 | **`inventoryGraph` never populated in support bundle** — The support bundle route never passes `inventoryGraph` to `buildSupportBundle()`. The type field exists but is always `undefined` in the actual API response | **Medium** | Either the field should be wired, or this should be documented as "reserved for future use" |

### 5.5 Backward Compatibility

| # | Gap | Severity | Evidence |
|---|---|---|---|
| G15 | **No backward compatibility tests for existing routes** — All 6 surfaces are additive (new routes or optional fields). No existing route response shape was modified. But no test verifies this explicitly | **Low** | The full suite (947/947 pass) implicitly verifies this — if any existing test broke, it would be caught |

### 5.6 Documentation Gaps

| # | Gap | Severity | Evidence |
|---|---|---|---|
| G16 | **No public API contract documentation** — New routes have no description in docs/ | **Medium** | Makes it difficult for future phases to understand what the contract guarantees |
| G17 | **No response shape examples** — No example JSON output in docs or tests | **Low** | Test fixtures serve as implicit examples |

---

## 6. Recommended Phase 7-B Minimal Scope

### Priority: MUST-HAVE (3 items)

#### H1: Cross-user isolation test for connection inventory-graph route

| Detail | Value |
|---|---|
| **Target file** | `apps/api/src/engine/tests/inventory-graph-routes.test.ts` |
| **Target test** | New test: "Connection inventory-graph returns 404 when requesting another user's connection" |
| **Exact behavior** | Create two users (A with connection `conn-a`, B). User B's token → `GET /api/connections/conn-a/inventory-graph` → 404 |
| **Why needed** | G2 — The userId filter on S3 is the only access control; if accidentally removed, cross-user data leakage occurs. This is the highest-severity untested code path in Phase 6 |
| **Required tests** | 1 new test |
| **Compatibility risk** | **Zero** — new test only |
| **Priority** | **MUST-HAVE** |

#### H2: Support bundle auto-propagation verification

| Detail | Value |
|---|---|
| **Target file** | `apps/api/src/engine/tests/support-bundle.test.ts` |
| **Target test** | New test: "Support bundle auto-propagates enrichedStacks from assessment when input doesn't override" |
| **Exact behavior** | Create assessment fixture WITH `enrichedStacks: [mockStack]`, call `buildSupportBundle({ assessment })` WITHOUT passing `enrichedStacks` input, verify `bundle.enrichedStacks` equals the mock stack |
| **Why needed** | G3 — The `??` fallback path is untested. If `assessment.enrichedStacks` is not populated or the fallback is removed, bundles lose enriched data silently |
| **Required tests** | 1 new test |
| **Compatibility risk** | **Zero** — new test only |
| **Priority** | **MUST-HAVE** |

#### H3: Response shape regression guard for all 3 new routes

| Detail | Value |
|---|---|
| **Target file** | `apps/api/src/engine/tests/inventory-graph-routes.test.ts` |
| **Target tests** | 3 new tests: (a) "Session inventory-graph response has expected shape", (b) "Session service-stacks response has expected shape", (c) "Connection inventory-graph response has expected shape" |
| **Exact behavior** | For each route: verify 200, then assert top-level keys (`graph` or `stacks`), then verify at least the key structural fields (e.g., `graph.hostname`, `graph.nodes`, `graph.rels`, `graph.capturedAt`, `graph.completeness`; `stacks[0].id`, `stacks[0].service`, `stacks[0].enrichment.version`) |
| **Why needed** | G1 — If `InventoryGraph` fields are accidentally renamed, no existing test catches it at the route level (engine tests are separate) |
| **Required tests** | 3 new tests |
| **Compatibility risk** | **Zero** — new tests only |
| **Priority** | **MUST-HAVE** |

### Priority: RECOMMENDED (4 items)

#### H4: Route-level empty-state tests

| Detail | Value |
|---|---|
| **Target file** | `apps/api/src/engine/tests/inventory-graph-routes.test.ts` |
| **Target tests** | 2 new tests: (a) inventory-graph returns 200 with empty graph when snapshot has no software, (b) service-stacks returns 200 with empty array when no services |
| **Exact behavior** | Create fixture with empty `software: []` and empty `configChecklist: []`; verify 200 + empty nodes/rels or empty stacks |
| **Why needed** | G6, G7 — Route-level verification that empty snapshots don't crash or return errors |
| **Required tests** | 2 new tests |
| **Compatibility risk** | **Zero** |
| **Priority** | RECOMMENDED |

#### H5: API contract documentation

| Detail | Value |
|---|---|
| **Target file** | `docs/operations.md` (append section) or new `docs/api-contracts.md` |
| **Exact behavior** | Document the 3 new routes: method, path, auth, response shape, error codes, which fields are optional, which fields are always present |
| **Why needed** | G5, G16 — No doc describes the new routes. Future phases need contract reference |
| **Required tests** | None (doc only) |
| **Compatibility risk** | **Zero** |
| **Priority** | RECOMMENDED |

#### H6: Support bundle `inventoryGraph` wiring documentation

| Detail | Value |
|---|---|
| **Target file** | `apps/api/src/support-bundle.ts` (comment) or `docs/operations.md` |
| **Exact behavior** | Either wire `inventoryGraph` into the support bundle route, OR document that the field is reserved for future use and currently always `undefined` in API responses |
| **Why needed** | G14 — The type field exists but is never populated. This is a dead field that could mislead consumers |
| **Recommended action** | Document as "reserved for future use" rather than wiring (wiring would require re-extracting the graph in the route handler, which is unnecessary work) |
| **Required tests** | None (doc only) |
| **Compatibility risk** | **Zero** |
| **Priority** | RECOMMENDED |

#### H7: Enrichment field completeness regression guard

| Detail | Value |
|---|---|
| **Target file** | `apps/api/src/engine/tests/inventory-graph-routes.test.ts` |
| **Target test** | Verify that when a stack has enrichment, all 10 optional fields are either `undefined` or arrays (never some other type), and `enrichment.version` is always `"phase5.stack.v1"` |
| **Exact behavior** | After S2 200 response, iterate stacks; for each stack with enrichment, assert all 10 field names exist as keys and each is `undefined \|\| Array` |
| **Why needed** | G12 — Guards against accidental type change (e.g., `processes: []` instead of `undefined` when empty) |
| **Required tests** | 1 new test |
| **Compatibility risk** | **Zero** |
| **Priority** | RECOMMENDED |

### Priority: OPTIONAL (3 items)

#### H8: Secret safety structural test at route level

| Detail | Value |
|---|---|
| **Target file** | `apps/api/src/engine/tests/inventory-graph-routes.test.ts` |
| **Exact behavior** | For S2 response, verify all `secretRefs` entries have `redacted: true`, `fingerprint` (string), `sourceLocation` (string), and no raw value fields |
| **Why needed** | G10 — Defense-in-depth; engine tests cover this but route-level test would catch serialization issues |
| **Priority** | OPTIONAL |

#### H9: Pre-Phase-3 snapshot backward compatibility at route level

| Detail | Value |
|---|---|
| **Target file** | `apps/api/src/engine/tests/inventory-graph-routes.test.ts` |
| **Exact behavior** | Create a snapshot fixture with only `system` + `software` fields (no `processes`, `dataPaths`, etc.); verify S1/S2 return 200 with valid (but less rich) graph/stacks |
| **Why needed** | G8 — Route-level verification that old snapshots don't break new routes |
| **Priority** | OPTIONAL |

#### H10: Double redaction integrity test

| Detail | Value |
|---|---|
| **Target file** | `apps/api/src/engine/tests/assessment-summary.test.ts` |
| **Exact behavior** | Create assessment with enrichedStacks that include port numbers, PIDs, etc.; run through `buildAssessmentSummary()` (which calls `redactAssessment()`); verify numeric fields (port, pid) are NOT redacted |
| **Why needed** | G11 — Verify redaction doesn't over-redact numeric fields |
| **Priority** | OPTIONAL |

---

## 7. Explicit Non-Goals

| Non-goal | Reason |
|---|---|
| New production routes | Phase 7 is hardening, not expansion |
| New graph algorithms | `extractInventoryGraph()` contract is frozen |
| New service-stack enrichment fields | `aggregateServiceStacks()` contract is frozen |
| New migration classifier behavior | Out of scope |
| UI visualization | No frontend changes |
| Data Migration | Out of scope per charter |
| Secret Transport | Out of scope per charter |
| Conflict Resolver | Out of scope per charter |
| Breaking response changes | All existing response shapes preserved |
| Renaming public fields | Backward compatibility required |
| Replacing `AssessmentServiceStack` with `ServiceStack` | Different semantics, breaking change |
| Broad refactor | Not needed for hardening |
| Performance optimization | Not required for contract safety at this scale |
| Response versioning / content negotiation | Premature — no consumer demand yet |
| JSON Schema / OpenAPI generation | Premature — can be added in a later phase |

---

## 8. Test and Evidence Plan

### 8.1 Phase 7-B Must-Add Tests

| # | Test | File | Priority |
|---|---|---|---|
| T1 | Connection inventory-graph: cross-user isolation → 404 | inventory-graph-routes.test.ts | MUST |
| T2 | Support bundle: auto-propagation from assessment.enrichedStacks | support-bundle.test.ts | MUST |
| T3 | Session inventory-graph: response shape contract | inventory-graph-routes.test.ts | MUST |
| T4 | Session service-stacks: response shape contract | inventory-graph-routes.test.ts | MUST |
| T5 | Connection inventory-graph: response shape contract | inventory-graph-routes.test.ts | MUST |
| T6 | Session inventory-graph: empty snapshot → 200 with empty graph | inventory-graph-routes.test.ts | RECOMMENDED |
| T7 | Session service-stacks: no services → 200 with empty stacks | inventory-graph-routes.test.ts | RECOMMENDED |
| T8 | Service-stacks: enrichment field keys + types + version | inventory-graph-routes.test.ts | RECOMMENDED |

**Total must-add**: 5 tests (H1 + H2 + H3)
**Total recommended**: 3 additional tests (H4 + H7)
**Total Phase 7-B new tests**: 5–8

### 8.2 Phase 7-C Evidence Closure (separate phase)

| # | Evidence | What It Proves |
|---|---|---|
| E1 | Full API suite rerun (expect ≥952 pass) | No regressions |
| E2 | TypeScript `npx tsc --noEmit` clean | No type errors |
| E3 | `npm run build` clean | Production build passes |
| E4 | All new tests pass individually | Each hardening target works |
| E5 | Cross-user isolation verified | Access control intact |
| E6 | Response shape contract verified | No field regression |
| E7 | Updated audit report | Phase 7 evidence recorded |

### 8.3 Commands to Run

```bash
# Type check
cd E:/1project/EnvForge/apps/api && npx tsc --noEmit -p tsconfig.json

# Build
cd E:/1project/EnvForge/apps/api && npm run build

# Full test suite
cd E:/1project/EnvForge/apps/api && npm test

# Targeted new tests
cd E:/1project/EnvForge/apps/api && npm test -- --test-name-pattern="inventory-graph-routes"
cd E:/1project/EnvForge/apps/api && npm test -- --test-name-pattern="support-bundle"
```

---

## 9. Risk and Compatibility Notes

### 9.1 Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cross-user data leak via S3 | Low (filter exists but untested) | High | **H1** — Add isolation test |
| Support bundle silently drops enrichedStacks | Low (code is correct but untested) | Medium | **H2** — Add auto-propagation test |
| Response shape drift (field rename/remove) | Low (no active changes planned) | Medium | **H3** — Add shape contract tests |
| `inventoryGraph` field confusion (always undefined) | Medium (consumers may expect data) | Low | **H6** — Document as reserved |
| Enrichment field type change (undefined ↔ []) | Low (code is explicit) | Low | **H7** — Add type assertion test |

### 9.2 Compatibility Summary

| Aspect | Status |
|---|---|
| Existing route response shapes | **Unchanged** — all Phase 6 changes are additive |
| Existing type exports | **Unchanged** — Phase 6 only added optional fields |
| Engine-level contracts (`extractInventoryGraph`, `aggregateServiceStacks`) | **Unchanged** — Phase 6 only wired them, didn't modify them |
| Test fixtures | **All Phase 6 tests use their own fixtures** — zero fixture churn |
| Frontend compatibility | **Zero impact** — frontend doesn't reference any new surface |

### 9.3 No-Break Guarantees

1. **Zero existing field renames or removals** — All Phase 6 additions use new field names or new routes
2. **Zero existing route behavior changes** — New routes are greenfield; existing routes are untouched
3. **Zero test fixture modification** — All new tests create their own isolated fixtures via `fs.mkdtemp`
4. **Zero engine semantic changes** — `extractInventoryGraph()` and `aggregateServiceStacks()` are called as-is

---

## 10. Files Expected to Change in Phase 7-B

| File | Change type | Why |
|---|---|---|
| `apps/api/src/engine/tests/inventory-graph-routes.test.ts` | **Add** 5–7 new tests | H1, H3, H4, H7 |
| `apps/api/src/engine/tests/support-bundle.test.ts` | **Add** 1 new test | H2 |
| `docs/operations.md` (or new `docs/api-contracts.md`) | **Add** API contract section | H5, H6 |
| `docs/phase7-b-hardening-implementation-2026-07-09.md` | **NEW** — implementation report | Phase 7-B evidence |

## 11. Files Expected NOT to Change

| File | Reason |
|---|---|
| `apps/api/src/routes.ts` | No route changes needed for hardening |
| `apps/api/src/inventory-graph.ts` | Engine contract frozen |
| `apps/api/src/migration-assessment.ts` | No changes needed |
| `apps/api/src/support-bundle.ts` | No changes needed (doc-only for H6) |
| `apps/api/src/migration-classifier.ts` | Out of scope |
| `apps/api/src/engine/tests/inventory-graph.test.ts` | Phase 1 tests unchanged |
| `apps/api/src/engine/tests/inventory-graph-phase4.test.ts` | Phase 4 tests unchanged |
| `apps/api/src/engine/tests/service-stack-phase5.test.ts` | Phase 5 tests unchanged |
| `apps/api/src/engine/tests/assessment-summary.test.ts` | Already has 4 Phase 6 tests; no new gaps |
| `apps/web/**/*` | No frontend changes |

---

## 12. Phase 7-B Implementation Prompt

---

**PROMPT START** — copy everything below to execute Phase 7-B

---

# Phase 7-B: Production Consumer Hardening — Implementation

## Target

Harden Phase 6 production surfaces with contract tests, cross-user isolation verification, support bundle auto-propagation verification, and API documentation. Zero production code changes — tests and docs only.

## Non-Goals

- NO new production routes
- NO changes to `routes.ts`, `migration-assessment.ts`, `support-bundle.ts`
- NO changes to `inventory-graph.ts` (extractor/aggregator)
- NO changes to `migration-classifier.ts`
- NO frontend/UI changes
- NO Data Migration / Secret Transport / Conflict Resolver
- NO breaking response changes
- NO field renaming
- NO broad refactor

## Step 1: Read these files first (do not modify)

1. `apps/api/src/engine/tests/inventory-graph-routes.test.ts` — understand fixture patterns (Fastify + fs.mkdtemp + fixture DB)
2. `apps/api/src/engine/tests/support-bundle.test.ts` — understand the `assessment()` fixture and `buildSupportBundle()` call patterns
3. `apps/api/src/routes.ts:4601-4610` — confirm S3 cross-user filter: `db.connections.find((c) => c.id === id && c.userId === user.id)`
4. `apps/api/src/support-bundle.ts:108-179` — confirm auto-propagation: `enrichedStacks: input.enrichedStacks ?? assessment?.enrichedStacks`
5. `apps/api/src/inventory-graph.ts:218-225` — confirm `InventoryGraph` shape: `hostname, capturedAt, completeness, nodes, rels`
6. `apps/api/src/inventory-graph.ts:960-986` — confirm `ServiceStack` shape: `id, label, service, packages, ports, configFiles, containers, confidence, reasoning, processes?, dataPaths?, envFiles?, secretRefs?, volumes?, networks?, certificates?, domains?, usersGroups?, scheduledTasks?, enrichment?`
7. `docs/operations.md` — find appropriate section for API contract documentation

## Step 2: Add MUST-HAVE tests in inventory-graph-routes.test.ts

### Test H1: Cross-user isolation for connection inventory-graph

Create a second user in the fixture DB with their own connection. Then:
1. Auth as user B → `GET /api/connections/<user-A-connection-id>/inventory-graph`
2. Assert 404 (NOT 200, NOT 401)
3. Verify user B CAN access their own connection's graph → 200

### Test H3a: Session inventory-graph response shape contract

1. `GET /api/migration/sessions/ig-session/inventory-graph` with auth → 200
2. Assert `body.graph` exists
3. Assert `typeof body.graph.hostname === "string"`
4. Assert `typeof body.graph.capturedAt === "string"`
5. Assert `typeof body.graph.completeness === "number"`
6. Assert `Array.isArray(body.graph.nodes)`
7. Assert `Array.isArray(body.graph.rels)`
8. Assert at least one node has `kind` (string), `id` (string), `label` (string), `evidence` (object)

### Test H3b: Session service-stacks response shape contract

1. `GET /api/migration/sessions/ig-session/service-stacks` with auth → 200
2. Assert `Array.isArray(body.stacks)`, `body.stacks.length > 0`
3. For the first stack, assert:
   - `typeof s.id === "string"` and starts with `"stack:"`
   - `typeof s.label === "string"`
   - `s.service` exists and has `kind === "service"`
   - `Array.isArray(s.packages)`
   - `Array.isArray(s.ports)`
   - `s.enrichment.version === "phase5.stack.v1"`
   - `typeof s.enrichment.sourceGraphNodeCount === "number"`
   - `typeof s.enrichment.sourceGraphEdgeCount === "number"`

### Test H3c: Connection inventory-graph response shape contract

Same structure as H3a but via `GET /api/connections/ig-connection/inventory-graph`.

## Step 3: Add MUST-HAVE test in support-bundle.test.ts

### Test H2: Support bundle auto-propagates enrichedStacks from assessment

1. Create an `AssessmentSummary` fixture that INCLUDES `enrichedStacks` (import or construct a minimal `ServiceStack[]`)
2. Call `buildSupportBundle({ sessionId: "test", assessment: assessWithEnriched })`
3. Do NOT pass `enrichedStacks` in the input
4. Assert `bundle.enrichedStacks` is NOT undefined
5. Assert `bundle.enrichedStacks` equals the enriched stacks from the assessment fixture

Note: You may need to create a minimal ServiceStack fixture. At minimum it needs: `{ id: "stack:test", label: "test", service: { id: "service:test", kind: "service", label: "test", unit: "test", status: "running", evidence: {} }, packages: [], ports: [], configFiles: [], containers: [], confidence: "low" as const, reasoning: "test" }`

## Step 4: Add RECOMMENDED tests (if time permits)

### Test H4a: Empty snapshot → 200 with empty graph

Add a new connection+sessions in the fixture with `probeSnapshot` that has `software: []` and `configChecklist: []`. Then:
1. `GET` inventory-graph → 200
2. Assert `body.graph.nodes.length === 0`
3. Assert `body.graph.rels.length === 0`

### Test H4b: No services → 200 with empty stacks

Same empty-snapshot session:
1. `GET` service-stacks → 200
2. Assert `body.stacks.length === 0`

### Test H7: Enrichment field completeness

1. `GET` service-stacks → 200
2. For each stack, verify the enrichment field names are present:
   - `processes`, `dataPaths`, `envFiles`, `secretRefs`, `volumes`, `networks`, `certificates`, `domains`, `usersGroups`, `scheduledTasks`
3. Each is either `undefined` or an `Array`
4. `enrichment.version === "phase5.stack.v1"`

## Step 5: Document API contracts

### Option A: Append to docs/operations.md

Add a section "## Inventory Graph & Service Stack API" with:

```markdown
### Routes

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/api/migration/sessions/:sessionId/inventory-graph` | Bearer | `{ graph: InventoryGraph }` |
| GET | `/api/migration/sessions/:sessionId/service-stacks` | Bearer | `{ stacks: ServiceStack[] }` |
| GET | `/api/connections/:id/inventory-graph` | Bearer | `{ graph: InventoryGraph }` |

### Error Responses

| Code | Condition |
|---|---|
| 401 | Missing or invalid bearer token |
| 404 | Session/connection not found |
| 400 | No snapshot available (probe first) |

### InventoryGraph shape

{ hostname: string, capturedAt: string, completeness: number (0-1), nodes: InventoryNode[], rels: InventoryRel[] }

### ServiceStack shape

Each stack has 9 core fields (always present) + 10 optional enrichment fields (undefined when no data) + enrichment metadata.
```

### Option B: Create docs/api-contracts.md

Same content, cleaner separation. Either is acceptable.

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
cd E:/1project/EnvForge/apps/api && npm test -- --test-name-pattern="support-bundle"
```

## Step 7: Evidence to report

After implementation, report:
1. Total test count (expect ≥952)
2. Pass/fail status
3. `npx tsc --noEmit` status
4. `npm run build` status
5. List of files changed
6. List of new tests added
7. Any anomalies found during hardening

## Step 8: Commit expectation

- Commit message: `Harden Phase 6 production surfaces with contract tests and API docs — Phase 7-B`
- Can commit locally
- Do NOT push (push is Phase 7-C)

## Step 9: PASS / BLOCKED closure

- **PASS**: All tests pass, typecheck clean, build succeeds, cross-user isolation verified, support bundle auto-propagation verified, response shape contracts pass, API docs written
- **BLOCKED**: Any test failure, type error, build failure, or if any production code needs modification to pass hardening tests (tests should only reveal existing correct behavior)

---

**PROMPT END**

---

## 13. Phase 7-A Verdict

- **Result**: **PASS**
- **Blockers**: None
- **Stable baseline**: `851c655`, clean repo, synced with origin, 947/947 tests pass
- **Phase 7-B ready**: Yes — prompt above is executable
- **Key findings**:
  - **G2 (HIGH)**: Cross-user isolation on S3 connection route is untested — **must fix in Phase 7-B**
  - **G3 (MEDIUM)**: Support bundle auto-propagation path is untested
  - **G1 (MEDIUM)**: No response shape contract tests — field regressions could go undetected
  - **G14 (MEDIUM)**: `SupportBundle.inventoryGraph` is a dead field (never populated in route)
  - **G5 (MEDIUM)**: No API documentation for new routes
  - All gaps are test/documentation gaps — **zero production code bugs found**

---

*Report generated 2026-07-09. Phase 7-A planning complete.*
