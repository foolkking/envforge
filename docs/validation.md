# Validation

Validation covers scenario contracts, dry-run harnesses, live target readiness,
and generated reports.

## Contract recap

Every scenario should prove that EnvForge does not bypass the plan lifecycle:

```text
Evidence / Capability -> Environment Plan -> Review -> Dry-run -> Apply -> Verify -> Rollback / Report
```

Plan shape, approval gates, action-run records, validation output, rollback
availability, and report content are all part of the contract.

## Core scenarios

| Scenario | Must prove |
|---|---|
| Build Nginx + Docker | Certified capabilities produce a safe Rebuild Plan |
| Nginx + Caddy conflict | Conflicting capabilities block or warn as designed |
| Keycloak + Authelia | SSO overlap warnings and manual steps are visible |
| SSH hardening | Lockout confirmations, secret confirmation, reload/probe/rollback |
| Redis/PostgreSQL migration | Data strategy confirmation and no blind data-directory copy |
| LEMP/LAMP combos | Combo support derives from component strategies and harness coverage |

Cross-cutting refusal rules:

- not-ready capabilities are hidden from ordinary Build;
- detect-only items emit review actions, not apply actions;
- failed dry-run blocks apply;
- pending review blocks apply;
- secrets/data/manual steps require explicit confirmation;
- unsupported cross-distro behavior refuses rather than silently applying.

## Harness commands

```bash
npm run harness:scenarios
npm run harness:scenario
npm run harness:target:check
npm run harness:certify
npm run harness:certify:dry-run
```

Ubuntu live helpers:

```bash
npm run harness:ubuntu:provision
npm run harness:register
npm run harness:ubuntu:destroy
```

## Target readiness

Live targets must be disposable. A target is not ready if any hard requirement
fails.

Required attributes:

| Attribute | Requirement |
|---|---|
| Disposable marker | Hostname or marker proves it is not production |
| SSH | Reachable with configured user/key |
| Sudo | Passwordless sudo for harness user |
| Package manager | No apt/dpkg lock or equivalent |
| Network | Can install/check required packages |
| Baseline | Clean enough for deterministic scenario |
| Safety | No production markers, user data, or unknown destructive risk |

If a target looks like production, do not bypass readiness checks.

## Report bundle

Scenario and live runs produce reports under `docs/harness-reports/<runId>/`.
Timestamped run directories are local output, not durable docs.

Curated/baseline reports may be kept deliberately, but must be reviewed for:

- no plaintext secrets;
- expected action-run shape;
- scenario verdict;
- report markdown and JSON consistency;
- rollback/verify evidence.

## Evaluation template

Each curated report should capture:

| Field | Meaning |
|---|---|
| Run id | Harness report directory or release id |
| Target type | Dry-run, VM, cloud burner, live Ubuntu |
| Scenario list | Which contracts ran |
| Verdict | pass, fail, warning, skipped |
| Failed checks | Action, verify, rollback, report failures |
| Secret scan | Confirmation that report artifacts are redacted |
| Follow-up | Bug, doc update, catalog fix, or accepted limitation |

## Certification relationship

Full Migration Certified capabilities require at least dry-run harness coverage.
Core/high-risk capabilities additionally need live or strongly representative
scenarios. Certification output is generated into `docs/generated/`.

Commands:

```bash
npm run certification:check
npm run certification:backlog
```
