# Baseline Test Report

| Gate | Result | Detail |
|---|---|---|
| Build | PASS | All workspaces, Web production bundle. |
| Typecheck | PASS | All workspaces. |
| API run 1 | FAIL-existing/intermittent | 1028/1029; one non-deterministic failure in full serial suite output. |
| API run 2 | PASS | 1029/1029 with the identical command. |

The intermittent result is not treated as a product acceptance pass and must be covered by repeated final regression.

