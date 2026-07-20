---
id: EF-ROAD-002
title: 当前到目标差距矩阵
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
- engineering
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-003, ADR-004, ADR-008, ADR-013, ADR-014, ADR-015, ADR-016]
source_of_truth_for:
- current target gap matrix
---


# 当前到目标差距矩阵

| Target authority | Current authority / exact evidence | Strategy | Compatibility / flag / backfill | Cutover and rollback gate | Retirement |
|---|---|---|---|---|---|
| `EnvironmentProject` | `runtime-store.ts:StoredMigrationSession`; `/api/migration/sessions*`; SQLite `system_kv` | ADAPT then REPLACE | import session/connection ownership into Project/Endpoint with legacy IDs and source hash; legacy API adapter; new-project write flag | row/count/hash reconciliation; rollback restores legacy reads without deleting new rows | Phase 10 or earlier after usage=0 |
| `EnvironmentSnapshot` | `runtime-store.ts:StoredProbeSnapshot`; collector status/error/completeness; connection snapshot files | ADAPT | import only finalized snapshots; failed collection remains CollectionRun; preserve section/evidence hashes | dual-read comparison for completeness and redaction; no long dual-write | Phase 4 |
| `WorkloadCandidate` | derived `inventory-graph.ts:ServiceStack` and migration assessment/review items | REPLACE | legacy importer creates candidates, never confirmed Workload; evidence assignment retained | candidate counts/assignment/confidence reviewed; rollback uses read-only ServiceStack view | Phase 4/10 |
| `WorkloadBlueprintRevision` | PostgreSQL `workload.workloads`, placements and immutable Blueprint revisions; legacy ServiceStack remains evidence | IMPLEMENTED Phase 1 | manual and reviewed legacy-import drafts only; no auto-confirm | compiler/readiness/immutability and Secret tests | Phase 1 authority; legacy views retire Phase 10 |
| `DecisionSetRevision` | PostgreSQL immutable `planning.decision_set_revisions`; legacy decision arrays remain read-only inputs | IMPLEMENTED Phase 1 | new revisions only; hard blockers cannot be accepted | concurrent revision and hash-bound compiler tests | Phase 1 authority; legacy writes retire Phase 10 |
| `PlanRevision` | PostgreSQL canonical Plan/DAG/Contracts with exact bindings; legacy EnvironmentPlan remains separate execution-era compatibility data | IMPLEMENTED Phase 1 | legacy Plans are historical artifacts and must be recompiled | deterministic 100-repeat, crash-safe transaction, drift tests | Phase 1 planning authority; Phase 2 consumes only approved fixtures |
| `PlanApproval` | PostgreSQL standalone exact-hash approval with separation of duties | IMPLEMENTED Phase 1 | old approval is never migrated as valid | exact hash, replay, CAS, risk and no-Run tests | Phase 1 authority |
| `ExecutionRun` | `StoredApplyRun`, `ActionRunRecord`; synchronous `/api/plans/:id/apply`; process-local queue | REPLACE | API adapter creates durable Run and returns 202; no status dual-write except bounded comparison | worker lease/fencing/crash matrix, active-run handoff, legacy Apply permanently 410 | Phase 2/3/10 |
| `ActionRun` + `ActionAttempt` | `action-runs.ts:ActionRunRecord` combines logical action and attempt evidence | ADAPT | split stable logical action from retried attempts, retain source evidence ID | attempt/reconciliation parity and no duplicate effects | Phase 2 |
| `VerificationResult` / verification Run | latest Plan verify result arrays and command checks | REPLACE | import historical results as legacy evidence only; required verification enters DAG | commit gate and business verification prove authority | Phase 2/3 |
| rollback `ExecutionRun` | latest Plan rollback result arrays | REPLACE | historical result is evidence, not a fabricated independent run | independent Run/Plan/hash/before-state and crash tests | Phase 2/3 |
| `ArtifactRecord` | `artifact-store.ts` local SHA-256 Plan bytes + Plan metadata | ADAPT | provider import verifies content hash and preserves legacy ref; ADR-016 local provider flag | provider head/hash, corruption/interruption, reference reconciliation | Phase 0/10 |
| `SecretProviderBinding` / delivery | Snapshot `SecretRef`, encrypted current credentials, redaction | NEW | migrate only provider references/fingerprints; never backfill plaintext | canary, JIT resolve, cleanup, rotation/revoke tests | Phase 3 |
| `DatasetMigrationRun` / `TransferSession` | NOT FOUND; PostgreSQL code is intent/dry-run evidence only | NEW | no fake backfill; decisions may seed draft strategy but cannot claim execution | live disposable data transfer, consistency, checkpoint/resume and verify | Phase 5 |
| `CutoverRun` | NOT FOUND | NEW | none | single-writer, drain/final sync/traffic/observation/commit/rollback evidence | Phase 6 |
| `ArchiveVersion` | local short-lived Plan artifact only | NEW | no current artifact is promoted to Archive without manifest/encryption/replica/scrub | Golden Preserve & Restore, import after control-plane loss | Phase 7/8 |
| `RestoreDrillRun` | NOT FOUND | NEW | none | isolated business drill bound to exact ArchiveVersion/manifest/plan hashes | Phase 8 |

All authority transitions require usage telemetry, explicit deletion conditions, and a bounded rollback window. Long-term dual writes are forbidden. Phase 10 is the default final legacy-retirement gate, not permission to leave two authorities indefinitely.
