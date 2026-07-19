---
id: EF-PREP-DOC-TRACE-001
title: EnvForge Document Migration Traceability
version: "1.0"
status: active
phase: preparation
---

# EnvForge Document Migration Traceability

## Chain of Custody

```text
legacy docs package
→ 51-row disposition + source hashes
→ stable content in docs/00–15
→ current guides marked non-authoritative
→ historical reports in delivery/history
→ generated snapshots in delivery/history or artifacts/generated
→ ephemeral summaries hash-recorded and excluded
```

| Evidence | Path | Coverage |
|---|---|---|
| pre-install Git inventory | `evidence/hashes/existing-docs-before-manifest.txt` | 47 tracked files |
| legacy source disposition | `delivery/history/LEGACY_FILE_DISPOSITION.csv` | 51/51 inputs |
| disposition coverage result | `evidence/legacy-docs/disposition-coverage.json` | no tracked omission |
| installed design inventory | `evidence/hashes/installed-design-manifest.txt` | 178 docs-tree files at initial HEAD |
| historical source hashes | `delivery/history/SOURCE_SHA256SUMS` | archived source integrity |
| deleted ephemeral record | `delivery/history/deleted-ephemeral-files.md` | 4 hash-recorded outputs |

## Active-path Retirement

Pre-install root files such as `product.md`, `system-design.md`, `operations.md`, `validation.md`, `web-ui.md`, old audits, phase reports, and `generated/` outputs are not active target-design entrypoints. Stable design is mapped into leaf specifications; current behavior is mapped into registered current guides; historical conclusions are archived.

Approved compatibility stubs at Preparation entry: none. Repository references to retired paths must be either migrated or classified as historical text before Closure. Phase 10 is the final removal gate for current-implementation guides and any compatibility paths introduced later.
