# Phase 0 Implementation Plan

1. Add `pg` and an explicit SQL migration runner with checksum/version metadata.
2. Create production migration `0001` for workspace, project/endpoint/link,
   delayed control operations, artifact metadata, domain event, audit, outbox,
   inbox, idempotency, and projection foundation only.
3. Add UUIDv7, canonical JSON/hash, redaction, PostgreSQL transaction, and
   workspace-scoped repository primitives.
4. Implement project create/list/get/update with atomic event/outbox/audit and
   idempotency/CAS; expose the approved `/api/v1` subset behind PostgreSQL config.
5. Add separate dispatcher and projection process entrypoints plus a safe
   hash-verification ControlPlaneOperation.
6. Add Local Artifact atomic publish/read/head/delete/corruption handling and an
   injected S3-compatible provider contract without live credentials.
7. Add deterministic SQLite foundation backfill dry-run/apply/reconciliation and
   backup/restore operational commands.
8. Run disposable PostgreSQL clean/upgrade/replay, API restart, failure,
   workspace isolation, artifact, redaction, and regression tests.
9. Synchronize OpenAPI, persistence/current guides, acceptance evidence, Closure,
   and Handoff. Commit by reviewable subsystem; do not push without authorization.

Stop on a secret leak, cross-workspace access, migration checksum drift, data
loss, long-term dual-write, or any requirement to implement Phase 1/2 objects.
