---
id: EF-PREP-CURRENT-GUIDES-001
title: EnvForge Current Implementation Guide Register
version: "1.0"
status: active
phase: preparation
---

# EnvForge Current Implementation Guide Register

All entries are `informative-current-implementation`, have `target_architecture_authority: false`, and are verified against Preparation initial HEAD `a0a9a69cefc0888c32e9fb2ef3f5ca5416a4a254`.

| Guide | Current revalidation | Result | Retirement phase | Evidence |
|---|---|---|---|---|
| `docs/04-compilation/capability-authoring-guide.md` | paths and `test:capabilities`/preview/golden commands exist; only two official packages currently certify | PASS-WITH-DEBT | phase-10 | 2/2 capability package run; target architecture remains separate |
| `docs/04-compilation/current-capability-catalog-guide.md` | legacy `configs/catalog`, 119-item audits, support-level semantics and scripts exist | PASS-WITH-DEBT | phase-10 | catalog audit: 0 errors, 99 warnings; generated paths need migration |
| `docs/10-operations/current-runtime-operations.md` | Fastify/React/SQLite/SSH and listed core commands exist | PASS-WITH-DEBT | phase-10 | current repository inventory; Docker unavailable locally |
| `docs/11-testing/current-harness-guide.md` | dry/live commands exist; live path has explicit safety gates | PASS-WITH-DEBT | phase-10 | dry fixtures inspected; live target not run |
| `docs/15-experience/current-web-implementation.md` | listed nav/components/styles/i18n paths exist; smoke command is valid | PASS | phase-10 | Web smoke 16/16 after local browser install |

Debt means the guide is accurate as a legacy/current guide but remains non-authoritative and must be retired as target implementations replace the referenced paths. Preparation updates the front matter to the exact classification contract.
