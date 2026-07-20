# Current Domain Audit

- `EnvironmentPlan`: SQLite/document authority with immutable hash but a mixed
  Plan/Apply/Verify/Rollback status envelope. It is not the target PlanRevision.
- `ServiceStack`: derived inventory aggregation and useful legacy evidence; it
  is not a stable Workload identity.
- `InventoryGraph`: read-only evidence graph feeding current migration analysis.
- `StoredMigrationSession`: SQLite/runtime document workflow, not a Project
  aggregate.
- `ApplyRun` and `ActionRunRecord`: legacy execution evidence and explicitly out
  of Phase 1 scope.
- Phase 0 `core.projects`: minimal PostgreSQL envelope with immutable type but a
  generic status set and no planning pointers.

The safe authority transition is new PostgreSQL planning writes plus bounded
legacy reads/import proposals. No old Approval remains valid.
