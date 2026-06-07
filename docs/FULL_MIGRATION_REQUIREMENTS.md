# Full Migration Certified — Capability Requirements

> **Product decision (current phase).** EnvForge no longer exposes the
> four-tier supportLevel ladder (`detect-only` / `basic-rebuild` /
> `managed-config` / `full-migration`) to ordinary users. End users see
> exactly two states:
>
> - **Full Migration Certified** — visible in Build / Migrate /
>   Maintain.
> - **Not Ready** — hidden from end users, kept in the administrator
>   capability registry with the missing-requirement list.
>
> This document defines what *Full Migration Certified* means.

## What Full Migration Certified is, and is not

Full Migration Certified is **not** the same as "100 % automatic
migration". A capability is certified when EnvForge has a complete set
of safety rules and execution boundaries around it, including
automatic detection, structured planning, validated apply, rollback,
secret-aware reporting, and — when an operation cannot be performed
safely without operator input — **structured, auditable, mandatory
manual steps**.

Concretely, certified means:

1. The capability can be detected from a target's runtime evidence.
2. The capability can be planned through Environment Plan with no
   side-effect bypass.
3. The plan honours conflict rules, approval gates, and remaining-risk
   acks before apply.
4. Apply runs through Managed Execution: snapshot → apply → verify →
   rollback on failure.
5. Verify reports per-action exit codes and is replayable.
6. Rollback is either fully automatic, or has a documented manual
   procedure with explicit operator confirmation gates.
7. Secrets touched during the plan are redacted in every report.
8. Cross-distro deltas are mapped (or explicitly refused).
9. Data strategy is one of: `none`, `optional`, `review`,
   `dump-restore`, `official-backup-restore`, `manual`, or `blocked`.
   Raw `rsync` of live data directories is forbidden when not
   appropriate.

Capabilities like `gitlab-ce`, `keycloak`, `vault-secrets`,
`docker-mailserver`, or `k3s` can absolutely be certified — they just
ship with required `manual` steps, `official-backup-restore` data
strategy, and additional approval gates.

## The 13-section requirement contract

A capability is certified iff every section below is satisfied or
explicitly waived with a structured `notApplicable` reason.

### 1. Identity

```ts
{
  id: string;
  capabilityKey: string;
  name: string;
  category: "runtime" | "developer" | "database" | "container" |
            "security" | "network" | "service";
  description: string;
  supportedModes: { migrate: boolean; build: boolean; maintain: boolean };
  owner?: string;            // maintainer email or team
}
```

### 2. Detection

At least one of the following must be present:

- `detect.packages` (apt / dnf / rpm / pacman / apk / zypper).
- `detect.binaries` (PATH lookup).
- `detect.services` (systemd unit names).
- `detect.configPaths` (file or glob).
- `detect.ports` (TCP / UDP).
- `detect.processes` (`ps -ef` regex).
- `detect.containers` (image name / compose service).

Plus `detect.evidenceReasons: string[]` that explain *why* the
detection signal proves the capability is actually in use.

### 3. Install / Rebuild Plan

- `install.packageMap` — apt + dnf at minimum, additional managers
  documented when the catalog claims them.
- `install.actions` — list of `installPackage` / `enableService` /
  `runCommand` / `writeConfig` actions in execution order.
- `install.preflight` — checks that gate apply (e.g. cloud-init done,
  apt lock free).
- `install.idempotency` — every action must be safely re-runnable.
- `install.targetReconciliation` — when the target already provides
  the capability, the plan emits a reconcile path rather than a fresh
  install.
- `install.existedBeforeHandling` — see ManagedCapabilityRecord.
- `install.managedMarker` — set to `true` when the orchestrator emits
  a ManagedCapabilityRecord on success (the default for certified
  capabilities).

### 4. Config Governance

- `config.files`, `config.globs`, `config.ownership`.
- `config.defaultVsCustom` — heuristic for distinguishing distro
  defaults from operator edits.
- `config.secretPatterns` — additional patterns beyond the base
  redactor.
- `config.blockedPaths` — paths the safe writer must refuse.
- `config.validation` — config-syntax validator (`nginx -t`,
  `sshd -t`, `visudo -cf`, `apache2ctl configtest`, etc.).
- `config.safeApply` — uses one of the four high-risk safe apply
  surfaces (`safeWriteConfigFile`, `safeSshdConfigApply`,
  `safeFirewallApply`, `safeSudoersApply`, `safeSystemdUnitApply`).
- `config.backupAndRollback` — paths the rollback path must restore.

### 5. Data Strategy

```ts
strategy: "none" | "optional" | "review" | "dump-restore" |
          "official-backup-restore" | "manual" | "blocked";
```

- Required for any capability that owns persistent state.
- `dump-restore` MUST cite the dump command + restore command.
- `official-backup-restore` MUST cite the upstream tool and version
  range (e.g. `gitlab-backup create`, `kc.sh export`).
- `manual` MUST attach `manualSteps[]` with each step labelled
  `confirmRequired`.
- `blocked` MUST explain why and what the operator should do instead.
- `dataLossWarnings` MUST list every irreversible scenario.

Raw `rsync` of live data directories (e.g. `/var/lib/postgresql`,
`/var/lib/mysql`, `/var/lib/redis`, `/var/lib/elasticsearch`) is
forbidden when the upstream supplies a logical dump tool.

### 6. Dependency / Reference Graph

- Configuration includes (`include` / `!includedir`).
- Environment files (`/etc/default/*`, `/etc/sysconfig/*`).
- Filesystem paths the capability writes to.
- Certificates / keys consumed.
- Upstream services depended on.
- Ports + sockets.
- Volumes (named + bind).
- External dependencies (DNS, ACME, registry, identity provider).
- DNS records that MUST exist before apply.
- Identity / secret dependencies (e.g. requires Vault / SSO).

