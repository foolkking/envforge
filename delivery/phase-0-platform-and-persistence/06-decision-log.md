# Phase 0 Decision Log

| ID | Decision | Basis | Reversible |
|---|---|---|---|
| PH0-DEC-001 | Use `pg` with reviewed SQL files and a small runner | ADR-015; no ORM exists | yes |
| PH0-DEC-002 | PostgreSQL 17 is validation target; minimum SQL remains PostgreSQL 16 compatible | local tooling and Preparation baseline | yes |
| PH0-DEC-003 | Foundation API is additive `/api/v1`; legacy `/api` remains unchanged | compatibility and no broad route split | yes |
| PH0-DEC-004 | User workspace comes from PostgreSQL membership, with personal bootstrap only for authenticated actors | workspace isolation invariant | yes |
| PH0-DEC-005 | Outbox dispatcher is a foundation process, not an ExecutionRun worker | ADR-011 and Phase boundary | no semantic conflation |
| PH0-DEC-006 | S3 provider uses an injected client contract; live MinIO is deferred until an environment exists | Entry optionality | yes |
| PH0-DEC-007 | External Prompt body is not stored | accepted pre-Phase-0 policy | no |
