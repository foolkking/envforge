# Phase 0 Defect Register

| ID | Severity | Finding | Resolution | Status |
|---|---|---|---|---|
| PH0-DEF-001 | P1 | Reference DDL lacked accepted Outbox claim and delayed-work fields | production migrations implement accepted leaf/addendum behavior; catalog documents divergence | CLOSED |
| PH0-DEF-002 | P1 | Initial Artifact provider was not bound to ArtifactRecord lifecycle | added pending/reconcile/available/corrupt/deletion transitions and tests | CLOSED |
| PH0-DEF-003 | P1 | Safe ControlPlaneOperation existed only at service level | added admin-only workspace-scoped API and OpenAPI contract | CLOSED |
| PH0-DEF-004 | P2 | `npm test -- ...pattern` appends filter after the test directory | current harness guide records exact equivalent Node command | CLOSED-DOCUMENTED |
| PH0-DEF-005 | P2 | Docker/MinIO unavailable in the validation environment | approved optional contract test; live claim explicitly prohibited | DEFERRED-PHASE-9 |

Open P0/P1 defects: none.
