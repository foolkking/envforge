# Database Validation Evidence

Environment: Windows x64, Node 20.13.1, npm 10.5.2, PostgreSQL client/server
17.10, isolated `initdb` cluster and disposable databases.

Evidence from `platform-foundation.test.ts`:

- clean `0001` + `0002` apply and checksum replay return the same two versions;
- `0003` failure probe rolls back both its table and schema version row;
- all five Project Types persist and Project Type changes are rejected by a
  trigger;
- project links use same-workspace composite foreign keys;
- revision identity reservations enforce revision number and content-hash
  uniqueness;
- delayed operations expose `available_at`, schedule/dedup, cancel/revoke and
  attempt-history columns;
- fresh PostgreSQL pool and a rebuilt Fastify app read the same Project;
- backup restore into a disposable `envforge_phase0_restore` database succeeds.

Migration authority is `apps/api/migrations/postgres/`; Reference DDL is not
executed by the runner. Runtime uses PostgreSQL only when
`ENVFORGE_POSTGRES_URL` is configured; legacy SQLite remains a separate path.
