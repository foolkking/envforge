# Harness scenario: ssh-hardening-safe-apply

Title: SSH hardening — safe apply with reload-not-restart and probe
Mode: dry-run
Destructive: true
Target: harness-dry-run
Verdict: **pass**
Started: 2026-05-29T14:05:48.788Z
Ended:   2026-05-29T14:05:48.792Z

## Plan summary
- planId: `rebuild:harness-dry-run:1780063548791`
- type: rebuild
- status: needs-review
- effectiveSupportLevel: full-migration
- items: 1
- review.required: true
- review.targetStateConfidence: unknown
- conflicts: 0
- approvalsRequired: 2

## Apply gate verdict
- ok: true
- (no blocking reasons)

## Expectations
- ok: true

## Action run records (dry-run synthesised)
- `capability:ssh-hardening/ssh-hardening:install:openssh-server` — status=pending
- `capability:ssh-hardening/ssh-hardening:command:重启 sshd` — status=pending
- `capability:ssh-hardening/ssh-hardening:verify` — status=skipped

## Target differences observed
- sshServiceName: unknown (probe in live mode: systemctl status ssh sshd)
- nginxServiceName: nginx
- dockerServiceName: docker
- packageManager: unknown (probe in live mode: command -v apt-get / dnf / pacman / apk / zypper)
- systemdAvailable: unknown (probe: command -v systemctl)
- sudoNoPassword: unknown (probe: sudo -n true)
- firewallStack: unknown (probe: ufw status / firewall-cmd --state / nft list ruleset)
- tmpAtomicInstall: assumed yes (probe: stat -f /tmp; install -m 0644)
- aptDpkgLocked: unknown (probe: lsof /var/lib/dpkg/lock-frontend)
