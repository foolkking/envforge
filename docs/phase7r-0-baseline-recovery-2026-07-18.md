# EnvForge Phase 7R-0 Baseline Recovery Report

## 1. Result

PASS — repository fix committed and pushed

## 2. Initial Baseline

- Branch: `main`
- Initial HEAD: `4b095cc8cbe9cc6bb46ed2be72ee0eedb4cc9849`
- Initial remote HEAD: `4b095cc8cbe9cc6bb46ed2be72ee0eedb4cc9849`
- Working tree: only the expected untracked `docs/audit-report-2026-07-08.md`
- Initial API result: exit code 1; 999 passed, 1 failed, 1000 total
- Failing test: `Build-consumed catalog data contains only certified items (no not-ready leaks)`
- Error: `SQLITE_ERROR: no such table: system_kv` from `GET /api/catalog`

Phase 7R-A/B/C commits were absent. `main` and `origin/main` were synchronized,
and `git diff --check` passed before investigation.

## 3. Reproduction

| Layer | Exact command | Result | Evidence |
|---|---|---|---|
| Target test, run 1 | `node --test --test-concurrency=1 --test-name-pattern='Build-consumed catalog data contains only certified items' apps/api/dist/engine/tests/build-ui-regression.test.js` | PASS, exit 0 | `.tmp_logs/phase7r-0-target-before-run1.log` |
| Target test, run 2 | Same command | PASS, exit 0 | `.tmp_logs/phase7r-0-target-before-run2.log` |
| Target test, run 3 | Same command | PASS, exit 0 | `.tmp_logs/phase7r-0-target-before-run3.log` |
| Build UI file | `node --test --test-concurrency=1 apps/api/dist/engine/tests/build-ui-regression.test.js` | PASS, 34/34 | `.tmp_logs/phase7r-0-build-ui-suite-before.log` |
| Catalog routes | `node --test --test-concurrency=1 apps/api/dist/engine/tests/catalog-certification-routes.test.js` | PASS, 15/15 | `.tmp_logs/phase7r-0-catalog-route-suite-before.log` |
| SQLite suites | `node --test --test-concurrency=1 apps/api/dist/engine/tests/db-sqlite-relational.test.js apps/api/dist/engine/tests/db-sqlite-subsystems.test.js` | PASS, 11/11 | `.tmp_logs/phase7r-0-db-init-suites-before.log` |
| Full API before fix | `npm run test --workspace @fool/api` | PASS, 1000/1000 | `.tmp_logs/phase7r-0-api-before-fix.log` |
| New initialization-contract regression before fix | `node --test --test-concurrency=1 --test-name-pattern='Build-consumed app factory initializes system_kv before routes are ready' apps/api/dist/engine/tests/build-ui-regression.test.js` | FAIL, exit 1: database not initialized | `.tmp_logs/phase7r-0-regression-before-fix.log` |

The original failure was therefore intermittent: the Phase 7R-A run failed at
999/1000, while isolated runs and a later unchanged full run passed. The new
contract test made the harness defect deterministic without creating the table
inside the test.

Database paths used by `bootApp()` were unique per invocation:

```text
FOOL_RUNTIME_DB=<OS_TEMP>/envforge-build-ui-*/runtime.json
SQLite file=<OS_TEMP>/envforge-build-ui-*/envforge.db
FOOL_DATA_DIR=<OS_TEMP>/envforge-build-ui-*
NODE_ENV=development
```

The parent test process had no `NODE_ENV`, `FOOL_RUNTIME_DB`, or
`FOOL_DATA_DIR` value. The test factory assigned these values before database
initialization. It did not use an in-memory or repository database.

## 4. Root Cause Classification

- Classification: **TEST_HARNESS_BUG**
- Root cause: the Build-consumed Fastify test factory registered routes and
  returned a ready-looking app without running the production SQLite bootstrap.
  Its first `/api/catalog` request invoked `readRuntimeDatabase()` twice through
  the route's `Promise.all`: once directly and once through
  `listCatalogFromDatabase()`. Lazy initialization could expose the SQLite
  connection before migration 1 had created `system_kv`, causing the observed
  intermittent missing-table response.
