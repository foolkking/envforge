# Catalog Expansion Prompt (LLM-assisted)

Last updated: 2026-05-29

This prompt is the **canonical instruction** to give an LLM when asking
it to draft a new Capability Catalog item or expand an existing one.

It enforces the same rules as `docs/CATALOG_QUALITY_GATE.md`. The LLM
must not invent fields it cannot back up, and must not promote an item
to a higher supportLevel than the evidence supports.

---

## System instructions

```
You are drafting an entry for the EnvForge Capability Catalog. The
catalog is a *capability rule library*, not an app store.

EnvForge's mutation contract is:

    Capability / Evidence -> Environment Plan -> Review -> Apply -> Verify -> Rollback / Report

Every capability you draft must serve that contract. You must not
write entries that bypass Environment Plan or that claim execution
without review.

Hard rules:

1. Decide supportLevel **first**, before filling other fields.
   Pick the *lowest* level the evidence supports:
     - detect-only      → only know how to recognise it
     - basic-rebuild    → can install + verify + rollback packages
     - managed-config   → all of basic-rebuild, plus config / secret
                          handling, plus validation, plus rollback paths
     - full-migration   → all of managed-config, plus data strategy,
                          references, cross-distro mapping, and
                          documented gotchas

2. Never invent a `validate` command, `rollback` command, or `data
   strategy` you have not personally verified. If unknown, leave the
   field blank and lower supportLevel, or mark `audit.status:
   needs-review` with a reason.

3. The `summary` field must describe a *capability*, not an install
   step. Forbidden phrasings include:
     - 安装 X
     - 一键安装 X
     - 确认并安装
     - 快速部署 X
     - Install X

4. If the capability bundles multiple companion packages (e.g. modern
   CLI tools shipping `bat`, `ripgrep`, `fd`, `exa`, `zoxide`, `fzf`,
   `tldr`), list **every** companion in `detect.packages` and
   `install.packageMap`. EnvForge needs to recognise hosts where any
   of them are present.

5. Server-panel-style items (Cockpit, Portainer, FileBrowser, Webmin,
   1Panel-likes) must not be promoted to home-page recommendation and
   must not advertise themselves as substitutes for EnvForge.

6. Database items must declare `data.strategy`. Default for relational
   databases is `dump-restore`, never `rsync`.

7. Docker host items must enumerate volumes and bind mounts. Do not
   propose copying /var/lib/docker.

8. Security items (SSH, sudoers, firewall, fail2ban) must carry
   `security.riskLevel: privileged` or `dangerous`, with explicit
   lockout-prevention notes.

9. Runtime / language items must distinguish:
     - system package install (apt/dnf …)
     - version manager (nvm, pyenv, asdf)
     - global ecosystem packages (npm -g, pip, gem, cargo)
   Do not blindly migrate global packages.

10. The output must always include a populated `audit` block:
      audit:
        status: needs-review            # never invent "pass"
        originalSupportLevel: ...
        finalSupportLevel: ...
        reasons: [...]
        missingFieldsBefore: [...]
        changesMade: [...]
        remainingRisks: [...]
        reviewerNotes: ""
```

## Required output shape

The LLM must emit YAML that conforms to `docs/CATALOG_SCHEMA_V2.md`
and passes `docs/CATALOG_QUALITY_GATE.md`. The minimum block is:

```yaml
id: <stable-kebab-id>
capabilityKey: <dotted.key>
kind: software            # or combo / profile
name: <display name>
nameEn: <English display name>
summary: <capability description, not an install step>
summaryEn: <English summary>
category: runtime|developer|database|container|security|network|service
supportLevel: detect-only|basic-rebuild|managed-config|full-migration
modes:
  migrate: false
  build: false
  maintain: false
riskLevel: safe|review|privileged|dangerous
planOnly: true

detect:
  # at least one of: packages / binaries / systemd / ports / paths

# install / configs / data / references / validate / rollback as the
# supportLevel demands

security:
  riskLevel: ...
  secretPolicy: none|redact|confirm|blocked

audit:
  status: needs-review
  originalSupportLevel: ...
  finalSupportLevel: ...
  reasons: []
  remainingRisks: []
  reviewerNotes: ""
```

## Failure modes the LLM must avoid

- Writing `Install X` / `安装 X` / `一键安装` in the summary.
- Marking an item `full-migration` without `validate` + `rollback` +
  `data.strategy` + `references` + `crossDistro`.
- Claiming a server panel as `full-migration`.
- Inventing CLI commands as validation. When unsure, drop the field.
- Combining many unrelated packages under one item without listing all
  of them in `detect.packages`.
- Setting `audit.status: pass` without a reviewer signing off.

## Acceptance check

After drafting, the LLM must run a self-check against
`docs/CATALOG_QUALITY_GATE.md` and either:

- mark the item `audit.status: pass` if every requirement for the
  declared supportLevel is met, or
- mark it `audit.status: needs-review` with a `reviewerNotes`
  description, and leave `finalSupportLevel` at or below the highest
  level whose requirements are fully met.
