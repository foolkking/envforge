# Harness Target Readiness Contract

> Companion to `docs/HARNESS_EVALUATION.md` and
> `docs/HARNESS_UBUNTU_LIVE_RUN.md`. Defines the minimum target
> requirements for live certification and the JSON contract emitted by
> `scripts/harness/check-target-readiness.mjs`.

## Why this exists

Destructive harness scenarios (rolling back a broken nginx config,
swapping `sshd_config`, removing nginx) are unsafe to run on anything
that is not a disposable VM. The orchestrator MUST refuse to run those
scenarios without a positive readiness verdict, and the readiness
verdict MUST come from a structured probe — not from the operator's
word.

The pure logic that decides "ready" lives in
`scripts/harness/lib/readiness.mjs:evaluateReadiness`. Both the runner
and the test suite consume it.

## Required target attributes

| Attribute              | Why                                                                          |
| ---------------------- | ---------------------------------------------------------------------------- |
| Ubuntu **22.04** or **24.04** LTS | Catalog audit + safe-apply assumptions are tested on these LTS releases. |
| `systemd` available    | `safeSystemdUnitApply` + `is-active` checks rely on it.                     |
| SSH reachable          | The whole orchestrator works through SSH.                                   |
| `sudo -n` succeeds     | Every safe-apply uses `sudo`; password prompts deadlock the runner.         |
| `apt-get` available    | Build / Remove scenarios install packages via apt.                          |
| Disposable marker      | The hostname starts with `envforge-harness-` / `envforge-cert-` / `envforge-disposable-` / `envforge-test-`, **or** the file `/etc/envforge-disposable` exists. |
| No production marker   | Hostname does not contain `prod`, `production`, `live`, `main`, AND `/etc/envforge-production` does not exist. |

A target that fails ANY of these is `not-ready`. A target that passes
all of them but still has any `productionMarkers` is `not-ready` —
the production check is fail-closed.

`safeForDestructive` is `true` only when `verdict === "ready"` AND
`disposable === true`. The orchestrator gates destructive scenarios
on `safeForDestructive === true`.

## The probe

The probe runs read-only commands over SSH and reports raw signals:

| Command                                                       | Field                |
| ------------------------------------------------------------- | -------------------- |
| `grep PRETTY_NAME /etc/os-release`                            | `os`                 |
| `uname -r`                                                    | `kernel`             |
| `hostname`                                                    | `hostname`           |
| `command -v systemctl`                                        | `systemd`            |
| `sudo -n true`                                                | `sudo`               |
| `command -v apt-get`                                          | `apt`                |
| `lsof /var/lib/dpkg/lock-frontend`                            | `aptLocked`          |
| `systemctl list-unit-files \| awk '/^(ssh\|sshd)\\.service/'` | `sshServiceName`     |
| `systemctl list-unit-files \| awk '/^nginx\\.service/'`       | `nginxServiceName`   |
| `systemctl list-unit-files \| awk '/^docker\\.service/'`      | `dockerServiceName`  |
| `ufw status` / `firewall-cmd --state` / `nft list ruleset`    | `firewallStack`      |
| `[ -f /etc/envforge-production ]`                             | `productionMarkers`  |
| `[ -f /etc/envforge-disposable ]` + hostname pattern          | `disposableMarkers`  |

Run the probe directly:

```sh
node scripts/harness/check-target-readiness.mjs envforge@192.168.64.10
```

## Output contract

The probe writes a JSON object with this shape:

```json
{
  "target": "envforge@192.168.64.10",
  "os": "Ubuntu 24.04 LTS",
  "kernel": "6.8.0-31-generic",
  "hostname": "envforge-harness-1d4c7",
  "systemd": true,
  "ssh": true,
  "sudo": true,
  "apt": true,
  "disposable": true,
  "safeForDestructive": true,
  "verdict": "ready",
  "reasons": [],
  "raw": {
    "target": "envforge@192.168.64.10",
    "os": "Ubuntu 24.04 LTS",
    "kernel": "6.8.0-31-generic",
    "hostname": "envforge-harness-1d4c7",
    "systemd": true,
    "ssh": true,
    "sudo": true,
    "apt": true,
    "aptLocked": false,
    "sshServiceName": "ssh.service",
    "nginxServiceName": "none",
    "dockerServiceName": "none",
    "firewallStack": "ufw:inactive",
    "productionMarkers": [],
    "disposableMarkers": ["hostname-disposable", "disposable-file"]
  }
}
```

Exit code is `0` for `verdict === "ready"`, non-zero otherwise.

## How the orchestrator uses it

```js
import { destructiveAllowed, evaluateReadiness } from "./scripts/harness/lib/readiness.mjs";

const readiness = evaluateReadiness(parsedProbe);
const gate = destructiveAllowed({
  readiness,
  allowDestructive: process.env.ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE === "true",
  destructive: scenario.destructive
});
if (!gate.allowed) {
  // record `skipped` with `gate.reason` and move on. The certification
  // verdict never escalates to certified-basic when a mandatory
  // destructive scenario is skipped.
}
```

## Common failures

| Symptom                                                | Fix                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| `verdict=not-ready, reasons=[apt/dpkg lock is held]`   | Wait for cloud-init / unattended-upgrades to finish. `cloud-init status --wait` |
| `verdict=not-ready, reasons=[sudo not available without password]` | Add `<user> ALL=(ALL) NOPASSWD:ALL` to /etc/sudoers.d/envforge |
| `verdict=not-ready, reasons=[no disposable marker]`    | `sudo touch /etc/envforge-disposable` OR rename the host to `envforge-harness-*` |
| `verdict=not-ready, reasons=[hostname looks like a production host]` | DO NOT bypass — pick a different VM.                            |

## Test coverage

Pure logic tests live in
`apps/api/src/engine/tests/live-certify.test.ts`. They cover:

- parseReadinessProbe accepts the documented shape and rejects bad ones.
- evaluateReadiness flags Ubuntu 22.04 vs 24.04, missing systemd,
  missing sudo, apt lock, prod hostname, missing disposable marker.
- destructiveAllowed refuses every combination that violates the
  "disposable + ready + ack" triple.
- decideCertificationVerdict cannot escalate `not-run` regardless of
  scenario outcomes.

The tests do not require a live VM.
