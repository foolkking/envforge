# Phase 7-B: Production Consumer Hardening — Implementation Report

- **Date**: 2026-07-09
- **Phase**: 7-B (implementation)
- **Stable baseline**: `851c655` — Close Phase 6 production exposure evidence
- **Result**: **PASS**

---

## 1. Baseline

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD before | `851c6556660d28678d24dbf44bd517584cf6ea48` |
| Commit msg before | `Close Phase 6 production exposure evidence` |
| `origin/main` sync | Synced — `0 ahead, 0 behind` |
| Full API suite before | 947/947 pass |
| Phase 7-A report | `docs/phase7-a-production-consumer-hardening-planning-2026-07-09.md` — present |

**Verdict**: Repository clean, synced, and fully tested. No blockers.

---

## 2. Files Changed

| File | Change type | Lines |
|---|---|---|
| `apps/api/src/engine/tests/inventory-graph-routes.test.ts` | **Add** 8 hardening tests + fixture expansion | +224 |
| `apps/api/src/engine/tests/support-bundle.test.ts` | **Add** 2 auto-propagation tests | +58 |
| `docs/operations.md` | **Add** Inventory Graph & Service Stack API section | +78 |

**Total**: 3 files changed, ~360 lines added, 0 lines removed. **Zero production code changes.**

---

## 3. Hardening Items Completed

### MUST-HAVE (3/3)

#### H1: Cross-user isolation test ✅

| Detail | Value |
|---|---|
| Test name | `H1: Connection inventory-graph returns 404 for another user's connection` |
| File | `inventory-graph-routes.test.ts` |
| Verifies | User B → `/api/connections/<user-A-conn>/inventory-graph` → 404 |
| Also verifies | User B CAN access own connection → 200; User A still CAN access own → 200 |
| Result | **PASS** — cross-user isolation confirmed |

#### H2: Support bundle auto-propagation ✅

| Detail | Value |
|---|---|
| Test names | `H2` (auto-propagation) + `H2b` (explicit override) |
| File | `support-bundle.test.ts` |
| Verifies | When `assessment.enrichedStacks` is set but `input.enrichedStacks` is not passed, bundle gets auto-propagation from assessment |
| Also verifies | Explicit `input.enrichedStacks` overrides assessment |
| Result | **PASS** — both paths verified |

#### H3: Response shape contract tests ✅

| Detail | Value |
|---|---|
| Test names | `H3a`, `H3b`, `H3c` |
| File | `inventory-graph-routes.test.ts` |
| H3a | Session inventory-graph shape: `graph.hostname`, `capturedAt`, `completeness`, `nodes[]`, `rels[]`, node structure (`id`, `kind`, `label`, `evidence`) |
| H3b | Session service-stacks shape: core fields (`id`, `label`, `service.kind`, `packages[]`, `ports[]`, `confidence`, `reasoning`), enrichment (`version`, `sourceGraphNodeCount`, `sourceGraphEdgeCount`) |
| H3c | Connection inventory-graph shape: identical contract to H3a |
| Result | **PASS** — all three shape contracts verified |

### RECOMMENDED (2/2 — H5 + H6 documentation; H4 + H7 tests)

#### H4: Empty-state route tests ✅

| Detail | Value |
|---|---|
| Test names | `H4a`, `H4b` |
| H4a | Empty snapshot → 200 with `graph.nodes.length === 0`, `graph.rels.length === 0` |
| H4b | Empty snapshot → 200 with `stacks.length === 0` |
| Result | **PASS** |

#### H5: API contract documentation ✅

| Detail | Value |
|---|---|
| File | `docs/operations.md` |
| Section | `## Inventory Graph & Service Stack API` |
| Covers | 3 routes, error codes, `InventoryGraph` shape, `ServiceStack` shape (9 core + 10 optional + enrichment), secret safety guarantee, assessment/support-bundle enrichment, backward compatibility, empty-state behavior |
| Result | **Complete** |

#### H6: `SupportBundle.inventoryGraph` dead-field documentation ✅

| Detail | Value |
|---|---|
| Location | `docs/operations.md` — under "Assessment & Support Bundle Enrichment" |
| Language | `SupportBundle.inventoryGraph?: InventoryGraph` — reserved for future use; currently always `undefined` in API responses |
| Decision | **Document as reserved** — no wiring (wiring would require re-extracting graph in the support-bundle route handler, which is unnecessary work) |
| Result | **Complete** |

#### H7: Enrichment field type guard ✅

| Detail | Value |
|---|---|
| Test name | `H7: Enrichment fields are undefined or Array, never unexpected types` |
| Verifies | All 10 enrichment field names on each stack; each is `undefined` or `Array` (never `null`, string, number); `enrichment.version === "phase5.stack.v1"` |
| Result | **PASS** |

### OPTIONAL (1/1 — H8)

#### H8: Secret safety structural test at route level ✅

