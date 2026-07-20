# EnvForge Phase 0 Closure Report

## 1. Result

`PASS — Phase 1 Core Domain and Planning is unlocked`.

## 2. Baseline

- Repository: `E:\1project\EnvForge`
- Initial branch: `phase/0-platform-and-persistence`
- Initial HEAD: `6c4027f0663f191ac7c3f7b720ad019efb827173`
- Preparation final HEAD: `7dbb9189ff2dd9d712917464c71898be96e6a4e0`
- Preparation Handoff hash: `16e620f5ee749ef3bd350bd6abd7d29e76b1fbe80071a45a51c2e3c256e255d8`
- Design baseline/hash: Integrated v1.2 / tree `c22974727e338aff8419f4c70952e9978e16b7ca`
- Delivery contract: `EF-DELIVERY-CONTRACT-001@1.1`
- Toolchain: Node 20.13.1, npm 10.5.2, TypeScript 5.5.4
- PostgreSQL version: 17.10 disposable validation target
- Artifact providers: Local PASS; injected S3 contract PASS; live MinIO unavailable
- Initial database/API: SQLite hybrid runtime; legacy API plus OpenAPI reference
- Baseline tests: API 1001/1001, Web 16/16, harness 109/109

## 3. Entry Assessment

- Verdict: `ENTRY-PASS`
- Decisions: ADR-003, ADR-014, ADR-015, ADR-016
- Blockers: none
- Allowed debt: live MinIO, final version/capacity matrix, later-phase product domains
- Evidence: `01-entry-assessment.md`

## 4. Scope Executed

- Completed WP: WP0-WP6 and WP8-WP13.
- N/A: WP7 UI implementation; this is an internal platform phase.
- Omitted: Phase 1 Planning, Phase 2 Execution, Dataset, Secret Delivery,
  Cutover, Archive, Restore, SSH mutation and UI product flow.
- Reason: explicit Phase boundaries.

## 5. Design Inputs and Deltas

Normative design, ADRs, machine contracts and Preparation Handoff were bound in
Entry. Current guides and historical evidence were revalidated against the
initial HEAD. Production SQL extends incomplete Reference DDL Outbox/delayed
fields; Project lineage follows the requirement addendum. Deltas and decisions
are in `04-design-delta.md`, `06-decision-log.md`, and WP1.

## 6. Architecture Delivered

- PostgreSQL explicit migrations and repository transaction helper;
- Workspace, Project/Endpoint, lineage/revision and safe operation foundation;
- API short transactions and independent worker/projection entrypoints;
- Event, Audit, Outbox, Inbox, idempotency and projection storage;
- Local and injected S3-compatible Artifact providers;
- existing session auth adapted to PostgreSQL workspace membership;
- readiness and bounded admin workspace metrics.

## 7. Persistence

Production migrations `0001` and `0002` are transactional, checksum-protected,
clean-installable and replayable. Schema uses application UUIDv7, bigint
versions, canonical JSON SHA-256, workspace composite foreign keys, uniqueness,
append-only Event/Audit triggers and query indexes. A real `pg_dump`/`pg_restore`
test restores Projects and migration versions. Reference DDL remains non-
production authority. See `docs/07-persistence/production-migration-catalog.md`.

## 8. Authority and Legacy Migration

New Foundation writes are PostgreSQL-only behind `ENVFORGE_POSTGRES_URL`.
Legacy SQLite resources remain separate and are not dual-written. The backfill
supports dry-run, deterministic source hashes, rejected reasons, idempotent
replay and reconciliation without events or external side effects. Authority,
flags, rollback and retirement gates are in WP8 and
`platform.authority_transitions`.

## 9. API

Implemented `/api/v1` operations cover Project create/list/get/name update,
Endpoint binding/list, safe admin hash-verification operation, operation read,
workspace metrics and health/readiness. Mutations use Idempotency-Key; Project
update/binding uses If-Match; errors use Problem Details. OpenAPI validates 103
paths and 107 operations. Later-phase operations remain target contracts and
are not registered by the Phase 0 router.

