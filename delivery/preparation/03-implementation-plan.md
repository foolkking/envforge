---
id: EF-PREP-PLAN-001
title: EnvForge Preparation Implementation Plan
version: "1.0"
status: accepted
phase: preparation
approved_entry: ENTRY-PASS
---

# EnvForge Preparation Implementation Plan

## Current Facts

- The integrated design files and historical migration assets are already present in two local commits above `origin/main`.
- Product code has not changed since the 2026-07-18 current-state audit; this is verified by an empty code diff from audit commit `a77f597` through initial HEAD for `apps/`, `packages/`, `scripts/`, package manifests, and CI before Preparation tooling changes.
- The active API is Fastify + SQLite with 228 route registrations in a 6,555-line `apps/api/src/routes.ts`; the target OpenAPI 3.1 contract is design-only and contains 103 operations.
- The production server awaits SQLite `initializeDatabase()` before route registration/listen, while later JSON migration/task-healing/rule initialization remains post-listen legacy behavior.
- Environment Plan/approval/hash/artifact/apply protections exist in the current product, but the target Project/Blueprint/PlanRevision/ExecutionRun/Dataset/Cutover/Archive model is not implemented.
- Full API baseline is 1000/1001 because a migrated generated-artifact path remained in one test.

## Ordered Work

1. Record repository, environment, docs, API, DB, execution, UI, test, history, and generated-artifact evidence.
2. Complete design delta, risk, decision, legacy disposition, guide register, document traceability, and defect registers.
3. Adopt v1.2 explicitly through ADR supersession without bulk-changing leaf document schema versions.
4. Close OQ-002/OQ-003/OQ-004 using current-code comparisons and accepted ADRs; synchronize security, persistence, artifact, open-question, and Phase 0 acceptance sources.
5. Bind current-to-target gap and current-code migration documents to exact current symbols, feature flags, backfills, cutover/rollback gates, telemetry, and Phase 10 retirement.
6. Move remaining live generator/test assumptions from `docs/generated` to temporary or `artifacts/generated` locations; restore the API test baseline with tooling/test-only changes.
7. Add pinned validation dependencies and scripts for Markdown/static policy, Mermaid rendering, OpenAPI lint/bundle/codegen smoke, JSON Schema positive/negative cases, and reference DDL disposable PostgreSQL execution.
8. Add CI enforcement and failure-path checks; record tool versions, elapsed time, artifact sizes, and hashes.
9. Freeze Golden Build v1 Preparation inputs, create delivery templates and acceptance contract, and complete WP records.
10. Run stabilization from a reviewed diff: typecheck, build, API, Web smoke, golden/capability, design validation, failure injection, security scan, DDL reapply, and CI-equivalent run.
11. Close defects/debt, create Closure/Handoff, hash evidence, and make path-scoped atomic commits. Do not push.

## Expected Files

- `docs/00-governance/**`, selected `docs/07-persistence/**`, `docs/09-security/**`, `docs/12-roadmap/**`, `docs/13-acceptance/**`, `docs/14-adr/**`, and current-guide front matter;
- `delivery/**` and `artifacts/generated/README.md`;
- documentation/spec validation scripts, root dev dependencies/lockfile, package scripts, and `.github/workflows/ci.yml`;
- the minimal catalog-certification test/generator and dry-run harness output-path migration needed to remove active-doc generated dependencies;
- `PROJECT_STATE.md` and repository entrypoint links.

No production TypeScript implementation file is expected to change.

## Validation Commands

Official product commands: `npm run typecheck`, `npm run build`, `npm test`, `npm run preflight`, `npm run audit:catalog`, `npm run test:golden`, `npm run test:capabilities`, `npm run smoke:web`.

Preparation adds pinned commands for design static validation, Mermaid render, OpenAPI lint/bundle/codegen smoke, JSON Schema tests, reference DDL disposable validation, Secret canary/pattern scan, generated-staleness checks, and a CI-equivalent aggregate.

## Risks and Rollback

- Stage by explicit paths so user work is never included.
- Preserve the two existing local commits; do not amend, reset, or rebase.
- Each documentation decision commit is independently revertible.
- Validation dependency/tooling commits are isolated from design content.
- Generated output is temporary or ignored unless it is formal phase evidence.
- If an accepted design must change rather than be clarified, register `design-baseline-change` and stop that item.

## Commit Plan

Existing local commits are retained:

1. `36da326 docs: adopt integrated EnvForge design baseline`
2. `a0a9a69 docs: archive legacy evidence and add validation policy`

Additional atomic commits will cover decisions/binding, validation tooling, CI/governance, legacy/current-guide convergence, and final closure. No automatic push is authorized.

## Stop Conditions

- Secret or PII enters evidence;
- a product/runtime change is required;
- a P0/P1 defect cannot be closed within Preparation scope;
- machine contracts remain unparseable or reference DDL cannot be verified;
- user changes cannot be separated;
- source-of-truth precedence or a core invariant is ambiguous.
