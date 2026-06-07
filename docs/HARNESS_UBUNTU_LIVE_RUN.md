# Harness — Live Ubuntu Run Guide

> Companion to `docs/HARNESS_EVALUATION.md` and
> `docs/HARNESS_TARGET_READINESS.md`. The procedures below stand up a
> disposable Ubuntu 22.04 / 24.04 LTS VM, register it with EnvForge,
> run the live certification scenarios, collect the report bundle,
> and tear the VM down.
>
> **Never** run destructive scenarios on a production host. The
> harness refuses to do so unless
> `ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE=true` is explicitly set per
> shell session AND
> `scripts/harness/check-target-readiness.mjs` returns
> `safeForDestructive=true`.
>
> If no live VM is available, the certification verdict is locked to
> `not-run`. There is NO flag combination that escalates a dry-run to
> `certified-*`.

## Prerequisites

- An EnvForge instance reachable at `$ENVFORGE` (HTTP / HTTPS).
- A bearer token for an account with `connection:write` permission.
- An SSH key pair the operator owns. The PUBLIC half is injected into
  the VM via cloud-init / Vagrant provisioner / Multipass cloud-init.

```sh
export ENVFORGE=https://envforge.example          # or http://127.0.0.1:4000
export TOK=eyJ...                                  # bearer token
export PUBKEY="$(cat ~/.ssh/id_ed25519.pub)"
export PRIV=~/.ssh/id_ed25519
```

---

## Method A — Multipass (recommended for laptops)

Multipass runs Ubuntu VMs natively on macOS, Windows, and Linux. The
operator scripts ship a one-shot provision command:

```sh
# 1. Provision the VM (idempotent name picked automatically).
npm run harness:ubuntu:provision -- --pubkey ~/.ssh/id_ed25519.pub
# Output:
#   vm name : envforge-harness-1d4c7
#   ip      : 192.168.64.10
#   user    : envforge
#   ssh spec: envforge@192.168.64.10
TARGET_SSH=envforge@192.168.64.10
TARGET_NAME=envforge-harness-1d4c7

# 2. Confirm the target meets the readiness contract BEFORE doing
#    anything destructive.
ENVFORGE_HARNESS_SSH_KEY=$PRIV \
  npm run harness:target:check -- $TARGET_SSH

# 3. Register the connection in EnvForge.
CONN_ID=$(ENVFORGE_HARNESS_BASE_URL=$ENVFORGE \
  ENVFORGE_HARNESS_BEARER_TOKEN=$TOK \
  npm run --silent harness:register -- \
    --host 192.168.64.10 --user envforge --port 22 --keyFile $PRIV)
echo "registered connection: $CONN_ID"

# 4. Run live certification.
ENVFORGE_HARNESS_MODE=live \
ENVFORGE_HARNESS_BASE_URL=$ENVFORGE \
ENVFORGE_HARNESS_BEARER_TOKEN=$TOK \
ENVFORGE_HARNESS_TARGET=$CONN_ID \
ENVFORGE_HARNESS_TARGET_SSH=$TARGET_SSH \
ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE=true \
ENVFORGE_HARNESS_SSH_KEY=$PRIV \
npm run harness:certify

# 5. Inspect the certification report.
cat docs/harness-reports/live-ubuntu-certification/summary.md

# 6. Destroy the VM and drop the connection.
npm run harness:ubuntu:destroy -- --name $TARGET_NAME
curl -fsS -X DELETE "$ENVFORGE/api/connections/$CONN_ID" \
  -H "Authorization: Bearer $TOK"
```

If `multipass` is unavailable the provisioner exits non-zero and prints
the manual fallback. **It does not pretend to have created a VM.**

---

## Method B — Vagrant + VirtualBox

```ruby
# scripts/harness/Vagrantfile (template)
Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/jammy64"           # or "ubuntu/noble64" for 24.04
  config.vm.network "private_network", type: "dhcp"
  config.vm.hostname = "envforge-harness-vagrant"
  config.vm.provider "virtualbox" do |vb|
    vb.memory = 2048
    vb.cpus = 2
  end
  config.vm.provision "shell", inline: <<-SHELL
    set -eu
    apt-get update
    apt-get install -y openssh-server sudo curl
    id envforge >/dev/null 2>&1 || useradd -m -s /bin/bash envforge
    echo 'envforge ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/envforge
    chmod 0440 /etc/sudoers.d/envforge
    install -d -m 0700 -o envforge -g envforge /home/envforge/.ssh
    cat > /home/envforge/.ssh/authorized_keys <<EOF
ENVFORGE_PUBKEY_PLACEHOLDER
EOF
    chown envforge:envforge /home/envforge/.ssh/authorized_keys
    chmod 0600 /home/envforge/.ssh/authorized_keys
    install -m 0644 /dev/null /etc/envforge-disposable
  SHELL
end
```

