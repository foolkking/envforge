
# Current Web Inventory

Verified paths: `apps/web/src/main.tsx`, `lib/nav.ts`, `components/PipelineBar.tsx`, `components/ui/`, modular styles, and zh/en locale resources all exist.

The app has Dashboard, Migrate, Build, Plans, and admin Capability surfaces. Reports deep-link into the Plans center. Migrate persists a `StoredMigrationSession`, presents assessment/review/config-data/target/dry-run/plan/apply/report steps, and promotes into the Environment Plan center for real Apply. Build consumes certified catalog items and creates a rebuild Environment Plan. There is no current Archive/Restore product workflow implementing the target contract.

The 16-test Playwright smoke uses mocked API responses. It proves route rendering across four viewport/locale/theme projects and assessment/review copy; it does not prove a live Build, migration, SSH Apply, Dataset transfer, Cutover, or Archive/Restore flow.
