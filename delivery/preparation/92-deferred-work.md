# Preparation Deferred Work

| ID | Work | Reason deferred | Target phase | Exit gate |
|---|---|---|---|---|
| PREP-D-001 | Replace process-local SQLite execution authority with durable PostgreSQL Run/lease/fencing | Product runtime implementation is Phase 0-2 scope | Phase 0-2 | Durable execution acceptance |
| PREP-D-002 | Dataset migration, Secret Delivery, Cutover, Archive, Restore Drill | Explicit Preparation non-goals | Phase 5-8 | Respective phase exit criteria |
| PREP-D-003 | Retire legacy `/api` route registry and current guides | Requires compatibility telemetry and Phase 10 retirement gate | Phase 10 | No active references and rollback window closed |
| PREP-D-004 | CI cache/performance optimization | Current validation is acceptable; optimization is non-blocking | Phase 0 | CI duration budget |

No P0 or P1 work remains open. P2/P3 debt does not unlock product functionality
and must not be described as implemented by Preparation.
