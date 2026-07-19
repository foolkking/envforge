---
id: EF-PREP-RISK-001
title: EnvForge Preparation Risk Register
version: "1.0"
status: active
phase: preparation
---

# EnvForge Preparation Risk Register

| ID | Severity | Risk | Control | Owner | Due gate | Status |
|---|---|---|---|---|---|---|
| R-001 | P1 | overwrite or accidentally stage user working-tree changes | preserve paths; path-scoped staging; final diff review | Preparation | every commit | controlled |
| R-002 | P1 | target design is misreported as current product capability | classification metadata, current inventories, historical revalidation | Architecture | Closure | controlled |
| R-003 | P1 | generated catalog output remains active documentation or stale input | move paths, isolated generator test, stale scan | Capability/QA | WP11 | controlled |
| R-004 | P1 | Secret enters evidence/logs | never read `.env`; filename/count-only scan; canary; redaction review | Security | WP11 | controlled |
| R-005 | P1 | reference DDL is mistaken for production migration | disposable execution plus explicit non-authority language | Backend | WP2/WP12 | controlled |
| R-006 | P2 | documentation tool dependencies pollute production runtime | root devDependencies only; lockfile; CI-only use | Tooling | WP11 | controlled |
| R-007 | P2 | CI duration increases materially | measure each stage; cache npm/browser; retain split commands | Tooling | WP13 | deferred |
| R-008 | P1 | old Phase numbering or Maintain mode survives as active authority | static scans and traceability | Architecture | WP12 | controlled |
| R-009 | P1 | OQ-002/003/004 are closed without code evidence/options | decision log comparison and accepted ADRs | Security/Backend/Infra | WP1 | controlled |
| R-010 | P1 | gap matrix uses generic claims without symbols/authority transitions | exact paths, symbols, backfill/flag/cutover/rollback fields | Architecture | WP8 | planned |
| R-011 | P2 | Golden Build scope expands into Phase 3 implementation | freeze fixture/acceptance only; no action/runtime code | Product/QA | WP12 | controlled |
| R-012 | P1 | historical reports silently satisfy current acceptance | code diff check plus current command reruns | QA | Closure | controlled |
| R-013 | P2 | local PostgreSQL service contains unrelated data | use uniquely named disposable database/cluster and explicit paths | Backend | WP11 | planned |
| R-014 | P2 | Docker-dependent validation is falsely marked PASS | report `SKIPPED-environment`; no capability claim | QA | Closure | controlled |
| R-015 | P2 | current route inventory heuristics overstate auth/coverage | mark heuristic fields and require handler/test inspection for claims | API | WP5 | controlled |
| R-016 | P1 | documentation links remain at retired root paths | all-repo reference scan and only approved compatibility stubs | Docs | WP12 | controlled |
| R-017 | P2 | generated evidence becomes stale after commits | regeneration command and final evidence hash pass | Preparation | WP13 | controlled |
