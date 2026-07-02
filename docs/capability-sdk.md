# Capability SDK and Certification Harness

The Capability SDK is the contributor-facing package format for EnvForge
capabilities. It is not a marketplace, not a remote registry, and not dynamic
third-party code execution.

Current baseline:

- package root: capabilities/
- manifest schema: capabilities/schema/capability.schema.json
- validator and harness: apps/api/src/capability-certification.ts
- CLI entry: npm run test:capabilities
- official examples: official.nginx and official.postgresql
- catalog preview: apps/api/src/capability-catalog-preview.ts and
  npm run preview:capabilities

The existing catalog under configs/catalog remains the runtime capability
knowledge base. Capability packages can reference catalog ids through
catalogRefs. Future work may sync or generate catalog entries from certified
capability packages.

Prompt6 adds a review-only preview step for that future sync path. Certified
packages can be converted into deterministic catalog preview artifacts under
generated/catalog-preview/, but those artifacts are not loaded by runtime code
and do not modify configs/catalog.

## Capability package contract

Minimum package structure:

~~~text
capabilities/official/nginx/
  capability.yaml
  README.md
  fixtures/
  tests/
~~~

A mature package may later add:

~~~text
collectors.ts
classify.ts
plan.ts
apply.ts
verify.ts
rollback.ts
docs.md
~~~

Collector and classifier code is read-only by default. Planner code may only
produce Environment Plan actions, artifacts, gates, or recommendations. Applier
code must only run inside Managed Execution for an approved immutable
Environment Plan. Verifiers must not hide writes. Rollback descriptors describe
boundaries; they do not imply automatic rollback exists.

## capability.yaml fields

| Field | Purpose |
|---|---|
| id, name, publisher, version | Stable identity and ownership |
| status | experimental, community, verified, official, production-certified |
| riskLevel | low, medium, high, critical |
| catalogRefs | Optional links to current runtime catalog ids |
| supports | OS and architecture support matrix |
| features | discover, plan, apply, verify, rollback support |
| permissions | Declared read/write paths and commands |
| requiresGates | Review gates required before Plan generation or Apply |
| testMatrix | OS matrix covered by fixtures or tests |
| fixtures | Package-local fixtures used by certification |
| certification | Evidence used to bound the claimed status |
| redaction | Sensitive key and report redaction assertions |
| safety | Environment Plan, Managed Execution, and direct-mutation boundaries |
| docs | Package documentation entry |

## Safety gates

Current SDK gates:

- config-diff-confirm
- service-reload-confirm
- data-migration-strategy-confirm
- secret-handling-confirm
- backup-freshness-confirm
- version-compatibility-confirm
- manual-follow-up-confirm

Write permissions require gates. apply=true also requires approvedPlanRequired,
appliesViaManagedExecution, publicMutationApi=false, no directMutationRoutes,
and an environmentPlanBoundary statement that mentions an approved immutable
Environment Plan.

## Certification levels

| Level | Requirement summary |
|---|---|
| Experimental | Schema valid, docs present, fixture present; not production apply ready. |
| Community | Experimental plus discover/classify tests and redaction tests. |
| Verified | Community plus golden or equivalent fixture, plan-only tests, required gates, and failure diagnostic fixture. |
| Official | Verified plus EnvForge publisher, official docs, supported OS matrix, certification harness pass, and P0 safety gates. |
| Production-certified | Official plus live disposable-target apply/verify/report tests, rollback boundary evidence, and upgrade/regression policy. |

Certification levels come from harness evidence. A capability cannot claim a
higher level than the evidence supports.

## Redaction rules

The certification harness scans manifests, docs, fixtures, and test files for:

- sentinel secret values;
- raw password, token, secret, private key, database URL, or API key assignments;
- forbidden direct mutation route references.

Allowed content includes key names, existence indicators, hashes, counts, safe
paths, and explicit redaction placeholders such as <redacted>.

## Commands

~~~bash
npm run test:capabilities
npm run preview:capabilities
npm run test:golden
npm test
~~~

## Current limitations

- Marketplace is not implemented.
- Remote capability registry is not implemented.
- Dynamic third-party plugin loading and sandboxing are not implemented.
- Production-certified live disposable-target capability certification is not
  implemented for official examples.
- The SDK package format is additive; current Assessment and Apply runtime still
  use the existing catalog and Environment Plan kernel.
- Capability-to-catalog preview is review-only. Runtime catalog automatic
  enablement, marketplace distribution, and dynamic plugin loading are not
  implemented.
