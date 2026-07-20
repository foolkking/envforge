# Correction Validation

State: `LOCAL-VALIDATION-PASS`. Remote CI is still pending and Phase 1 remains
locked.

Environment: Windows x64, Node 20.13.1, npm 10.5.2, PostgreSQL 17.10, local
Chromium/Playwright. GitHub Linux sandbox behavior requires remote validation.

| Gate | Command | Result |
|---|---|---|
| clean dependency install | `npm ci` | PASS, exit 0 |
| direct failed command run 1 | `npm run validate:docs:mermaid` | PASS, 7/7 rendered |
| direct failed command run 2 | `npm run validate:docs:mermaid` | PASS, 7/7 rendered |
| exact workflow order | install, build, typecheck, preflight, catalog, design | PASS |
| full API | `npm test` | PASS 1014/1014, 0 skipped |
| Phase 0 PostgreSQL | filtered Node test command | PASS 13/13 |
| typecheck | `npm run typecheck` | PASS |
| build | `npm run build` | PASS |
| Web smoke | `npm run smoke:web` | PASS 16/16 |
| design and machine contracts | `npm run validate:preparation` | PASS |
| Reference DDL | included in validation | PASS, 50 tables twice, 8 probes |
| Secret canary | included in validation | PASS, 0 repository findings |
| validator failure paths | included in validation | PASS 9/9 |

The CI-only Puppeteer JSON is parsed locally and contains only the two required
Chromium launch arguments. The actual `CI=true` Linux path must be proven by
GitHub Actions on the exact remediation HEAD.
