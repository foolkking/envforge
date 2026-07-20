# Phase 1 Implementation Plan

## Current Facts

Phase 0 provides explicit PostgreSQL migrations, transaction helpers,
workspace-scoped foundation resources, idempotency/CAS, append-only Event/Audit,
Outbox/Inbox, and independent worker/projection entrypoints. Legacy
`EnvironmentPlan` remains coupled to Apply/Verify/Report in SQLite and cannot be
promoted into the new planning authority.

## Sequence

1. Add a scoped Phase 1 production migration. Do not apply Phase 4 Candidate
   tables from the reference DDL.
2. Implement typed Project lifecycle, ProjectLink, WorkloadPlacement,
   Blueprint contracts/revisions/readiness, Decision revisions, migration
   estimates, deterministic compiler, Plan DAG, drift checks, and Approval.
3. Add planning services whose aggregate writes, event, outbox, audit, and
   idempotency state commit atomically.
4. Add `/api/v1` planning routes and a compiler worker path. Keep Run creation
   locked and produce no remote side effect.
5. Add a minimal Project-centered Web planning workflow using localized copy.
6. Add clean/upgrade/concurrency/determinism/property/security/failure tests and
   a legacy dry-run mapping that never promotes old approvals.
7. Synchronize machine contracts, current-state docs, operations, and evidence.
8. Run stabilization, commit atomically, push only the delivery branch, and wait
   for exact-HEAD GitHub CI.

## Stop Conditions

Stop for mutable confirmed content, nondeterministic Plan hashes, cross-workspace
access, secret leakage, partial Plan persistence, any Run/SSH side effect,
long-term dual write, or a required CI gate that cannot be satisfied.
