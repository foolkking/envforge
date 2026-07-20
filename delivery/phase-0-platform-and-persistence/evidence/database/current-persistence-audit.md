# Current Persistence Audit

Current production startup awaits `initializeDatabase()` before route
registration. SQLite uses WAL, foreign keys, busy timeout, checksum migrations
1-5, and a `system_kv` runtime document plus relational subsystem tables. A
process mutex serializes broad runtime document updates. JSON-to-SQLite migration
is transactional and one-time. No PostgreSQL production pool, migration directory,
repository, workspace membership, outbox/inbox foundation, or database-backed CAS
exists at Entry. Local Maps and API-process lifecycle still own execution state.

The existing local Plan artifact implementation verifies SHA-256 and prevents
path traversal but writes directly to the final file and lacks temp/fsync/rename,
metadata authority, provider contract, lifecycle state, and cleanup protocol.
