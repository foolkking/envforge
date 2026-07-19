---
id: EF-PREP-DECISION-001
title: EnvForge Preparation Decision Log
version: "1.0"
status: active
phase: preparation
---

# EnvForge Preparation Decision Log

## DEC-PREP-001 — Integrated Baseline Version

- Date: 2026-07-19
- Context: the source ZIP is named v1.1 Integrated but contains accepted additions beyond the repaired v1.1 baseline.
- Options: keep v1.1; call every leaf v1.2; register the integrated package as baseline v1.2 while preserving independent leaf versions.
- Decision: register `EnvForge Integrated Design Baseline v1.2`; supersede ADR-001 through ADR-013; do not bulk-bump leaf document schema versions.
- Reason: uniquely names the adopted package without creating meaningless specification churn.
- Reversibility: superseding ADR only.

## DEC-PREP-002 — OQ-002 Authentication Baseline

- Current evidence: local account, GitHub/Google OAuth, TOTP, bearer session, and admin checks exist; target workspace roles and high-risk reauth are not implemented.
- Option A: local accounts only. Lowest migration cost, weaker enterprise federation and production policy.
- Option B: OIDC only. Strong federation, but blocks offline/local bootstrap and increases Phase 0 operational dependence.
- Option C: local administrator bootstrap plus optional OIDC; production requires MFA policy; high-risk operations require recent reauthentication; app, SSH, and Secret Provider credentials remain separate.
- Decision: Option C; ADR-014.
- Security/testing/operations: supports isolated tests, break-glass bootstrap, federated production, auditable high-risk gates, and reversible provider adoption.
- Phase impact: Phase 0 establishes identity/session foundations; later security phases add full RBAC/ABAC and production policy.

## DEC-PREP-003 — OQ-003 Migration and ORM Policy

- Current evidence: SQLite DDL steps are explicit/checksummed; JSON document migrations run separately; no ORM owns the schema.
- Option A: ORM auto-sync. Fast initial delivery, but unsafe production drift and weak replay evidence.
- Option B: ORM-generated checked-in migrations. Better review, but tool output can become accidental authority.
- Option C: reviewed explicit SQL migrations are schema authority; query builder/ORM may be used only for access and cannot auto-sync production; migrations are transactional where supported, checksummed, replayable, and upgrade-tested.
- Decision: Option C; ADR-015.
- Security/testing/operations: maximizes inspectable constraints and deterministic disposable validation; rollback is forward-fix/down policy per migration rather than hidden ORM behavior.
- Phase impact: Phase 0 converts reference DDL into production migrations; Preparation does not do so.

## DEC-PREP-004 — OQ-004 Artifact Baseline

- Current evidence: Plan artifacts are local content-addressed files with SHA-256, exclusive creation, and restrictive permissions; they lack an interface, fsync publish contract, encryption default, replicas, and archive semantics.
- Option A: database BLOBs. Simple transaction boundary, poor large-object/Archive scalability.
- Option B: raw local paths. Minimal change, but paths become authority and are unsafe for production/archive recovery.
- Option C: a common Artifact Store interface; local development provider uses temp write + fsync + atomic rename + SHA-256; production sensitive artifacts are encrypted by default; metadata stays in PostgreSQL; local storage is never a long-term Archive guarantee.
- Decision: Option C; ADR-016.
- Security/testing/operations: supports corruption/interruption tests and provider replacement without weakening encryption or integrity.
- Phase impact: Phase 0 implements the local provider/interface; Archive replication/scrub remains Phase 7/8.

## DEC-PREP-005 — Generated Output

- Decision: active `docs/` contains no current generated certification/harness output. Current output is temporary, CI Artifact, or under ignored `artifacts/generated/`; historical snapshots remain under `delivery/history/`.
- Reason: generated content cannot be an active authority and stale files must not make tests pass.
- Reversibility: generator paths can change, but classification and stale checks remain binding.
