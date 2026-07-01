# EnvForge Capability SDK

This directory defines the contributor-facing capability package format.

Capability SDK is additive to the existing runtime catalog. The current catalog
under configs/catalog remains the runtime knowledge base. Certified capability
packages can reference catalog ids today; future work may generate or sync
catalog entries from capability packages.

## What a capability is

A capability describes how EnvForge can discover, explain, plan, apply, verify,
report, and bound rollback for one environment component. A mature capability is
not just a script. It includes:

- collector evidence contract
- classifier signals
- planner output or Plan fragments
- controlled applier semantics
- verifier contract
- rollback descriptor
- risk model
- docs
- fixtures
- tests

Collector and classifier logic is read-only by default. Planner output may only
produce Environment Plan actions, artifacts, gates, or recommendations. Applier
logic must not be exposed as a public mutation API; target-changing work must
execute only through an approved immutable Environment Plan and Managed
Execution.

## Package structure

~~~text
capabilities/official/nginx/
  capability.yaml
  README.md
  fixtures/
  tests/
~~~

Future packages may also include source modules:

~~~text
collectors.ts
classify.ts
plan.ts
apply.ts
verify.ts
rollback.ts
docs.md
~~~

Dynamic third-party plugin loading is not implemented in this baseline.

## Required manifest

Each package must include capability.yaml. The schema lives at
capabilities/schema/capability.schema.json and the executable validator lives in
apps/api/src/capability-certification.ts.

Required themes:

- identity: id, name, publisher, version
- lifecycle status: experimental, community, verified, official, production-certified
- risk level: low, medium, high, critical
- supported OS and architecture matrix
- feature contract: discover, plan, apply, verify, rollback
- permissions: read, write, commands
- gates: required review confirmations
- fixtures and tests
- certification evidence
- redaction assertions
- Environment Plan safety boundary

## Safety rules

- No capability may bypass Environment Plan review/apply.
- Write permissions require gates.
- apply=true must declare approvedPlanRequired and appliesViaManagedExecution.
- Appliers must not expose public direct mutation APIs.
- Rollback full requires stronger live disposable-target evidence.
- Secrets must be redacted in docs, fixtures, stdout/stderr examples, and reports.

## Certification levels

| Level | Minimum requirements |
|---|---|
| Experimental | Schema valid, docs present, basic fixture present; not recommended for production apply. |
| Community | Experimental plus basic discover/classify tests and redaction tests. |
| Verified | Community plus golden or equivalent fixture, plan-only tests, required gates, and failure diagnostic fixture. |
| Official | Verified plus EnvForge-maintained docs, OS matrix, certification harness pass, and P0 safety-gate evidence. |
| Production-certified | Official plus live disposable-target apply/verify/report coverage, rollback boundary evidence, and upgrade/regression policy. |

Certification level comes from harness evidence, not a manual statement.

## Commands

~~~bash
npm run test:capabilities
npm run test:golden
npm test
~~~

## Official examples

- official.nginx: web-entry capability with config diff and service reload gates.
- official.postgresql: stateful database capability with data migration, backup freshness, and version compatibility gates.

Marketplace, remote registry, untrusted-code sandboxing, and dynamic plugin
execution are future work.

