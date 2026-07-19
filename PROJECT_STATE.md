# PROJECT_STATE

AI-readable current-state snapshot. Read this before changing the repo, then read
`AGENTS.md` for working rules. Human entry point: `README.md`. Last updated:
2026-07-20.

## Preparation delivery status

Preparation adopted EnvForge Integrated Design Baseline v1.2 and established the
delivery governance tree under `delivery/`. Current implementation guides are
informative and non-authoritative; target PostgreSQL, durable execution, dataset,
Secret Delivery, Cutover, Archive, and Restore capabilities remain later-phase
work. Machine validation is rerunnable with `npm run validate:preparation`.

Preparation evidence, Closure, and Phase 0 handoff are maintained at
`delivery/preparation/evidence/index.md`, `delivery/preparation/90-closure-report.md`,
and `delivery/preparation/91-handoff-manifest.yaml`. The current baseline is
API 1001/1001, Web smoke 16/16, and harness scenarios 109/109. No credentials,
runtime databases, logs, or user backup files belong in Preparation commits.

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
| Capability catalog preview | `npm run preview:capabilities` |
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
| `docs/capability-sdk.md` | Contributor-facing capability package format and certification |
| `docs/capability-catalog-preview.md` | Review-only capability-to-catalog preview and diff |
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
expanded apply-gate/collector tests. Current validation: 828 API/engine tests
and 16 Web smoke tests pass; root typecheck and build pass.

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

The API and migration integration are complete for this batch. Prompt2B+C adds
a Migrate-local Web Review Inbox, Decision Explanation cards, decision history,
and safe action handling. Review actions may update migration-session advisory
decisions or data strategy and may remember a preference, but they cannot
approve or execute an Environment Plan.

## Read-only Assessment backend baseline

Prompt2A is implemented as a pure, additive projection over existing migration
sessions, source snapshots, collector envelopes, and migration candidate
reports:

- `GET /api/migration/sessions/:sessionId/assessment` returns source and
  snapshot context, service stacks, risk summary, migration readiness, required
  decisions, and collector evidence quality.
- `GET /api/migration/sessions/:sessionId/assessment/report?format=json` and
  `format=markdown` export a default-redacted Assessment Report suitable for
  tickets and internal review.
- Missing sessions and snapshots return explicit unavailable states instead of
  empty successful assessments. Partial or failed collectors remain visible;
  successful empty evidence is distinguishable from unavailable evidence.
- Assessment routes are read-only. They do not materialize Decision Engine
  records, create an Environment Plan or Approval, create Apply/Action/session
  runs, or mutate a source or target host.

Prompt2B+C now exposes the backend Assessment in the Migrate Web flow:

- Read-only Assessment is the first-run primary action; Generate Plan is
  secondary and Apply is not an active first-run action.
- The source step discloses what is and is not read, while the Assessment view
  renders service stacks, evidence quality, readiness, required decisions, and
  backend-generated JSON/Markdown report export.
- Review Inbox items join to Service Stacks and evidence through candidate ids.
  Decision Explanation cards show recommendation, alternatives, default safe
  choice, unresolved impact, Plan-draft impact, and available history.
- Accept, alternative, record-only, manual, defer, and advisory-preference
  actions use existing Decision Engine and migration-session APIs. They do not
  create Approval or Apply Run records.

The Web First-run Assessment and Review Inbox productization baseline is now in
place. Production Team Adoption remains future roadmap work.

## Golden Scenario Lab

Prompt3 adds a deterministic product-level fixture lab under
`fixtures/golden-scenarios/`:

- legacy VPS migration;
- Docker Compose application rebuild;
- safe PostgreSQL/MySQL/Redis migration;
- Assessment-only server inventory report;
- post-migration verification evidence expectation.

Run it with `npm run test:golden`. The shared harness invokes the real migration
classifier, Assessment/Service Stack projection, Decision Engine Review
eligibility, migration plan-only projection, and JSON/Markdown report builders.
It verifies expected stacks, statefulness, evidence completeness and collector
failures, Review decisions, readiness, report content, sentinel redaction, and
the explicit read-only/no-Apply/no-target-mutation report boundary.

The lab also fixed two evidence-classification ambiguities exposed by the
fixtures: generic Docker packages now prefer Docker/Docker Compose rules instead
of unrelated applications that merely depend on Docker, and Certbot timer
evidence remains a security stack rather than a generic scheduled job.

This is a fixture/harness baseline, not a claim that all five scenarios are
production-ready end to end. The post-migration verification case is a
documented evidence expectation; live target Apply, transfer, continuous
verification, remediation, and rollback remain outside Prompt3. The existing
109 capability Plan/dry-run scenarios and live disposable-target certification
remain separate complementary layers.

## Failure Diagnostic and Support Bundle baseline

Prompt4 adds a read-only failure explanation and support layer without changing
the trusted Apply kernel:

