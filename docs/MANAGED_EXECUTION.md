# Managed Execution Hardening

> Phase output. The earlier phases delivered the catalog audit and the
> end-to-end Plan Review / Apply Gate / Plan Report contract. This phase
> drives those guarantees down into the actual SSH execution layer so
> every action that mutates a target host follows the same lifecycle and
> is captured on the Plan Report.

## Action Run Lifecycle

Every mutating action runs through this state machine
(`apps/api/src/action-runs.ts`):

```
pending
  ↓
snapshotting          ← capture file hash / mode / packages installed / service state
  ↓
applying              ← invoke safeWriteConfigFile / install / restart
  ↓
verifying             ← nginx -t, sshd -t, docker info, systemctl is-active
  ↓
succeeded                                 (terminal)

If any step fails:
  failed
    ↓
  rolling-back        ← restoreConfigFileFromBackup, uninstall fresh packages,
    ↓                   stop services we started
  rolled-back          (terminal)
  rollback-failed      (terminal — alarm raised in the report)

Two terminal short-circuits:
  skipped               — for non-mutating actions (review / validate / manualStep)
  manual-required       — for detect-only items that emit only review actions
```

Illegal transitions throw `ActionRunStateError` (validated by the test
suite).

## ActionRunRecord

Stored on the runtime database as a flat list (`actionRuns`). Capped at
the most-recent 1000 entries.

```ts
interface ActionRunRecord {
  id: string;            // <planId>::<itemId>::<actionId>::<timestamp>
  planId: string;
  itemId: string;
  actionId: string;
  capabilityKey?: string;
  startedAt: string;
  endedAt?: string;
  status: ActionRunStatus;
  snapshot?: ActionSnapshot;
  applyResult?: ActionApplyResult;
  verifyResult?: ActionVerifyResult;
  rollbackResult?: ActionRollbackResult;
  stdoutPreview?: string;   // ≤ 4 kB, secret-redacted
  stderrPreview?: string;   // ≤ 4 kB, secret-redacted
  redacted: boolean;        // true iff any preview / message hit a redaction rule
  error?: string;           // secret-redacted
}
```

The Plan Report (`GET /api/plans/:id/report`) now joins the plan with
the runtime store's `actionRuns` so the JSON / Markdown export shows
per-action `apply / verify / rollback` outcomes. See
`environment-plan.ts:buildPlanReport`.

## safeWriteConfigFile lifecycle

`apps/api/src/config-files.ts:safeWriteConfigFile` is the entry point
for every config write. It now follows this strict 8-step flow:

```
1. stat original                            → record mode + owner + sha256
2. timestamped + stable backup              → <path>.envforge.bak.<ts> + .envforge.bak
3. write candidate → /tmp/envforge-...      → temp file, never touches the live path
4. pre-validate live file                   → refuse to overwrite a file that's
                                              ALREADY syntactically broken
5. atomic install (preserve mode + owner)   → sudo install -m <mode> -o <user> -g <group>
6. post-validate live file                  → run the dispatched validator
                                              (nginx -t, sshd -t, visudo -cf, …)
7. on post-validate failure                 → restoreConfigFileFromBackup
                                              and throw redacted error
8. return { backupPath, tempPath, success } → consumed by the orchestrator
```

The dispatcher remains in place: paths under `sudoers`, `/ssh/sshd_config`,
`/ufw/`, `firewalld`, `/systemd/` are routed to the typed safe-apply
functions below.

## Four high-risk safe-apply surfaces

### `safeSshdConfigApply`

1. `sshd -t` against the **existing** live config. Refuses to apply on
   top of a broken state.
2. Write candidate to `/tmp` and atomic install with backup.
3. `sshd -t` against the new live config. On failure restore backup and
   throw.
4. **`systemctl reload`** sshd — never `restart`, so existing sessions
   stay open.
