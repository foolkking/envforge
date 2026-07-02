# Documentation Index

This is the durable documentation map for EnvForge. Human entry point:
[`README.md`](../README.md). AI agents should read
[`PROJECT_STATE.md`](../PROJECT_STATE.md), then [`AGENTS.md`](../AGENTS.md).

## Maintained docs

| Doc | Purpose |
|---|---|
| [product.md](./product.md) | Product scope, user roles, workspace IA, roadmap, non-goals |
| [product/README.md](./product/README.md) | Productization design map for first-run assessment, trust, explainability, support, ecosystem, adoption, and roadmap |
| [system-design.md](./system-design.md) | Architecture, migration engine, Environment Plan, execution, config/security |
| [catalog.md](./catalog.md) | Capability Catalog schema, certification, authoring, quality gate, admin governance |
| [capability-sdk.md](./capability-sdk.md) | Contributor-facing capability package format, certification harness, safety gates |
| [capability-catalog-preview.md](./capability-catalog-preview.md) | Review-only preview and diff from certified capability packages to catalog artifacts |
| [web-ui.md](./web-ui.md) | Web IA, page responsibilities, UI patterns, design-system constraints |
| [operations.md](./operations.md) | Deployment, runtime configuration, backups, operational SOPs |
| [validation.md](./validation.md) | E2E scenarios, harness workflow, target readiness, report template |
| [decisions.md](./decisions.md) | Durable decisions that should not be silently reversed |

## Product Design

Product design entry path: `docs/product/README.md`.

- [Product Design Overview](./product/README.md)
- [Product Strategy](./product/product-strategy.md)
- [First-run Experience](./product/first-run-experience.md)
- [Trust Model](./product/trust-model.md)
- [Explainability](./product/explainability.md)
- [Failure, Repair, and Support](./product/failure-recovery-support.md)
- [Service Stack Model](./product/service-stack-model.md)
- [Review Inbox](./product/review-inbox.md)
- [Golden Scenarios](./product/golden-scenarios.md)
- [Capability Ecosystem](./product/capability-ecosystem.md)
- [Production Adoption](./product/production-adoption.md)
- [Quality Harness](./product/quality-harness.md)
- [Roadmap](./product/roadmap.md)

## Generated outputs

| Path | Purpose |
|---|---|
| [generated/catalog-certification.md](./generated/catalog-certification.md) | Generated Full Migration certification summary |
| [generated/catalog-certification.json](./generated/catalog-certification.json) | Machine-readable certification output |
| `../generated/catalog-preview/` | Review-only generated capability catalog preview artifacts; not runtime catalog |

Generated files are refreshed by scripts and should not be edited by hand.

## Archives and local output

| Path | Policy |
|---|---|
| [archive/](./archive/) | Retired historical material only. Not part of the active doc path. |
| [ui-ia-restructure.md](./ui-ia-restructure.md) | Historical rationale for the implemented UI information-architecture consolidation; not the current UI specification. |
| `harness-reports/` | Local timestamped harness output. Do not treat as durable docs. |
| `_work/` | Temporary work area. Should be empty or near-empty after active work is merged. |

## Consolidation note

The previous many-file docs set was consolidated into this smaller structure on
2026-06-11. Historical product, architecture, catalog, deployment, validation,
and UI draft notes were merged into the maintained docs above.
