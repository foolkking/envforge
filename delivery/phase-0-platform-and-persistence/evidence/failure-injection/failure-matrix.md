# Failure Injection Evidence

| Injection | Result |
|---|---|
| migration SQL failure | transaction rolls back; no table/version row |
| PostgreSQL unavailable | `health()` returns `{ok:false}`; readiness is designed to return 503 |
| duplicate idempotent API request | one Project/result is returned; different body returns 409 |
| stale If-Match | 412 and no mutation |
| expired Outbox claim | reclaim succeeds |
| duplicate delivery | one Inbox completion/result |
| unsupported event schema | retry/dead-letter; no projection completion |
| projection version gap | processing fails rather than silently skipping |
| local Artifact corruption | read fails and DB state becomes `corrupt` |
| S3 staging verification failure path | provider deletes staging object before failure |
| interrupted/backfill replay | deterministic mapping ledger is idempotent and emits no side effect |
| API/app pool restart | persisted Project is read by a new pool and Fastify instance |

All injections use disposable data. No production host, external server, or
user database was targeted.
