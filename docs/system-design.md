# System Design

EnvForge is organized around a six-stage model:

```text
Discover -> Classify -> Plan -> Apply -> Verify -> Rollback / Report
```

The same architecture powers Migrate, Build, and Maintain. The input changes,
but the mutation path does not.

## Environment Plan contract

Environment Plan is the only product-level write path.

P0 Security Kernel: Complete. The trusted execution kernel is:

```text
Immutable Environment Plan
+ canonical planHash
+ hash-bound approval
+ artifact-bound apply
+ atomic apply claim
+ idempotency-bound apply run
+ managed execution
+ ActionRunRecord evidence
+ legacy direct mutation disabled
```

| Endpoint | Purpose |
|---|---|
| `POST /api/plans` | Create Migration/Rebuild/Change/Remove/Repair/Imported Recipe plan |
| `GET /api/plans/:id` | Inspect plan |
| `POST /api/plans/:id/review` | Record review/approval decisions |
| `POST /api/plans/:id/apply` | Apply approved plan |
| `POST /api/plans/:id/verify` | Re-run verification |
| `POST /api/plans/:id/rollback` | Roll back supported changes |
| `GET /api/plans/:id/report` | Export report |

Legacy target-mutation routes return `410 Gone`. Compatibility flags do not
re-enable them. Schedules may reference only an approved immutable Plan id/hash.

The approval/execution identity is:

```text
server-created immutable spec + content-addressed artifacts
-> canonical SHA-256 planHash
-> approvalRecord(planHash, actor, risks/conflicts/gates, time)
-> Apply reloads URL plan id and recomputes planHash
-> managed action execution + ActionRunRecord(planId, planHash, actionId)
```

Apply accepts only runtime controls such as `dryRun` and an idempotency key. It
never accepts a Plan, YAML, actions, export, config path/content, or temporary
acknowledgements. A successful dry-run records evidence but never grants
approval.

Non-dry-run Apply first atomically claims the approved Plan for execution.
Repeated requests with the same idempotency key return the same apply run/result;
different concurrent requests cannot both enter managed execution for the same
approved Plan. Scheduled non-dry-run Plan execution uses the same claim and
finalize path; legacy playbook/catalog schedules never execute.

Current atomic apply claim is guaranteed within a single API process runtime
store. The runtime-store update path is serialized by an in-process Mutex.
Multi-process or multi-replica deployments must replace this with a durable
transactional claim mechanism such as database compare-and-set, row-level
locking, or unique apply-run constraints. This is not a distributed lock.

## Core modules

| Area | Responsibility |
|---|---|
| Collectors | SSH read-only host evidence collection |
| Inventory | Normalize packages, services, configs, containers, users, runtimes, network, security |
| Classifier | Package intent, config ownership, default/custom, secret detection, risk, completeness |
| Catalog | Capability rules, package/service/config maps, validation/rollback metadata |
| Planner | Action graph, dependencies, target compatibility, dry-run, exports |
| Executor | SSH actions, safe config writes, package/service operations |
| Verifier | Config syntax, service status, ports, app health checks |
| Rollback | File backups, package/service state restoration, rollback reports |
| Runtime store | SQLite document/relational persistence |

## Discover

Discover creates a read-only `HostSnapshot`.

Collectors gather:

- OS, distro, kernel, architecture, init system.
- Packages from apt/dpkg, dnf/yum/rpm, pacman, apk, snap, flatpak and language
  package managers.
- Services, timers, cron, supervisor, init.d.
- Listening ports, processes, firewall state.
- Known catalog config paths, `/etc`, systemd drop-ins, dotfiles, compose files,
  env files.
- Containers, volumes, networks, bind mounts, image lists.
- Manual artifacts in `/opt`, `/usr/local`, `~/.local/bin`, custom units.
- Security state: sshd, firewall, fail2ban, sudoers metadata, authorized keys
  metadata.

