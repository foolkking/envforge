# Phase 1 Design Delta

| ID | Classification | Difference | Decision | Status |
|---|---|---|---|---|
| PH1-DD-001 | implementation-detail | Reference `phase-1-domain.sql` includes Phase 4 collection/candidate tables | Production migration contains only Phase 1 objects | accepted |
| PH1-DD-002 | implementation-detail | Reference DDL assumes Project current-pointer columns absent from Phase 0 production schema | Add scoped nullable pointers and mode status in Phase 1 migration | accepted |
| PH1-DD-003 | implementation-detail | Legacy EnvironmentPlan includes Run statuses and mutable execution evidence | Preserve as historical/compatibility data; new PlanRevision is separate | accepted |
| PH1-DD-004 | implementation-detail | Phase 0 generic Project status cannot enforce five mode lifecycles | Add explicit mode state validation in domain/service and DB transition guard | accepted |
| PH1-DD-005 | implementation-detail | Phase 0 dispatcher handles only foundation operations | Extend dispatcher with deterministic plan-compilation topic without Action execution | accepted |