- Code path:
  `bootApp()` -> `registerRoutes()` -> `GET /api/catalog` ->
  `Promise.all(listCatalogFromDatabase(), readRuntimeDatabase())` ->
  `SafeJsonStore.read()` -> `initializeDatabase()` -> migration 1.
- Evidence: the unchanged full suite produced both 999/1000 and 1000/1000;
  isolated fresh-directory runs passed; the added contract test failed before
  the fix with `Database not initialized. Call initializeDatabase() first.`
- Production impact: the production entry point is not affected by this
  harness omission. `server.ts` awaits `initializeDatabase()` before
  `registerRoutes()` and before `app.listen()`, so production requests cannot
  reach routes until programmatic migrations complete.

Rejected classifications:

- `ENVIRONMENT_ONLY`: rejected because the harness used new unique temporary
  directories and the parent process had no relevant database environment
  override; the same unchanged checkout produced both pass and fail results.
- `PRODUCTION_BOOTSTRAP_BUG`: rejected because production explicitly awaits the
  same bootstrap before route registration and listening.
- `ORDER_DEPENDENCY`: rejected as the primary cause because the failing file and
  target passed independently, test files run with concurrency 1, and the
  factory created a unique database path. No predecessor was required to create
  the table.
- `CONCURRENCY_RACE`: present as the immediate lazy-read trigger, but secondary
  to the harness bypassing the mandatory startup bootstrap.
- `STALE_BUILD_OR_GENERATED_STATE`: rejected because API build succeeded before
  reproduction and `npm test` performs a clean API rebuild itself.

## 5. `system_kv` Initialization Contract

1. Schema location: migration version 1 in `apps/api/src/db-sqlite.ts`.
2. Migration/bootstrap owner: `runProgrammaticMigrations()`, called and awaited
   by `initializeDatabase()`.
3. Production startup: `apps/api/src/server.ts` awaits `initializeDatabase()`
   before route registration and `app.listen()`.
4. Test startup before fix: `bootApp()` did not call database bootstrap.
5. The failing test therefore bypassed the normal production initialization.
6. Catalog was reachable before schema readiness only in this test factory.
7. Production migration was awaited; the harness omitted the await entirely.
8. Before fix, the factory did not own SQLite shutdown or temporary-directory
   cleanup. After fix its `onClose` hook owns both.
9. The API test command uses `--test-concurrency=1`; each `bootApp()` also uses a
   unique SQLite file, so workers do not intentionally share it.
10. No suite is allowed or required to pre-create `system_kv` after the fix.
11. Source and compiled tests use the same environment-resolved runtime JSON
    path and sibling `envforge.db` derivation.
12. Parent `NODE_ENV`, `FOOL_RUNTIME_DB`, and `FOOL_DATA_DIR` were unset; no
    environment leakage was found.
13. The original target passed three isolated pre-fix runs.
14. Full-suite behavior was not stable before fix: one 999/1000 failure and one
    later 1000/1000 pass were observed.
15. The only observed failure position was the Build-consumed catalog route;
    the intermittent timing did not reproduce on every run.
16. This was a test harness startup-contract defect, not a demonstrated
    production startup defect.

## 6. Changes Made

| File | Change | Reason |
|---|---|---|
| `apps/api/src/engine/tests/build-ui-regression.test.ts` | `bootApp()` now awaits the real `initializeDatabase()` before registering routes and owns SQLite/temp-directory cleanup through `onClose` | Match production readiness and cleanup contracts; remove lazy first-request initialization |
| `apps/api/src/engine/tests/build-ui-regression.test.ts` | Added a fresh-app contract test that queries `sqlite_master` after `bootApp()` | Prove migration 1 created `system_kv` through the real bootstrap path |
| `docs/phase7r-0-baseline-recovery-2026-07-18.md` | Added this recovery evidence report | Establish the new Phase 7R baseline |

No production code changes were made.

No production code changes were required: the production server already waits
for schema readiness before registering or serving routes.

## 7. Tests Added or Updated

