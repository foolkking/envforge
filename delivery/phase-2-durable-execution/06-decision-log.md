# Phase 2 Decision Log

- PostgreSQL rows are the sole authority for new Runs, queue, leases and attempts.
- DB `now()` is authoritative for lease and schedule timing.
- The worker adapter contract is closed and versioned; Phase 2 ships only a deterministic sandbox test adapter.
- Verification is represented by Plan actions in the main DAG and is mandatory before commit.
- Rollback creates a separate Run; original Run evidence is immutable.
- Scheduled operations use durable `not_before`, deduplication and revoke state, never in-memory timers.
- Manual actions require structured attestation plus machine verification; unverified acknowledgement blocks progress.

