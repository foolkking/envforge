# EnvForge Phase 7R-A Final Audit and Convergence Planning

## 1. Result

**PASS**

Phase 7R-A completed baseline verification, evidence inventory, risk planning,
and the minimal Phase 7R-B execution plan. No production code, tests, runtime
behavior, or pre-existing documentation was changed in this phase.

## 2. Baseline

| Check | Result | Evidence |
|---|---|---|
| Branch | PASS | `main` |
| Initial Phase 7R HEAD | PASS | `f4ddca57bffb199f0d7e47bc8d3dddb0b8a7ef1b` |
| `origin/main` | PASS | Same SHA; 0 ahead / 0 behind |
| Phase 6R ancestry | PASS | `4b095cc` is an ancestor |
| Working tree | PASS | Only `docs/audit-report-2026-07-08.md` untracked |
| Reconciliation report | PASS | `docs/phase-plan-reconciliation-2026-07-09.md` exists |
| Phase 7R-0 report | PASS | `docs/phase7r-0-baseline-recovery-2026-07-18.md` exists |
| Nine target commits | PASS | All are ancestors of HEAD |
| Full API baseline | PASS | `1001/1001`, 0 fail, 0 skipped, exit 0 |
| Phase 7R-0 test executed | PASS | `ok 245 - Build-consumed app factory initializes system_kv before routes are ready` |
| `git diff --check` | PASS | No output |

Baseline log: `.tmp_logs/phase7r-a-api-baseline.log`.

### Phase 7R-0 consistency

- Commit message is `Restore deterministic API baseline — Phase 7R-0`.
- Commit changed only `build-ui-regression.test.ts` and its recovery report.
- No production code changed.
- `bootApp()` uses a unique temporary directory, awaits the real
  `initializeDatabase()` before route registration, and cleans its owned SQLite
  connection/directory through `onClose`.
- The recovery used no swallowed SQLite error, weakened assertion, removed
  test, `.skip`, or `.todo`.
- Phase 7R-0 is baseline evidence, not a functional audit slice.

## 3. Reconciliation Context

The reconciliation report reclassifies the historical Phase 5/6/7 extension
work as Phase 4E/4F/4G. The functional audit therefore remains exactly nine
slices. Phase 5R and Phase 6R later implemented the resumed dry-run and runtime
validation goals. Phase 7R is the final audit; Phase 8 is not open.

## 4. Evidence Source Priority

1. Current production code and reachable execution paths
2. Current automated tests, rerun at the audited HEAD
3. Git commits and diffs
4. Current API behavior through Fastify injection
5. Phase reports and reconciliation report
6. The untracked 2026-07-08 audit report

Types, TODOs, fixtures, mocks, or tests alone do not prove production
availability.

## 5. Nine-Slice Audit Inventory

