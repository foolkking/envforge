# WP8 Authority Transition Register

| Resource | New write/read authority | Legacy handling | Retirement |
|---|---|---|---|
| Workload/Blueprint | PostgreSQL `workload.*` | ServiceStack review proposal only | Phase 10 |
| DecisionSet | PostgreSQL `planning.decision_set_revisions` | legacy decisions read-only | Phase 10 |
| Plan | PostgreSQL immutable `planning.plan_revisions` | legacy EnvironmentPlan historical/read adapter | Phase 10 |
| Approval | PostgreSQL exact-hash approval | old approval always invalid | Phase 1/10 |

No dual write is implemented.
