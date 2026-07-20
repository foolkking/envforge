# Phase 1 Baseline Test Report

| Command | Result | Evidence |
|---|---|---|
| `npm run typecheck` | PASS | exit 0 |
| `npm run test --workspace @fool/api` | PASS | 1014/1014, 0 skipped |
| `npm run build` | PASS | exit 0 |
| `npm run smoke:web` | PASS | 16/16 |
| `npm run validate:preparation` | PASS | exit 0; generated evidence reset after baseline capture |

Executed on Windows x64, Node 20.13.1, npm 10.5.2. Logs were retained outside
the repository under the system temporary directory.
