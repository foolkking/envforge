# Capability Catalog

The Capability Catalog is a migration/rebuild rule library, not an app market.
Catalog items describe how a capability is detected, planned, applied, verified,
rolled back, and reported.

## User/admin split

| Surface | Visibility |
|---|---|
| Build/Migrate for ordinary users | Full Migration Certified capabilities only |
| `/api/catalog` default | Certified-only |
| Capability Admin | All items, certification metadata, standards, rules, suggestions, integrations |
| `/api/catalog?include=all` | Admin-only |
| `/api/catalog/certification` | Admin-only audit summary |

Current generated audit: 119 catalog items, 105 certified, 14 not-ready terminal
decisions. Source: `docs/generated/catalog-certification.*`.

## Certification states

End users see two states:

| State | Meaning |
|---|---|
| Full Migration Certified | Safe to expose in Build/Migrate/Maintain plan flows |
| Not Ready | Hidden from end users; available only in admin governance |

The legacy internal `supportLevel` ladder still exists for rule depth and audit
logic:

- `detect-only`
- `basic-rebuild`
- `managed-config`
- `full-migration`

The ladder must not be rendered as ordinary user-facing filters or badges.

## Full Migration Certified contract

A certified capability has complete or explicitly waived coverage for:

1. Identity.
2. Detection.
3. Install/rebuild plan.
4. Config governance.
5. Data strategy.
6. Dependency/reference graph.
7. Validation.
8. Rollback.
9. Security.
10. Cross-distro support.
11. Conflict rules.
12. Environment Plan/report integration.
13. Harness/scenario coverage.

Certified does not mean fully automatic. Manual steps are acceptable when they
are structured, auditable, ordered, and `confirmRequired`.

## Schema overview

Every catalog item has a visible item joined to deeper detection rules through
`capabilityKey`.

Required top-level fields:

| Field | Purpose |
|---|---|
| `id` | Stable kebab-case id |
| `capabilityKey` | Logical capability identifier, for visible item/rule joins |
| `kind` | `software`, `combo`, or `profile` |
| `name`, `nameEn`, `summary`, `summaryEn` | Capability-oriented copy |
| `category` | Runtime, developer, database, container, security, network, service, etc. |
| `supportLevel` | Internal rule depth |
| `modes` | `migrate`, `build`, `maintain` availability |
| `riskLevel` | `safe`, `review`, `privileged`, `dangerous` |
| `planOnly` | Must be true |
| `detect` | At least one detection signal |
| `install` | Required for `basic-rebuild` and above |
| `configs` | Required for `managed-config` and above |
| `data` | Required for full migration/stateful capabilities |
| `validate` | Required for `basic-rebuild` and above |
| `rollback` | Required for `basic-rebuild` and above |
| `security` | Risk, secret policy, blocked/dangerous operations |
| `crossDistro` | Package/service/config path mappings |
| `audit` | Why the item has its current state |

## Detection and companion packages

Detection can use packages, binaries, services, config paths, ports, processes,
and containers.

Capabilities that represent a software family must list every companion package
in detection and install maps. Examples:

- modern CLI tools: `bat`, `ripgrep`, `fd-find`, `eza`/`exa`, `zoxide`, `fzf`,
  `tldr`, `lsd`, `dust`, `delta`, `procs`, `bottom`;
- network tools: `nethogs`, `iftop`, `vnstat`, `tcpdump`, `nmap`, `mtr-tiny`,
  `traceroute`, `bmon`;
- monitor tools: `htop`, `btop`, `iotop`, `ncdu`, `glances`, `dstat`,
  `sysstat`;
- backup/sync: `rsync`, `rclone`, `borgbackup`, `restic`, `duplicity`.

If any companion is present, EnvForge should treat it as capability evidence,
not a low-confidence orphan package.

## Quality gate by support level

| Level | Minimum promise |
|---|---|
| `detect-only` | Recognize and send to review queue; no default apply |
| `basic-rebuild` | Package install plan, validation, rollback policy |
| `managed-config` | Config paths, secret policy, validation, backup/rollback, data strategy |
| `full-migration` | Data/references/cross-distro/conflict/plan/report/harness coverage |

Universal failure conditions:

- missing stable id, capabilityKey, supportLevel, riskLevel, modes, planOnly,
  audit, or detect signal;
- summary describes "install X" instead of a capability;
- direct execution bypasses Environment Plan;
- claimed support level is deeper than real metadata;
- fabricated validation/rollback fields.

## Data, security, and rollback rules

- Databases need explicit data strategy. Prefer logical dump/restore when
  upstream provides it.
- Docker host rules inventory compose files, env files, bind mounts, volumes,
  networks; `/var/lib/docker` is not copied by default.
- SSH, firewall, sudoers, and similar security capabilities require privileged
  or dangerous risk levels, approvals, validation, and rollback protection.
- Combos/profiles cannot exceed the effective support of their required
  components unless explicit extra rules justify it.

## Capability Admin

Capability Admin is admin-only and contains:

- Overview: coverage, backlog, suggestions, queues, owner load.
- Rule Registry: every item, certification status, missing requirements.
- Standards: online-maintained certification/standard versions.
- Suggestion Inbox: user/admin triage, owner assignment, backlog decisions.
- Package Integrations: package/service/config/detection/validate/rollback
  mappings, not host package management.
- Users & Queues: maintainers, reviewers, handlers, review queues, assignments.

## Authoring workflow

1. Decide the real support level first.
2. Fill only fields supported by real evidence.
3. Declare companion packages and cross-distro maps.
4. Define plan templates, validation, rollback, security, and data strategy.
5. Add harness scenarios for certified capabilities.
6. Run quality/certification checks.

Commands:

```bash
npm run catalog:check
npm run certification:check
npm run certification:backlog
```

## Generated artifacts

| File | Source |
|---|---|
| `docs/generated/catalog-certification.md` | Full Migration certification summary |
| `docs/generated/catalog-certification.json` | Machine-readable audit |

Do not edit generated artifacts by hand.