```sh
sed -i.bak "s|ENVFORGE_PUBKEY_PLACEHOLDER|$PUBKEY|" scripts/harness/Vagrantfile
vagrant up

TARGET_IP=$(vagrant ssh -c "hostname -I" 2>/dev/null | awk '{print $1}')
TARGET_SSH=envforge@$TARGET_IP

# … same readiness / register / certify / destroy flow as Method A.
vagrant destroy -f
```

---

## Method C — Cloud burner VM

Spin up a stock Ubuntu 22.04 / 24.04 image with cloud-init equivalent
to:

```yaml
#cloud-config
hostname: envforge-harness-cloud
preserve_hostname: false
manage_etc_hosts: true
package_update: true
users:
  - name: envforge
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    ssh_authorized_keys:
      - $PUBKEY
runcmd:
  - install -m 0644 /dev/null /etc/envforge-disposable
  - echo "EnvForge disposable cloud burner" > /etc/envforge-disposable
```

Recommendations specific to cloud:

- Lock the security group / firewall to the EnvForge ingress IP only.
- Tag the instance with `envforge-disposable=true` so audit can spot
  burners that survived past a run.
- Always destroy the instance via the cloud API at the end of the run.

---

## Live data each run captures

The orchestrator's per-scenario `*.report.json` block carries
`targetDifferences`. In live mode each field comes from
`scripts/harness/check-target-readiness.mjs` plus a small in-scenario
probe. In dry-run mode the value is `unknown (probe: ...)`.

| Field               | Source                                                       |
| ------------------- | ------------------------------------------------------------ |
| `targetOs`          | `/etc/os-release` `PRETTY_NAME`                              |
| `kernel`            | `uname -r`                                                   |
| `packageManager`    | `command -v apt-get`                                         |
| `initSystem`        | `command -v systemctl`                                       |
| `sshServiceName`    | `systemctl list-unit-files` row matching `(ssh\|sshd).service` |
| `nginxServiceName`  | `systemctl list-unit-files` row matching `nginx.service`     |
| `dockerServiceName` | `systemctl list-unit-files` row matching `docker.service`    |
| `sudoNoPassword`    | `sudo -n true`                                               |
| `aptDpkgLocked`     | `lsof /var/lib/dpkg/lock-frontend`                           |
| `firewallStack`     | `ufw status` / `firewall-cmd --state` / `nft list ruleset`   |

When any of these reveals a divergence from EnvForge's assumptions
(e.g. `ssh.service` rather than `sshd.service`), the operator MUST
update the **execution layer** (`safeSshdConfigApply` already tries
both names) — never the safety gate.

---

## Verdict labels

| Verdict                     | Meaning                                                                  |
| --------------------------- | ------------------------------------------------------------------------ |
| `not-run`                   | No live invocation was recorded. Default state of the repo.              |
| `failed`                    | At least one mandatory scenario failed.                                  |
| `certified-with-warnings`   | All mandatory scenarios passed but at least one optional was skipped or one warning was raised (e.g. docker not available). |
| `certified-basic`           | Every mandatory + optional scenario passed cleanly on a verified-disposable Ubuntu LTS target. |

The verdict logic lives in
`scripts/harness/lib/readiness.mjs:decideCertificationVerdict` and is
covered by the test suite.

---

## CI vs operator-driven runs

| Layer            | Runs in CI?              | Command                                      |
| ---------------- | ------------------------ | -------------------------------------------- |
| Unit + scenario  | ✅ yes (no SSH)           | `npm test`                                    |
| Harness dry-run  | ✅ yes (no SSH)           | `npm run harness:scenarios`                   |
| Live readiness   | ❌ requires VM            | `npm run harness:target:check -- envforge@<ip>` |
| Live certify     | ❌ requires VM            | `npm run harness:certify` (with all four ENVFORGE_HARNESS_* vars) |

CI's harness dry-run still asserts plan + gate + expected fields, so a
regression in the planner / apply gate / approval aggregation breaks
the build long before it reaches a target.

---

## Troubleshooting

- **apt is locked** — wait for cloud-init / unattended-upgrades to
  finish: `sudo cloud-init status --wait`.
- **`systemctl reload sshd`: Unit sshd.service not found** on Ubuntu —
  the unit there is `ssh.service`. `safeSshdConfigApply` already tries
  both names; if a run still fails, the live report's
  `targetDifferences.sshServiceName` will document the actual unit and
  the issue should be filed against the execution layer.
- **`docker.io` package not found on Ubuntu Minimal images** —
  `apt-get update` was probably skipped; confirm cloud-init finished
  and re-run scenario 6.
- **Probe says `disposable=false`** — the hostname doesn't match the
  expected pattern AND `/etc/envforge-disposable` is missing. Re-name
  the host or `sudo touch /etc/envforge-disposable`.
