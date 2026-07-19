
# Current Repository Inventory

Verified against `a0a9a69cefc0888c32e9fb2ef3f5ca5416a4a254`. Classification: `informative-current-implementation`; target architecture authority: false.

| Area | Current fact | Evidence |
|---|---|---|
| Layout | npm workspaces monorepo | root `package.json` |
| Workspaces | `apps/api`, `apps/web`, `packages/core`, `packages/collectors`, `packages/restorers`, `packages/cli` | workspace list |
| API | Fastify 4; one 6,555-line route registry with 228 registrations | `apps/api/src/server.ts`, `apps/api/src/routes.ts` |
| Web | React 18 + Vite; route state in `apps/web/src/main.tsx` | `apps/web/package.json` |
| Current persistence | SQLite tables plus a JSON runtime document in `system_kv`; local files for snapshots/artifacts | `db-sqlite.ts`, `db-store.ts`, `runtime-store.ts` |
| Current execution | HTTP-bound Environment Plan apply plus legacy process-local task queue | `routes.ts`, `plan-store.ts`, `executor.ts`, `task-queue.ts` |
| External action | agentless SSH through structured modules/managed adapters; direct legacy playbook routes disabled | collectors/restorers/API tests |
| CI | GitHub Actions build/typecheck/preflight/catalog audit only at entry | `.github/workflows/ci.yml` |
| Deployment | Dockerfile/compose files exist, but Docker is unavailable in this audit environment | repository and tool probe |

No independent durable worker entrypoint, PostgreSQL production authority, object-store runtime, Dataset engine, Secret delivery provider, Cutover state machine, or Archive service exists in current production code. Those are target-design objects.
