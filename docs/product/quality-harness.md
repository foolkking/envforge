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

Golden-scenario lab fixtures, Failure / Repair UX, Capability SDK, and
Production Team Adoption remain later work.
