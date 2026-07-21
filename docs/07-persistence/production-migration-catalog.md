---
id: EF-PERSISTENCE-MIGRATION-CATALOG-001
title: Production Migration Catalog
version: '1.1'
status: implemented
classification: normative
owners: [engineering, operations]
last_reviewed: '2026-07-20'
related_adrs: [ADR-003, ADR-015]
source_of_truth_for: [production PostgreSQL migration inventory]
---

# Production Migration Catalog

Production schema authority is the reviewed SQL under
`apps/api/migrations/postgres/`. The SQL under `docs/07-persistence/ddl/` is a
reference design input and is not executed by the runtime.

| Version | File | SHA-256 | Transactional | Purpose | Repair policy |
|---|---|---|---|---|---|
| 0001 | `0001_phase0_foundation.sql` | `6bcc56a7b32b0bf0ecc140726b11f57a69321fc9bef7e5573570ff167a1fb626` | yes | Workspace, Project/Endpoint/lineage reservations, delayed operations, Artifact, Event/Audit/Outbox/Inbox, idempotency and projection foundation | forward repair; never edit an applied file |
| 0002 | `0002_phase0_operations.sql` | `6972518024426f188fb9b4bda194f6dc4e7763a5732aae1b2579232699978313` | yes | Feature flags, authority transition register, legacy backfill ledger and immutable Project Type | forward repair; never edit an applied file |
| 0003 | `0003_phase1_domain_planning.sql` | `8b826ab37c750e1900231154335ed32632a54aa881cd3cb6fb91301e306235aa` | yes | Mode-specific Project lifecycle, Workload/Placement, immutable Blueprint and Decision revisions, MigrationEstimate, deterministic Plan/DAG/Contracts and exact-hash Approval | forward repair; preserve immutable revisions and never promote legacy approvals |
| 0004 | `0004_phase2_durable_execution.sql` | `22a8538b5dd7e86ada0a8e17dde5a964b4a5d2dbc6219dde1b4b0fbf901dc16a` | yes | Durable Run, queue, leases/fencing, checkpoints, reconciliation, verification/commit, rollback relation, schedules and attention state | forward repair; never rewrite Run evidence or an applied migration |

The runner stores checksums in `platform.schema_migrations`, applies each new
file in its own transaction, rejects checksum drift, and leaves no version row
or partial schema when a migration fails. Local destructive down migration is
not a production recovery mechanism. Restore a verified backup or ship a
reviewed forward migration.

```bash
ENVFORGE_POSTGRES_URL=<postgres-url> npm run db:migrate:phase0
```

The Phase 0 validation target is PostgreSQL 17.10. This is a tested target, not
the final product support commitment.