## 10. Event, Audit, Outbox, Inbox

Aggregate state, Event, Outbox, Audit and idempotency result commit in one
transaction. Dispatcher claims with `FOR UPDATE SKIP LOCKED`, token and lease,
records attempts, retries with bounded backoff and dead-letters. Inbox identity
deduplicates replay. Projection version gaps and unsupported schemas fail closed.
Metrics expose bounded workspace counts; evidence is retained for repair.

## 11. Artifact

`ArtifactService` inserts `pending`, publishes through a provider, then requires
head/length/SHA-256 reconciliation before `available`. Read corruption marks
`corrupt`; deletion is `deletion-pending -> deleted`. Local uses restrictive
temp files, fsync and atomic rename. S3 uses staging/copy/head/cleanup through an
injected contract. Live MinIO and production encryption integration are not
claimed; production-sensitive encryption remains required by ADR-016.

## 12. Security

Existing session authentication is reused; platform operations/metrics require
admin role. Membership plus repository filters and composite FKs enforce
workspace scope. SQL is parameterized and Artifact keys are opaque/traversal-
safe. A controlled canary is rejected before persistence and absent from a
database dump and repository scan. No real Secret or production credential was
used. Dependency installation is lockfile-pinned.

## 13. Operations

API, operation worker and projection are separate process entrypoints with
SIGTERM/SIGINT bounded polling shutdown and pool close. Readiness checks DB and
migration metadata. Operational commands cover migration, worker/projection,
backfill, backup and restricted disposable restore. Runbook:
`docs/10-operations/phase-0-platform-operations.md`.

## 14. Tests

| ID | Command | Environment | Result | Evidence | Acceptance |
|---|---|---|---|---|---|
| T1 | `npm run typecheck` | local | PASS | test report | PH0-025 |
| T2 | `npm run build` | local | PASS | test report | PH0-025 |
| T3 | `npm run test --workspace @fool/api` | local + disposable PostgreSQL | 1014/1014 twice | test report | PH0-002..025 |
| T4 | targeted Node test command | disposable PostgreSQL | 13/13 | test report | PH0-002..023, GAP |
| T5 | `npm run smoke:web` | Playwright | 16/16 | test report | regression |
| T6 | `npm run validate:design` | local | PASS | generated validators | PH0-022/024 |
| T7 | DDL/security/failure validators | disposable/local | PASS | validator summaries | PH0-017/022 |

## 15. Failure Injection

| Scenario | Expected | Actual | Result | Evidence |
|---|---|---|---|---|
| failed migration | no partial schema/version | rollback confirmed | PASS | failure matrix |
| PostgreSQL outage | no false readiness | `{ok:false}` | PASS | failure matrix |
| expired claim/duplicate delivery | reclaim/one result | confirmed | PASS | dispatcher evidence |
| unsupported schema/projection gap | fail/dead-letter | confirmed | PASS | dispatcher evidence |
| Artifact interruption/corruption | no false available | cleanup/corrupt state | PASS | Artifact evidence |
| API/app restart | durable read | fresh pool/app read | PASS | database evidence |

## 16. Performance and Capacity

| Metric | Result | Environment | Evidence |
|---|---|---|---|
| 50 identical idempotent requests | 159-169 ms | local PostgreSQL | performance baseline |
| Project create/read p50/p95 | 3-5 / 12-13 ms | 20 samples | performance baseline |
| Local Artifact 1 MiB put/read | 24-26 ms | local filesystem | performance baseline |
| Full API suite | 68-80 s | local | test report |

No production SLO, 100 MiB, live MinIO, RPO or RTO claim is made.

## 17. Regression

Initial API baseline was 1001/1001. Final total is 1014/1014 with no skip. The
first full attempt exposed a cwd-dependent test path and failed 1013/1014; the
test now uses `resolveFromRoot`, and two subsequent full runs passed. Root build,
typecheck and Web smoke have no new failures.

## 18. Documentation and Specifications

