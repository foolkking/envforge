# Golden Scenario Fixtures

These five product fixtures exercise EnvForge's assessment-first story through
the real migration classifier, Assessment projection, Decision Engine outcome
contract, plan-only projection, and JSON/Markdown report builders.

Run them with:

```bash
npm run test:golden
```

Each directory contains a `scenario.json`, a read-only `snapshot.json`, and a
README that records the automated depth and current limitations. These fixtures
are deterministic repository inputs. They do not connect to SSH, create an
Environment Plan or Approval, claim an Apply Run, call Managed Execution, or
write to a target.

The existing capability harness under `scripts/harness/scenarios/` remains the
source of capability Plan/dry-run coverage. This directory adds the smaller
product-level Golden Scenario Lab; it does not replace certification coverage.

`post-migration-verification` is intentionally an expectation fixture. It
checks that health/drift evidence remains visible to Assessment and documents
the desired continuous-verification contract, but does not claim that a
scheduled continuous verification service is production-ready.
