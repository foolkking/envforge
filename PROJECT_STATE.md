# PROJECT_STATE

AI-readable current-state snapshot. Read this before changing the repo, then read
`AGENTS.md` for working rules. Human entry point: `README.md`. Last updated:
2026-06-30.

## Product snapshot

EnvForge is a Linux environment migration and rebuild platform. It connects to a
source host over SSH, collects read-only evidence, classifies the real migration
intent, and produces a reviewable Environment Plan for rebuilding or maintaining
the target environment.

Productization narrative:

~~~text
EnvForge turns unknown Linux servers into reviewed, reproducible, verifiable migration plans.
EnvForge 把不可控的旧 Linux 服务器，转化为可审查、可重建、可验证、可审计的环境计划。
~~~

Hard invariant:

```text
Capability / Evidence -> Environment Plan -> Review -> Apply -> Verify -> Rollback / Report
```

Direct install, direct uninstall, and unreviewed remote editing are not product
level actions.

Current Productization Focus:

1. First-run Assessment
2. Review Inbox
3. Golden Scenario Lab
4. Failure / Repair Experience
5. Capability SDK
6. Production Team Adoption

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
| `docs/product/README.md` | Productization design map and maturity criteria |
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
| i18n foundation | Static visible copy is consolidated into `i18next` resources across shell/nav/public/onboarding/auth/account, Dashboard, Build/configure-run, Plans/runs/reports/automation, full Migrate/config governance, editors/collaboration, dialogs, and every Capability Admin/Governance tab. Remaining locale checks select bilingual backend entity fields or toggle the active locale. |
| CSS modules | `styles.css` is an 11-import entry; shell/public/Build/Migrate/Plans-Reports/Governance rules live in domain files, with explicit late-legacy and operations-console override files preserving cascade order. |
| Design system | `components/ui/{Button,Card,Badge,StatusPill,FilterPill,MetricPill,TabButton}.tsx` cover action/connection buttons, semantic cards/badges, filters, migration metrics, and governance tabs. Static legacy button classes were migrated through class-equivalent variants. |
| Governance split | `pages/governance/*` tab files exist |
| UI smoke | Playwright covers public, user, and admin routes across zh/en, light/dark, desktop/mobile; the admin smoke also verifies the localized Standards tab and shared tab semantics. |

The 2026-06-29 Web refactor backlog (deep i18n consolidation, CSS domain split,
and design-system deepening for governance tabs, connection buttons,
structural cards, filters, and migration score metrics) is complete in the
current working tree. Browser review covered desktop/mobile, light/dark, public
and admin governance layouts; `npm run smoke:web` passes all 12 projects.

Next candidates are deeper behavioral E2E coverage for apply/verify/rollback
fixtures and route-level JavaScript chunking. They are not blockers for the
completed UI refactor batch.

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

## Trusted Environment Plan execution core

P0 Security Kernel: Complete.

The 2026-06-30 security pass established the target-mutation boundary:

- New Environment Plans are frozen with canonical SHA-256 `planHash` values and
  persisted create-only. Runtime status/results are excluded from the hash;
  actions, risks, conflicts, required approvals, exports, and artifact identity
  are included.
- Review approval records are bound to the exact `planHash`. Apply reloads only
  the URL Plan id, recomputes the hash, requires `approvedPlanHash`, and rejects
  Plan/YAML/action/config payloads and request-time acknowledgements.
- Config changes and imported recipes use content-addressed artifacts. Managed
  Apply verifies artifact bytes before execution and emits a hash-bound
  `ActionRunRecord` for every frozen action, including skipped-after-failure
  actions. Verify, rollback, and reports consume matching run evidence.
- Direct execute/batch/multi-execute, rebuild/remove/config/migration apply,
  config backup restore, snapshot deploy, uninstall, and schedule mutation HTTP
  routes return 410. The scheduler can execute only an approved immutable
  `planId + approvedPlanHash`; legacy playbook/catalog schedules are skipped.
  Non-dry-run scheduled Plan execution uses the same atomic apply claim,
  idempotency record, managed execution, and finalize path as HTTP Apply.