Discover must not modify the source, read blocked secrets, read large data by
default, copy database directories, or treat Docker images as a plan.

Every collected section carries an evidence envelope: `status`,
`completeness`, command/exit/timeout evidence, stdout/stderr, errors, and
`collectedAt`. The overall snapshot retains the same quality summary when it is
persisted. Partial or failed collection is evidence, not an empty-success
result, and low completeness can require the `partial-snapshot-confirm` gate.

## Classify

Classify converts raw evidence into migration candidates.

```ts
type MigrationClass =
  | "managed-software"
  | "system-baseline"
  | "user-dotfile"
  | "service-config"
  | "language-global-package"
  | "container-workload"
  | "manual-install"
  | "unknown-review"
  | "do-not-migrate";
```

Package Intent Score buckets:

| Bucket | Meaning | Default behavior |
|---|---|---|
| high | Strong migration intent | recommend/include |
| medium | Likely useful | user review |
| low | Weak signal | collapsed |
| ignore | dependency/base package | hidden unless expanded |

High signals include catalog match, enabled/running service, listening port,
custom config, data directory, and references from systemd/cron/compose/config.
Medium signals include manual install markers, binaries, PATH/alias/history, and
language global packages. Kernel, library, firmware, base image, essential, and
auto dependency packages are downranked.

### Decision Engine

Decision scoring is an advisory layer over classification. It records intent,
evidence strength, migration readiness, risk, automation confidence, business
criticality, review cost, user-preference confidence, and collector
completeness, then returns one of:

```text
auto-staged | required-decision | suggested-decision
record-only | hidden-noise | blocker
```

Scoped preference memory and risk profiles may tune ordinary recommendations,
but never bypass database/secret decisions or blockers. Migration-session
analysis idempotently materializes Review Inbox, history, and audit records;
operator decisions resolve the corresponding Inbox item. This subsystem cannot
approve or execute an Environment Plan.

## Config and data governance

Config files are first-class migration artifacts. The system tracks:

- ownership from catalog paths, package ownership, service references,
  environment files, includes, symlinks, and process flags;
- default/custom status from package verification, ownership, mtime, and
  semantic diff;
- sensitivity: `safe`, `review`, `secret`, `blocked`;
- safe read status: `read`, `skipped-large`, `skipped-secret`,
  `permission-denied`, `not-found`;
- validation command and rollback backup path.

Data strategy is explicit:

| Strategy | Use |
|---|---|
| `none` | No persistent data owned |
| `optional` | Useful but not required |
| `review` | Operator must decide |
| `dump-restore` | Logical database dump/restore |
| `official-backup-restore` | Upstream backup tool |
| `manual` | Structured manual steps |
| `blocked` | Unsafe or unsupported |

Database directories and `/var/lib/docker` are not copied blindly.

## Plan

An Environment Plan includes:

- source/target host metadata;
- selected capabilities or evidence;
- action graph and dependencies;
- risks, blockers, approvals, manual steps;
- config/data decisions;
- dry-run result;
- validation plan;
- rollback plan;
- report/export artifacts.

The immutable hash covers Plan identity, target, action/items, risks,
conflicts, required gates, export content, and artifact ids/content hashes.
Approval/status/dry-run/verify/report/run fields are runtime state and do not
change the approved object. Config and recipe content is loaded only from the
artifact store and re-hashed before execution.

Action kinds include install package, copy/edit file, create directory, enable
or restart service, transfer data, validate, snapshot, run command, and rollback.
High-risk actions must define dry-run, apply, verify, and rollback behavior.

## Managed execution

Mutating actions record `ActionRunRecord` lifecycle:

```text
pending -> snapshotting -> applying -> verifying -> succeeded
failed -> rolling-back -> rolled-back | rollback-failed
```

Non-mutating or manual-only actions may end as `skipped` or `manual-required`.
If an earlier action fails, later frozen actions still receive explicit
`skipped` records; the evidence stream therefore accounts for every action in
the approved Plan.

