# WP8 Authority Transition Register

| Resource | Current read | New read/write | Flag or gate | Backfill/cutover | Rollback and retirement |
|---|---|---|---|---|---|
| Foundation Project | legacy session/doc remains for legacy routes | PostgreSQL `core.projects` for `/api/v1` | `ENVFORGE_POSTGRES_URL`; `postgres-foundation-*` register | deterministic session mapping; new writes PostgreSQL-only | disable new read exposure, preserve rows; retire legacy Phase 10 |
| Endpoint metadata | legacy connection/config | PostgreSQL Endpoint and binding foundation | PostgreSQL route gate | imported/created through foundation service | preserve legacy reader until mapped; Phase 10 |
| Artifact metadata | local Plan metadata | PostgreSQL `artifact.artifacts` | `artifact-store-v2` | new provider publications only; legacy bytes not silently moved | preserve source bytes and records; Phase 10 |
| Artifact bytes | local legacy paths | provider opaque keys | provider configuration | gradual explicit import only | do not delete old bytes during rollback |
| Event/Audit | partial runtime logs | append-only PostgreSQL | foundation transaction | new commands only; backfill emits no events | no destructive rollback; Phase 10 |
| Outbox/Inbox | absent | PostgreSQL authority | worker/projection process | no legacy backfill required | stop consumers; preserve evidence |
| Idempotency | partial apply-specific state | PostgreSQL scoped key/result | `/api/v1` mutations | no replay of historical requests | preserve records through TTL policy |
| Projection | direct legacy read | PostgreSQL project summary | projection consumer | rebuild from Phase 0 events | direct authoritative Project read remains available |

The `platform.authority_transitions` table records the active foundation
cutovers. There is no bounded dual-write exception. The `legacy-read-adapter`
flag permits only explicit old reads and cannot authorize old writes to a new
foundation aggregate.
