---
id: EF-PREP-LEGACY-001
title: EnvForge Legacy Document Disposition
version: "1.0"
status: accepted
phase: preparation
---

# EnvForge Legacy Document Disposition

The authoritative row-level disposition is [`delivery/history/LEGACY_FILE_DISPOSITION.csv`](../history/LEGACY_FILE_DISPOSITION.csv). Its SHA-256 is `a61ad8fc8a0b9a266ed6ec53fd7ee5a046cca62cb67d1998f6fc5be1d14ed570`.

| Classification/action | Count | Result |
|---|---:|---|
| MERGE-AND-RETIRE | 14 | stable concepts moved into normative leaf specs; old path retired |
| ARCHIVE-EVIDENCE | 19 | reports preserved under `delivery/history`, never active authority |
| SPLIT-AND-RETAIN | 9 | current operational knowledge retained in explicitly informative guides |
| REGENERATE-OUTSIDE-DOCS | 5 | historical snapshots archived; current outputs must use artifacts/CI |
| DELETE-EPHEMERAL | 4 | hashes recorded; incomplete timestamped summaries excluded |
| Total | 51 | complete |

The 47 tracked files under `docs/` at pre-install commit `d522abe` all have a disposition. Four additional disposition rows are ignored ephemeral harness summaries recovered from the legacy package. No tracked pre-install docs path is missing.

Preparation also found three project-only tracked generated preview files under `generated/catalog-preview/`. They were not part of the legacy 51-row input, so they are separately archived at `delivery/history/capability-preview-snapshots/2026-07-19/` with file hashes and source commit metadata. Future CLI output is written to ignored `artifacts/generated/capability-preview/`.

Retirement is not deletion without trace: the pre-install Git tree, SHA-256 manifest, package, backup, destination mapping, and repository history are all retained. Old active entrypoints have no authority after the v1.2 adoption. Any compatibility stub must be explicitly listed in `95-document-migration-traceability.md` and retired by Phase 10 at the latest.
