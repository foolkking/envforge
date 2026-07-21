# Phase 2 Acceptance Traceability

All entries bind to `apps/api/migrations/postgres/0004_phase2_durable_execution.sql`, `apps/api/src/execution/`, and `apps/api/src/engine/tests/phase2-execution.test.ts` unless a more specific path is named.

| ID | Requirement | Evidence | Status |
|---|---|---|---|
| PH2-001 | Entry and Phase 1 Handoff | `01-entry-assessment.md` | PASS |
| PH2-002 | Exact Plan/Approval binding | exact-hash negative/positive test | PASS |
| PH2-003 | Idempotency and drift | replay/drift test | PASS |
| PH2-004 | Durable atomic claim | concurrent claim test | PASS |
| PH2-005 | Lease and heartbeat | reclaim/heartbeat test | PASS |
| PH2-006 | Stale fencing rejection | stale worker test | PASS |
| PH2-007 | Resource lease | conflicting writer test | PASS |
| PH2-008 | Run/Stage/Action/Attempt | migration and worker tests | PASS |
| PH2-009 | Checkpoint integrity | checkpoint hash persistence | PASS |
| PH2-010 | Retry policy storage | bounded attempt schema | PASS |
| PH2-011 | Unknown reconciliation | unknown adapter test | PASS |
| PH2-012 | Crash recovery | expired lease takeover | PASS |
| PH2-013 | Duplicate delivery safety | idempotency/unique constraints | PASS |
| PH2-014 | Pause/Resume | explicit control state service/API | PASS |
| PH2-015 | Cancel | safe control request state | PASS |
| PH2-016 | Required verification | commit gate test | PASS |
| PH2-017 | Once-only commit | unique commit race probe | PASS |
| PH2-018 | Independent RollbackRun | rollback relation test | PASS |
| PH2-019 | Immutable report/evidence | report hash and attempt history | PASS |
| PH2-020 | API contracts | OpenAPI 110 operations PASS | PASS |
| PH2-021 | Web Run workflow | Web smoke 16/16 | PASS |
| PH2-022 | Workspace/permission | cross-workspace negative test | PASS |
| PH2-023 | Secret canary | repository findings 0 | PASS |
| PH2-024 | Legacy Apply isolation | execution audit and separate schema | PASS |
| PH2-025 | Backup/recovery | Phase 0 restore regression PASS | PASS |
| PH2-026 | Observability/repair | persisted events/control/reconciliation | PASS |
| PH2-027 | Failure matrix | targeted PostgreSQL suite 10/10 | PASS |
| PH2-028 | Performance baseline | test duration and DB query baselines | PASS |
| PH2-029 | Full regression | API 1039/1039 | PASS |
| PH2-030 | Documentation sync | docs/OpenAPI/current guides | PASS |
| PH2-031 | Closure/Handoff | `90`, `91`, evidence index | PASS |
| PH2-GAP-001 | One active live Run per Project/Plan | partial unique indexes | PASS |
| PH2-GAP-002 | Retry drift revalidation | exact binding hash check | PASS |
| PH2-GAP-003 | Delayed work survives restart | fresh-pool schedule test | PASS |
| PH2-GAP-004 | Schedule dedup/cancel | scheduled operation test | PASS |
| PH2-GAP-005 | Structured manual evidence | attestation cannot verify test | PASS |
| PH2-GAP-006 | Post-commit attention preserves Commit | separate attention table/FK | PASS |
| PH2-GAP-007 | Source Release blocker | `source_release_blocked` invariant | PASS |

