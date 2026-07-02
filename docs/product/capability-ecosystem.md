# Capability Ecosystem

Question:

~~~text
别人能不能为它贡献能力？
~~~

EnvForge should not start with a marketplace. It should first provide:

- Capability SDK
- Harness
- Certification
- Contribution guide

A mature capability is not just a script. It should include:

- collector
- classifier
- planner
- applier
- verifier
- rollback descriptor
- risk model
- docs
- fixture
- tests

## Suggested package structure

~~~text
capabilities/nginx/
  capability.yaml
  collectors.ts
  classify.ts
  plan.ts
  apply.ts
  verify.ts
  rollback.ts
  docs.md
  fixtures/
  tests/
~~~

## capability.yaml example

~~~yaml
id: official.nginx
name: Nginx
publisher: envforge
status: stable
riskLevel: medium
supports:
  os:
    - ubuntu-20.04
    - ubuntu-22.04
    - ubuntu-24.04
    - debian-12
  architectures:
    - x86_64
    - arm64

features:
  discover: true
  plan: true
  apply: true
  verify: true
  rollback: partial

permissions:
  read:
    - /etc/nginx
    - systemd status
    - listening ports
  write:
    - /etc/nginx
  commands:
    - nginx -t
    - systemctl reload nginx

requiresGates:
  - config-diff-confirm
  - service-reload-confirm

testMatrix:
  - ubuntu-22.04
  - debian-12
~~~

## Certification levels

- Experimental
- Community
- Verified
- Official
- Production-certified

Certification must be based on harness results, not manual claims.

## Capability SDK baseline

Prompt5 establishes the contributor-facing SDK baseline:

- package root: capabilities/;
- schema: capabilities/schema/capability.schema.json;
- certification harness: apps/api/src/capability-certification.ts;
- script: npm run test:capabilities;
- official examples: official.nginx and official.postgresql;
- contributor guide: docs/capability-sdk.md.

This is not a marketplace and not dynamic third-party plugin execution. The
existing catalog remains the runtime capability knowledge base. Capability
packages may reference catalog ids; future work may sync certified packages into
catalog entries.

Certification is evidence-bounded. A package cannot claim a level higher than
its fixtures, tests, safety gates, redaction checks, and harness results
support. apply=true capabilities must declare write scope, required gates,
approved immutable Environment Plan boundary, and Managed Execution boundary.

Current official examples are certified to the official level, not
production-certified. Production-certified still requires live disposable target
apply/verify/report evidence, rollback boundary proof, and an upgrade/regression
policy.

## Capability to Catalog Preview baseline

Prompt6 establishes a safe bridge from certified capability packages to catalog
review artifacts:

~~~text
certified capability package
-> catalog preview
-> catalog diff
-> validation
-> generated review artifact
~~~

Run it with:

~~~bash
npm run preview:capabilities
~~~

The preview reads package manifests, reuses the certification harness, maps
approved capability metadata to catalog-facing review data, and writes
deterministic JSON artifacts under `generated/catalog-preview/`.

The preview does not:

- modify `configs/catalog/*`;
- replace the runtime catalog;
- enable a capability;
- load dynamic third-party plugins;
- approve an Environment Plan;
- run Apply.

Generated catalog preview artifacts are review-only. They carry
`enabledByDefault=false` and must be manually reviewed before any future sync
process can be considered. Marketplace, remote registry, dynamic plugin loading,
and automatic runtime catalog enablement remain unimplemented.

## Catalog Preview Review baseline

Prompt7 turns the Prompt6 CLI/artifact baseline into an admin review surface:

- Capability Admin includes a Catalog Preview tab;
- the tab shows read-only runtime/config mutation status;
- diff review highlights risk, gate, permission, and service-stack mapping
  changes;
- blocked or needs-review items remain visible with reasons and evidence;
- generated artifacts are shown as review artifacts only;
- admins can generate a promotion request draft.

The promotion request is not a promotion execution. It does not modify
`configs/catalog/*`, replace runtime catalog behavior, enable a capability,
approve a Plan, create an Apply Run, or enable dynamic plugins. Future work may
add an explicit reviewed sync process, but automatic runtime catalog enablement
is still not implemented.
