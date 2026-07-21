# Phase 2 Implementation Plan

1. Add forward-only migration `0004` for exact-bound Runs, Action attempts, durable queue, worker/resource leases, checkpoints, events, reconciliation, verification, commits, reports, scheduled operations, manual actions, and attention records.
2. Add an `execution` module with explicit domain states, transactional service, atomic `SKIP LOCKED` claim, DB-time leases and monotonic fencing.
3. Add a deterministic disposable test adapter with checkpoint/reconcile/verify/rollback and structured manual-action behavior.
4. Add independent worker entrypoint and authenticated workspace-scoped API routes; keep legacy Apply isolated.
5. Add focused PostgreSQL/API/failure-injection coverage, including stale fences, duplicates, unknown outcomes, once-only commit, independent rollback, scheduled deduplication, restart recovery, and cross-workspace denial.
6. Synchronize OpenAPI, accepted execution docs, current guides, PROJECT_STATE, acceptance and handoff.
7. Run full regression, validation, commit, push only the delivery branch, and verify GitHub CI on the exact final HEAD.

Stop for any design change that weakens exact Plan binding, PostgreSQL authority, fencing, verification-before-commit, independent rollback, tenant isolation, or secret safety.

