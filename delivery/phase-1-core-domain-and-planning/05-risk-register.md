# Phase 1 Risk Register

| ID | Severity | Risk | Control |
|---|---|---|---|
| PH1-R-001 | P1 | Confirmed Blueprint mutation | immutable trigger, repository guard, negative test |
| PH1-R-002 | P1 | Plan hash nondeterminism | canonical sort, stable semantic keys, 100-repeat test |
| PH1-R-003 | P0 | Secret material enters planning records | sensitive-key/value canary validation and scans |
| PH1-R-004 | P0 | Cross-workspace reference | composite foreign keys, scoped repositories, IDOR tests |
| PH1-R-005 | P1 | Legacy Plan falsely promoted | dry-run only mapping; old approval always invalid |
| PH1-R-006 | P1 | Compiler leaves partial rows | single PostgreSQL transaction and crash probe |
| PH1-R-007 | P1 | Approval authorizes drifted inputs | exact input bindings/hash plus drift evaluation |
| PH1-R-008 | P1 | Phase boundary creep into Run/Discovery | no Candidate or Run tables/routes; locked Run endpoint test |
| PH1-R-009 | P2 | Large Plan JSON/query cost | size limits and performance evidence |
| PH1-R-010 | P2 | Web confuses Plan with execution | explicit no-execution copy and no Run CTA |
