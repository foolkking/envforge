# Real Target Harness & Evaluation

> **Goal.** Validate the EnvForge mutation contract end-to-end against
> *real* (or near-real) Linux targets:
>
> ```
> Capability / Evidence
>   → Environment Plan
>     → Plan Review
>       → Apply Gate
>         → Managed Execution
>           → ActionRunRecord
>             → Verify
>               → Rollback (on failure)
>                 → Plan Report
> ```
>
> No phase may be skipped. The Plan Report MUST exist for every harness
> run, even when the plan is refused at the apply gate.

## Supported target types

| Target                            | Use                                   | Authoritative? |
| --------------------------------- | ------------------------------------- | -------------- |
| **Docker / systemd container**    | Fast smoke (`docker run --privileged …`) | ❌ no — kernel is shared, systemd is partial |
| **Vagrant + VirtualBox VM**       | Local full-stack tests                | ✅ yes (per box) |
| **Multipass Ubuntu VM**           | Quick Ubuntu-only smoke               | ✅ yes for Ubuntu |
| **Cloud VM** (Hetzner / DO / EC2) | Final acceptance run                  | ✅ yes — recommended for releases |

The harness itself is target-agnostic: it speaks SSH through the
existing `StoredConnection` row (registered via `POST
/api/connections/connect`). Any of the four target types becomes
available once that row exists.

## Disposable target lifecycle

A harness run MUST own its target. Operators are expected to:

1. **Create** — `vagrant up`, `multipass launch`, `docker run -d
   --rm --privileged …`, or a cloud-init-driven cloud VM.
2. **Register** with EnvForge — login to the API, create a connection
   pointing at the new host, run `POST /api/connections/:id/probe` so
   `connection.probeSnapshot` is populated.
3. **Run scenarios** — `npm run harness:scenario -- <id>`.
4. **Reset** — destroy the VM (`vagrant destroy -f`, `multipass
   delete --purge`, `docker rm -f`, terraform destroy). Snapshots
   should not be reused between runs.
5. **Cleanup** — remove the EnvForge connection row (`DELETE
   /api/connections/:id`), drop scratch reports under
   `docs/harness-reports/`.

### Recommended Vagrant box

```ruby
# scripts/harness/Vagrantfile (template — operators copy-paste)
Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/jammy64"
  config.vm.network "private_network", type: "dhcp"
  config.vm.provision "shell", inline: <<-SHELL
    apt-get update
    apt-get install -y openssh-server sudo
    echo 'envforge ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/envforge
  SHELL
end
```

## Golden Scenarios

The harness ships with ninety-seven scenarios under
`scripts/harness/scenarios/`. Each scenario is a JSON file describing
the plan source, expected gate behaviour, verify checks, and notes.