| Detail | Value |
|---|---|
| Test name | `H8: SecretRef fields are structurally safe — fingerprint only, no raw values` |
| Verifies | Every `secretRef` has `redacted: true`, `fingerprint` (non-empty hex string), `sourceLocation` (string), `kind` (string); no `value`, `plaintext`, or `raw` fields |
| Result | **PASS** |

---

## 4. Tests Added / Updated

### New Tests (10)

| # | Test | File | Priority |
|---|---|---|---|
| 1 | H1: Cross-user isolation → 404 | inventory-graph-routes.test.ts | MUST |
| 2 | H3a: Session inventory-graph shape contract | inventory-graph-routes.test.ts | MUST |
| 3 | H3b: Session service-stacks shape contract | inventory-graph-routes.test.ts | MUST |
| 4 | H3c: Connection inventory-graph shape contract | inventory-graph-routes.test.ts | MUST |
| 5 | H2: Support bundle auto-propagation | support-bundle.test.ts | MUST |
| 6 | H2b: Support bundle explicit override | support-bundle.test.ts | MUST |
| 7 | H4a: Empty snapshot → 200 empty graph | inventory-graph-routes.test.ts | RECOMMENDED |
| 8 | H4b: No services → 200 empty stacks | inventory-graph-routes.test.ts | RECOMMENDED |
| 9 | H7: Enrichment field type guard | inventory-graph-routes.test.ts | RECOMMENDED |
| 10 | H8: Secret safety structural test | inventory-graph-routes.test.ts | OPTIONAL |

### Existing Tests (unchanged)

- `inventory-graph-routes.test.ts`: 10 original Phase 6-B tests — unchanged, all pass
- `support-bundle.test.ts`: 5 original tests (2 Phase 6-B + 3 pre-existing) — unchanged, all pass
- `assessment-summary.test.ts`: 8 tests (4 original + 4 Phase 6-B) — unchanged, all pass

---

## 5. Commands Run

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **CLEAN** — 0 errors |
| `npm run build` | **PASS** |
| `node --test dist/engine/tests/inventory-graph-routes.test.js` | **18/18 pass** (10 original + 8 new) |
| `node --test dist/engine/tests/support-bundle.test.js` | **7/7 pass** (5 original + 2 new) |
| `npm test` (full API suite) | **957/957 pass** (15 suites, 0 failures) |

---

## 6. Secret Safety Regression

| Check | Method | Result |
|---|---|---|
| Existing regex-based secret safety test | `inventory-graph-routes.test.ts` test 6 | ✅ PASS (unchanged) |
| H8 structural SecretRef test | `inventory-graph-routes.test.ts` H8 | ✅ PASS |
| Support bundle redaction | `support-bundle.test.ts` test 1 | ✅ PASS (unchanged) |
| Assessment redaction | `assessment-summary.test.ts` test 4 | ✅ PASS (unchanged) |
| No password/token/key in new test JSON | All new tests use same fixture data | ✅ No new secret data |

---

## 7. Explicit Non-Goals Honored

| Non-goal | Status |
|---|---|
| No new production routes | ✅ None added |
| No changes to `routes.ts` | ✅ Untouched |
| No changes to `migration-assessment.ts` | ✅ Untouched |
| No changes to `support-bundle.ts` | ✅ Untouched |
| No changes to `inventory-graph.ts` | ✅ Untouched |
| No changes to `migration-classifier.ts` | ✅ Untouched |
| No frontend/UI changes | ✅ None |
| No Data Migration | ✅ Untouched |
| No Secret Transport | ✅ Untouched |
| No Conflict Resolver | ✅ Untouched |
| No breaking response changes | ✅ None |
| No field renaming | ✅ None |
| No broad refactor | ✅ None |
| No new architecture | ✅ None |

---

## 8. Risk and Compatibility Notes

- **Cross-user isolation**: Confirmed via H1. The `c.userId === user.id` filter in `routes.ts:4606` is the single access-control point — any future refactor of that route must preserve it.
- **Support bundle auto-propagation**: Confirmed via H2. The `??` fallback in `support-bundle.ts:147` works correctly. If `assessment.enrichedStacks` is set, bundles get it without explicit wiring.
- **`SupportBundle.inventoryGraph` dead field**: Documented as reserved. No test or route populates it. Future phases should either wire it or remove the field.
- **Enrichment field stability**: H7 confirms all 10 optional enrichment fields are `undefined | Array` — no accidental type drift.
- **Empty-state stability**: H4a/b confirm empty snapshots return 200 with valid (but empty) graph/stacks — no crashes.

---

## 9. HEAD After

| Item | Value |
|---|---|
| HEAD after | (to be filled after commit) |
| Commit message | `Harden Phase 6 production surfaces with contract tests and API docs — Phase 7-B` |
| Pushed | No (push is Phase 7-C) |

---

## 10. Next Step

**Phase 7-C**: Contract Stability Evidence Closure — finalize evidence, push to origin, produce closure report.

---

*Report generated 2026-07-09. Phase 7-B implementation complete.*
