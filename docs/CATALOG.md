# Capability Catalog

> **Product update.** End users no longer see the four-tier
> supportLevel ladder. They see only **Full Migration Certified**
> capabilities in Build / Migrate / Maintain. Everything else lives in
> the admin registry. See `docs/FULL_MIGRATION_REQUIREMENTS.md` for the
> certification standard and
> `docs/CAPABILITY_CERTIFICATION_BACKLOG.md` for the upgrade backlog.

Last updated: 2026-05-31

EnvForge's catalog is a **Capability Catalog**, not an app market. A
catalog item is a migration and rebuild rule card that explains how a
capability is detected, planned, applied, verified, and rolled back.

This document is the operator-facing index. The canonical schema and
authoring rules live in:

- [FULL_MIGRATION_REQUIREMENTS.md](./FULL_MIGRATION_REQUIREMENTS.md) —
  the standard a capability must meet to enter the user-side flow.
- [CAPABILITY_CERTIFICATION_BACKLOG.md](./CAPABILITY_CERTIFICATION_BACKLOG.md)
  — auto-generated upgrade backlog (`npm run certification:backlog`).
- [catalog-audit/full-migration-certification.json](./catalog-audit/full-migration-certification.json)
  — machine-readable audit output.
- [CATALOG_SCHEMA_V2.md](./CATALOG_SCHEMA_V2.md) — field-by-field shape
  contract.
- [CATALOG_AUTHORING.md](./CATALOG_AUTHORING.md) — how to write a new
  item.
- [CATALOG_QUALITY_GATE.md](./CATALOG_QUALITY_GATE.md) — internal-only
  per-supportLevel checks (kept for historical compatibility; the
  user-side gate is now the certification audit).
- [CATALOG_EXPAND_PROMPT.md](./CATALOG_EXPAND_PROMPT.md) — LLM prompt.

---

## End-user vs admin view

| Surface | Who sees what |
| --- | --- |
| End-user Build / Migrate / Maintain | Only Full Migration Certified items |
| `/api/catalog` (default) | Only Full Migration Certified items |
| `/api/catalog?include=all` (admin only) | Every item with full certification metadata |
| `/api/catalog/certification` (admin only) | Audit-style summary with missing requirements |

The certification gate is enforced in two places that **must** stay in sync:

- `apps/api/src/catalog-certification.ts:deriveCertification` — runtime
- `scripts/check-full-migration-certification.mjs` — CI audit

The `catalog-certification.test.ts` suite asserts both agree.

---

## Current state

```
catalog     119
certified   105
not-ready    14
open upgrade backlog 0
terminal decisions   14   (blocked 5, archive-candidate 3, needs-human-decision 6)
```

Updates to this section come from
`docs/catalog-audit/full-migration-certification.json` — re-run
`npm run certification:check` and `npm run certification:backlog`
to refresh.

---

Last updated: 2026-05-31

EnvForge's catalog is a **Capability Catalog**, not an app market. A
catalog item is a migration and rebuild rule card that explains how a
capability is detected, planned, applied, verified, and rolled back.

This document is the operator-facing index. The canonical schema and
authoring rules live in:

- [CATALOG_SCHEMA_V2.md](./CATALOG_SCHEMA_V2.md) — field-by-field shape
  contract.
- [CATALOG_AUTHORING.md](./CATALOG_AUTHORING.md) — how to write a new
  item.
- [CATALOG_QUALITY_GATE.md](./CATALOG_QUALITY_GATE.md) — minimum
  requirements per supportLevel.
- [CATALOG_EXPAND_PROMPT.md](./CATALOG_EXPAND_PROMPT.md) — LLM prompt.
- [CATALOG_AUDIT_REPORT.md](./CATALOG_AUDIT_REPORT.md) — current audit
  results for every catalog item.

---

## Catalog count

The static catalog has **119 items** today (`apps/api/src/catalog.ts`):

- **104 software** items (single capability)
- **15 combo** items (composite stacks)

Item totals are extracted from source via
`scripts/audit-catalog-items.mjs`; the audit report is regenerated on
every catalog change.

