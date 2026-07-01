# official.nginx

Nginx is an official EnvForge capability example for a web-entry service.

## Scope

- discover Nginx packages, service state, ports, and selected config paths
- classify Nginx as a web-entry Service Stack
- plan config migration with explicit config diff review
- validate candidate config with nginx -t before reload
- reload only after service-reload-confirm
- record certificate path risk without reading private key content
- provide failure diagnostics and support bundle evidence

## Safety boundary

Nginx applier behavior must execute only as reviewed actions in an approved
immutable Environment Plan through Managed Execution. This package must not
expose direct target mutation APIs. Reload and config writes require gates and
ActionRunRecord evidence.

## Required gates

- config-diff-confirm
- service-reload-confirm
- secret-handling-confirm

## Rollback boundary

Rollback is partial. EnvForge can describe config backup/restore boundaries for
files managed by an approved Plan, but certificate issuance and external
upstream availability remain manual or separate repair-plan work.

## Fixtures

- fixtures/nginx-assessment.json covers service/config/cert-path evidence.
- fixtures/nginx-config-validation-failure.json covers nginx -t failure,
  repair draft expectation, and support bundle evidence.

