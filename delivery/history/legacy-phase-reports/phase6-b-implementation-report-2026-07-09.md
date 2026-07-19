---
title: 'Phase 6-B: Production Integration / Route Exposure / Assessment Wiring — Implementation
  Report'
status: archived
classification: historical-evidence
not_source_of_truth: true
original_path: phase6-b-implementation-report-2026-07-09.md
archived_at: '2026-07-19'
source_sha256: db12d6613f947eb81e5d29b6346fd5b2ba434ad57978b3d4044629b082646192
---

> 历史证据：保留原始内容、日期和当时结论。不得作为当前设计或当前代码事实源；使用前必须在当前 HEAD 重新验证。

# Phase 6-B: Production Integration / Route Exposure / Assessment Wiring — Implementation Report

- **Date**: 2026-07-09
- **Phase**: 6-B (implementation)
- **Stable baseline**: `5760e41` — Enrich service stack aggregation with Phase 4 graph surfaces — Phase 5-B
- **Result**: **PASS**

---

## 1. Baseline

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD before | `5760e41ca9dee24a6b701bc06d1e470185059fed` |
| Commit message before | `Enrich service stack aggregation with Phase 4 graph surfaces — Phase 5-B` |
| `origin/main` sync | Synced — `0 ahead, 0 behind` |
| Full API suite before | 931/931 pass |

## 2. Files Changed

| File | Change type | Lines |
|---|---|---|
| `apps/api/src/routes.ts` | **Add** 3 new routes + import | +38 |
| `apps/api/src/migration-assessment.ts` | **Add** import + `enrichedStacks` field + extraction call | +13 |
| `apps/api/src/support-bundle.ts` | **Add** import + 2 optional fields + wiring | +12 |
| `apps/api/src/engine/tests/inventory-graph-routes.test.ts` | **NEW** — 10 route-level tests | +246 |
| `apps/api/src/engine/tests/assessment-summary.test.ts` | **Add** 4 enriched stack tests | +62 |
| `apps/api/src/engine/tests/support-bundle.test.ts` | **Add** 2 bundle wiring tests | +28 |

**Total**: 6 files changed, ~399 lines added, 0 lines removed.

## 3. Routes Added

| Route | Method | Auth | Response |
|---|---|---|---|
| `/api/migration/sessions/:sessionId/inventory-graph` | GET | Bearer token | `{ graph: InventoryGraph }` |
| `/api/migration/sessions/:sessionId/service-stacks` | GET | Bearer token | `{ stacks: ServiceStack[] }` |
| `/api/connections/:id/inventory-graph` | GET | Bearer token | `{ graph: InventoryGraph }` |

Error handling:
- 401 — no/invalid token
- 404 — session/connection not found
- 400 — no snapshot available

## 4. Assessment Wiring

- **`AssessmentSummary.enrichedStacks?: ServiceStack[]`** — optional field added
- Computed in `buildAssessmentSummary()` via `extractInventoryGraph()` → `aggregateServiceStacks()`
- Does NOT replace or alter existing `serviceStacks: AssessmentServiceStack[]`
- Gracefully produces empty `enrichedStacks` when snapshot has no software

## 5. Support Bundle Wiring

- **`SupportBundle.inventoryGraph?: InventoryGraph`** — optional field
- **`SupportBundle.enrichedStacks?: ServiceStack[]`** — optional field
- **`BuildSupportBundleInput.inventoryGraph?`** / **`enrichedStacks?`** — pass-through inputs
- Propagates from assessment's `enrichedStacks` when available
- Falls back to `undefined` when not available (no assessment, old snapshots)

## 6. Tests Added / Updated

### New: `inventory-graph-routes.test.ts` (10 tests)

1. ✅ `GET /sessions/:id/inventory-graph` → 200 with valid session
2. ✅ `GET /sessions/:id/inventory-graph` → 404 for unknown session
3. ✅ `GET /sessions/:id/inventory-graph` → 400 without snapshot
4. ✅ `GET /sessions/:id/service-stacks` → 200 with enriched stacks
5. ✅ `GET /sessions/:id/service-stacks` → enrichment version is `phase5.stack.v1`
6. ✅ `GET /sessions/:id/service-stacks` → no raw secret values in JSON
7. ✅ `GET /connections/:id/inventory-graph` → 200 with probed connection
8. ✅ `GET /connections/:id/inventory-graph` → 400 without probeSnapshot
9. ✅ `GET /connections/:id/inventory-graph` → 404 unknown connection
10. ✅ All three routes return 401 without auth

### Updated: `assessment-summary.test.ts` (+4 tests)

11. ✅ `enrichedStacks` is populated from InventoryGraph
12. ✅ `enrichedStacks` does not alter existing `serviceStacks`
13. ✅ Empty `enrichedStacks` when no software
14. ✅ Read-only boundary not violated by InventoryGraph extraction

### Updated: `support-bundle.test.ts` (+2 tests)

15. ✅ `enrichedStacks` propagated from input to bundle
16. ✅ `inventoryGraph` undefined when not provided and no enrichedStacks on assessment

## 7. Commands Run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **CLEAN** — 0 errors |
| `npm run build` | **PASS** |
| `npm test` (full API suite) | **947/947 pass** (15 suites, 0 failures) |

## 8. Secret Safety Evidence

- `inventory-graph-routes.test.ts` test 6: `JSON.stringify()` of service-stacks response checked for `/password|secret|private[-_]?key/i` — **none found**
- `assessment-summary.test.ts` test 14: redaction still active — no `super-secret-password` in JSON
- `SecretRef` nodes store only `fingerprint` (DJB2 hash), `sourceLocation` (path), `redacted: true`
- `EnvFileRef` nodes store only `keyCount: number`
- No raw credential values in any new response shape

## 9. Explicit Non-Goals Honored

| Non-goal | Status |
|---|---|
| NO Data Migration | ✅ Untouched |
| NO Secret Transport | ✅ Untouched |
| NO Conflict Resolver | ✅ Untouched |
| NO changes to `inventory-graph.ts` core builder | ✅ Untouched |
| NO changes to `migration-classifier.ts` | ✅ Untouched |
| NO changes to existing public field names | ✅ Untouched |
| NO UI/frontend changes | ✅ None made |
| NO breaking API response changes | ✅ All additive |
| NO broad refactor | ✅ None |

## 10. Compatibility Notes

- Existing routes unchanged — all old tests pass unchanged
- `AssessmentSummary` gains optional `enrichedStacks` — clients ignoring unknown fields unaffected
- `SupportBundle` gains optional `inventoryGraph` + `enrichedStacks` — same
- New routes are greenfield — zero backward compatibility risk
- `extractInventoryGraph()` handles pre-Phase-3 snapshots gracefully (fewer node types, still valid graph)

## 11. HEAD After

| Item | Value |
|---|---|
| HEAD after | (to be filled after commit) |
| Commit message | `Expose InventoryGraph and enriched ServiceStack via assessment routes — Phase 6-B` |
| Pushed | No (push is Phase 6-C) |

## 12. Next Step

**Phase 6-C**: Browser/API Evidence Closure — verify new routes return correct data shapes via curl/in-browser inspection, produce visual evidence (screenshots of API responses), and push to origin.

---

*Report generated 2026-07-09. Phase 6-B implementation complete.*