| Slice | Commit(s) / message | Actual files and production change | Tests / reports | Current status | Reachability / docs / false-completion risk |
|---|---|---|---|---|---|
| Phase 1 | `24cb363` — Block direct playbook execution | Production: `executor.ts`, `engine/index.ts`, `engine/managed-execution.ts`; test scan update in `build-ui-regression.test.ts` | `phase1-bypass`, plan/apply and managed execution suites; no standalone phase report found | PASS | Direct helpers fail closed; approved recipe artifact remains reachable only through managed Plan Apply. Audit mutable-input and raw-command bypass again. |
| Phase 2 | `556a5ca` — Modularize probe collectors and completeness tracking | Added `collectors/{runner,types,index,os,packages,systemd,network,docker,...}.ts`; production metadata changes in `ssh.ts`; added `phase1-bypass` | `collector-modules`, `collector-runner`, `snapshot-completeness` | PARTIAL | Completeness is used in production, but `ssh.ts` still calls monolithic `collectors/remote-collector.ts`; modular runner is not the live SSH collector. Highest false-completion risk. |
| Phase 3 | `e2136e4` — Add snapshot data surfaces | Production: `collectors/data-surfaces.ts`, `remote-collector.ts`, `runtime-store.ts`, `ssh.ts` | `collectors/__tests__/data-surfaces.test.ts` | PASS | Surfaces are collected and serialized; B must verify old/empty input and value redaction. |
| Phase 4 | `6d48ff8` — Expand inventory graph extraction | Production `inventory-graph.ts` | `inventory-graph-phase4.test.ts` | PASS | Builder is now called by production routes and assessment; audit declared/generated node/edge parity, determinism, sparse input, redaction. |
| Phase 4E | `5760e41` — Enrich ServiceStack aggregation | Production `inventory-graph.ts` | `service-stack-phase5.test.ts` | PASS | `aggregateServiceStacks()` is used by routes and assessment. Optional fields protect old graphs; audit ordering and leakage. |
| Phase 4F | `3d9d740` — expose graph/stacks; `851c655` — close evidence | Production: `routes.ts`, `migration-assessment.ts`, `support-bundle.ts`; tests and Phase 6 A/B/C reports | `inventory-graph-routes`, assessment, support bundle | PASS | Three authenticated production routes call real builders. Session loader and connection query scope by user. Audit 401/404/400, cross-user, empty state, support wiring. |
| Phase 4G | `7ac6000` — contract hardening; `b3d690c` — close evidence | Tests plus `docs/operations.md`; no production change | Expanded route/support tests and Phase 7 A/B/C reports | PASS | Tests-only hardening is documented as such. `SupportBundle.inventoryGraph?` is reserved and not guaranteed. Stale Phase 8 next-step text remains. |
| Phase 5R | `b058ce7` — PostgreSQL dry-run closed loop | Production: `postgres-data-migration.ts`, additive assessment field | `postgres-data-migration.test.ts`; Phase 5R A/B reports | PASS | Pure structured dry-run only; all templates and execution remain blocked. Audit for real process/DB/SSH/transfer calls and false live-migration claims. |
| Phase 6R | `4b095cc` — runtime schema validation | Production: `schemas/{shared,plan-schemas,migration-schemas}.ts`, four route hooks | `schema-validation.test.ts`, apply regression; Phase 6R A/B reports | PASS | Validators are reachable on four high-risk routes; no handler extraction occurred. Audit valid-client compatibility, stable errors, secret reflection, path/ordering behavior. |

All listed commits are pushed through the current `origin/main` history.

## 6. Per-Slice Audit Scope

### Phase 1 — Playbook execution bypass

- Trace legacy mutation handlers and assert HTTP 410 independent of flags.
- Trace Plan create/review/apply through stored immutable payload,
  `planHash`, `approvedPlanHash`, artifact-byte verification, `artifactHash`,
  `actionId`, and `source: "approved-artifact"`.
- Verify direct YAML/catalog/batch helpers fail without SSH execution.
- Verify Apply takes only URL Plan id plus the allowlisted body and cannot
  reread mutable request YAML/actions/config.
- Inspect shell/raw-command call sites and ensure no ordinary API reaches them
  outside approved managed adapters.

### Phase 2 — Collector modularity and completeness

- Run modular runner tests for success, partial, throw/failure, skipped optional
  collectors, error arrays, and completeness thresholds.
- Trace real SSH collection through `collectRemoteSnapshot()` and
  `fullSnapshotToStored()`; document that modular runner is not the live path.
- Verify failed/partial envelopes survive persistence and feed assessment and
  `partial-snapshot-confirm` rather than being interpreted as absence.
- Treat module presence as PARTIAL, not production replacement.

### Phase 3 — Snapshot data surfaces

- Verify Process, DataPath, EnvFile, SecretRef, Volume, Network, Certificate,
  Domain, UserGroup, and ScheduledTask schema/collector/serialization alignment.
- Verify optional/old snapshot compatibility and empty/sparse normalization.
- Assert EnvFile retains keys/counts but not values and SecretRef retains only
  reference/fingerprint/redacted metadata.
- Trace actual graph consumption for every surface.

### Phase 4 — InventoryGraph

- Verify all typed nodes and relationship kinds are actually emitted.
- Verify empty/sparse graphs, deterministic ids/order, deduplication,
  completeness propagation, and secret redaction.
- Confirm production routes and assessment call the current extractor.

### Phase 4E — ServiceStack enrichment

- Trace `InventoryGraph -> aggregateServiceStacks() -> routes/assessment`.
- Verify confidence/reasoning/evidence, relationship-derived optional fields,
  deterministic ordering, empty state, old graph compatibility, and redaction.
- Confirm no UI dependency is required for backend correctness.

### Phase 4F — Production route exposure

- Exercise all three routes for authentication, ownership, cross-user denial,
  missing resources/snapshots, empty state, response shape, and registration.
