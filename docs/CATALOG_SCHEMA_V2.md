# Catalog Schema V2

Last updated: 2026-05-29

This document defines the canonical shape of every Capability Catalog
entry in EnvForge. The schema has two physical homes today:

1. **Visible catalog item** — the user-facing record returned by
   `listCatalogItems()` (`apps/api/src/catalog.ts`).
2. **Detection rule** — the deeper rule consumed by the migration
   classifier (`apps/api/src/catalog-rules.ts`).

The two layers are joined through `capabilityKey`. A visible item may
exist without a deep detection rule (status `detect-only`); a detection
rule may serve multiple visible items (e.g. `mysql-server` and
`mariadb` both map to `database.mysql`).

The schema is **versioned**. V2 is the version every new item must
satisfy. Items written before V2 carry an `audit` block recording their
upgrade status.

---

## 1. Top-level fields

| Field           | Type                                         | Required | Notes                                                                                          |
| :-------------- | :------------------------------------------- | :------: | :--------------------------------------------------------------------------------------------- |
| `id`            | string                                       |   yes    | Stable, lowercase-kebab id. Once published it must not change.                                 |
| `capabilityKey` | string                                       |   yes    | Logical capability identifier, dotted (e.g. `web-server.nginx`). Joins visible item ↔ rule.    |
| `kind`          | `"software"` \| `"combo"` \| `"profile"`     |   yes    | Combos express composite capabilities; profiles bundle software for a use case.                |
| `name`          | string                                       |   yes    | Display name; should describe a capability, not an install command.                            |
| `nameEn`        | string                                       |   yes    | English display name.                                                                          |
| `summary`       | string                                       |   yes    | Capability-oriented summary. Must not start with "安装/Install/一键安装/快速部署".               |
| `summaryEn`     | string                                       |   yes    | English summary.                                                                               |
| `category`      | enum                                         |   yes    | `runtime / developer / database / container / security / network / service`.                   |
| `tags`          | string[]                                     |    no    | Free-form tags for filtering.                                                                  |
| `supportLevel`  | enum                                         |   yes    | `detect-only / basic-rebuild / managed-config / full-migration`.                               |
| `modes`         | `{ migrate: bool; build: bool; maintain: bool }` | yes  | Which modes can use this capability. Detect-only items default to all-false.                   |
| `riskLevel`     | enum                                         |   yes    | `safe / review / privileged / dangerous`. Drives risk badges and gating.                       |
| `planOnly`      | boolean                                      |   yes    | Always `true` for V2 items. Catalog actions never bypass Environment Plan.                     |
| `detect`        | object                                       |   yes    | At least one detection signal required (see §2).                                               |
| `install`       | object                                       |  cond    | Required for `basic-rebuild` and above.                                                        |
| `configs`       | object                                       |  cond    | Required for `managed-config` and `full-migration`.                                            |
| `data`          | object                                       |  cond    | Required for `full-migration`; optional otherwise.                                             |
| `references`    | object                                       |   no     | Reference parsing rules (config includes, env files, certificates, upstreams).                 |
| `validate`      | object                                       |  cond    | Required for `basic-rebuild` and above.                                                        |
| `rollback`      | object                                       |  cond    | Required for `basic-rebuild` and above.                                                        |
| `security`      | object                                       |   yes    | Risk classification, secret policy, blocked paths, dangerous operations.                       |
| `crossDistro`   | object                                       |  cond    | Required for `basic-rebuild` and above when relevant.                                          |
| `ui`            | object                                       |   no     | UI hints (badges, recommended-on-home, warnings).                                               |
| `audit`         | object                                       |   yes    | Audit metadata (status, upgrade history, reviewer notes).                                      |

---

## 2. `detect`

Every catalog item must declare at least **one** detection signal:

```yaml
detect:
  packages:
    apt: [nginx, nginx-full, nginx-extras]
    dnf: [nginx]
    pacman: [nginx]
    apk: [nginx]
  binaries: [nginx]
  systemd: [nginx.service]
  ports: [80, 443]
  paths: [/etc/nginx]
```

A capability that bundles **multiple companion packages** (e.g. modern
CLI tools = `bat / ripgrep / fd / exa / zoxide / fzf / tldr`) must list
**all** of them under `detect.packages` or `detect.binaries`. EnvForge
treats any of them being present on the host as evidence the capability
exists.

---

## 3. `install`

```yaml
install:
  packageMap:
    apt: [nginx]
    dnf: [nginx]
  planActions:
    - kind: installPackage
      packageNames: [nginx]
    - kind: enableService
      serviceName: nginx
```

`planActions` are **plan templates only** — they are never executed
directly. The plan engine clones them into an Environment Plan that
must be reviewed before apply.

---

## 4. `configs`

```yaml
configs:
  files: [/etc/nginx/nginx.conf]
  globs: [/etc/nginx/conf.d/*.conf]
  exclude: [/etc/nginx/*.default]
  sensitivity: review        # safe | review | secret | blocked
  secretPatterns: [ssl_certificate_key, password=]
  maxSizeKB: 256
```

Used by Config Governance to read, diff, validate, and back up files
before applying a Change Plan.

---

## 5. `data`

```yaml
data:
  paths:
    - path: /var/lib/postgresql
      requiredForFunctionality: required
      strategy: dump-restore   # rsync-review | dump-restore | rebuildable | not-recommended
  defaultStrategy: dump-restore
```

Database items must declare a strategy. EnvForge does **not** rsync
data directories blindly. Stateful capabilities without a credible
strategy must stay at `managed-config` or below.

---

## 6. `validate`

```yaml
validate:
  preApply:
    - command: nginx -t
  postApply:
    - command: systemctl is-active nginx
    - command: curl -sI http://127.0.0.1
      allowFailure: true
```

Runs through the plan-runner. Every check must exit zero (or be marked
`allowFailure`) for the verify step to pass.

---

## 7. `rollback`

```yaml
rollback:
  backupPaths: [/etc/nginx]
  restoreBackupOf: /etc/nginx/nginx.conf
  removeInstalledPackages: [nginx]
  reloadServices: [nginx]
  description: |
    Restore /etc/nginx backup, reinstall the package set EnvForge
    installed during apply, and reload nginx.
```

---

## 8. `security`

```yaml
security:
  riskLevel: privileged             # safe | review | privileged | dangerous
  secretPolicy: confirm             # none | redact | confirm | blocked
  blockedPaths: [/etc/shadow, /etc/ssl/private]
  dangerousOperations:
    - "Disabling SSH password auth without a working key may lock you out."
```

---

## 9. `crossDistro`

```yaml
crossDistro:
  packageMap:
    apt: [nginx]
    dnf: [nginx]
  serviceMap:
    debian: [nginx]
    rhel: [nginx]
  notes: "Alpine ships nginx without `mail` module by default."
```

---

## 10. `ui`

```yaml
ui:
  badge: "Full Migration"
  recommendedOnHome: true
  warnings:
    - "TLS keys may live under /etc/nginx; review before migrate."
```

`recommendedOnHome` only honored for `full-migration` and select
`managed-config` items.

---

## 11. `audit`

```yaml
audit:
  status: pass               # pass | fixed | needs-review | blocked
  originalSupportLevel: managed-config
  finalSupportLevel: managed-config
  reasons:
    - "Detection covers apt, dnf, binaries, ports."
  missingFieldsBefore: []
  changesMade: []
  remainingRisks: []
  reviewerNotes: ""
```

The audit block is mandatory after the V2 audit pass. It is the
authoritative record of why an item carries its current supportLevel.