### 7. Validation

- `validate.config` — exit-0 syntax check.
- `validate.serviceStatus` — `systemctl is-active <unit>` (or
  equivalent on non-systemd).
- `validate.port` — listening on the expected port.
- `validate.healthCheck` — application-level probe.
- `validate.dataRestore` — only when data strategy is `dump-restore`
  or `official-backup-restore`.
- `validate.targetState` — reconcile probe vs the desired state.
- `validate.postRollback` — verify the rollback actually restored
  service health.

### 8. Rollback

- `rollback.fileRestore` — backup paths + restore command.
- `rollback.serviceState` — start / stop / reload to return to the
  pre-apply state.
- `rollback.packagePolicy` — auto-uninstall only when
  `existedBefore=false` AND `removableByEnvForge=true`.
- `rollback.dataRollback` — automatic where possible; otherwise
  `manualSteps` with `confirmRequired`.
- `rollback.limitations` — list operations the rollback path
  cannot recover.
- `rollback.failedHandling` — what happens when rollback itself fails
  (must record `rollback-failed` ActionRunRecord and surface in the
  Plan Report).

### 9. Security

- `security.riskLevel` — one of `safe` / `review` / `privileged` /
  `dangerous`.
- `security.secretPolicy` — `none` / `redact` / `confirm` / `blocked`.
- `security.requiredApprovals` — typed gates (`ssh-lockout-confirm`,
  `secret-confirm`, `data-strategy-confirm`,
  `firewall-lockout-confirm`, `identity-provider-confirm`,
  `backup-restore-confirm`, `manual-dns-confirm`).
- `security.blockedOperations` — operations the apply gate must
  refuse outright.
- `security.dangerousOperations` — operations that need the typed
  CONFIRM phrase in the UI.
- `security.sshLockoutProtection` — required when the capability
  writes `sshd_config`.
- `security.firewallLockoutProtection` — required when the capability
  rewrites firewall rules.
- `security.sudoersProtection` — required when the capability writes
  to `sudoers` / `sudoers.d/*`.
- `security.logRedaction` — every command output goes through
  `redactSecrets` before write.

### 10. Cross-distro

- `crossDistro.packageMap` — at minimum apt + dnf; document any other
  managers the catalog claims to support.
- `crossDistro.serviceMap` — debian / rhel / fedora / arch / alpine.
- `crossDistro.configPathMap` — when paths differ across distros.
- `crossDistro.userGroupDifferences` — e.g. `www-data` vs `nginx` vs
  `apache`.
- `crossDistro.compatibilityLevel` — `verified` / `family` /
  `untested` / `unsupported`.
- `crossDistro.fallbackStrategy` — what happens on partial support.
- `crossDistro.unsupportedTargetBehavior` — must refuse, not silently
  apply.

### 11. Conflict Rules

- `conflicts.mutuallyExclusive` — capability keys that cannot
  co-exist.
- `conflicts.portConflicts` — ports the capability binds.
- `conflicts.semanticOverlaps` — capabilities with overlapping intent.
- `conflicts.alternatives` — drop-in replacements (`alternativeOf`).
- `conflicts.profileIncludes` — combo / profile relationships
  (`includes`, `profileOf`).
- `conflicts.comboComponentRules` — when this capability is part of a
  combo, document how its rules feed into the combo's
  `effectiveSupportLevel`.

### 12. Environment Plan + Report Integration

Every certified capability must work end-to-end through:

```
capability evidence → Environment Plan → Plan Review → Apply Gate →
Managed Execution → ActionRunRecord → Verify → Rollback → Plan Report
```

The Plan Report MUST include selected capabilities, evidence, risks,
approvals, conflicts, dataStrategy decisions, action runs, validation
results, rollback availability, and any unresolved manual steps.

### 13. Harness / Scenario

- Every certified capability has at least one **dry-run** harness
  scenario in `scripts/harness/scenarios/` that asserts the plan
  shape, the apply-gate behaviour, and the expected ActionRunRecord
  shape.
- Core capabilities (`nginx-web-service`, `docker-host-profile`,
  `ssh-hardening`) additionally have **live** scenarios exercised by
  `npm run harness:certify`.
- Scenario JSON documents `expected` (planner contract) and `verify`
  (live-mode contract) explicitly. No "best effort" assertions.

## Manual steps are first-class

Capabilities like Vaultwarden, Keycloak, GitLab-CE,
docker-mailserver, k3s, vault-secrets need manual steps (DKIM key
transport, realm export, mail DNS, unseal keys). Those capabilities
can still reach certified — manual steps are **not** a downgrade —
provided the manual steps are:

```ts
manualSteps: Array<{
  id: string;
  label: string;
  description: string;
  confirmRequired: true;
  operator: "user" | "admin";
  ordering: "before-apply" | "between-apply-and-verify" | "after-verify" | "before-rollback";
}>
```

The Plan Review UI renders each step as a checkbox; the apply gate
refuses non-dry apply until each step is acked.

## Anti-fake rule

A capability is **not** certified just because the JSON document
claims so. The `scripts/check-full-migration-certification.mjs` audit
re-derives every requirement from the catalog item's metadata, the
catalog rule registry, the audit record, and the actual harness
scenario file. A capability fails certification when ANY of:

- a required field is missing,
- a required field references a value that does not exist (e.g.
  `manualSteps[*].id` collides),
- the catalog item is `detect-only` / `basic-rebuild` /
  `managed-config` and has not been promoted with the explicit
  `certificationStatus: "certified"` opt-in,
- harness coverage is missing for an item the catalog claims is in
  the user-side Build flow.

This document is the source of truth for the audit.
