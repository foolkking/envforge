# Phase 0 Deferred Work

| ID | Severity | Deferred item | Owner | Target | Due gate | Workaround |
|---|---|---|---|---|---|---|
| PH0-DW-001 | P2 | Live MinIO integration, timeout and multipart certification | platform | Phase 9 | production artifact certification | injected S3-compatible contract; no live claim |
| PH0-DW-002 | P2 | PostgreSQL minimum supported version matrix | platform/ops | Phase 9 | production support matrix | PostgreSQL 17.10 is the recorded validation target |
| PH0-DW-003 | P2 | 100 MiB Artifact capacity run and final SLOs | performance | Phase 9 | production capacity gate | 1 MiB local baseline only; no SLO claim |
| PH0-DW-004 | P2 | UI consumption of Foundation Project APIs | web | Phase 1 | Phase 1 experience gate | Phase 0 is internal; no misleading UI added |
| PH0-DW-005 | P2 | Durable Execution queue, WorkerLease, fencing and checkpoints | execution | Phase 2 | Phase 2 acceptance | Phase 0 worker handles only safe control operations |

Dataset, Secret Delivery, Cutover, Archive, Restore, RLS enablement, HA, and
full legacy retirement remain their normative roadmap phases, not Phase 0 debt.
