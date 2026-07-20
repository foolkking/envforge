# Phase 0 Evidence Index

Evidence is grouped by acceptance concern. `.tmp_logs/` contains ephemeral
local command logs and is intentionally not committed; this index records the
exact commands and summarized results needed to replay them.

| Area | Evidence | Primary command |
|---|---|---|
| baseline | `../01-entry-assessment.md`, `tests/baseline-test-report.md` | `npm run typecheck`, `npm run build`, `npm run test --workspace @fool/api`, `npm run smoke:web` |
| database | `database/migration-validation.md` | isolated `initdb`/`pg_ctl`, `PlatformDatabase.migrate()` |
| API | `api/current-api-inventory.json` | OpenAPI validation and platform integration suite |
| Artifact | `artifact/provider-validation.md` | platform integration suite |
| Outbox/Inbox | `outbox-inbox/dispatcher-validation.md` | `dispatchOnce()` integration tests |
| security | `security/secret-isolation.md` | canary and workspace isolation tests |
| failure | `failure-injection/failure-matrix.md` | disposable failure tests |
| performance | `performance/baseline.md` | platform performance subtest |
| hashes | `hashes/sha256-manifest.txt` | `Get-FileHash -Algorithm SHA256` |

The Phase 0 integration test owns its PostgreSQL cluster, runtime-store path,
Artifact root and tokens under a temporary directory. No runtime database,
credential, or full raw environment dump is evidence.
