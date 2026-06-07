# EnvForge End-to-End Scenario Validation

> **Scope.** This document closes the catalog audit phase by exercising every
> reviewed catalog capability through the **full mutation contract** EnvForge
> guarantees:
>
> ```
> Capability / Evidence
>   → Environment Plan
>     → Plan Review (conflicts + risks + approvals)
>       → Apply Gate (server-side)
>         → Verify
>           → Report
> ```
>
> **No phase may be skipped.** No UI affordance, API route, or integration
> may bypass the Plan Review or the Apply Gate. If a scenario in this
> document fails, the corresponding test in
> `apps/api/src/engine/tests/e2e-scenarios.test.ts` MUST also fail.

## Status legend

| Symbol | Meaning |
| --- | --- |
| ✅ | Closed-loop verified (test + manual) |
| ⚠️ | Reachable but degraded — UI must surface a warning |
| ❌ | Refused: apply gate blocks until the operator acts |

## Contract recap (re-stated for every scenario)

1. **User entry point.** Where in the UI / API the user starts the flow.
2. **Inputs.** Catalog ids, target snapshot, ack flags.
3. **Expected plan.** type, item count, capability keys.
4. **Conflicts / risks / approvals.** What Plan Review must surface.
5. **Approve gate.** What the operator must do before the plan is
   `approved`.
6. **Apply gate.** What the server-side `evaluateApplyGate` must reject
   until conditions are met.
7. **Verify.** What the verify run must check.
8. **Report.** What the Plan Report must record.
9. **Failure / refusal.** What the system must do on a bad ack or a
   verify failure.

---

## Scenario 1 — Build Nginx + Docker (no conflict)

| Field | Value |
| --- | --- |
| Status | ✅ |
| Test | `e2e: nginx + docker rebuild has no block conflict and surfaces only safe approvals` |

1. **Entry.** `POST /api/plans` with `source.kind="capability-selection"`
   and `capabilityIds=["nginx-web-service","docker-host-profile"]`.
2. **Inputs.** Empty target snapshot. No prior software.
3. **Expected plan.**
   * `type=rebuild`
   * 2 items: `capability:nginx-web-service` (capabilityKey
     `web-server.nginx`, full-migration), `capability:docker-host-profile`
     (`container.docker`, full-migration).
   * `summary.totalItems=2`, `summary.totalActions ≥ 4` (install + start + verify per item).
4. **Conflicts.** None. `plan.review.conflicts` is empty.
5. **Approve gate.** No remainingRisks (their audit `remainingRisks` is empty per `catalog-audit-records.ts`); no required approval gate. Operator can `Approve` immediately.
6. **Apply gate.** `evaluateApplyGate(plan, {})` returns `ok=true`.
7. **Verify.** `nginx -t`, `docker version` exit 0.
8. **Report.** Records both capabilities, supportLevel `full-migration`,
   conflicts=[], remainingRisks=[], dataStrategy=none-required.
9. **Failure mode.** If apt fails on either package, plan moves to
   `failed`; rollback removes the installed package.

## Scenario 2 — Build Nginx + Caddy (block conflict)

| Field | Value |
| --- | --- |
| Status | ❌ until plan edited |
| Test | `e2e: nginx + caddy produces http-frontend block conflict and refuses approve/apply` |

1. **Entry.** Same `POST /api/plans` but `capabilityIds=["nginx-web-service","caddy-server"]`.
2. **Expected plan.** 2 items, both web frontends.
3. **Conflicts.** `plan.review.conflicts` contains a single entry:
   * `id="http-frontend"`
   * `severity="block"`
   * `participatingItemIds` includes both items.
   * `resolutionOptions` lists `keep-nginx`, `keep-caddy`, `keep-openresty`, `keep-traefik`.
4. **Approve gate.**
   * **Cannot ack a block conflict.** UI shows red banner. The operator
     must edit the plan (drop one capability) and resubmit.
   * Even if the operator forges `acknowledgedConflicts:[{conflictId:"http-frontend"}]`, the apply gate refuses because `evaluateApplyGate.blockingConflicts` is computed from the live plan, not from acks.
5. **Apply gate.** Returns 400 with `gate.blockingConflicts=[http-frontend]`.
6. **Verify.** Not reached.
7. **Report.** Records the refusal: `conflictsDetected=[http-frontend(block)]`, `applyAttempted=false`.
8. **Failure / refusal.** API responds 400 to apply; the plan stays at `needs-review`.

