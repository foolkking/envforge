# Quality Harness

A mature product is not just “has tests.” It has a systematic quality workflow
that proves scan, plan, apply, verify, rollback, reporting, and redaction
behavior.

## Harness workflow

~~~text
create source fixture
scan source
classify service stack
generate plan
review gates
apply to target
verify target
rollback if supported
verify rollback
export report
redaction check
~~~

## Test matrix

- Ubuntu 20.04
- Ubuntu 22.04
- Ubuntu 24.04
- Debian 11
- Debian 12
- Rocky / AlmaLinux
- x86_64
- arm64
- Docker installed
- Docker not installed
- sudo available
- sudo unavailable
- systemd available
- non-systemd partial

## Regression rules

- 不会新增未审批危险 action
- 不会降低 gate 等级
- 不会把 required-decision 降为 auto-staged
- 不会泄露 secret
- 不会破坏 artifact hash
- 不会绕过 Plan apply
- 不会破坏 rollback boundary

Every official capability should have fixture and harness proof.

## Read-only Assessment regression baseline

Prompt2A adds backend regression coverage for:

- service-stack projection from migration candidates;
- PostgreSQL statefulness, high risk, evidence explanation, and required data
  migration strategy;
- collector partial/failed/timeout/stderr evidence and the distinction between
  an absent component and unavailable collector evidence;
- readiness blockers caused by insufficient evidence;
- JSON and Markdown report redaction;
- the invariant that Assessment reads create no approved Plan, Approval, Apply
  Run, ActionRunRecord, migration session run, or target mutation.

At the Prompt2A checkpoint, the browser workflow and golden-scenario lab
fixtures remained future work.

Prompt2B+C adds Web behavior coverage for the read-only first-run CTA and
disclosure, PostgreSQL Service Stack explanation, Docker absent-versus-failed
collector semantics, migration readiness, backend report export, Review Inbox
joining, decision history, and advisory decision actions. Tests assert that
accepting or remembering a Review decision does not call Plan approval or Apply.

At the Prompt2B+C checkpoint, Golden-scenario fixtures, Failure / Repair UX,
Capability SDK, and Production Team Adoption remained later work.

## Prompt3 product Golden Scenario Lab

The Golden Scenario Lab now lives in `fixtures/golden-scenarios/` with a shared
runner in `apps/api/src/golden-scenario-harness.ts` and regression tests in
`apps/api/src/engine/tests/golden-scenarios.test.ts`.

```bash
npm run test:golden
```

The five fixtures exercise the real classifier, Assessment, Service Stack,
Decision outcome/Review eligibility, plan-only projection, report, and
redaction paths. Assertions cover expected stack categories, statefulness,
readiness, collector status, required decisions, report boundary text, and
sentinel-secret absence.

The harness is read-only by construction: it does not import or call Plan
approval, apply claim, Managed Execution, ActionRunRecord append, or target
write functions. Existing route and P0 regression tests remain authoritative
for the guarantee that Assessment/Review cannot approve or apply a Plan.

Automated depth is intentionally explicit:

- the first four scenarios are deterministic Assessment/Review/report fixtures;
- legacy VPS, Docker Compose, and database scenarios also build the existing
  migration plan-only projection without applying it;
- post-migration verification validates evidence-envelope expectations only;
  scheduled continuous verification, remediation, and rollback remain pending;
- live disposable-target certification continues to use
  `npm run harness:certify`, not the fixture lab.

## Prompt4 failure and Support Bundle regression baseline

`npm run test:golden` now runs both 5/5 product scenarios and 5/5 failure
scenarios. Failure fixtures invoke the real diagnostic and Support Bundle
builders and assert:

- Nginx invalid config, missing Docker secret, unknown PostgreSQL backup
  freshness, partial collector, and unhealthy verification taxonomy;
- what/where/attempt/impact, likely causes, recommended actions, and honest
  retry/skip/rollback boundaries;
- Repair Plan output remains a review-required draft and has no execution
  function;
- JSON and Markdown Support Bundles contain useful evidence while sentinel
  database passwords, API tokens, private-key content, `.env` values, and
  database URLs are redacted;
- diagnostics and exports create no Plan, Approval, Apply Run,
  ActionRunRecord, repair, rollback, or target mutation.

API route tests snapshot runtime state before and after GET exports. Web smoke
coverage renders the diagnostic card, verifies the repair draft label, keeps
retry/rollback controls disabled, exports Support Bundle Markdown, and checks
that no Plan review/apply request is sent.

Automatic repair/rollback, Capability SDK, and Production Team Adoption remain
later roadmap work.

## Prompt5 capability certification harness

Prompt5 adds a contributor-facing capability harness:

~~~bash
npm run test:capabilities
~~~

The harness validates capability package manifests and package-local docs,
fixtures, and tests. It checks:

- schema validity and required fields;
- status and risk level enums;
- declared read/write/command permissions;
- write/apply safety gates;
- approved immutable Environment Plan boundary;
- Managed Execution boundary;
- no public direct mutation API declaration;
- no forbidden direct mutation route references;
- redaction assertions and raw secret scans;
- certification level does not exceed evidence;
- package docs and fixtures exist.

This harness complements the golden scenario lab. It does not replace the P0
Apply regression tests or live disposable-target certification. The official
Nginx and PostgreSQL examples currently reach the official level only.
production-certified remains future work.

## Prompt6 capability catalog preview harness

Prompt6 adds a review-only preview harness:

~~~bash
npm run preview:capabilities
~~~

The preview harness verifies that certified capability packages can be converted
into catalog-facing diff artifacts without changing runtime behavior. Regression
coverage checks:

- official.nginx and official.postgresql produce catalog previews;
- uncertified packages are blocked;
- write/apply capabilities require gates and the approved Environment Plan
  boundary;
- PostgreSQL data-migration gates and Nginx reload gates cannot be removed;
- risk downgrade relative to an existing catalog item is blocked;
- secret sentinel leaks block preview through certification;
- diff entries include service-stack mappings, gates, risks, and permissions;
- generated artifacts are deterministic, redacted, and carry
  `enabledByDefault=false`;
- preview does not modify `configs/catalog/*` or runtime catalog behavior.

This is not a production catalog sync. Generated artifacts are review evidence
only; an explicit reviewed promotion workflow remains future work.
