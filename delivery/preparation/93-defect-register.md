---
id: EF-PREP-DEFECTS-001
title: EnvForge Preparation Defect Register
version: "1.0"
status: active
phase: preparation
---

# EnvForge Preparation Defect Register

| ID | Severity | Description | Classification | Resolution | Status | Target |
|---|---|---|---|---|---|---|
| PREP-DEF-001 | P1 | API test and certification generators referenced retired `docs/generated` | implementation-detail | isolated/current generated paths, stale scan, rerun 1001 tests | resolved | Preparation WP11 |
| PREP-DEF-002 | P2 | current guides used generic `informative` classification | implementation-detail | normalize metadata and bind verified commit | resolved | Preparation WP12 |
| PREP-DEF-003 | P1 | CI did not validate integrated design assets | implementation-detail | add pinned design validation command to CI | resolved | Preparation WP11 |
| PREP-DEF-004 | P2 | Web smoke initially cannot launch because Playwright browser cache is absent | environment/tooling | install project-matched Chromium; document CI install/cache | resolved | Preparation entry |

No P0 defect is open. Additional machine-validation findings are appended before Closure.