- `apps/api/src/failure-diagnostics.ts` maps collector, review, apply,
  ActionRunRecord, and verification evidence into structured diagnostics with
  impact, likely causes, recommended actions, retry/skip/rollback boundaries,
  and optional draft-only repair suggestions.
- `apps/api/src/support-bundle.ts` exports default-redacted JSON/Markdown
  bundles. It includes assessment, collector, review, Plan/hash/artifact,
  Apply/ActionRun, verification, and version evidence when available; missing
  Plan/Apply metadata remains explicit for assessment-only sessions.
- `GET /api/migration/sessions/:sessionId/failures` and
  `GET /api/migration/sessions/:sessionId/support-bundle?format=json|markdown`
  are read-only derived views. Runtime-state snapshot tests verify they create
  no Approval, Apply Run, ActionRunRecord, repair, rollback, or mutation.
- Migrate renders Failure Diagnostic cards and Support Bundle export. Retry,
  rollback, and manual-action controls remain disabled in this baseline; no Web
  failure action calls Plan approval or Apply.
- Five golden failure fixtures cover Nginx config validation, Docker secret
  missing, PostgreSQL backup freshness unknown, partial collection, and
  unhealthy service verification. `npm run test:golden` runs both 5 product and
  5 failure scenarios.

Repair Plan is a suggestion/draft only. Target-changing draft steps require a
separately reviewed and approved immutable Environment Plan. Rollback content is
an evidence boundary explanation, not a claim that automatic recovery occurred.
Full automatic repair and rollback are not implemented.

## Capability SDK and Certification Harness baseline

Prompt5 adds the contributor-facing capability package baseline without
changing the trusted Apply kernel:

- capabilities/README.md documents the SDK package model and safety boundary.
- capabilities/schema/capability.schema.json defines the manifest fields.
- capabilities/official/nginx/ and capabilities/official/postgresql/ provide
  official example packages with fixtures, tests directories, docs, gates,
  redaction assertions, and catalog references.
- apps/api/src/capability-certification.ts validates manifests and package
  files, scans for raw secret assignments and forbidden direct mutation route
  references, checks required gates, and bounds claimed certification level by
  evidence.
- scripts/certify-capabilities.mjs and npm run test:capabilities provide the
  certification entry point.
- docs/capability-sdk.md explains contribution workflow, certification levels,
  safety gates, and limitations.

Certification levels are experimental, community, verified, official, and
production-certified. The two official examples currently certify to official;
production-certified remains future work because live disposable target
apply/verify/report coverage and stronger rollback evidence are not part of
this baseline.

Capability packages cannot bypass Environment Plan review/apply. Collector and
classifier work is read-only, planner work can only produce Plan actions or
recommendations, and appliers are allowed only as approved immutable Plan
actions through Managed Execution. Marketplace, remote registry, dynamic
third-party plugin loading, and untrusted-code sandboxing are not implemented.

## Capability Catalog Preview baseline

Prompt6 adds a review-only bridge from certified capability packages to catalog
review artifacts. Prompt7 adds the admin review surface and draft promotion
request layer on top of the same review-only model:

- `apps/api/src/capability-catalog-preview.ts` maps certified capability
  manifests to catalog preview models with source certification, target catalog
  operation, service-stack mappings, permissions, gates, risks, features, diff
  entries, blockers, warnings, and generated artifact metadata.
- `scripts/preview-capability-catalog.mjs` and `npm run preview:capabilities`
  run certification first, generate deterministic JSON artifacts under
  `generated/catalog-preview/`, and print per-capability summaries.
- `apps/api/src/engine/tests/capability-catalog-preview.test.ts` verifies
  official.nginx and official.postgresql previews, blocked uncertified input,
  required gates, Environment Plan boundary checks, risk-downgrade blocking,
  secret-leak blocking, deterministic artifacts, and that `configs/catalog/*`
  is not modified.
- `GET /api/capabilities/catalog-preview`,
  `/diff`, `/artifact`, and
  `POST /api/capabilities/catalog-preview/promotion-request` are admin-only
  derived views. They return review summaries, diff items, generated artifact
  metadata, safety flags, and a draft promotion request.
- Capability Admin includes a Catalog Preview tab with read-only status, diff
  review, risk/gate/permission/service-stack mapping impact, generated artifact
  status, and promotion request draft generation.
- `apps/api/src/engine/tests/capability-catalog-preview-routes.test.ts` and Web
  smoke verify the API/UI layer remains read-only and draft-only.

The generated preview artifacts are review artifacts only:

- `generatedArtifact.enabledByDefault` is always false.
- `catalogArtifact.runtimeEnabled` is always false.
- `configs/catalog/*` is not rewritten.
- The runtime catalog is not replaced.
- No capability is enabled.
- No Environment Plan approval or Apply Run is created.
- Promotion request drafts do not create production changes; they are review
  artifacts only.

Capability SDK remains contributor-facing. The existing catalog remains the
runtime knowledge base. Marketplace, remote registry, dynamic plugin loading,
automatic runtime catalog enablement, and production promotion execution remain
future work.

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