- Trace session ownership through `loadMigrationSessionContext(user.id, id)` and
  connection ownership through `c.userId === user.id`.
- Verify assessment and support bundle wiring remains additive.

### Phase 4G — Contract hardening

- Run route shape, empty-state, cross-user, structural secret-safety, and
  support auto-propagation tests.
- Confirm public fields were not renamed/deleted and tests-only work is not
  represented as a new production capability.
- Recheck `SupportBundle.inventoryGraph?` remains optional/reserved.

### Phase 5R — PostgreSQL dry-run boundary

- Trace intent, dry-run, and optional Assessment field.
- Assert pure construction, `executionBlocked: true`, all templates blocked,
  `data-strategy-confirm`, no credential values, and no adapter registration.
- Search for process execution, DB connections, SSH execution, transfer, real
  `pg_dump`, `pg_restore`, or `pg_basebackup` calls.
- Confirm the legacy migration apply route remains HTTP 410 and docs state that
  real PostgreSQL migration execution is unavailable.

### Phase 6R — Runtime validation

- Exercise null, missing, wrong primitive/container shape, unknown enum/field,
  forbidden field, non-string array elements, oversized arrays/strings, and
  malformed path ids where applicable.
- Exercise valid payloads for all four routes and confirm business-handler
  semantics are unchanged.
- Verify HTTP 400 error shape, field detail, no stack trace or secret reflection,
  preserved legacy 410 handlers, and route registration order.

## 7. Cross-Phase Risk Analysis

| Risk | Planned evidence | Priority |
|---|---|---|
| Plan/playbook bypass or mutable input | Direct helper, legacy 410, plan hash, artifact tamper, managed execution tests plus code trace | must-have |
| Authorization/cross-user exposure | Three graph/stack routes, Plan ownership, session/connection loader tests | must-have |
| Secret propagation | Surface -> graph -> stack -> assessment/support/dry-run/error serialization tests and static scans | must-have |
| False execution/readiness claim | PostgreSQL no-execution scan and docs comparison | must-have |
| Partial evidence treated as complete | Collector targeted tests plus assessment completeness trace | must-have |
| Tests-only mistaken for production | Phase 2 modular runner and Phase 4G contract inventory | must-have |
| Schema validation compatibility | Valid route payload tests plus validator unit tests | must-have |
| Route ordering | Route inventory and legacy 410 injection tests | recommended |
| Support bundle authorization | Session ownership trace and route tests | must-have |
| Stale Phase 8/next-step text | Docs scan and minimal correction | recommended |
| Phase 7R-0 readiness regression | Initialization contract, Build UI, catalog, SQLite suites, full suite | must-have |

## 8. Recommended Phase 7R-B Minimal Scope

| Target | Reason / expected change | Priority | Risk | Verification | Production code allowed? |
|---|---|---|---|---|---|
| Current production files listed above | Trace only; establish reachable execution evidence | must-have | none | Code citations and route call chains | No |
| Existing targeted tests | Execute all nine-slice safety/contract suites | must-have | test runtime | Exit 0 and counts | No |
| Static searches | Distinguish tests/docs/templates from executable calls | must-have | false positives | Context classification in report | No |
| `docs/phase7-c-contract-stability-evidence-closure-2026-07-09.md` | Replace obsolete Phase 8 next step with reconciliation/Phase 7R closure wording | recommended | very low | `rg "Phase 8"` contextual scan | No |
| Phase 7R-B evidence report | Persist audit matrix, findings, commands, and decisions | must-have | none | `git diff --check` | No |
| Missing regression test | Add only if a real untested safety/authorization/compatibility gap is proved | optional | scope expansion | Must fail or prove gap before change | Only if blocker policy requires |
| Production blocker fix | Only for proved safety, authorization, secret, integrity, or compatibility bug | conditional must-have | high | Failing test first, targeted regression, full suite | Yes, only minimal blocker fix |

Expected result from current planning evidence: no production code changes.

## 9. Explicit Non-Goals

- Real PostgreSQL dump/restore/basebackup or database migration execution
- Secret Transport or Conflict Resolver
- Generic database migration framework
- Broad route split, collector rewrite, graph/stack redesign, or OpenAPI generation
- Marketplace, dynamic plugins, UI work, or Phase 8
- Re-enabling any legacy mutation route
- Changing dry-run, validation, or completeness semantics
- Refactoring unrelated code or rewriting historical reports