- Build, Migrate, recipe, config-governance, and remove-capability Web paths now
  create/review/apply stored Environment Plans instead of calling direct target
  mutation helpers.

Security regression coverage is in `plan-security-core.test.ts`,
`plan-apply-security-routes.test.ts`, `managed-plan-execution.test.ts`, and the
expanded apply-gate/collector tests. Current validation: 800 API tests and 12
Web smoke projects pass; root typecheck and build pass.

Current atomic apply claim is guaranteed within a single API process runtime
store. The runtime database update path is serialized by an in-process Mutex.
Multi-process or multi-replica deployments must replace the runtime mutex with a
durable transactional claim mechanism, such as database compare-and-set,
row-level locking, or unique apply-run constraints. Do not describe the current
implementation as distributed atomic locking.

## Current SSH collection resilience

- SSH connection timeouts cover the handshake only; successful connections clear
  that timer before the full remote inventory starts.
- Slow optional inventory commands are bounded, firewall inspection is
  non-interactive, and Debian package versions are collected in one batched
  `dpkg-query` pass.
- Every remote section now returns status, completeness, command/exit/timeout
  evidence, stdout/stderr, errors, and `collectedAt`. Overall timeout produces
  partial evidence instead of an empty-success snapshot; partial completeness
  feeds the `partial-snapshot-confirm` Plan gate.
- `ssh.ts` preserves the overall and per-section evidence envelopes when it
  persists a `StoredProbeSnapshot`; evidence quality no longer disappears
  between remote collection and migration-session analysis.
- Migrate Source renders overall collector state/completeness/confidence plus
  failed or timed-out commands and stderr summaries. It explicitly identifies
  when `partial-snapshot-confirm` is required.
- `packages/core` and local collectors use the same evidence dimensions
  (`completeness`, `commands`, `collectedAt`) so local manifests do not silently
  collapse unavailable tools into empty data.
- Regression coverage lives in
  `apps/api/src/engine/tests/ssh-collector-resilience.test.ts`.

## Decision Engine product API

The rule engine is now a persistent advisory layer, separate from the trusted
Apply kernel:

- Candidate scoring includes intent, evidence strength, readiness, risk,
  automation confidence, business criticality, review cost, user-preference
  confidence, and collector completeness.
- Built-in risk profiles, scoped user preference memory, Review Inbox items,
  decision history, and an append-only decision audit trail persist in the
  runtime store.
- Migration-session analysis materializes Inbox/history/audit records
  idempotently. Saving a migration decision resolves the matching Inbox item
  and records the resolution; remembered preferences influence later
  classification but cannot override secret/data requirements or blockers.
- Authenticated CRUD/read APIs live under `/api/decision-engine/*`. No Decision
  Engine route can approve or execute an Environment Plan.

The API and migration integration are complete for this batch. A dedicated Web
Review Inbox and preference-management surface remains a later product task.

## Verification report evidence

- Structured and Markdown Plan reports include `planHash`,
  `approvedPlanHash`, target id, latest `applyRunId`/idempotency state, frozen
  artifact hashes, per-action status/exit code, redacted command evidence,
  verification results, rollback availability, and remaining manual steps.
- Web report readers explicitly request the Markdown representation; the prior
  structured-object/string mismatch is removed.

## Git caveats

- The worktree may contain active UI refactor changes during implementation
  batches. Do not revert user work.
- Do not commit runtime state: `data/envforge.db*`, `data/.master-key`,
  `data/runtime-db*.json*`, `data/backups/`, `data/keys/`, `data/snapshots/`,
  `.env`, logs, or harness output.
- `.gitattributes` now pins text files to LF. Before creating a real commit,
  run `git add --renormalize .` so historical CRLF churn is cleaned separately
  from feature changes.
- If `.git/index.lock` exists, do not run git operations until the lock clears.
