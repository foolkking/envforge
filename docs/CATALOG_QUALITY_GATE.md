# Catalog Quality Gate

Last updated: 2026-05-29

The quality gate is the rule set that decides whether a catalog item
can carry a given `supportLevel`. It is enforced by
`scripts/check-catalog-quality.mjs` (run via `npm run catalog:check`)
and is the contract every PR must satisfy before adding or upgrading a
catalog item.

The gate is intentionally strict. EnvForge's catalog is a capability
rule library; promising more depth than the rule actually has is worse
than admitting an item is `detect-only`.

---

## 0. Universal rules (apply to every supportLevel)

A catalog item, regardless of level, **must**:

- have a stable `id`;
- have a `capabilityKey`;
- have `kind` (`software` / `combo` / `profile`);
- have `name`, `nameEn`, `summary`, `summaryEn`;
- have `category`;
- have `supportLevel`;
- have `modes` (object with `migrate`, `build`, `maintain`);
- have `riskLevel`;
- have `planOnly: true`;
- have `audit` block with status, original/final supportLevel, reasons;
- have at least one `detect` signal;
- have a `summary` that **describes a capability**, not "Install X" /
  "一键安装 X" / "确认并安装" / "快速部署";
- have a `security` block declaring risk and (when applicable) secrets;
- never bypass the Environment Plan flow (no direct `/api/execute`
  reference, no UI button labelled "Install" / "确认并安装" without a
  Plan in between).

If any of the above is missing, the item is **fail** at every level.

---

## 1. `detect-only`

**When to use.** EnvForge can recognise the capability but cannot plan
a clean install, migration, configuration, validation, or rollback.

Examples: server panels (Cockpit, Portainer, FileBrowser), unfamiliar
self-hosted apps with bespoke install scripts, items where we have
package names but no validation hook.

**Required.**

- `detect` with at least one of `packages`, `binaries`, `services`,
  `ports`, `paths`.
- `modes.migrate`, `modes.build`, `modes.maintain` all `false` unless
  explicitly justified in `audit.notes`.
- `ui.badge` set to `"Detect Only"` or `"Needs Review"`.

**Forbidden.**

- Any default `apply` / `install` action that mutates the target.
- "Add to Plan" as the primary CTA without an explicit acknowledgement
  that the item enters the Review Queue rather than a Rebuild Plan.
- Claims of supporting validation / rollback / migration / data.

**Pass criteria.** A user looking at the card cannot mistake it for
something safe to one-click install.

---

## 2. `basic-rebuild`

**When to use.** EnvForge can install a package or runtime safely on a
clean target. There is no significant config migration and no critical
data directory.

Examples: CLI tools (`htop`, `bat`, `ripgrep` …), language runtimes
without ecosystem state (Go, .NET, OpenJDK), simple system packages.

**Required.**

- everything in §0;
- `install.packageMap` covering at least the package managers the item
  supports;
- `install.planActions` that produce an Environment Plan (no direct
  shell);
- `validate` with at least one health check (e.g. `node --version`,
  `command -v rsync`);
- `rollback` declaring whether the package can be removed and whether
  user data is preserved;
- `security.riskLevel`;
- `crossDistro.packageMap` covering supported package managers;
- `planOnly: true`.

If the capability bundles multiple packages (e.g. modern CLI tools), the
`detect.packages` and `install.packageMap` lists must include **every**
companion (`bat`, `ripgrep`, `fd-find`, `exa`, `zoxide`, `fzf`, `tldr`)
so a host with any of them is recognised.

**Forbidden.**

- Any `apply` path that runs without a Plan.
- Claims of migrating user configuration.
- Skipping `validate`.

**Pass criteria.** Click → Rebuild Plan with install + verify + a
documented rollback strategy.

---

## 3. `managed-config`

**When to use.** EnvForge understands the capability's configuration
files, can scan secrets, and can validate config + service state. Data
migration is not the core promise (or is `optional` / `review`).

Examples: nginx, fail2ban, certbot, ufw, openvpn, samba.

**Required.**

- everything in §2;
- `configs.files` and/or `configs.globs`;
- `configs.sensitivity`;
- `configs.secretPatterns` **or** `security.secretPolicy`;
- at least one `validate` check covering config syntax or service
  state;
- `rollback.backupPaths` or `rollback.restoreBackupOf`;
- `data.strategy` (one of `none` / `optional` / `rsync-review` /
  `dump-restore` / `rebuildable` / `not-recommended` — silence is not
  acceptable);
- `references` — at least notes — when the software's config typically
  refers to filesystems, certificates, env files, or upstream services;
- `migrationCompleteness` declaring whether config-only migration is
  sufficient;