## Scenario 3 — Build Keycloak + Authelia (warn conflict)

| Field | Value |
| --- | --- |
| Status | ⚠️ ack required |
| Test | `e2e: keycloak + authelia warn conflict can be acked with a valid resolutionId` |

1. **Entry.** `capabilityIds=["keycloak","authelia"]`.
2. **Expected plan.** Two items both at `managed-config`, IdP capability keys.
3. **Conflicts.** `identity-provider` conflict at `severity="warn"`. resolutionOptions include `keep-keycloak`, `keep-authelia`, `ack-multi-idp`, etc.
4. **Approve gate.**
   * Operator picks one resolutionId from `resolutionOptions` (e.g. `ack-multi-idp`).
   * Each item also has approval gates (`identity-provider-confirm`, `secret-confirm`); operator ticks them.
5. **Apply gate.** `evaluateApplyGate` requires a non-empty `resolutionId` that **belongs to the rule's `resolutionOptions`**. Empty or unknown resolutionId is rejected.
6. **Verify.** `kc.sh status` (best effort) and `authelia --version`.
7. **Report.** Records `conflicts=[identity-provider(warn → ack-multi-idp)]`, `requiredApprovalGates=4`, `approvalState=all-acked`.
8. **Failure mode.** Submitting a fabricated resolutionId (e.g. `pretend-keep-postgres`) yields a 400 from apply gate.

## Scenario 4 — SSH hardening (remainingRisks + ssh-lockout-confirm)

| Field | Value |
| --- | --- |
| Status | ⚠️ many gates |
| Test | `e2e: ssh-hardening apply refuses without remainingRisks and ssh-lockout gates` |

