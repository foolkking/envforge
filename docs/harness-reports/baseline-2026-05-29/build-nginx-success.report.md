# Harness scenario: build-nginx-success

Title: Build nginx — happy path
Mode: dry-run
Destructive: false
Target: harness-dry-run
Verdict: **pass**
Started: 2026-05-29T14:05:48.710Z
Ended:   2026-05-29T14:05:48.763Z

## Plan summary
- planId: `rebuild:harness-dry-run:1780063548756`
- type: rebuild
- status: needs-review
- effectiveSupportLevel: full-migration
- items: 1
- review.required: true
- review.targetStateConfidence: unknown
- conflicts: 0
- approvalsRequired: 0

## Apply gate verdict
- ok: true
- (no blocking reasons)

## Expectations
- ok: true

## Action run records (dry-run synthesised)
- `capability:nginx-web-service/nginx-web-service:install:nginx` — status=pending
- `capability:nginx-web-service/nginx-web-service:command:启动 Nginx` — status=pending
- `capability:nginx-web-service/nginx-web-service:command:启动服务` — status=pending
- `capability:nginx-web-service/nginx-web-service:verify` — status=skipped

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
