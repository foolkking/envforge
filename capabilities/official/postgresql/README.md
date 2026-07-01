# official.postgresql

PostgreSQL is an official EnvForge capability example for a stateful database.

## Scope

- discover service, port, config path, and data-directory existence metadata
- classify PostgreSQL as a stateful database Service Stack
- require data migration strategy review before Plan generation
- recommend pg_dump and pg_restore for logical migration
- expose physical backup as an alternative when an operator chooses it
- allow record-only or manual follow-up when backup freshness is unknown
- verify with a target connectivity check after restore when a reviewed Plan
  includes a restore action

## Safety boundary

PostgreSQL applier behavior must execute only as reviewed actions in an
approved immutable Environment Plan through Managed Execution. User decisions
can influence Plan draft generation, but they do not approve a Plan and do not
create Apply Runs.

## Required gates

- data-migration-strategy-confirm
- backup-freshness-confirm
- version-compatibility-confirm
- secret-handling-confirm
- manual-follow-up-confirm

## Risks

- direct file copy may corrupt data if PostgreSQL is running
- version mismatch can break restore
- data volume size may be unknown
- backup freshness may be unknown
- database credentials must be redacted

## Rollback boundary

Rollback is manual in this baseline. EnvForge records the chosen strategy,
artifact hashes, and verification evidence, but it does not claim automatic
database rollback without a separate production-certified live lab.

