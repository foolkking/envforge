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
