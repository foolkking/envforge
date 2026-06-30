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