## 10. Test and Evidence Plan

| Evidence group | Command |
|---|---|
| Typecheck | `npm run typecheck` |
| Build | `npm run build` |
| Full API | `npm run test --workspace @fool/api` |
| Phase 1 / Plan | `node --test --test-concurrency=1` over `phase1-bypass`, `plan-security-core`, `plan-apply-security-routes`, `managed-plan-execution` compiled files |
| Phase 2 | `node --test --test-concurrency=1 apps/api/dist/collectors/__tests__/collector-modules.test.js apps/api/dist/collectors/__tests__/collector-runner.test.js apps/api/dist/collectors/__tests__/snapshot-completeness.test.js` |
| Phase 3 | `node --test --test-concurrency=1 apps/api/dist/collectors/__tests__/data-surfaces.test.js` |
| Phase 4/4E | Compiled `inventory-graph-phase4` and `service-stack-phase5` files |
| Phase 4F/4G | Compiled `inventory-graph-routes`, `assessment-summary`, and `support-bundle` files |
| Phase 5R | Compiled `postgres-data-migration` test file |
| Phase 6R | Compiled `schema-validation` plus Plan apply compatibility file |
| Phase 7R-0 | Compiled Build UI, catalog certification routes, and SQLite relational/subsystem files |
| Static evidence | Required `rg` scans for execution, pg tools, 410, hashes, routes, secrets, and Phase 8 |
| Whitespace/status | `git diff --check`, `git status --short`, `git diff --stat` |

Targeted Node commands operate on a fresh API build. Logs belong under ignored
`.tmp_logs/` and are not durable documentation.

## 11. Risk / Compatibility Notes

- Full API `npm test` covers `dist/engine/tests`, but collector tests under
  `dist/collectors/__tests__` require separate targeted execution.
- Phase 2 modular collectors must remain PARTIAL unless the live SSH call path
  changes; Phase 7R must not turn this audit observation into a broad rewrite.
- Optional fields (`enrichedStacks`, `inventoryGraph`, PostgreSQL dry-run) must
  remain additive.
- Production `server.ts` already awaits SQLite initialization before route
  registration; Phase 7R must preserve that behavior.
- The old audit predates Phases 1-6R and contains superseded conclusions and
  mojibake; it cannot establish current PASS status.

## 12. Files Expected to Change in Phase 7R-B

- `docs/phase7r-b-final-audit-evidence-2026-07-18.md`
- `docs/phase7-c-contract-stability-evidence-closure-2026-07-09.md` (one stale
  next-step correction)
- Tests or production files only if a blocker is first proved

## 13. Files Expected Not to Change

- `apps/web/**`
- `apps/api/src/inventory-graph.ts`
- `apps/api/src/postgres-data-migration.ts`
- `apps/api/src/schemas/**`
- Plan/executor/collector production modules unless a blocker is proved
- Generated outputs, runtime data, `.env`, logs, screenshots
- `docs/audit-report-2026-07-08.md`
- Phase 7R-0 files

## 14. `docs/audit-report-2026-07-08.md` Handling Decision

Keep it untracked and unchanged. It is not required for the final evidence
chain, contains mojibake, and predates fixes that invalidate several conclusions
(direct playbook bypass, new surfaces, graph extraction, and dry-run/validation
work). Committing it would introduce stale and misleading claims.

## 15. Phase 7R-B Execution Checklist

- [ ] Confirm branch remains `main`, local Phase 7R-A is the only commit above
      `f4ddca57`, and remote remains `f4ddca57`
- [ ] Trace all nine production paths and authorization boundaries
- [ ] Run typecheck, build, full API, every targeted suite, and 7R-0 suites
- [ ] Classify every static-search hit by executable/test/doc/template context
- [ ] Verify no real PostgreSQL execution/adapter/connection/transfer
- [ ] Verify Plan approval/hash/artifact integrity and legacy 410 behavior
- [ ] Verify partial evidence and sensitive surfaces remain safe
- [ ] Verify graph/stack routes, ownership, contracts, and support wiring
- [ ] Verify runtime validation errors and valid-client compatibility
- [ ] Correct only the proved stale Phase 8 next-step reference
- [ ] Write the Phase 7R-B evidence report with explicit findings/severity
- [ ] Run `git diff --check`, inspect changed files, commit locally, do not push
