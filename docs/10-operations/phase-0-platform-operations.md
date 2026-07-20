---
id: EF-OPS-PHASE0-001
title: Phase 0 Platform Operations
version: '1.1'
status: implemented
classification: informative-current-implementation
owners: [operations, engineering]
last_reviewed: '2026-07-20'
related_adrs: [ADR-003, ADR-009, ADR-015, ADR-016]
source_of_truth_for: [current Phase 0 platform operations]
current_implementation_as_of: '2026-07-20'
verified_against_commit: phase-0-working-tree
target_architecture_authority: false
retirement_phase: phase-10
---

# Phase 0 Platform Operations

Phase 0 adds an opt-in PostgreSQL foundation beside the legacy SQLite runtime.
Setting `ENVFORGE_POSTGRES_URL` enables migration and `/api/v1` foundation
routes. New foundation writes are PostgreSQL-only. Legacy runtime resources are
not silently dual-written.

## Processes

```bash
npm run db:migrate:phase0
npm run start:prod
npm run start:platform-worker
npm run start:platform-projection
```

API owns HTTP and short database transactions. The operation worker consumes
only `foundation.operation.requested`; projection consumes Project and Endpoint
topics. Neither is a Phase 2 Execution worker and neither can run SSH or Plan
actions.

## Health and Inspection

- `GET /api/v1/health/live` proves only process liveness.
- `GET /api/v1/health/ready` requires PostgreSQL and migration metadata.
- `GET /api/v1/platform/metrics` is admin-only and workspace-scoped.
- Inspect `platform.schema_migrations`, `audit.outbox_messages`,
  `audit.outbox_attempts`, and `audit.inbox_messages` for repair.
- Investigate dead-letter evidence before a reviewed requeue. Do not delete
  evidence rows to make a queue appear healthy.

## Legacy Backfill

```bash
npm run migration:phase0:dry-run
ENVFORGE_POSTGRES_URL=<postgres-url> npm run migration:phase0:apply
```

Back up SQLite/runtime data first. Dry-run maps deterministically and records
rejected reasons without PostgreSQL writes. Apply stores source hashes and
target IDs in `platform.legacy_backfill_items`; replay reconciles to the same
target and emits no external side effects.

## Backup and Restore

```bash
ENVFORGE_POSTGRES_URL=<postgres-url> ENVFORGE_BACKUP_PATH=<path> npm run backup:postgres:phase0
ENVFORGE_POSTGRES_URL=<disposable-restore-url> ENVFORGE_BACKUP_PATH=<path> npm run restore:postgres:phase0
```

Restore is deliberately restricted to database names containing
`envforge_phase0_restore`. The acceptance test executes real `pg_dump` and
`pg_restore`, checks restored rows, and replays migration checksums. Production
retention, encrypted backup storage, and credential rotation remain deployment
responsibilities.

## Artifact and Failure Recovery

- Publication is `pending -> available` only after head, length, and SHA-256
  agree. Hash mismatch marks `corrupt`.
- Deletion is `deletion-pending -> deleted`; never edit an object key or state
  by hand.
- Database outage fails readiness closed.
- An expired Outbox claim is reclaimable; Inbox identity deduplicates replay.
- Unsupported schema versions retry and then dead-letter.
- Projection gaps fail rather than silently skipping a version.
- Local partial writes and S3 staging objects are removed before publication.
- SIGTERM/SIGINT stops polling and closes the database pool after the current
  batch.