OpenAPI and JSON Schemas include the implemented Phase 0 API. The production
migration catalog separates runtime SQL from Reference DDL. Current runtime and
harness guides link the new commands without rewriting legacy history.
`PROJECT_STATE.md` records the delivered scope and later-phase exclusions.
Generated Preparation snapshots were restored and not modified.

## 19. Acceptance Traceability

- Total: 33 (PH0-001..026 plus PH0-GAP-001..007)
- Passed: 33, including optional S3 contract acceptance
- Failed: 0
- Blocked: 0
- Path: `94-acceptance-traceability.md`

## 20. Defects

| ID | Severity | Description | Resolution | Status | Target |
|---|---|---|---|---|---|
| PH0-DEF-001 | P1 | Reference behavior gap | richer production SQL | CLOSED | Phase 0 |
| PH0-DEF-002 | P1 | Artifact record/provider gap | ArtifactService lifecycle | CLOSED | Phase 0 |
| PH0-DEF-003 | P1 | operation not API-reachable | safe admin API | CLOSED | Phase 0 |
| PH0-DEF-004 | P2 | cwd-dependent test command | `resolveFromRoot`/guide | CLOSED | Phase 0 |
| PH0-DEF-005 | P2 | no live MinIO | contract-only scope | DEFERRED | Phase 9 |

## 21. Known Limitations

Live MinIO, production encryption envelope integration, RLS, HA, final version
matrix, production capacity and UI adoption are not certified. The Foundation
worker is not a Durable Execution worker. Legacy SQLite remains for old
resources until phased cutover/retirement.

## 22. Deferred Work

See `92-deferred-work.md`. Later product domains follow the accepted roadmap and
are not Phase 0 failures.

## 23. Evidence Bundle

| ID | Path | Classification | Acceptance |
|---|---|---|---|
| E1 | `evidence/database/migration-validation.md` | current evidence | migration/GAP |
| E2 | `evidence/api/current-api-inventory.json` | current evidence | API/security |
| E3 | `evidence/artifact/provider-validation.md` | current evidence | Artifact |
| E4 | `evidence/outbox-inbox/dispatcher-validation.md` | current evidence | dispatcher/inbox |
| E5 | `evidence/security/secret-isolation.md` | sanitized evidence | security |
| E6 | `evidence/failure-injection/failure-matrix.md` | current evidence | failure |
| E7 | `evidence/performance/baseline.md` | current evidence | performance |
| E8 | `evidence/tests/final-test-report.md` | current evidence | regression |

SHA-256 inventory is `evidence/hashes/sha256-manifest.txt`; the final Git tree
provides content identity for Closure metadata. Ephemeral raw logs are not
committed.

## 24. Commits

| Commit | Description | Checks |
|---|---|---|
| `1bba6c6` | Phase 0 Entry and audit baseline | Entry/hash/baseline review |
| `387a2b8` | PostgreSQL and platform foundation | typecheck/build/targeted integration |
| `7a7a081` | failure, recovery and performance tests | targeted and full API suites |
| `a51e442` | contracts, operations and evidence | design/Markdown/OpenAPI/schema validation |

The final Closure commit contains this report, Handoff, Acceptance traceability
and evidence hash inventory; it does not alter implementation behavior.

## 25. Final Repository State

- Final branch: `phase/0-platform-and-persistence`
- Final implementation HEAD: `a51e442259dd4faf4a21e7df619d4c805cb37049`
- Working tree: required clean after Closure commit
- Schema/API: `phase0-postgresql-0002`, `/api/v1` foundation subset
- Feature flags: six explicit foundation/compatibility flags
- Tests/CI-equivalent: all required local checks PASS

## 26. Handoff Readiness

Phase 1 inputs, authoritative paths, feature flags, accepted ADRs, migration
catalog, test harnesses and debt are in `91-handoff-manifest.yaml`. Blocking
conditions are empty. Phase 1 may consume the foundation but must not reinterpret
ControlPlaneOperation as ExecutionRun.

## 27. Final Verdict

`PASS — Phase 1 Core Domain and Planning is unlocked`.
