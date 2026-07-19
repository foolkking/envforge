
# Current Database Inventory

Classification: `informative-current-implementation`; verified against the Preparation initial HEAD.

- Engine: SQLite through `sqlite`/`sqlite3`.
- Bootstrap: `initializeDatabase()` applies five checksum-recorded SQLite DDL steps and creates `system_kv` before production routes are registered.
- Core authority: `system_kv(key='runtime_db')` stores the normalized `RuntimeDatabase` JSON document. Relational tables additionally serve comments, likes, reports, suggestions, inbox, audit logs, queues, and background tasks.
- JSON schema: new runtime documents default to `0.3.0`; post-listen legacy JSON migration code includes a `0.4.0` migration.
- Concurrency: process-local mutex around document read/modify/write; no database CAS for aggregate versions and no multi-process authority.
- Environment Plans and Apply claims: arrays inside the runtime document; Apply idempotency records are persisted, but the execution itself remains HTTP/process bound.
- Indexes/constraints: SQLite DDL contains table-local keys/indexes; it does not implement the target workspace-scoped PostgreSQL model, durable queue leases, resource fencing, outbox/inbox target contract, or immutable revision constraints.
- Backup: `npm run backup:db` exists for the legacy runtime. This is not target control-plane recovery.
- Production migrations: the target `docs/07-persistence/ddl/*.sql` files are reference DDL only and are not registered in the current application.
