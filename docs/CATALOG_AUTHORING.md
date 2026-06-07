# Catalog Authoring

Last updated: 2026-05-29

This is the practical author guide. The canonical schema lives in
[CATALOG_SCHEMA_V2.md](./CATALOG_SCHEMA_V2.md) and the per-supportLevel
requirements in [CATALOG_QUALITY_GATE.md](./CATALOG_QUALITY_GATE.md).
For LLM drafting, use
[CATALOG_EXPAND_PROMPT.md](./CATALOG_EXPAND_PROMPT.md).

EnvForge's catalog is a **capability rule library**. A catalog item is
not an install script — it is a description of a capability that can
be detected, planned, applied, verified, and rolled back through an
Environment Plan.

---

## 1. Decide the supportLevel first

Pick the lowest level the rule can honestly satisfy:

- `detect-only` — can only recognise it.
- `basic-rebuild` — can install + verify + rollback.
- `managed-config` — also understands config paths + secrets +
  validation + rollback.
- `full-migration` — also covers data strategy + references +
  cross-distro mapping.

If you cannot meet the gate at a higher level, **stay lower**. There
is no penalty for `detect-only` — there is a real penalty for a
fabricated `full-migration` item that loses a target host.

---

## 2. Forbidden language

Never use these phrasings as the primary expression of a catalog
entry:

- 安装 X
- 一键安装 X
- 确认并安装
- 快速部署 X
- Install X
- Configure & install

Use capability descriptions:

- "Nginx Web Server capability"
- "Docker Runtime capability"
- "PostgreSQL Database capability"
- "Add to Rebuild Plan"
- "Generate Environment Plan"

The check script (`npm run catalog:check`) refuses summaries that
start with the forbidden phrases.

---

## 3. Required fields by supportLevel

See [CATALOG_QUALITY_GATE.md](./CATALOG_QUALITY_GATE.md) for the full
matrix. Quick reference:

```
                 detect-only  basic-rebuild  managed-config  full-migration
id                  yes          yes             yes             yes
capabilityKey       yes          yes             yes             yes
kind                yes          yes             yes             yes
name/summary        yes          yes             yes             yes
category            yes          yes             yes             yes
supportLevel        yes          yes             yes             yes
modes               yes          yes             yes             yes
riskLevel           yes          yes             yes             yes
planOnly            yes          yes             yes             yes
detect              yes          yes             yes             yes
install              -           yes             yes             yes
configs              -           opt             yes             yes
data                 -            -              yes (any)       yes
references           -            -              opt             yes
validate             -           yes             yes             yes
rollback             -           yes             yes             yes
security            yes          yes             yes             yes
crossDistro          -           yes             yes             yes
audit               yes          yes             yes             yes
```

---

## 4. Companion packages — list every member

Many capabilities ship as a family of related packages. The detection
rule must list **every** member so a host with any of them gets
recognised. Examples:

```yaml
id: rust-cli-tools
capabilityKey: developer.cli-tools
detect:
  packages:
    apt: [bat, ripgrep, fd-find, exa, zoxide, fzf, tldr]
    dnf: [bat, ripgrep, fd-find, exa, zoxide, fzf, tldr]
  binaries: [bat, rg, fd, exa, zoxide, fzf, tldr]
install:
  packageMap:
    apt: [bat, ripgrep, fd-find, exa, zoxide, fzf, tldr]
    dnf: [bat, ripgrep, fd-find, exa, zoxide, fzf, tldr]
```

Bundles are preferable to individual cards for the same family. If a
new tool joins the family, edit the existing card rather than creating
a parallel one.

---

## 5. Special cases

Treat these item types with extra care.

### Server panels

Cockpit, Portainer, FileBrowser, Webmin-class panels. Never recommend
them on the home page; never call them "EnvForge alternatives". Cap
their supportLevel at `managed-config`.

### Databases

Always declare `data.strategy`. Default for relational databases is
`dump-restore`, never `rsync`. State explicitly that EnvForge will not
copy `/var/lib/<db>` blindly.

### Docker hosts

`data.paths` must enumerate volumes, bind mounts, and compose files.
`/var/lib/docker` is not copied by default. Document compose env files
and external networks.

### Security capabilities

SSH / sudoers / firewall / fail2ban must declare risk level
`privileged` or `dangerous`. SSH must explain the lockout-prevention
strategy (reload not restart, second-session probe, rollback timer).
Firewall items must document "do not block existing SSH" rules.

### Runtime / language ecosystems

Distinguish:

- system package install (`apt install nodejs`),
- version manager (`nvm`, `pyenv`, `asdf`),
- global ecosystem packages (`npm -g foo`, `pip install`).

Do not blindly migrate global packages.

### Combos / profiles

Declare `includes`. The combo's `supportLevel` cannot exceed the
**lowest** supportLevel of its components, unless extra rules in
`audit.reasons` justify it.

---

## 6. Mutation contract reminder

A catalog item is a *plan source*, never an executor. The card's
buttons must read:

- "Add to Plan"
- "Configure Plan"
- "Generate Rebuild Plan"
- "Review Plan"

Never:

- "Install"
- "Run now"
- "Configure & install"

EnvForge's mutation contract is

```
Capability / Evidence -> Environment Plan -> Review -> Apply -> Verify -> Rollback / Report
```

If your draft cannot fit that contract, the answer is to lower
`supportLevel`, not to bypass the contract.

---

## 7. Pre-merge checklist

Before submitting:

- [ ] `id`, `capabilityKey`, `name`, `nameEn`, `summary`, `summaryEn`,
      `category`, `supportLevel`, `modes`, `riskLevel`, `planOnly`,
      `audit` are all present.
- [ ] Summary is capability-oriented; no "Install / 安装 / 一键安装".
- [ ] Detection covers every companion package.
- [ ] supportLevel matches the depth of the item's actual fields.
- [ ] `audit.status` is one of `pass / fixed / needs-review / blocked`.
- [ ] `npm run catalog:check` passes locally.
- [ ] `npm run catalog:audit` regenerates the dump.
- [ ] If the item is a server panel / database / docker host / security
      / runtime / combo, the special-case rules are honoured.
