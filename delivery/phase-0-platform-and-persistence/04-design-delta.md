# Phase 0 Design Delta

| ID | Current fact | Target | Classification | Decision |
|---|---|---|---|---|
| PH0-D-001 | SQLite/document runtime remains current authority | PostgreSQL authority for new foundation resources | implementation-detail | additive PostgreSQL module and feature gate; no dual-write |
| PH0-D-002 | Reference DDL lacks rich outbox claims and delayed work | production migration must include accepted lease/state fields | implementation-detail | production SQL extends reference DDL |
| PH0-D-003 | Reference link types omit `retries` and `repairs` | addendum requires lineage space | design defect correction | production SQL uses accepted four link types |
| PH0-D-004 | No workspace membership model in current auth | repository/API must resolve trusted workspace | implementation-detail | PostgreSQL actor membership, never body-only workspace trust |
| PH0-D-005 | No Docker/MinIO locally | S3 contract is optional at Entry | implementation-detail | injected-client contract test; no live certification claim |
| PH0-D-006 | Prompt requests saving its body | accepted external-prompt policy forbids repository copy | implementation-detail | record prompt identity/hash only |
