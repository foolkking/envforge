# Phase 0 Acceptance Traceability

Status is based on current working-tree evidence; Closure is not final until
this table, the final report and the Handoff are committed together.

| Acceptance ID | Requirement | Code/evidence | Test/command | Status |
|---|---|---|---|---|
| PH0-001 | Entry and Preparation Handoff | `01-entry-assessment.md` | hash and PASS checks | PASS |
| PH0-002 | Explicit migration framework | `platform/postgres.ts` | migration suite | PASS |
| PH0-003 | Clean install | `0001`, `0002` | isolated initdb | PASS |
| PH0-004 | Upgrade/replay path | checksum runner | migration replay | PASS |
| PH0-005 | Workspace scope | composite FKs/repositories | isolation suite | PASS |
| PH0-006 | Project persistence/restart | routes + repository | rebuilt pool/Fastify | PASS |
| PH0-007 | CAS/ETag | project PATCH | stale If-Match test | PASS |
| PH0-008 | API idempotency | scoped key/result | same/different body tests | PASS |
| PH0-009 | Event/Outbox/Audit atomicity | service transaction | rollback/count assertions | PASS |
| PH0-010 | Outbox dispatcher restart/reclaim | claim lease/token | expired claim test | PASS |
| PH0-011 | Inbox deduplication | unique consumer/message | duplicate delivery test | PASS |
| PH0-012 | Projection rebuild boundary | projection consumer | topic/inbox assertions | PASS |
| PH0-013 | ControlPlaneOperation | admin API + worker | create/dispatch/get | PASS |
| PH0-014 | Local Artifact | `ArtifactService` + local provider | atomic/hash test | PASS |
| PH0-015 | MinIO/S3 provider contract | injected provider | MemoryS3 contract test; live MinIO unavailable | PASS-CONTRACT |
| PH0-016 | Corruption detection | provider + DB state | tamper/read test | PASS |
| PH0-017 | Redaction/Secret canary | sensitive guard/dump scan | canary test and repository scan | PASS |
| PH0-018 | Legacy dry-run/backfill | backfill ledger | twice/replay test | PASS |
| PH0-019 | No long-term dual-write | authority register/flags | code and migration review | PASS |
| PH0-020 | Backup/restore | `platform/backup.ts` | real pg_dump/pg_restore | PASS |
| PH0-021 | Health/readiness/metrics | routes/service metrics | unavailable DB + metrics test | PASS |
| PH0-022 | OpenAPI/API tests | OpenAPI + schemas | `validate:openapi`, API suite | PASS |
| PH0-023 | Security isolation | auth/membership/FKs | cross-workspace tests | PASS |
| PH0-024 | Current guide sync | current guide addenda | Markdown validation | PASS |
| PH0-025 | Full regression | all API/Web/workspaces | API 1014/1014, Web 16/16 | PASS |
| PH0-026 | Closure/Handoff | `90`, `91`, this file | final diff and hashes | PASS |
| PH0-GAP-001 | Addendum hashes bound | `01-entry-assessment.md` | SHA-256 recorded | PASS |
| PH0-GAP-002 | Five immutable Project Types | `core.projects` | insert/trigger test | PASS |
| PH0-GAP-003 | ProjectLink/Endpoint binding space | composite FKs/routes | schema/API test | PASS |
| PH0-GAP-004 | Revision/hash uniqueness | reservation table | duplicate constraint test | PASS |
| PH0-GAP-005 | Delayed durable work | operation scheduling columns | column/operation test | PASS |
| PH0-GAP-006 | Cross-workspace lineage rejection | composite FK | rejected insert test | PASS |
| PH0-GAP-007 | Preparation unchanged/verifiable | restored snapshots | hash/git review | PASS |

The table intentionally does not claim Phase 1/2 planning or execution
acceptance. `PASS-CONTRACT` means the approved optional provider contract is
tested without claiming live MinIO availability.