| Test | Purpose | Before Fix | After Fix |
|---|---|---|---|
| `Build-consumed app factory initializes system_kv before routes are ready` | Verify a fresh build-consumed app uses the real bootstrap and exposes `system_kv` before route readiness | FAIL: database not initialized | PASS |
| Existing certified-only catalog route test | Verify catalog returns 200 and no not-ready item leaks | Intermittent: observed fail and pass | PASS in five consecutive targeted runs and both full runs |

No tests were removed, skipped, weakened, or changed to accept HTTP 500.

## 8. Verification

| Check | Command | Result | Evidence |
|---|---|---|---|
| Target test x5 | Targeted Node test command shown above, repeated five times | PASS; five exit codes 0 | `.tmp_logs/phase7r-0-target-after-run1.log` through `run5.log` |
| Related catalog suite | `node --test --test-concurrency=1 apps/api/dist/engine/tests/catalog-certification-routes.test.js` | PASS, 15/15, 0 skipped | `.tmp_logs/phase7r-0-catalog-route-suite-after.log` |
| Build-consumed suite | `node --test --test-concurrency=1 apps/api/dist/engine/tests/build-ui-regression.test.js` | PASS, 35/35, 0 skipped | `.tmp_logs/phase7r-0-build-ui-suite-after.log` |
| DB initialization suites | `node --test --test-concurrency=1 apps/api/dist/engine/tests/db-sqlite-relational.test.js apps/api/dist/engine/tests/db-sqlite-subsystems.test.js` | PASS, 11/11, 0 skipped | `.tmp_logs/phase7r-0-db-init-suites-after.log` |
| Typecheck | `npm run typecheck` | PASS, exit 0 | `.tmp_logs/phase7r-0-typecheck.log` |
| API build | `npm run build --workspace @fool/api` | PASS, exit 0 | `.tmp_logs/phase7r-0-api-build-after-fix.log` |
| Root build | `npm run build` | PASS, exit 0 | `.tmp_logs/phase7r-0-root-build.log` |
| Full API run 1 | `npm run test --workspace @fool/api` | PASS, 1001/1001, 0 fail, 0 skipped | `.tmp_logs/phase7r-0-api-after-fix-run1.log` |
| Full API run 2 | `npm run test --workspace @fool/api` | PASS, 1001/1001, 0 fail, 0 skipped | `.tmp_logs/phase7r-0-api-after-fix-run2.log` |
| `git diff --check` | `git diff --check` | PASS | No output |

## 9. Git State

- Commit created: yes
- Commit SHA: the commit containing this report; exact immutable SHA is
  recorded by the post-push verification and final Phase 7R-0 output. A Git
  commit cannot embed its own SHA because changing this file changes that SHA.
- Push performed: yes, normal `git push origin main`
- Local HEAD: synchronized with `origin/main` after push
- Remote HEAD: synchronized with local HEAD after push
- Untracked files: only `docs/audit-report-2026-07-08.md`
- Force push used: no

## 10. New Phase 7R Baseline

The exact immutable SHA is the commit containing this report and is recorded in
the post-push command output and final Phase 7R-0 response. Use that SHA, not
`4b095cc`, when restarting Phase 7R-A.

```text
PHASE_7R_BASELINE_SHA=<Phase 7R-0 commit containing this report>
PHASE_7R_EXPECTED_API_TOTAL=1001
PHASE_7R_EXPECTED_API_PASS=1001
PHASE_7R_EXPECTED_API_FAIL=0
```

## 11. Phase 7R Restart Decision

- Ready to restart Phase 7R-A: yes
- Reason: root cause is identified, the real test bootstrap contract is
  restored, target and related suites pass, full typecheck/build pass, and two
  consecutive full API runs pass at 1001/1001 with no skipped tests.
- Required prompt baseline replacements: replace the Phase 7R HEAD and
  `origin/main` expectation with the exact Phase 7R-0 commit SHA reported after
  push; replace `1000/1000` with `1001/1001`.

## 12. Final Conclusion

- Root cause resolved: yes
- Deterministic baseline restored: yes
- Phase 7R-0 complete: yes
- Phase 7R itself complete: no
