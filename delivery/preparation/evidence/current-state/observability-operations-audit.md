# Current Observability and Operations Audit

| Area | Current state | Gap |
|---|---|---|
| Logs | Fastify structured logger and action/task output with redaction | no target run/event correlation across durable worker |
| Metrics | no production metrics subsystem found | target SLI/SLO/alerts not implemented |
| Tracing | no distributed tracing found | target API/worker/provider trace absent |
| Health/readiness | `/api/health` and `/api/ready` routes | readiness does not represent all target dependencies |
| Background work | process-local task queue/scheduler/background tables | no durable lease/fencing worker |
| Run inspection | Plan/Apply/action evidence and support bundle | no target ExecutionRun timeline/reconciliation admin surface |
| Repair | diagnostic/draft repair helpers | no general repair coordinator |
| Backup | legacy SQLite backup command | no target PostgreSQL + Artifact control-plane recovery drill |
| Support bundle | assessment/graph/Plan/action evidence with redaction tests | not immutable ReportArtifact; target workspace controls pending |

Preparation adds observable validation tooling but does not implement product metrics, tracing, worker repair, or backup/restore.
