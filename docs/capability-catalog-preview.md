# Capability Catalog Preview

Prompt6 establishes a review-only bridge from certified capability packages to
catalog review artifacts:

~~~text
certified capability package
-> catalog preview
-> catalog diff
-> validation
-> generated review artifact
~~~

This is not a runtime sync process. It does not modify `configs/catalog/*`, does
not replace the runtime catalog, does not enable dynamic plugins, and does not
approve or apply any Environment Plan.

## Command

~~~bash
npm run preview:capabilities
~~~

The command builds the API package, runs capability certification, generates
preview JSON under `generated/catalog-preview/`, and prints a summary for each
capability.

## Generated artifacts

Artifacts are review records only. They are safe to commit only when they are
deterministic and redacted:

- no timestamp or `generatedAt` field;
- no random id;
- no absolute or machine-specific path;
- no local user name or CI-only metadata;
- no token, private key, credential URL, raw `.env` value, or sentinel secret;
- `generatedArtifact.enabledByDefault` is always `false`;
- `catalogArtifact.runtimeEnabled` is always `false`.

The generated artifact path is intentionally separate from `configs/catalog/*`.
Runtime catalog behavior remains unchanged until a future explicit, reviewed
sync workflow exists.

## Preview content

Each preview contains:

- source capability id, publisher, version, certification level, and pass/fail;
- target catalog id and operation: `create`, `update`, `no-op`, or `blocked`;
- service stack mappings and discover signals;
- declared read/write/command permissions;
- required gates;
- risk notes;
- feature flags and rollback support;
- catalog diff entries;
- blockers and warnings;
- generated artifact metadata with `enabledByDefault=false`.

Diff entries include kind, operation, path, before, after, and reason. The diff
is meant for human review and later promotion workflows, not automatic runtime
activation.

## Blocking rules

Preview is blocked when certification or safety checks fail, including:

- certification did not pass;
- official namespace uses a non-EnvForge publisher;
- write permissions have no gates;
- `apply=true` lacks an approved immutable Environment Plan boundary;
- `rollback=full` lacks strong live-target evidence;
- required gates are removed;
- risk is downgraded relative to an existing runtime catalog item without
  evidence;
- secret sentinel or raw credential content is detected by certification.

## Current official previews

`official.nginx` maps to `nginx-web-service` and produces a web-entry preview
with:

- signals: nginx service, `/etc/nginx`, `nginx -t`;
- gates: `config-diff-confirm`, `service-reload-confirm`;
- risks: certificate path missing, config invalid, reload impact.

`official.postgresql` maps to `postgres-profile` and produces a database preview
with:

- signals: postgresql service, port 5432, `/var/lib/postgresql`, `pg_hba.conf`,
  `postgresql.conf`;
- gates: `data-migration-strategy-confirm`, `backup-freshness-confirm`,
  `version-compatibility-confirm`;
- risks: raw file copy corruption, version mismatch, backup freshness unknown,
  data volume unknown.

## Limitations

- Marketplace is not implemented.
- Remote capability registry is not implemented.
- Dynamic third-party plugin loading is not implemented.
- Runtime catalog automatic enablement is not implemented.
- Promotion UI and production approval workflow are future work.
