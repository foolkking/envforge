# PROJECT_STATE

AI-readable current-state snapshot. Read this before changing the repo, then read
`AGENTS.md` for working rules. Human entry point: `README.md`. Last updated:
2026-06-11.

## Product snapshot

EnvForge is a Linux environment migration and rebuild platform. It connects to a
source host over SSH, collects read-only evidence, classifies the real migration
intent, and produces a reviewable Environment Plan for rebuilding or maintaining
the target environment.

Hard invariant:

```text
Capability / Evidence -> Environment Plan -> Review -> Apply -> Verify -> Rollback / Report
```

Direct install, direct uninstall, and unreviewed remote editing are not product
level actions.

## Stack

| Layer | Current state |
|---|---|
| Package manager | npm workspaces, `package-lock.json` |
| Frontend | `apps/web`, React 18, TypeScript, Vite |
| Backend | `apps/api`, Fastify, TypeScript, ssh2 |
| Packages | `packages/core`, `collectors`, `restorers`, `cli` |
| Storage | SQLite hybrid document/relational persistence |
| Runtime | Node >= 20, npm >= 10 |

## Main commands

| Task | Command |
|---|---|
| Build all | `npm run build` |
| Build server | `npm run build:server` |
| Typecheck all | `npm run typecheck` |
| Typecheck web | `cd apps/web && npx tsc --noEmit` |
| API tests | `npm run test --workspace @fool/api` |
| Web dev | `npm run dev:web` |
| API dev | `npm run dev:api` |
| Catalog certification | `npm run certification:check` |
| Harness scenarios | `npm run harness:scenarios` |

## Current durable docs

The documentation set was consolidated on 2026-06-11. Durable human-maintained
docs are intentionally few:

| File | Purpose |
|---|---|
| `README.md` | Human entry point |
| `AGENTS.md` | Agent working rules |
| `PROJECT_STATE.md` | Current repository snapshot |
| `docs/index.md` | Documentation map |
| `docs/product.md` | Product scope, IA, roadmap |
| `docs/system-design.md` | Architecture, migration engine, execution, config/security |
| `docs/catalog.md` | Catalog schema, certification, authoring, quality gate |
| `docs/web-ui.md` | Web IA, UI patterns, design-system rules |
| `docs/operations.md` | Deploy, runtime operations, backups |
| `docs/validation.md` | E2E scenarios, harness, target readiness |
| `docs/decisions.md` | Durable decisions not obvious from code |

Generated certification output lives in `docs/generated/`. Historical/raw notes
live only in `docs/archive/` when they are worth retaining.

## Current web UI refactor state

Active area: `apps/web/src`.

Landed/in working tree:

| Module | State |
|---|---|
| Migrate page placement | `MigratePipelinePage` moved from `components/` to `pages/`, rendered by `MachinePage` |
| Drawers | Build markdown/compose/config overlays converted toward right-side drawers |
| IA | Grouped nav and six-step `PipelineBar` source of truth in `lib/nav.ts` |
| Plans deep link | `navigateApp(page, view)` and Plans `runs` deep link exist |
| Design system | `components/ui/{Button,Card,Badge,StatusPill}.tsx` exists; rollout is partial |
| Governance split | `pages/governance/*` tab files exist |

Known backlog:

1. i18n consolidation: replace inline `locale === "zh" ? ... : ...` with
   dictionaries and fix mojibake comments.
2. CSS split: `apps/web/src/styles.css` still has legacy layer plus refresh layer.
3. Design-system deepening: governance subtabs, `conn-btn-ghost`, structural
   cards, `score-pill`, each with visual review.

## Catalog/certification state

Current generated audit says:

| Metric | Value |
|---|---|
| catalog items | 119 |
| certified | 105 |
| not-ready | 14 |
| open upgrade backlog | 0 |
| terminal decisions | 14 |

Source of truth: `docs/generated/catalog-certification.md` and
`docs/generated/catalog-certification.json`. Re-run `npm run certification:check`
and `npm run certification:backlog` before changing quoted counts.

## Git caveats

- The worktree contains large unrelated UI changes plus runtime artifacts. Do not
  revert user work.
- Do not commit runtime state: `data/envforge.db*`, `data/.master-key`,
  `data/runtime-db*.json*`, `data/backups/`, `data/keys/`, `data/snapshots/`,
  `.env`, logs, or harness output.
- `.gitattributes` now pins text files to LF. Before creating a real commit,
  run `git add --renormalize .` so historical CRLF churn is cleaned separately
  from feature changes.
- If `.git/index.lock` exists, do not run git operations until the lock clears.