| Group | Scenario ids | Description |
| --- | --- | --- |
| Core install/remove | `build-nginx-success`, `nginx-config-postvalidate-failure-rollback`, `build-docker-success`, `remove-managed-nginx`, `remove-existing-nginx-blocked` | Baseline plan, validate, rollback, and remove flows. |
| Security/data | `ssh-hardening-safe-apply`, `firewall-baseline-dry-run`, `fail2ban-protection-dry-run`, `redis-server-dry-run`, `postgres-profile-dry-run`, `mysql-server-dry-run`, `certbot-ssl-dry-run`, `certbot-letsencrypt-alias-review` | Approval gates, lockout safety, dump/restore strategies, and TLS key handling. |
| Web/proxy/runtime | `node-runtime-profile-dry-run`, `python-toolchain-dry-run`, `caddy-server-dry-run`, `openresty-dry-run`, `traefik-proxy-dry-run`, `mariadb-dry-run`, `haproxy-lb-dry-run`, `apache-httpd-dry-run`, `php-fpm-dry-run`, `php-toolchain-dry-run`, `ruby-toolchain-dry-run` | Certified runtime and frontend/proxy capabilities with config validation and review gates. |
| Runtime/devops tools | `golang-runtime-dry-run`, `openjdk-runtime-dry-run`, `rust-toolchain-dry-run`, `dotnet-runtime-dry-run`, `nodejs-version-mgr-dry-run`, `pyenv-toolchain-dry-run`, `flutter-sdk-dry-run`, `git-version-control-dry-run`, `ansible-tool-dry-run`, `terraform-iac-dry-run`, `kubernetes-tools-dry-run`, `rsync-tools-dry-run`, `htop-tools-dry-run` | Certified developer, runtime, backup, and monitoring tools with package validation, manual config/data review, and secret approval gates where needed. |
| File/VPN/dev services | `samba-share-dry-run`, `nfs-server-dry-run`, `tailscale-dry-run`, `code-server-dry-run`, `sonarqube-dry-run` | Certified file sharing, mesh VPN, and remote development/code quality services with ACL, identity, auth, and backup/restore review gates. |
| Data/search stores | `mongodb-dry-run`, `minio-storage-dry-run`, `elasticsearch-dry-run`, `clickhouse-dry-run`, `influxdb-dry-run` | Certified database, object storage, search, OLAP, and time-series capabilities with explicit backup/restore or replication strategies and secret review. |
| Secure infra / cluster | `wireguard-vpn-dry-run`, `openvpn-server-dry-run`, `firewalld-dry-run`, `vault-secrets-dry-run`, `k3s-dry-run` | Certified VPN, firewall, secrets, and lightweight Kubernetes capabilities with lockout protection, snapshot/restore confirmation, and secret review gates. |
| Apps / SSO / process | `swap-config-dry-run`, `nodejs-pm2-dry-run`, `nextcloud-dry-run`, `gitea-server-dry-run`, `jellyfin-media-dry-run`, `keycloak-dry-run`, `authelia-dry-run` | Certified system tuning, process management, self-hosted apps, media, and SSO capabilities with backup/restore, secret continuity, and target-topology review gates. |
| Self-hosted apps batch | `vaultwarden-dry-run`, `pihole-dry-run`, `authentik-dry-run`, `wikijs-dry-run`, `n8n-dry-run`, `bookstack-dry-run`, `home-assistant-dry-run`, `gitlab-ce-dry-run`, `umami-dry-run`, `nocodb-dry-run`, `adguard-home-dry-run`, `docker-mailserver-dry-run`, `onlyoffice-docs-dry-run`, `immich-dry-run`, `forgejo-dry-run`, `uptime-kuma-dry-run`, `paperless-ngx-dry-run`, `navidrome-dry-run`, `audiobookshelf-dry-run`, `freshrss-dry-run` | Certified app-service cards with Docker-aware plans, app backup/restore or manual data strategies, DNS/IdP/mail gates, and secret redaction. |
| Shell/cache/tooling | `zsh-shell-dry-run`, `fish-shell-dry-run`, `neovim-editor-dry-run`, `tmux-multiplex-dry-run`, `rust-cli-tools-dry-run`, `nethogs-bandwidth-dry-run`, `memcached-dry-run`, `valkey-server-dry-run` | Certified shell, editor, terminal, cache, and network utility capabilities with dotfile/config review, bind/data review, and Redis/Valkey conflict checks where needed. |
| Observability/messaging/CI | `prometheus-monitoring-dry-run`, `grafana-dashboard-dry-run`, `netdata-monitoring-dry-run`, `zabbix-monitoring-dry-run`, `loki-logging-dry-run`, `mosquitto-mqtt-dry-run`, `rabbitmq-dry-run`, `meilisearch-dry-run`, `jenkins-ci-dry-run`, `gitlab-runner-dry-run` | Certified metrics, dashboard, logging, broker, search, and CI capabilities with data strategy gates, backup/restore confirmation, secret review, and topology checks. |

Each scenario file documents:

* `planSource` — `capability-selection` / `remove-request` / `config-change`.
* `expected` — assertions on plan shape (`planType`, `items`,
  `conflictsBlock`, `conflictsWarn`, `approvalsRequired`,
  `remainingRisks`, `blockedUntilApproved`,
  `expectedEligibility`, `reviewReasonsContain`).
* `verify` — runtime expectations the live runner asserts (action run
  status, verify command, redaction).
* `notes` — operator-facing context.

## Destructive test safety

A scenario marked `destructive: true` MUST run on a disposable target.
The harness enforces this in two layers:

1. **Live mode** (`ENVFORGE_HARNESS_MODE=live`): destructive scenarios
   refuse to run unless `ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE=true`.
2. **Dry-run mode** (default): destructive scenarios still build the
   plan + run the apply gate locally, but no SSH session opens.

Never set `ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE=true` against a
production-class target.

## Collecting Plan Reports

Every scenario writes three files into a per-run directory at
`docs/harness-reports/<runId>/`:

| File suffix             | Contents                                                                    |
| ----------------------- | --------------------------------------------------------------------------- |
| `<id>.report.json`      | Full bundle: plan, plan report, action runs, gate verdict, expectations.    |
| `<id>.report.md`        | Human-readable Markdown export (paste into change-management tickets).      |
| `<id>.actions.json`     | ActionRunRecord array, secret-redacted.                                     |
| `summary.json` / `.md`  | Cross-scenario verdicts for the run.                                        |

All output is passed through `redactSecrets` from
`apps/api/src/action-runs.ts` before serialisation. Run directories are
git-ignored (`docs/harness-reports/2*/`) so casual runs never leak into
commit history; promote a curated copy under a release-named
subdirectory when you want to commit evidence.

## Pass / fail rules

A scenario passes when **all** of the following hold:

1. The Plan Report bundle was written.
2. `applyGate.ok === true` (or, for scenarios that EXPECT refusal,
   `applyGate.ok === false` with the documented blocking reason).
3. `expectations.ok === true` — every assertion in the scenario's
   `expected` block matched.
4. (Live mode only) Every action run reaches a terminal status that
   matches `verify.actionRunStatuses`.
5. (Live mode only) Every command listed in `verify.verifyCommands`
   exits 0.

Anything else is a failure. Failure cases must record:

- `applyGate.reasons`
- `expectationsResult.reasons`
- The action run record(s) with non-terminal or `failed` status.
- Any rollback outcome.

## Real-system difference checklist

The harness records the following per target so we can spot when a
real system breaks an EnvForge assumption. In live mode each is
probed; in dry-run mode the value is `unknown (probe: …)`.

| Field                 | Probe                                                                |
| --------------------- | -------------------------------------------------------------------- |
| `sshServiceName`      | `systemctl status ssh sshd 2>/dev/null` — pick the unit that exists  |
| `nginxServiceName`    | `systemctl is-enabled nginx` (Ubuntu) vs `nginx.service` (RHEL)      |
| `dockerServiceName`   | `systemctl status docker`                                            |
| `packageManager`      | `command -v apt-get / dnf / pacman / apk / zypper`                   |
| `systemdAvailable`    | `command -v systemctl`                                               |
| `sudoNoPassword`      | `sudo -n true`                                                       |
| `firewallStack`       | `ufw status` / `firewall-cmd --state` / `nft list ruleset`           |
| `tmpAtomicInstall`    | `stat -f /tmp ; install -m 0644 /dev/null /tmp/envforge.test`        |
| `aptDpkgLocked`       | `lsof /var/lib/dpkg/lock-frontend`                                   |

When a live run reveals a deviation (e.g. ssh service named
`ssh.service` on Ubuntu vs `sshd.service` on RHEL), the harness records
it in `targetDifferences` and the operator must update the
**execution layer**, not the safety gate. See
`apps/api/src/config-files.ts:safeSshdConfigApply` for the canonical
multi-name reload pattern.

## Known limitations

- Docker/systemd-in-container targets cannot truly exercise SSH-lockout
  recovery; treat them as a smoke check for the apply gate, not for
  reload/probe behaviour.
