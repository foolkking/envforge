---
id: EF-PREP-DELTA-001
title: EnvForge Preparation Design Delta
version: "1.0"
status: active
phase: preparation
---

# EnvForge Preparation Design Delta

| ID | Design source | Current implementation | Difference | Classification | Decision / action | Status |
|---|---|---|---|---|---|---|
| DELTA-001 | Integrated package + Preparation prompt | ADR-001 names baseline v1.1 | Integrated experience/governance package must be registered as baseline v1.2 | ADR-required | ADR-013 supersedes ADR-001; leaf document format versions remain 1.1 until changed individually | resolved |
| DELTA-002 | Authentication target | local accounts, GitHub/Google OAuth, TOTP and bearer sessions exist without target workspace RBAC/reauth policy | target baseline decision was open | ADR-required | ADR-014 closes OQ-002 with local bootstrap + optional OIDC, production MFA policy, recent reauth for high risk | resolved |
| DELTA-003 | Persistence target | SQLite DDL + JSON runtime document + post-listen JSON migration | target PostgreSQL migration authority/tool policy was open | ADR-required | ADR-015 closes OQ-003: explicit SQL migrations own schema; no ORM auto-sync | resolved |
| DELTA-004 | Artifact target | local content-addressed Plan artifact path with SHA-256 and restrictive mode; no object store/encryption contract | local/production artifact defaults incomplete | ADR-required | ADR-016 closes OQ-004: atomic local provider, production sensitive encryption, provider interface | resolved |
| DELTA-005 | Generated artifact policy | scripts and one test addressed `docs/generated` | active docs could be recreated and API baseline failed after migration | implementation-detail | move generator output to temp/`artifacts/generated`; test generator in isolated temp path | resolved |
| DELTA-006 | Current guide metadata contract | current guides used generic metadata | prompt requires exact current-implementation classification/metadata | implementation-detail | update five current guides and validator | resolved |
| DELTA-007 | Target API | OpenAPI 3.1 `/api/v1`, 103 operations | current Fastify legacy `/api` has 228 routes in a monolithic registry | implementation-detail gap | inventory and migration mapping only; no route implementation in Preparation | deferred Phase 0–10 |
| DELTA-008 | Target persistence/domain/execution | PostgreSQL Project/Revision/Run/lease/fencing/outbox model | current SQLite StoredMigrationSession/EnvironmentPlan/ApplyRun and process-bound apply | implementation-detail gap | bind exact symbols and authority transition in gap/migration plans | deferred Phase 0–2 |
| DELTA-009 | Target Dataset/Secret/Cutover/Archive | normative target objects and acceptance exist | no production engines or durable objects exist | implementation-detail gap | record non-implementation; do not prebuild | deferred Phase 5–8 |
| DELTA-010 | Target experience | Assessment-first, Plan/Run separation, trust/recovery UX | current Web partially expresses assessment and Plan center but shares a monolithic app and legacy types | implementation-detail gap | current-guide revalidation and traceability only | deferred Phase 1–10 |
| DELTA-011 | Design CI | machine contracts require lint/render/bundle/schema/DDL checks | CI builds/typechecks/preflights/catalog only | implementation-detail | add pinned documentation/spec validation | resolved |
| DELTA-012 | Reference DDL | reference SQL must execute but must not be production migration | no project PostgreSQL production migration mechanism | implementation-detail | validate in disposable PostgreSQL; retain explicit non-authority label | resolved |

No `design-baseline-change` item is currently required. If machine validation proves a normative contradiction rather than a correctable specification defect, the affected work stops pending approval.
