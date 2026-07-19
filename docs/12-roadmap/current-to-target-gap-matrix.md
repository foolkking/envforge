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
| `WorkloadBlueprintRevision` | NOT FOUND | NEW | no backfill may invent a blueprint; user review/manual import creates revision | compiler/readiness tests before authority | Phase 1 authority |
| `DecisionSetRevision` | `StoredMigrationDecision`/config/data decision arrays | ADAPT | canonical immutable revision with source IDs/hash; legacy mutation adapter creates successor | compare decision semantics and plan input binding | Phase 1/10 |
| `PlanRevision` | `environment-plan.ts:EnvironmentPlan`; `StoredEnvironmentPlan.payload`; hash/artifact/approval tests | ADAPT then REPLACE | legacy-import origin, exact Plan/hash/artifact binding, capability limitation marker; compiler flag | new Plan is sole write; approval/hash parity; old Apply disabled only after Golden Build | Phase 1/3/10 |
| `PlanApproval` | `PlanApprovalRecord` embedded in stored Plan; `plan-store.ts` | EXTRACT | backfill only when actor/time/hash/gates are complete; otherwise expired/unapproved | approval and plan-hash tests, reauth policy; rollback keeps new approval audit immutable | Phase 1 |
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