- `safeFirewallApply` schedules its rollback timer via a nohup'd shell
  sleep. On targets where `/tmp` is mounted noexec the timer falls
  back to `at(1)`; if `at` is unavailable the harness reports
  `rollbackArmed=false` and the operator must wire up their own
  watchdog.
- Multi-tenant cloud images sometimes ship with cloud-init still
  running. The harness probes `cloud-init status` before scenarios 3
  and 5 and waits for `done` so package operations don't race with
  cloud-init's apt-get.

## CI vs operator-driven runs

| Layer            | Runs in CI?              | Command                                      |
| ---------------- | ------------------------ | -------------------------------------------- |
| Unit + scenario  | ✅ yes (no SSH needed)    | `npm test`                                    |
| Harness dry-run  | ✅ yes (no SSH needed)    | `npm run harness:scenarios`                   |
| Harness live     | ❌ no (requires VM)       | `ENVFORGE_HARNESS_MODE=live ENVFORGE_HARNESS_TARGET=<connId> ENVFORGE_HARNESS_BASE_URL=https://envforge.example ENVFORGE_HARNESS_BEARER_TOKEN=<token> npm run harness:scenarios -- ssh-hardening-safe-apply` |
| Destructive live | ❌ no (operator opt-in)   | Add `ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE=true` |

CI's harness dry-run still asserts the plan + gate + expected fields,
so a regression in the planner / apply gate / approval aggregation will
break the build before it ever reaches a target.

## Operator workflow

```sh
# 1. Boot a disposable target.
vagrant up

# 2. Register the target with EnvForge.
curl -X POST $ENVFORGE/api/connections/connect \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"method":"ssh-key","fields":{"host":"192.168.56.10","port":"22","username":"vagrant"},"keyMaterial":"..."}'

# 3. Run a single scenario in live mode against that target.
ENVFORGE_HARNESS_MODE=live \
ENVFORGE_HARNESS_BASE_URL=$ENVFORGE \
ENVFORGE_HARNESS_BEARER_TOKEN=$TOK \
ENVFORGE_HARNESS_TARGET=$CONN_ID \
ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE=true \
npm run harness:scenario -- ssh-hardening-safe-apply

# 4. Inspect the report bundle.
cat docs/harness-reports/<runId>/ssh-hardening-safe-apply.report.md

# 5. Reset the target.
vagrant destroy -f
```

## Where the harness lives in the repo

```
scripts/
  run-harness-scenarios.mjs               ← runner
  harness/
    scenarios/
      01-build-nginx-success.json
      02-nginx-config-postvalidate-rollback.json
      03-build-docker-success.json
      04-ssh-hardening-safe-apply.json
      05-remove-managed-nginx.json
      06-remove-existing-nginx-blocked.json

docs/
  HARNESS_EVALUATION.md                   ← this file
  EVALUATION_REPORT_TEMPLATE.md           ← human-fillable template
  harness-reports/<runId>/                ← per-run output (gitignored)
```


---

## Live Target Certification

The dry-run baseline produced in the previous phase **does not** count
as live certification. To certify EnvForge's live execution behaviour
the operator MUST run the golden scenarios against a disposable Ubuntu
VM in live mode and produce a signed certification report at
`docs/harness-reports/live-ubuntu-certification/`.

> **Until a real run is recorded the certification verdict is
> `not-run`.** No code path in the harness will produce a
> `certified-*` verdict without a successful live execution; see
> `scripts/run-harness-certification.mjs` and
> `scripts/run-harness-scenarios.mjs`.

### Recommended target

| Field             | Recommended                                              |
| ----------------- | -------------------------------------------------------- |
| OS                | **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS** (Jammy / Noble) |
| Init system       | systemd                                                  |
| Package manager   | apt                                                      |
| SSH               | reachable on the registered port; key-based auth         |
| sudo              | NOPASSWD for the EnvForge SSH user (see Vagrantfile)     |
| Network           | outbound to apt mirrors + docker registry (scenario 3)   |