1. **Entry.** `capabilityIds=["ssh-hardening"]`.
2. **Expected plan.** 1 item, capability `security.ssh`, supportLevel `full-migration`. Carries `audit.remainingRisks` (≥ 1 entry) and `requiredApprovals = [ssh-lockout-confirm, secret-confirm]`.
3. **Conflicts.** None.
4. **Approve gate.**
   * Every entry in `audit.remainingRisks` must be ticked (Plan Review's "Audit Remaining Risks" section).
   * Every gate in `plan.review.approvalsRequired` must be ticked.
   * The `ssh-lockout-confirm` gate is rendered as **dangerous** in the UI and requires a typed confirmation phrase ("CONFIRM SSH LOCKOUT") — see `PlanReviewPanel`.
5. **Apply gate.** Returns 400 if **any** remainingRisk or approval gate is missing. The error response includes `gate.missingRiskAcks` and `gate.missingApprovalGates`.
6. **Verify.** `sshd -t` + `systemctl is-active sshd` + a remote SSH probe with a 60-second auto-rollback timer.
7. **Report.** Records `remainingRisks` (acked / unacked), `requiredApprovalGates`, `dataStrategy=none`.
8. **Failure mode.** If verify fails (sshd reports config error, or the SSH probe cannot reconnect), the plan auto-rolls back and the report records `verify=failed → rolled-back`.

## Scenario 5 — Migrate Redis or PostgreSQL (data strategy)

| Field | Value |
| --- | --- |
| Status | ⚠️ data-strategy gate |
| Test | `e2e: redis migration plan records dataStrategy=dump-restore (not raw rsync)` |

1. **Entry.** `POST /api/plans` with `type=migration` (handled by the
   migration classifier path). The classifier produces an `EnvironmentPlan`
   for the redis-server / postgres-profile capability.
2. **Expected plan.** Item carries `dataStrategy="dump-restore"` in the
   plan report. Redis uses an explicit `manual-review` RDB/AOF strategy
   that maps to SAVE/BGSAVE review; PostgreSQL/MySQL use logical
   dump/restore tooling (`pg_dump` / `mysqldump`).
3. **Conflicts.** None unless valkey is also requested.
4. **Approve gate.** Risks include "RDB / AOF persistence files require
   explicit review" (redis) or "Logical dump (pg_dump) required" (postgres).
   Operator must ack each.
5. **Apply gate.** Refuses if dataStrategy is `unknown` or `raw-rsync`.
   The apply gate verifies that no plan action with kind=`copyConfig`
   targets `/var/lib/postgresql/*` or `/var/lib/redis/*` directly without
   a preceding `runCommand` step that produces a dump file.
6. **Verify.** `redis-cli ping` / `psql --version` + a smoke query.
7. **Report.** Records `dataStrategy`, source-side dump file size, target-side restore exit code.
8. **Failure mode.** A plan whose only data action is a raw rsync of the
   data directory MUST be rejected by the report-generation step (`buildPlanReport` flags `dataStrategy="raw-rsync"` with severity `error`).

### Batch 1 Certified Scenario Additions

Batch 1 adds dry-run harness scenarios for the newly promoted
capabilities:

* `firewall-baseline-dry-run`: verifies `safeFirewallApply` plan shape,
  `firewall-lockout-confirm`, current SSH port protection, refusal when
  `ENVFORGE_CURRENT_SSH_PORT` is missing, firewall status validation, and
  rollback timer documentation.
* `fail2ban-protection-dry-run`: verifies package/service detection,
  `fail2ban-client status` / `systemctl is-active fail2ban`, jail config
  rollback, and structured review of custom action/log paths.
* `redis-server-dry-run`: verifies `redis-cli ping`, RDB/AOF manual data
  review, `data-strategy-confirm`, and no raw rsync of `/var/lib/redis`.

### Batch 2 / Batch 3 Certified Scenario Additions

The expanded six-item batch adds dry-run coverage for database, TLS, and
runtime capabilities:

* `postgres-profile-dry-run`: verifies `pg_dump` / `pg_dumpall` manual data
  review, `data-strategy-confirm`, `psql` validation, and no raw rsync of
  `/var/lib/postgresql`.
* `mysql-server-dry-run`: verifies `mysqldump` / `mariadb-dump` manual data
  review, `data-strategy-confirm`, `mysqladmin ping` validation, and no raw
  rsync of `/var/lib/mysql`.
* `certbot-ssl-dry-run`: verifies private key confirmation, manual DNS/domain
  ownership confirmation, `certbot certificates`, and dry-run ACME refusal.
* `node-runtime-profile-dry-run`: verifies Node/npm validation, global npm
  package review, and npm registry token redaction.
* `python-toolchain-dry-run`: verifies Python/pip validation, pipx/venv/user
  package review, and pip index credential redaction.
* `certbot-letsencrypt-alias-review`: keeps the legacy alias detect-only and
  points user-facing certified flow at `certbot-ssl`.

### Batch 3 Developer Toolchain Certified Scenario Additions

The `batch=3` developer toolchain slice adds dry-run coverage for:

* `nodejs-version-mgr-dry-run`: verifies NVM shell init review, default Node
  alias handling, npm global/cache rebuild scope, and NVM validation.
* `pyenv-toolchain-dry-run`: verifies pyenv build dependency coverage,
  version-file review, compiled interpreter/virtualenv rebuild scope, and
  pyenv validation.
* `flutter-sdk-dry-run`: verifies Flutter SDK path review, pub credential/cache
  handling, Flutter/Dart validation, and Android/iOS platform SDK scope.

### Batch 4 Web / Proxy Certified Scenario Additions

The `batch=3` Web/Proxy slice adds dry-run coverage for:

* `caddy-server-dry-run`: verifies Caddyfile validation, ACME storage secret
  confirmation, DNS/domain confirmation, site-root review, and upstream review.
* `openresty-dry-run`: verifies `openresty -t`, custom Lua module review,
  TLS key path review, and upstream service review.
* `traefik-proxy-dry-run`: verifies Traefik health checks, `acme.json` secret
  confirmation, DNS/domain confirmation, Docker/file provider review, and
  dashboard exposure review.

### Batch 6 Web / Runtime Certified Scenario Additions

The `batch=6` slice adds dry-run coverage for:

* `mariadb-dry-run`: verifies the shared MySQL/MariaDB dump-restore strategy,
  MariaDB service validation, and no raw rsync of `/var/lib/mysql`.
* `haproxy-lb-dry-run`: verifies `haproxy -c`, backend dependency review, and
  TLS key redaction.
* `apache-httpd-dry-run`: verifies `apachectl configtest`, vhost/module review,
  TLS/auth file redaction, and PHP handler coupling review.
* `php-fpm-dry-run`: verifies PHP-FPM syntax validation, pool env secret
  redaction, socket/TCP listener review, and web-server upstream review.
* `php-toolchain-dry-run`: verifies PHP and Composer validation plus Composer
  credential review.
* `ruby-toolchain-dry-run`: verifies Ruby, RubyGems, and Bundler validation plus
  RubyGems/Bundler credential review.

### Batch 10 Runtime / DevOps Certified Scenario Additions

The `batch=10` slice adds dry-run coverage for:

* `golang-runtime-dry-run`: verifies Go package detection, `go version`, private
  module environment review, and no module cache copy.
* `openjdk-runtime-dry-run`: verifies Java/Javac/Maven validation, Maven
  settings secret review, and local repository rebuild scope.
* `rust-toolchain-dry-run`: verifies Rust/Cargo validation, Cargo credential
  review, and no target directory copy.
* `dotnet-runtime-dry-run`: verifies .NET package detection, `dotnet --version`,
  NuGet credential review, and workload/cache rebuild scope.
* `git-version-control-dry-run`: verifies Git validation, global config review,
  SSH/signing credential review, and no repository working tree copy.
* `ansible-tool-dry-run`: verifies Ansible validation, inventory/vault review,
  and secret approval for vault material.
* `terraform-iac-dry-run`: verifies Terraform validation, provider/backend
  credential review, and no state-file migration by default.
* `kubernetes-tools-dry-run`: verifies kubectl/Helm validation, kubeconfig
  secret review, and cluster context confirmation.
* `rsync-tools-dry-run`: verifies rsync validation, source/destination approval,
  SSH credential review, and explicit refusal to infer arbitrary data migration.
* `htop-tools-dry-run`: verifies monitoring tool packages, htop/sysstat config
  review, and no historical metric data copy.

### Batch 8 Shell / Cache / Tooling Certified Scenario Additions

The `batch=8` slice adds dry-run coverage for:

* `zsh-shell-dry-run`: verifies zsh package detection, `zsh --version`, shell
  dotfile review, and default-shell change review.
* `fish-shell-dry-run`: verifies fish package detection, `fish --version`, and
  review for functions, completions, and `conf.d` startup files.
* `neovim-editor-dry-run`: verifies Neovim package detection, `nvim --version`,
  config/plugin review, and external provider/tool dependency review.
* `tmux-multiplex-dry-run`: verifies tmux package detection, `tmux -V`, and
  review for `.tmux.conf`, plugins, and session-resurrection files.
* `rust-cli-tools-dry-run`: verifies ripgrep/fzf/zoxide style CLI package
  detection, validation commands, and shell-integration review.
* `nethogs-bandwidth-dry-run`: verifies bandwidth/network utility packages,
  validation commands, monitor config review, and no historical metric copy.
* `memcached-dry-run`: verifies memcached package/service/config detection,
  bind-address exposure review, and no persistent cache data migration.
* `valkey-server-dry-run`: verifies Valkey package/service/config detection,
  RDB/AOF data strategy approval, secret confirmation, and Redis/Valkey
  conflict warning coverage.

### Batch 10 Observability / Messaging / CI Certified Scenario Additions

The additional `batch=10` service slice adds dry-run coverage for:

* `prometheus-monitoring-dry-run`: verifies Prometheus and Node Exporter
  package/config detection, `promtool check config`, TSDB snapshot/export
  approval, and scrape credential redaction.
* `grafana-dashboard-dry-run`: verifies Grafana service/provisioning config,
  health probing, database backup/restore confirmation, and datasource secret
  review.
* `netdata-monitoring-dry-run`: verifies Netdata config detection, service
  probing, cloud claim/stream secret review, and metric-history rebuild scope.
* `zabbix-monitoring-dry-run`: verifies Zabbix agent config, endpoint review,
  TLS PSK handling, and UserParameter script review.
* `loki-logging-dry-run`: verifies Loki/Promtail config detection, ready probe,
  chunk/index retention strategy, object-storage secrets, and promtail offset
  handling.
* `mosquitto-mqtt-dry-run`: verifies Mosquitto config validation, password/TLS
  secret review, bridge topology review, and retained-message strategy.
* `rabbitmq-dry-run`: verifies RabbitMQ diagnostics, definitions export/import
  review, queue-content strategy, and `.erlang.cookie` secret handling.
* `meilisearch-dry-run`: verifies Meilisearch health probing, dump/import data
  strategy, and master-key continuity review.
* `jenkins-ci-dry-run`: verifies Jenkins package/service planning,
  JENKINS_HOME backup/restore confirmation, credential-store secret review, and
  plugin compatibility review.
* `gitlab-runner-dry-run`: verifies GitLab Runner validation, token handling,
  executor dependency review, and refusal to migrate job caches by default.

### Batch 10 File / VPN / Data Certified Scenario Additions

The additional `batch=10` slice adds dry-run coverage for:

* `samba-share-dry-run`: verifies `testparm -s`, Samba account/passdb review,
  share path and ACL review, and explicit share data strategy approval.
* `nfs-server-dry-run`: verifies `exportfs -s`, export path review, client CIDR
  review, and no implicit dataset copy.
* `tailscale-dry-run`: verifies Tailscale validation, node identity handling,
  re-authentication with auth keys, and subnet route review.
* `code-server-dry-run`: verifies code-server validation, password/auth review,
  bind/TLS/reverse-proxy exposure review, and workspace repository exclusion.
* `sonarqube-dry-run`: verifies SonarQube health probing, JDBC/default admin
  credential review, plugin compatibility review, and database backup/restore.
* `mongodb-dry-run`: verifies MongoDB ping validation, mongodump/mongorestore
  strategy approval, keyFile/auth review, and replica-set topology review.
* `minio-storage-dry-run`: verifies MinIO health probing, `mc mirror` or
  replication strategy approval, root credential review, and KMS/site URL review.
* `elasticsearch-dry-run`: verifies cluster health probing, snapshot/restore
  strategy approval, keystore/TLS review, and discovery setting review.
* `clickhouse-dry-run`: verifies ClickHouse `SELECT 1`, BACKUP/RESTORE strategy,
  user secret review, and Keeper/ZooKeeper scope review.
* `influxdb-dry-run`: verifies InfluxDB health probing, `influxd backup` /
  restore strategy approval, token review, and retention/schema compatibility.

### Batch 5 Secure Infra Certified Scenario Additions

The additional `batch=5` slice adds dry-run coverage for:

* `wireguard-vpn-dry-run`: verifies `wg show`, private/preshared key review,
  peer endpoint review, AllowedIPs, forwarding, NAT, and firewall scope.
* `openvpn-server-dry-run`: verifies OpenVPN validation, PKI material review,
  client-config-dir handling, pushed routes, and target topology checks.
* `firewalld-dry-run`: verifies `firewall-cmd --check-config`, public-zone SSH
  confirmation, rollback-timer approval, and UFW/firewalld exclusivity review.
* `vault-secrets-dry-run`: verifies `vault status`, Vault snapshot/restore
  confirmation, unseal/root-token handling, and auto-unseal KMS review.
* `k3s-dry-run`: verifies `k3s kubectl get nodes`, snapshot/restore
  confirmation, kubeconfig/node-token secret review, and persistent volume scope.

### Batch 7 Apps / SSO Certified Scenario Additions

The additional `batch=7` slice adds dry-run coverage for:

* `swap-config-dry-run`: verifies `swapon --show`, fstab rollback, filesystem
  compatibility, cloud-image policy, and zram collision review.
* `nodejs-pm2-dry-run`: verifies PM2 validation, per-user dump.pm2 handling,
  application-directory scope, and environment secret redaction.
* `nextcloud-dry-run`: verifies Nextcloud occ status, maintenance-mode backup,
  DB dump/restore, data directory transfer, and config.php secret review.
* `gitea-server-dry-run`: verifies Gitea validation, `gitea dump` / restore,
  repository/LFS/hook handling, and app.ini secret review.
* `jellyfin-media-dry-run`: verifies Jellyfin health probing, media bind-mount
  scope, library metadata/plugin review, and hardware acceleration review.
* `keycloak-dry-run`: verifies Keycloak realm export/import, DB restore,
  OIDC client secrets, custom providers/themes, and IdP conflict warnings.
* `authelia-dry-run`: verifies Authelia state handling, TOTP/WebAuthn data,
  secret continuity, and reverse-proxy forward-auth pairing.

### Batch 20 Self-hosted App Certified Scenario Additions

The `batch=20` slice adds dry-run coverage for concrete self-hosted app
cards while keeping panels, aliases, and combo stacks out of certification:

* `vaultwarden-dry-run`: verifies vault backup/export review, attachments,
  ADMIN_TOKEN/SMTP secret handling, and data-strategy approval.
* `pihole-dry-run`: verifies DNS port 53 cutover, systemd-resolved conflict
  awareness, gravity/custom-list review, and admin secret approval.
* `authentik-dry-run`: verifies Authentik blueprint/DB migration, IdP approval,
  AUTHENTIK_SECRET_KEY continuity, and client-secret review.
* `wikijs-dry-run`, `bookstack-dry-run`, `paperless-ngx-dry-run`: verify
  documentation app content/media/database backup paths and secret-key review.
* `n8n-dry-run`: verifies workflow/credential DB backup, encryption-key
  continuity, webhook URL review, and binary-data storage scope.
* `home-assistant-dry-run`: verifies secrets.yaml review, recorder DB handling,
  and target-specific USB/Zigbee/Z-Wave bindings.
* `gitlab-ce-dry-run`, `forgejo-dry-run`: verify repository/LFS/registry or
  dump-restore paths plus app secret handling.
* `umami-dry-run`, `nocodb-dry-run`: verify app metadata/analytics DB backup,
  JWT/app secret continuity, webhook/tracking-domain review, and external DB
  credential handling.
* `adguard-home-dry-run`: verifies DNS port 53 cutover, AdGuardHome.yaml
  secret review, DoH/DoT certificate review, and resolver conflict awareness.
* `docker-mailserver-dry-run`: verifies maildir/account scope, DKIM/TLS secret
  handling, mail DNS confirmation, and no blind mail-volume copy.
* `onlyoffice-docs-dry-run`, `immich-dry-run`: verify multi-container app
  dependency backups, JWT/object-store secrets, photo/document data handling,
  and version-aware restore review.
* `uptime-kuma-dry-run`: verifies kuma.db backup, notifier credential review,
  status-page domain handling, and Docker socket monitor scope.
* `navidrome-dry-run`, `audiobookshelf-dry-run`, `freshrss-dry-run`: verify
  media/feed library scope, metadata backup, token/API secret review, and
  operator-owned bind mounts or OPML export/import decisions.
* `homepage-dry-run`, `stirling-pdf-dry-run`, `mealie-dry-run`,
  `linkwarden-dry-run`, `seafile-dry-run`: verify the final certified
  application cards, including config/token review, official backup paths,
  Seafile check tooling, and refusal of blind raw data copy.
* `lamp-stack-dry-run`, `lemp-stack-dry-run`,
  `node-production-deploy-dry-run`, `docker-compose-dev-dry-run`,
  `security-baseline-dry-run`, `monitoring-stack-dry-run`,
  `sso-stack-dry-run`: verify certified combo orchestration rules,
  approval gates, and report coverage for the final combo batch.

## Scenario 6 — LEMP combo (certified combo depth)

| Field | Value |
| --- | --- |
| Status | certified |
| Test | `e2e scenario 6: lemp-stack combo effectiveSupportLevel reflects certified combo depth` |

1. **Entry.** `capabilityIds=["lemp-stack"]` (combo).
2. **Expected plan.** 1 item with `supportLevel="full-migration"`. The combo now has a dedicated catalog rule and dry-run harness, and composes the certified Nginx, MySQL, PHP-FPM, and PHP toolchain strategies.
3. **Conflicts.** None expected.
4. **Approve gate.** Operator sees the combo's `audit.remainingRisks`:
   * "php-fpm pool definitions under /etc/php/*/fpm/pool.d/ are managed by the php-fpm card, not by this combo card."
   * "Nginx + MySQL + PHP-FPM components individually carry full-migration depth via their own cards; operators wanting that should run them as separate plans."
   These are in `audit.remainingRisks` and must be acked.
5. **Apply gate.** The plan's `effectiveSupportLevel` remains **full-migration** when paired with `php-fpm`, because both selected items are certified.
6. **Verify.** `nginx -t`, `mysqladmin ping || mariadb-admin ping`, `php-fpm -t || php-fpm8.3 -t || php-fpm8.2 -t`.
7. **Report.** Records `effectiveSupportLevel="full-migration"` and lists the combo's data/rollback/manual-review decisions.
8. **Failure mode.** If the combo loses its rule, harness, or data strategy, certification drops it back to not-ready and the Build UI hides it from non-admin users.

---

## Cross-cutting refusal rules

The server-side enforcement rules below MUST be reflected in
`environment-plan.ts:evaluateApplyGate` and exercised by the test suite.

1. **Block conflicts re-computed on every apply.** The server does not
   trust the snapshot of `plan.review.conflicts` shipped on the request.
   Before approve / apply it re-runs `detectPlanConflicts` against the
   current `plan.items[*].capabilityKey` set. If two conflicting
   capabilities are still present, apply is refused with 400 even if the
   client lists fake acknowledgements.
2. **Resolution id validation.** When the operator acks a warn conflict
   with `resolutionId="X"`, the gate verifies `X` is in the
   `resolutionOptions` list of that rule. Unknown ids are rejected.
3. **Resolution capabilityKey consistency.** If the operator picked
   `keep-nginx`, the plan's `capabilityKey` set must not still contain
   `web-server.caddy` / `web-server.openresty` / `network.reverse-proxy.traefik`.
   The gate enforces this by re-running detection.
4. **Detect-only items never produce direct apply actions.** Any plan
   item with `supportLevel="detect-only"` may only emit `kind=review`
   actions; the gate refuses apply if such an item carries any
   `installPackage`, `writeConfig`, `runCommand`, `restart`, `enableService`,
   or `removePackage` action.
5. **Required approvals are aggregated into `plan.review.approvalsRequired`.**
   The PlanReviewPanel reads this list. The apply gate refuses apply
   when any gate id in this list has not been acked.
6. **remainingRisks → Plan Review.** Every `audit.remainingRisks` entry
   on every plan item MUST appear in the Plan Review UI's "Audit
   Remaining Risks" section. The apply gate refuses apply until each is
   acked.
7. **Apply gate is server-side.** Front-end can disable buttons
   defensively, but the server is the source of truth. Hand-crafted
   curl requests with `dryRun=false` and forged acks MUST still be
   rejected when the live plan still has unresolved gates.

## Plan Report

Every applied (or apply-refused) plan produces a Plan Report. Generated
by `buildPlanReport(plan, options)` in `environment-plan.ts`, the report
contains:

* `selectedCapabilities`: list of plan item ids and their capabilityKeys.
* `supportLevels`: per-item supportLevel.
* `effectiveSupportLevel`: the **minimum** supportLevel across the
  plan, used to label the whole plan in the UI.
* `conflictsDetected`: full list of detected conflicts at apply time.
* `conflictResolutions`: which resolutionId the operator picked.
* `remainingRisks`: per-item remaining risks + ack state.
* `requiredApprovalGates`: per-item gates + ack state.
* `approvalState`: `pending` / `partial` / `complete`.
* `dataStrategyDecisions`: per-item data strategy.
* `validateResults`: from the verify phase, including `passed[] / failed[]`.
* `rollbackAvailability`: per-action `canRollback`.
* `skippedDetectOnlyItems`: items whose only action was `kind=review`.
* `unresolvedManualSteps`: actions of `kind=manualStep` plus any
  `requiredApprovals` that are still unacked at report time.

Both Markdown and JSON renderings are produced via:

* `GET /api/plans/:id/report?format=markdown`
* `GET /api/plans/:id/report?format=json`

## Target Snapshot in Build Mode

Build Mode MUST consider the target's existing capabilities:

1. If `connection.probeSnapshot` is present, `buildRebuildPlan` is given
   `existingCapabilities` (computed from the snapshot's software list +
   detection rules). Each existing capability that conflicts with a
   selected one is added to `plan.review.conflicts` as a synthetic
   `target-state` conflict.
2. If `connection.probeSnapshot` is absent or older than 24 hours, the
   plan carries `plan.review.targetStateUnknown=true` and the UI shows
   a warning banner.
3. `plan.review.targetStateConfidence` is `"verified"`, `"stale"`,
   or `"unknown"` depending on snapshot freshness.
4. When the user selects a capability that the target already provides
   (e.g. nginx + nginx is already running), the planner emits a
   **reconcile** plan item rather than a fresh install.

## Operational notes

* All scenarios must run with `npm test` in `apps/api`.
* The catalog quality gate (`npm run catalog:check`) must pass before
  any of the scenarios are considered closed.
* When this document is updated, the test file
  `apps/api/src/engine/tests/e2e-scenarios.test.ts` MUST be updated in
  the same change set.
