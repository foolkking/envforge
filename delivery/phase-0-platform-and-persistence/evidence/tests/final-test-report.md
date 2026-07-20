# Phase 0 Final Test Evidence (pre-Closure)

| Check | Command | Result |
|---|---|---|
| Root typecheck | `npm run typecheck` | PASS; all workspaces |
| Root build | `npm run build` | PASS; API/Web bundles built |
| API full run 1 | `npm run test --workspace @fool/api` | PASS 1014/1014, 0 skipped |
| Web smoke | `npm run smoke:web` | PASS 16/16 |
| API Phase 0 targeted | `node --test --test-concurrency=1 --test-name-pattern="Phase 0 platform foundation" apps/api/dist/engine/tests` | PASS 13/13; nonmatching tests skipped by design |
| Markdown | `npm run validate:docs:markdown` | PASS; 225 files, 0 errors |
| OpenAPI | `npm run validate:openapi` | PASS; 103 paths, 107 operations |
| JSON Schema | `npm run validate:schemas` | PASS |

The first full API attempt was `1013/1014` because the new migration rollback
test used a cwd-dependent path under the workspace test script. The test now
uses `resolveFromRoot`; the failure is retained in the evidence narrative and
was followed by a passing full run.