**Other distros are accepted** when the operator explicitly records the
delta in `targetDifferences` and the resulting evaluation report.
Treat any non-Ubuntu run as a separate certification — name the
report directory `live-<distro>-certification/`.

### Hard requirements before running destructive scenarios

1. The target MUST be a **disposable** VM (Multipass, Vagrant,
   Multipass, cloud burner). Production hosts are off-limits.
2. The operator MUST set `ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE=true`
   per shell session. The harness refuses every destructive scenario
   when this is missing.
3. The operator MUST record VM identity in the report
   (provider + image + region / hypervisor).
4. The operator MUST destroy the VM after the run; reports MUST NOT be
   re-used across distinct VM lifetimes.

### Live report directory

Live runs write to a fixed path so the certification report is easy
to find:

```
docs/harness-reports/live-ubuntu-certification/
  summary.json                 ← machine-readable
  summary.md                   ← human-readable, links each scenario
  <scenario>.report.{json,md}  ← per-scenario full bundle
  <scenario>.actions.json      ← redacted ActionRunRecord stream
  EVALUATION_REPORT.md         ← filled-in copy of EVALUATION_REPORT_TEMPLATE.md
```

Use the `harness:certify` script (introduced this phase) instead of
running `harness:scenarios` by hand — it writes the report into the
fixed certification directory and refuses to overwrite a passing
verdict from a previous run.

### Live run command (recipe)

```sh
# 1. Set up the VM (see HARNESS_UBUNTU_LIVE_RUN.md for Multipass / Vagrant / cloud).
# 2. Register the connection in EnvForge:
curl -X POST $ENVFORGE/api/connections/connect \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d '{"method":"ssh-key","fields":{"host":"<ip>","port":"22","username":"envforge"},"keyMaterial":"<private-key-pem>"}'

# 3. Probe so connection.probeSnapshot is populated.
curl -X POST $ENVFORGE/api/connections/$CONN_ID/probe \
  -H "Authorization: Bearer $TOK"

# 4. Run the certification.
ENVFORGE_HARNESS_MODE=live \
ENVFORGE_HARNESS_BASE_URL=$ENVFORGE \
ENVFORGE_HARNESS_BEARER_TOKEN=$TOK \
ENVFORGE_HARNESS_TARGET=$CONN_ID \
ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE=true \
npm run harness:certify

# 5. Inspect the verdict.
cat docs/harness-reports/live-ubuntu-certification/summary.md

# 6. Destroy the VM.
multipass delete --purge envforge-cert        # or vagrant destroy -f, or terraform destroy
```

### Required scenarios for certification

| # | id                                          | Mandatory | Destructive |
| - | ------------------------------------------- | --------- | ----------- |
| 1 | build-nginx-success                         | yes       | no          |
| 2 | nginx-config-postvalidate-failure-rollback  | yes       | yes         |
| 3 | ssh-hardening-safe-apply                    | yes       | yes         |
| 4 | remove-managed-nginx                        | yes       | yes         |
| 5 | remove-existing-nginx-blocked               | yes       | no          |
| 6 | build-docker-success                        | optional  | no          |

When scenario 6 is skipped the verdict is `certified-with-warnings`
(reason: `docker scenario not exercised`).

### Verdicts

The `harness:certify` script computes one of:

| Verdict                     | Meaning                                                                  |
| --------------------------- | ------------------------------------------------------------------------ |
| `certified-basic`           | All five mandatory scenarios passed in live mode against an Ubuntu VM.   |
| `certified-with-warnings`   | All mandatory scenarios passed but at least one optional scenario was skipped or one target-difference was flagged for follow-up. |
| `failed`                    | At least one mandatory scenario failed.                                  |
| `not-run`                   | No live mode invocation was recorded (the default state of the repo).    |

The current state of the repository is **`not-run`**. The committed
`live-ubuntu-certification/summary.md` documents this explicitly.