---

## Support levels

Every item must declare a `supportLevel`:

| supportLevel       | Meaning                                                                                        |
| :----------------- | :--------------------------------------------------------------------------------------------- |
| `detect-only`      | EnvForge can identify the capability, but it must enter the Review Queue before any action.    |
| `basic-rebuild`    | EnvForge can plan package install + minimal validation, no config or data migration.           |
| `managed-config`   | EnvForge understands config paths, secret risk, backup, validation, and safe apply.            |
| `full-migration`   | All of managed-config, plus data strategy, references, validation, rollback, cross-distro.     |

UI rules:

- Default home page only highlights `full-migration` and a small set of
  approved `managed-config` items.
- `detect-only` items must show a `Detect Only` badge and cannot
  generate a Rebuild Plan directly — they enter the Review Queue.
- `basic-rebuild` items must show that they only handle install +
  verify; they do not migrate user configuration.
- `managed-config` items must show secret-scan + validation + rollback
  steps before apply.
- `full-migration` items may set `ui.recommendedOnHome: true`.

---

## Capability layering

EnvForge separates user-visible capability cards from internal
detection rules. They are joined through `capabilityKey`.

| visible catalog id   | rule id    | capabilityKey         |
| :------------------- | :--------- | :-------------------- |
| `nginx-web-service`  | `nginx`    | `web-server.nginx`    |
| `docker-host-profile`| `docker`   | `container.docker`    |
| `postgres-profile`   | `postgres` | `database.postgresql` |
| `mysql-server`       | `mysql`    | `database.mysql`      |
| `mariadb`            | `mysql`    | `database.mysql`      |
| `redis-server`       | `redis`    | `cache.redis`         |
| `node-runtime-profile`| `node`    | `runtime.nodejs`      |
| `python-toolchain`   | `python`   | `runtime.python`      |
| `ssh-hardening`      | `ssh`      | `security.ssh`        |
| `firewall-baseline`  | `ufw`      | `security.firewall.ufw` |
| `fail2ban-protection`| `fail2ban` | `security.fail2ban`   |

Multiple visible items may share one capabilityKey when they describe
variants of the same underlying capability (e.g. `mysql-server` and
`mariadb`).

---

## Mutation contract (mandatory)

- `Add to Plan` means "add this capability to an Environment Plan".
- `Generate Rebuild Plan` means "create a reviewable plan", not "install
  immediately".
- `Remove Capability` means "create a Remove Plan", not "uninstall
  arbitrary packages".
- `Config changes` become Config Change Proposals with diff, secret
  scan, validate hook, apply, verify, and rollback.
- `Imported YAML` becomes an Imported Recipe Plan and follows the same
  review path.

No catalog item may bypass `/api/plans`. Direct execution endpoints
exist only for legacy compatibility and are disabled by default.

---

## Companion packages

Many capabilities ship more than a single binary. Authors must list
**every** companion in both `detect.packages` and `install.packageMap`,
so a host with any of them gets recognised. Examples:

- Modern CLI tools: `bat`, `ripgrep`, `fd-find`, `exa` (or `eza`),
  `zoxide`, `fzf`, `tldr`, `lsd`, `dust`, `delta`, `procs`, `bottom`.
- Network tools: `nethogs`, `iftop`, `vnstat`, `tcpdump`, `nmap`,
  `mtr-tiny`, `traceroute`, `bmon`.
- System monitor tools: `htop`, `btop`, `iotop`, `ncdu`, `glances`,
  `dstat`, `sysstat`.
- Backup sync: `rsync`, `rclone`, `borgbackup`, `restic`, `duplicity`.

If you add a member to one of these families, update the corresponding
catalog item rather than creating a separate one.

---

## Audit responsibilities

- Every catalog item has an `audit` block recording status, original
  supportLevel, final supportLevel, and reviewer notes.
- The `npm run catalog:check` script enforces the quality gate.
- The `npm run catalog:audit` script regenerates the dump and the
  audit report.
- New items are blocked at CI until they pass both scripts.