5. Open a fresh `ssh -o BatchMode=yes` probe **from the target itself**
   (so the EnvForge server doesn't need direct reachability). On
   failure restore the backup and reload again.

Verified by `safe-apply.test.ts`:
- never uses `systemctl restart sshd` (source-level assertion).
- runs `sshd -t` twice (pre + post).
- has a fresh-SSH-session reachability probe.
- restores the backup when the probe fails.

### `safeFirewallApply`

1. Pure-function preflight `preflightFirewallContentKeepsSsh(content,
   sshPort)` parses UFW / firewalld / nftables / iptables candidates
   and refuses any candidate that drops the SSH port. (Tested with
   real-world UFW DROP, iptables DROP, nftables drop, and
   default-INPUT=DROP without explicit allow.)
2. Schedule a **rollback timer** (≤ 90s) using a nohup'd shell sleep.
   Cancelled atomically via a flag file when the post-apply probe
   passes.
3. Apply via the generic safe write path (backup + atomic install).
4. Reload (`ufw reload` / `firewall-cmd --reload` / `systemctl reload
   nftables`).
5. Run the same SSH reachability probe from the target.
6. On success cancel the rollback timer; on failure let it fire.

### `safeSudoersApply`

1. Stage a candidate into `/etc/sudoers.d/.envforge-candidate-<ts>` with
   mode 0440.
2. `sudo visudo -cf <candidate>`. On failure delete the candidate and
   throw — the live `/etc/sudoers` is never touched.
3. Generic safe write to the requested path (backup + atomic install).
4. `sudo visudo -cf <live-path>` as a final defence. On failure restore
   the backup and throw.

### `safeSystemdUnitApply`

1. Generic safe write to the unit file (backup + atomic install).
2. `sudo systemctl daemon-reload`. On failure restore the backup and
   throw.
3. `sudo systemctl is-active <unit>` to capture the new state.
4. Return the daemon-reload exit code + active state.

## ManagedCapabilityRecord

Recorded by the orchestrator after a successful install.

```ts
interface ManagedCapabilityRecord {
  id: string;
  capabilityKey: string;
  catalogId: string;
  installedByPlanId: string;
  installedAt: string;
  targetHostId: string;
  packagesInstalled: Array<{
    name: string;
    manager: string;        // "apt" | "dnf" | "rpm" | …
    version?: string;
    existedBefore: boolean;
    removableByEnvForge: boolean;
  }>;
  configsTouched: string[];
  servicesTouched: string[];
  dataPathsKnown: string[];
}
```

### Example (nginx-web-service install)

```json
{
  "id": "mc-1782349001",
  "capabilityKey": "web-server.nginx",
  "catalogId": "nginx-web-service",
  "installedByPlanId": "rebuild:conn-A:1782349000123",
  "installedAt": "2026-05-30T08:00:00.000Z",
  "targetHostId": "conn-A",
  "packagesInstalled": [
    {
      "name": "nginx",
      "manager": "apt",
      "version": "1.18.0-6ubuntu14.4",
      "existedBefore": false,
      "removableByEnvForge": true
    }
  ],
  "configsTouched": ["/etc/nginx/nginx.conf"],
  "servicesTouched": ["nginx"],
  "dataPathsKnown": []
}
```

### Remove plan eligibility

`environment-plan.ts:assessRemoveEligibility` consults the markers when
building a Remove plan:

| Marker state                                   | Decision             |
| ---------------------------------------------- | -------------------- |
| `existedBefore=false` AND `removableByEnvForge=true` AND no data paths | auto-remove |
| `existedBefore=true`                           | manual confirmation  |
| `removableByEnvForge=false`                    | manual confirmation  |
| `dataPathsKnown.length > 0`                    | manual confirmation  |
| no marker for the package                      | manual confirmation  |

Manual-confirmation packages are added to `plan.review.reasons` and the
matching `removePackage` action receives `blockedUntilApproved=true`,
which the apply route already enforces.

## Secret redaction

`apps/api/src/action-runs.ts:redactSecrets` is the single source of
truth. It runs against:

- ActionRunRecord `stdoutPreview`, `stderrPreview`, `error`,
  `applyResult.message / steps`, `verifyResult.checks[].output`,
  `rollbackResult.message / steps`.
- The Plan Report Markdown export.

Redaction rules (in priority order):

| Rule                  | Pattern (summary)                                | Tag                                  |
| --------------------- | ------------------------------------------------ | ------------------------------------ |
| `private-key-block`   | `-----BEGIN/END … PRIVATE KEY-----` blocks       | `<REDACTED-PRIVATE-KEY>`             |
| `openssh-private-key` | OpenSSH PEM block                                | `<REDACTED-OPENSSH-PRIVATE-KEY>`     |
| `rsa-private-key`     | RSA PEM block                                    | `<REDACTED-RSA-PRIVATE-KEY>`         |
| `github-token`        | `ghp_…`, `gho_…`, `ghs_…`, `ghu_…`               | `<REDACTED-GH-TOKEN>`                |
| `gitlab-token`        | `glpat-…`                                        | `<REDACTED-GL-TOKEN>`                |
| `openai-key`          | `sk-…` (≥ 20 chars)                              | `<REDACTED-API-KEY>`                 |
| `aws-access-key`      | `AKIA[A-Z0-9]{12,}`                              | `<REDACTED-AWS-KEY>`                 |
| `jwt`                 | `eyJ…\.eyJ…\.…`                                  | `<REDACTED-JWT>`                     |
| `auth-header`         | `Authorization: Bearer/Basic/Token …`            | `<REDACTED-AUTH>`                    |
| `database-url`        | `DATABASE_URL=scheme://user:PASSWORD@host`       | `<REDACTED-DB-URL-PASSWORD>`         |
| `aws-secret-key`      | `aws_secret_access_key = …` / `AWS_SECRET_ACCESS_KEY=…` | `<REDACTED-AWS-SECRET>`        |
| `env-secret`          | `[A-Z_]*(KEY|TOKEN|SECRET|PASSWORD|PASS)[A-Z_]* = …` | `<REDACTED-ENV-SECRET>`          |
| `generic-password`    | `password|passwd|pwd = …`                        | `<REDACTED-PASSWORD>`                |
| `generic-secret`      | `secret|api[_-]?key|access[_-]?key|token = …`    | `<REDACTED-SECRET>`                  |

Every rule is idempotent — placeholders produced by an earlier rule are
excluded from later patterns via `[^<>]` in the value capture.

### Example

```
input
  PASSWORD="MyL0ngerPass"
  AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
  GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789
  Authorization: Bearer eyJ.payload.sig
  -----BEGIN OPENSSH PRIVATE KEY-----
  base64stuff
  -----END OPENSSH PRIVATE KEY-----

output
  PASSWORD="<REDACTED-ENV-SECRET>"
  AWS_SECRET_ACCESS_KEY=<REDACTED-AWS-SECRET>
  GITHUB_TOKEN=<REDACTED-GH-TOKEN>
  Authorization: Bearer <REDACTED-AUTH>
  -----BEGIN OPENSSH PRIVATE KEY-----
  <REDACTED-OPENSSH-PRIVATE-KEY>
  -----END OPENSSH PRIVATE KEY-----
```

The `redacted: true` flag on the ActionRunRecord and the
`severity` markers on the Plan Report make redactions visible to the
operator without leaking the raw value.

## Three deeply-supported capability closures

### `nginx-web-service`

1. **Snapshot** — `dpkg -s nginx` to record `existedBefore` + version.
2. **Apply (install)** — `sudo apt-get install -y nginx`.
3. **Apply (config)** — `safeWriteConfigFile("/etc/nginx/nginx.conf",
   …)` with pre-validate, atomic install, post-validate.
4. **Verify** — `nginx -t` (post-validate) + `systemctl is-active
   nginx`.
5. **Rollback** — `restoreConfigFileFromBackup("/etc/nginx/nginx.conf")`
   plus `apt-get -y remove nginx` only when `existedBefore=false`.

### `docker-host-profile`

1. **Snapshot** — `dpkg -s docker.io docker-compose-plugin`.
2. **Apply (install)** — `apt-get install -y docker.io docker-compose-plugin`.
3. **Apply (config)** — `safeWriteConfigFile("/etc/docker/daemon.json",
   …)`.
4. **Verify** — `docker version` + `docker info` + `systemctl is-active
   docker`.
5. **Rollback** — restore `daemon.json`, reload docker, optionally
   uninstall packages we added.

### `ssh-hardening`

Routed through `createSshHardeningAdapter` → `safeSshdConfigApply`:

1. **Snapshot** — `sudo cp -p /etc/ssh/sshd_config
   /etc/ssh/sshd_config.envforge.bak`, sha256sum.
2. **Apply** — pre-validate `sshd -t`, atomic install, post-validate
   `sshd -t`, `systemctl reload sshd` (no restart), fresh-SSH probe.
3. **Verify** — `sshd -t` (validateConfigFile reuses the same checker).
4. **Rollback** — `restoreConfigFileFromBackup`, `systemctl reload sshd`.

The Plan Review still requires the `ssh-lockout-confirm` and
`secret-confirm` approval gates plus the catalog `audit.remainingRisks`
acknowledgements before apply, as established in the previous phase.

## Test summary (additions in this phase)

| File                                            | Tests | Subject                                                      |
| ----------------------------------------------- | ----- | ------------------------------------------------------------ |
| `engine/tests/action-runs.test.ts`              | 20    | State machine + redaction rules + canAutoRemove              |
| `engine/tests/managed-execution.test.ts`        | 11    | Lifecycle happy path + apply/verify failure → rollback paths |
| `engine/tests/safe-apply.test.ts`               | 19    | Firewall preflight + source-level checks for sshd/visudo/systemd/safeWrite |
| `engine/tests/managed-capability.test.ts`       |  5    | Marker persistence round-trip + remove eligibility           |
| `engine/tests/remove-plan-eligibility.test.ts`  |  9    | assessRemoveEligibility + buildRemovePlan integration         |
| **Total new**                                   | **64**|                                                              |

`npm test` reports **592 total tests, 0 fail** (528 prior + 64 new).
`npm run catalog:check` reports **119 items, 0 fail, 1 pre-existing
warn** (unchanged).
