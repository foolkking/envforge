---
id: EF-ACC-PREP-001
title: Preparation Integrated Design Baseline Acceptance
version: '1.1'
status: accepted
classification: normative
owners: [architecture, qa, security]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-013, ADR-014, ADR-015, ADR-016]
source_of_truth_for: [Preparation acceptance]
---

# Preparation Integrated Design Baseline Acceptance

## Purpose

Preparation proves that the accepted target design, current repository facts, machine contracts, legacy migration, delivery governance, and Phase 0 inputs form a replayable implementation-ready baseline. It does not prove any Phase 0 product capability.

## Required Acceptance

| ID | Requirement |
|---|---|
| PREP-001 | Entry Assessment is `ENTRY-PASS` |
| PREP-002 | Integrated and legacy package hashes and provenance are recorded |
| PREP-003 | ADR-013 adopts Integrated Design Baseline v1.2 |
| PREP-004 | Design assets are in the repository and pre-existing docs are traceable |
| PREP-005 | Source-of-Truth has no dual authority |
| PREP-006 | Only Preparation + Phase 0–10 is active |
| PREP-007 | Canonical terminology and kebab-case state checks pass |
| PREP-008 | ADR status, supersession, and index agree |
| PREP-009 | OQ-002/OQ-003/OQ-004 are decided through ADR-014/015/016 |
| PREP-010 | Remaining Open Questions retain owner, due phase, impact, and status |
| PREP-011 | Current-to-target matrix binds exact current code and transition gates |
| PREP-012 | Current API/DB/execution/UI/test facts are audited |
| PREP-013 | Markdown/front matter/link validation passes |
| PREP-014 | All Mermaid sources render with official CLI |
| PREP-015 | OpenAPI parse/lint/bundle/example/codegen smoke passes |
| PREP-016 | JSON Schema positive and negative cases pass |
| PREP-017 | Reference DDL applies and constraint probes pass in disposable PostgreSQL |
| PREP-018 | Golden Build v1 fixture/scope is frozen, not implemented |
| PREP-019 | Delivery Contract 1.1 and templates exist |
| PREP-020 | Design validation is enforced in CI |
| PREP-021 | Baseline tests are recorded and Preparation introduces no regression |
| PREP-022 | Secret canary/pattern scan passes without credential disclosure |
| PREP-023 | Validation time and artifact-size baseline is recorded |
| PREP-024 | Every legacy docs input has a disposition |
| PREP-025 | Stable legacy content is represented in target fact sources |
| PREP-026 | Current implementation guides are current-HEAD revalidated and non-authoritative |
| PREP-027 | Historical evidence is isolated and key facts are current-HEAD revalidated |
| PREP-028 | Generated artifacts are outside active docs and have rebuild/stale rules |
| PREP-029 | Ephemeral output is excluded or hash-recorded with disposition |
| PREP-030 | `docs/15-experience` participates in Source-of-Truth |
| PREP-031 | Experience → Domain → API → UI → Test → Evidence traceability exists |
| PREP-032 | Certification preview/diff/review/promotion is separate from runtime enablement |
| PREP-033 | Retired active paths have no unresolved references or use approved stubs |
| PREP-034 | Document Migration Traceability is complete |
| PREP-035 | No P0/P1 remains; commits, Closure, and Handoff are complete |

## Verdict

`PASS` requires all PREP-001–035 PASS, replayable evidence, no P0/P1, no Secret leak, no product-scope implementation, and a Handoff with no blocking conditions. `PARTIAL` or `FAIL` keeps Phase 0 locked.