- `crossDistro` with package and service mappings.

**Forbidden.**

- Direct config writes (`writeConfigFile` without a Change Plan).
- Implicit secret handling. The item must declare what it scans for.

**Pass criteria.** Click → Change Plan or Rebuild Plan that lets the
operator inspect every config + secret risk before apply.

---

## 4. `full-migration`

**When to use.** Core capability with reliable detect, install, config,
data, validate, rollback, and cross-distro mapping. May appear on the
home page recommended list.

Examples: nginx, docker, postgresql, mysql/mariadb, redis, ssh.

**Required.**

- everything in §3;
- `data.paths[*].strategy` and `data.paths[*].requiredForFunctionality`;
- `references` covering config includes, filesystem paths, env files,
  certificates, upstream services, volumes (when applicable);
- `migrationCompleteness.configOnly` ∈ `complete / partial / incomplete`,
  with `missingRisks` enumerated when not `complete`;
- `validate.preApply` and `validate.postApply` filled;
- `rollback` declaring `backupPaths`, restore strategy, service-state
  restore, and package rollback policy;
- `security.dangerousOperations` listed when applicable;
- `crossDistro.packageMap`, `serviceMap`, and where relevant
  `configPathMap`;
- `ui.badge: "Full Migration"`, `ui.warnings` populated when there are
  known gotchas.

**Forbidden.**

- Anything that bypasses Environment Plan.
- Claiming `full-migration` while leaving `data.strategy` blank.

**Pass criteria.** Suitable for home-page recommendation; produces a
real Migration / Rebuild / Change / Remove plan; safe rollback exists.

---

## 5. Special-case rules

These categories have **mandatory extra rules** on top of the
supportLevel definitions.

### 5.1 Server panels (Cockpit, Portainer, FileBrowser, Webmin, 1Panel)

- Never recommended on the home page.
- May not advertise themselves as a substitute for EnvForge.
- Maximum supportLevel `managed-config`. Any higher requires explicit
  Schema V2 fields.
- `summary` must describe the capability, not promise replacement of
  EnvForge.

### 5.2 Databases (PostgreSQL, MySQL, MariaDB, Redis, MongoDB, etc.)

- `data.strategy` is mandatory (`dump-restore` is the default).
- May not declare `rsync` of data directories as default.
- `validate` must cover service activity at minimum; ideally also a
  trivial query (`SELECT 1`, `redis-cli ping`).

### 5.3 Docker / container hosts

- `data.paths` must enumerate volumes, bind mounts, and compose files.
- `/var/lib/docker` is **not** copied by default.
- `migrationCompleteness.missingRisks` should mention named volumes and
  external networks.

### 5.4 Security capabilities (SSH, UFW, firewalld, Fail2Ban, sudoers)

- `security.riskLevel` ∈ `privileged` or `dangerous`.
- SSH must declare lockout-prevention strategy (reload, second-session
  probe, rollback timer).
- Firewall items must declare "do not block existing SSH" rule.
- `validate` mandatory; `rollback` mandatory.

### 5.5 Runtime / language ecosystems

- Distinguish system package vs version manager vs global package.
- Do not blindly migrate global packages.
- Document package-manager source and `review` policy.

### 5.6 Combo / profile items

- Must declare `includes`.
- `supportLevel` may not exceed the **lowest** supportLevel of any
  required component, unless extra rules justify it (recorded in
  `audit.reasons`).
- Combo apply must always go through a Plan.

---

## 6. Failure conditions

The check script must mark an item **fail** when:

- it lacks `capabilityKey`, `supportLevel`, `riskLevel`, `modes`, or
  `audit`;
- its `summary` matches `^(install |安装 |一键安装 |快速部署 |确认并安装)`;
- its supportLevel is `full-migration` but `validate`, `rollback`,
  `security`, or `data.strategy` is missing;
- its supportLevel is `managed-config` but `configs`, `validate`, or
  `rollback` is missing;
- its supportLevel is `basic-rebuild` but `install` or `validate` is
  missing;
- it advertises itself as a substitute for EnvForge.

If the gate fails, the only remediations are:

1. fix the missing field, or
2. downgrade the item, or
3. mark it `audit.status: needs-review` with a reason.

Padding the item with fabricated validation commands is forbidden.

---

## 7. Recommended-on-home rules

- Only `full-migration` and explicitly approved `managed-config` items
  may set `ui.recommendedOnHome: true`.
- Server panels, mailservers, document platforms, photo libraries, and
  generic "self-hosted" tools must **not** appear on the home page even
  if they reach `managed-config`.
- The home page must group items by supportLevel, not by category, so
  the operator never confuses a `detect-only` item with a recommended
  capability.
