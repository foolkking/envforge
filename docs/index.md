# Documentation Index

This is the durable documentation map for EnvForge. Human entry point:
[`README.md`](../README.md). AI agents should read
[`PROJECT_STATE.md`](../PROJECT_STATE.md), then [`AGENTS.md`](../AGENTS.md).

## Maintained docs

| Doc | Purpose |
|---|---|
| [product.md](./product.md) | Product scope, user roles, workspace IA, roadmap, non-goals |
| [system-design.md](./system-design.md) | Architecture, migration engine, Environment Plan, execution, config/security |
| [catalog.md](./catalog.md) | Capability Catalog schema, certification, authoring, quality gate, admin governance |
| [web-ui.md](./web-ui.md) | Web IA, page responsibilities, UI patterns, design-system constraints |
| [operations.md](./operations.md) | Deployment, runtime configuration, backups, operational SOPs |
| [validation.md](./validation.md) | E2E scenarios, harness workflow, target readiness, report template |
| [decisions.md](./decisions.md) | Durable decisions that should not be silently reversed |

## Generated outputs

| Path | Purpose |
|---|---|
| [generated/catalog-certification.md](./generated/catalog-certification.md) | Generated Full Migration certification summary |
| [generated/catalog-certification.json](./generated/catalog-certification.json) | Machine-readable certification output |

Generated files are refreshed by scripts and should not be edited by hand.

## Archives and local output

| Path | Policy |
|---|---|
| [archive/](./archive/) | Retired historical material only. Not part of the active doc path. |
| `harness-reports/` | Local timestamped harness output. Do not treat as durable docs. |
| `_work/` | Temporary work area. Should be empty or near-empty after active work is merged. |

## Consolidation note

The previous many-file docs set was consolidated into this smaller structure on
2026-06-11. Historical product, architecture, catalog, deployment, validation,
and UI draft notes were merged into the maintained docs above.
