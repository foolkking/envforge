# Phase 2 Risk Register

| Risk | Severity | Control |
|---|---|---|
| Duplicate side effect | P1 | Action idempotency key, durable checkpoint, reconciliation, duplicate tests. |
| Split brain/stale write | P1 | DB-time lease, monotonic fencing token, CAS on every worker transition. |
| Unknown outcome | P1 | Explicit unknown state; reconcile before retry or completion. |
| False commit/report | P1 | Required verification and unique immutable commit record. |
| Cross-workspace access | P0 | Workspace-aware foreign keys, service/API context, negative tests. |
| Secret leakage | P0 | Sensitive-key rejection, shared redaction, canary scan. |
| Legacy dual authority | P1 | No migration into queue and new-write isolation. |
| Queue starvation/retry storm | P2 | priority/available-at indexes, bounded attempts, backoff/jitter. |
| Baseline test flake | P2 | repeat full API suite during stabilization and investigate recurrence. |

