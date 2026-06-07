# Harness scenario: remove-existing-nginx-blocked

Title: Remove plan refuses to auto-remove nginx that existed before EnvForge
Mode: dry-run
Destructive: false
Target: harness-dry-run
Verdict: **pass**
Started: 2026-05-29T14:05:48.800Z
Ended:   2026-05-29T14:05:48.802Z

## Plan summary
- planId: `remove:harness-dry-run:1780063548801`
- type: remove
- status: needs-review
- effectiveSupportLevel: n/a
- items: 1
- review.required: true
- review.targetStateConfidence: n/a
- conflicts: 0
- approvalsRequired: 0

## Apply gate verdict
- ok: true
- (no blocking reasons)

## Expectations
- ok: true

## Action run records (dry-run synthesised)
- `remove:apt:nginx/backup-remove-context` — status=pending
- `remove:apt:nginx/remove-packages` — status=pending
- `remove:apt:nginx/verify-removed` — status=skipped

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
