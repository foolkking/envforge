# Phase 0 Risk Register

| ID | Severity | Risk | Control | Gate |
|---|---|---|---|---|
| PH0-R-001 | P1 | SQLite/PostgreSQL divergence | PostgreSQL-only new writes; legacy read adapter; reconciliation | authority cutover |
| PH0-R-002 | P1 | migration partial failure/checksum drift | transactional SQL, checksum table, clean/upgrade/replay tests | WP2 |
| PH0-R-003 | P1 | cross-workspace access | membership lookup, workspace-required repositories, composite FKs | WP9 |
| PH0-R-004 | P0 | secret reaches DB/event/log/artifact | shared redaction, forbidden-key validation, canary scan | WP9/WP11 |
| PH0-R-005 | P1 | duplicate outbox/inbox effect | lease claims, stable message ID, inbox uniqueness | WP6/WP11 |
| PH0-R-006 | P1 | artifact false-available or traversal | opaque keys, temp/fsync/rename/head/hash | WP6 |
| PH0-R-007 | P1 | idempotency race or key/body mismatch | transaction and unique scope; request hash conflict | WP4/WP5 |
| PH0-R-008 | P2 | live MinIO unavailable | optional contract-only scope, explicit non-certification | Closure |
| PH0-R-009 | P1 | Phase 1/2 scope creep | migration table allowlist and API inventory | every commit |
| PH0-R-010 | P2 | PostgreSQL/toolchain CI drift | isolated cluster script and exact versions in evidence | WP11 |
