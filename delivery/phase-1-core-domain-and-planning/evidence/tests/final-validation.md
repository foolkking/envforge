# Phase 1 Final Validation

Stabilization completed on 2026-07-20 in the local Windows development
environment with disposable PostgreSQL 17.10 databases.

| Gate | Command | Result |
|---|---|---|
| Web typecheck | `cd apps/web && npx tsc --noEmit` | PASS |
| Full typecheck | `npm run typecheck` | PASS |
| Build | `npm run build` | PASS |
| API regression | `npm run test --workspace @fool/api` | PASS, 1029/1029, 17 suites, 0 skipped |
| Phase 1 PostgreSQL suite | included in API regression | PASS, 14/14 |
| Web smoke | `npm run smoke:web` | PASS, 16/16 desktop/mobile and zh/en |
| OpenAPI | `npm run validate:openapi` | PASS, OpenAPI 3.1, 104 paths, 109 operations |
| JSON Schema | `npm run validate:schemas` | PASS, 63 positive and 63 negative fixtures |
| Secret canary | `npm run validate:preparation:security` | PASS, 0 repository findings |
| Diff hygiene | `git diff --check` | PASS |

The Phase 1 compiler determinism case recompiles the bound fixture 100 times.
The PostgreSQL suite also covers migration replay, immutable revisions,
workspace isolation, project lineage, delayed-work-compatible persistence,
duplicate Outbox delivery, exact-hash approval, drift invalidation and the
locked Run boundary. No ExecutionRun or target-side effect is created.

The first stabilization attempt exposed two regressions and both were corrected
before this result: Phase 0 migration-count assertions were updated for migration
0003, and the Planning Web preview stopped eagerly requesting a route when the
Planning database is not configured. The complete affected suites were rerun.