Secret redaction is mandatory for stdout, stderr, errors, verification output,
rollback output, and report markdown. Redaction covers private keys, GitHub and
GitLab tokens, OpenAI keys, AWS keys/secrets, JWTs, auth headers, database URLs,
env secrets, passwords, and generic tokens.

## Safe apply surfaces

| Surface | Required behavior |
|---|---|
| SSH config | Pre-validate, atomic write, post-validate, reload not restart, fresh SSH probe, rollback protection |
| Firewall | Preflight must preserve SSH, rollback timer, reload, reachability probe |
| Sudoers | Stage candidate, `visudo -cf`, atomic write, validate live path |
| Systemd unit | Atomic write, daemon-reload, active-state check, restore on failure |
| Generic config | Backup, temp candidate, validation, atomic install, rollback on failure |

## Verify and rollback

Verify runs catalog-defined checks such as `nginx -t`, `sshd -t`,
`docker compose config`, `systemctl is-active`, `ss`, `curl`, `redis-cli ping`,
`psql -c "select 1"`, and similar health checks.

Rollback restores file backups, package state for packages installed by the
current plan, service enabled/running state, and supported config snapshots. It
does not delete existing target data by default.

Plan reports are derived from the immutable Plan plus stored apply/action
evidence. Structured and Markdown forms include Plan/approval hashes, target,
latest apply run and idempotency identity, frozen artifact hashes,
`ActionRunRecord` status/exit/commands, verification outcomes, rollback
availability, and unresolved manual steps. Command/output evidence is redacted
before export.

## Storage and scaling

Current storage is SQLite hybrid:

- document-style runtime state in key/value form;
- relational tables for comments, suggestions, inbox, audit logs, queues,
  reports, and task metadata.

Long-term scaling should happen through repository/provider interfaces rather
than business-logic rewrites. Future candidates: PostgreSQL for core/comments,
Redis or PostgreSQL queues, Meilisearch, ClickHouse.

## Test groups

- collector parsing;
- inventory normalization;
- package intent scoring;
- config ownership/default/secret detection;
- migration plan and dry-run;
- managed execution and safe apply;
- verifier and rollback;
- catalog certification;
- SQLite persistence and queues;
- UI source regression tests.

## Read-only failure diagnostics and support export

Migration sessions expose two derived GET surfaces:

```text
GET /api/migration/sessions/:sessionId/failures
GET /api/migration/sessions/:sessionId/support-bundle?format=json|markdown
```

They consume persisted collector envelopes, Assessment/Review decisions,
migration-session run results, verification evidence, and—when explicitly
available—immutable Plan, Apply, artifact, and ActionRun metadata. All text is
passed through the shared secret-redaction path before export.

These endpoints are not execution APIs. They do not persist diagnostics, create
or approve Plans, claim Apply, append ActionRunRecord, execute repair, execute
rollback, or mutate a source/target host. `RepairPlanDraft` is advisory data;
any target-changing suggestion must first become a separately reviewed,
artifact-bound immutable Environment Plan. Rollback fields describe recorded
boundaries and never imply automatic recovery.

## Capability catalog preview and promotion draft

Certified capability packages can be projected into catalog review artifacts
without changing runtime catalog behavior:

```text
GET /api/capabilities/catalog-preview
GET /api/capabilities/catalog-preview/diff
GET /api/capabilities/catalog-preview/artifact
POST /api/capabilities/catalog-preview/promotion-request
```

These admin-only endpoints reuse capability certification and catalog preview
models. They return review summaries, diff items, safety flags, generated
artifact metadata, and a promotion request draft. The draft is not an enablement
operation: it does not modify `configs/catalog/*`, replace the runtime catalog,
enable dynamic plugins, approve an Environment Plan, create an Apply Run, or
execute target mutation. Generated preview artifacts remain deterministic
review records with `enabledByDefault=false`.
