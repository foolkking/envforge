# WP1 Design Decisions and Invariants

## Accepted inputs

- ADR-003: PostgreSQL authoritative state.
- ADR-014: local account baseline with optional OIDC and high-risk controls.
- ADR-015: reviewed explicit SQL migration authority; no ORM auto-sync.
- ADR-016: atomic local Artifact provider and production-sensitive encryption
  boundary.

## Phase decisions

| Decision | Outcome |
|---|---|
| PostgreSQL target | PostgreSQL 17.10 disposable validation target; final support range deferred |
| Migration identity | zero-padded version prefix plus immutable SHA-256 checksum |
| Recovery | transactional migration, forward repair, verified backup restore; no automatic destructive down |
| Foundation authority | new Phase 0 resources write PostgreSQL only; no dual-write |
| Workspace | actor membership plus workspace-scoped repositories and composite FKs |
| Project types | immutable `assessment`, `build`, `migration`, `capture`, `restore` |
| Lineage | same-workspace `derived-from`, `restores-archive`, `retries`, `repairs` |
| Delayed work | durable `available_at`, schedule/dedup identity, cancel/revoke fields and attempt history |
| Control operation | admin-only deterministic hash verification; never an ExecutionRun |
| S3 | injected contract implementation; no live MinIO claim without Docker/MinIO |

## Invariants verified

Production SQL enforces workspace-aware Project/Endpoint/lineage references,
immutable Project Type, revision/hash uniqueness, append-only Event/Audit rows,
Outbox claims, Inbox deduplication, and Artifact states. Tests prove transaction
rollback, checksum replay, cross-workspace rejection, idempotency/CAS, Secret
field rejection, and provider hash checks.
