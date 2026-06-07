/**
 * catalog-audit-records.ts
 *
 * Persisted audit records for every visible catalog item.
 *
 * This module records the per-item audit outcome from the V2 quality
 * gate. The records are kept *outside* `catalog.ts` so we can iterate
 * on audit metadata without touching the user-facing catalog source,
 * and without forcing a CatalogItem schema migration in the same step.
 *
 * The audit metadata is merged onto each `CatalogItem` by
 * `database.ts:withCapabilityMetadata` (under the `audit` field). UIs
 * and the `catalog:check` script consume it from there.
 *
 * Audit batches are processed 20 items at a time; this file always
 * holds the *current* state of every item — pass / fixed /
 * needs-review / blocked — together with reasons and reviewer notes.
 */

export type CatalogAuditStatus = "pass" | "fixed" | "needs-review" | "blocked" | "pending";

export interface CatalogAuditRecord {
  /** Audit status for this item. */
  status: CatalogAuditStatus;
  /** supportLevel before the audit pass. */
  originalSupportLevel: "detect-only" | "basic-rebuild" | "managed-config" | "full-migration";
  /** supportLevel after the audit pass. */
  finalSupportLevel: "detect-only" | "basic-rebuild" | "managed-config" | "full-migration";
  /** Why the supportLevel landed here. */
  reasons: string[];
  /** Fields that were missing before the audit (informational). */
  missingFieldsBefore?: string[];
  /** Concrete edits the audit made. */
  changesMade?: string[];
  /** Risks the operator should still review. */
  remainingRisks?: string[];
  /** Free-form reviewer notes. */
  reviewerNotes?: string;
  /** Audit batch number (1-based). */
  batch: number;
}

/**
 * Audit records keyed by catalog item id.
 *
 * Items not yet audited are absent from the map. The merge layer in
 * `database.ts` inserts a default `pending` record for them so the UI
 * can still show progress.
 */
export const catalogAuditRecords: Record<string, CatalogAuditRecord> = {
  // ── Batch 1 (items 1-20) ──────────────────────────────────────────
  "node-runtime-profile": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect rule covers nodejs/npm packages, binaries, and ~/.npmrc with secret patterns.",
      "Validate hooks run `node --version` and `npm --version`.",
      "Configs limited to ~/.npmrc; data is none.",
      "Cross-distro package maps cover apt/dnf/yum/pacman/apk; global npm packages are a structured manual review step."
    ],
    remainingRisks: [
      "Global npm packages are not migrated by default and must be reviewed.",
      "Private npm registry tokens require explicit confirmation."
    ],
    batch: 3
  },
  "docker-host-profile": {
    status: "pass",
    originalSupportLevel: "full-migration",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect covers docker.io, docker-ce, binaries, systemd, and bind mount globs.",
      "Data strategy: prefer compose / volumes; /var/lib/docker is not copied.",
      "Validate runs `docker version` and `docker compose version`."
    ],
    remainingRisks: [
      "External networks and named volumes still need operator review per host."
    ],
    batch: 1
  },
  "ssh-hardening": {
    status: "pass",
    originalSupportLevel: "full-migration",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect covers openssh-server / sshd binaries / sshd.service.",
      "Validate uses `sshd -t`; rollback restores backup + reloads sshd.",
      "Safe-apply (config-files.ts) opens a second SSH probe to prevent lockouts."
    ],
    remainingRisks: [
      "Operators must review authorized_keys migration manually."
    ],
    batch: 1
  },
  "nginx-web-service": {
    status: "pass",
    originalSupportLevel: "full-migration",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect covers nginx, sites-available, sites-enabled, conf.d.",
      "Validate runs `nginx -t` and `systemctl is-active nginx`.",
      "Data strategy: /var/www optional, requires review."
    ],
    remainingRisks: [
      "TLS private key paths must be reviewed before migrate."
    ],
    batch: 1
  },
  "postgres-profile": {
    status: "pass",
    originalSupportLevel: "full-migration",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect covers postgresql server packages and main config dirs.",
      "Data strategy: dump-restore (logical), never rsync /var/lib/postgresql.",
      "Validate runs `psql -c 'select 1'` with service-state fallback.",
      "Plan carries explicit database data-strategy approval and structured pg_dump / pg_dumpall manual steps."
    ],
    remainingRisks: [
      "Roles, databases, extensions, encodings, and ownership still require explicit dump/restore decisions."
    ],
    batch: 2
  },
  "firewall-baseline": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect covers UFW on Debian-family hosts and firewalld on RHEL-family hosts.",
      "Plan uses safeFirewallApply semantics: preserve current SSH port, schedule an auto-rollback timer, and refuse if SSH reachability cannot be protected.",
      "Validate runs firewall status checks plus SSH reachability evidence; rollback restores the previous ruleset."
    ],
    remainingRisks: [
      "Operators must confirm the current SSH port stays allowed.",
      "Cloud security groups remain outside the VM and must be reviewed separately."
    ],
    batch: 1
  },
  "python-toolchain": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect covers python3 / python3-pip / pipx / venv with /etc/pip.conf + ~/.config/pip/pip.conf.",
      "Secret pattern set covers pip index credentials.",
      "Validate runs `python3 --version` and `pip3 --version`.",
      "Cross-distro package maps cover apt/dnf/yum/pacman/apk; pipx, venv, and user/global packages are structured manual review steps."
    ],
    remainingRisks: [
      "venvs and project-level requirements are not migrated automatically.",
      "Private pip index credentials require explicit confirmation."
    ],
    batch: 3
  },
  "redis-server": {
    status: "pass",
    originalSupportLevel: "full-migration",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect covers redis-server / redis package + /etc/redis/redis.conf.",
      "Data strategy: optional, prefer dump-restore over filesystem copy.",
      "Validate runs `redis-cli ping`."
    ],
    remainingRisks: [
      "RDB / AOF persistence files require explicit review."
    ],
    batch: 1
  },
  "mysql-server": {
    status: "pass",
    originalSupportLevel: "full-migration",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect covers mysql-server / mariadb-server, /etc/mysql, my.cnf.",
      "Data strategy: dump-restore (mysqldump), never copy live InnoDB files.",
      "Validate runs `mysqladmin ping` or `mysql --execute 'select 1'`.",
      "Plan carries explicit database data-strategy approval and structured dump / restore manual steps."
    ],
    remainingRisks: [
      "Users, grants, routines, triggers, character sets, and per-database dumps require explicit operator decisions."
    ],
    batch: 2
  },
  "golang-runtime": {
    status: "pass",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: golang-go package + go binary.",
      "Config: Go env files and profile snippets are scanned for private module settings.",
      "Validate: `go version`.",
      "Data strategy: none; module cache and per-project builds are rebuilt, not copied."
    ],
    remainingRisks: [
      "Module proxy and per-project builds are explicitly out of scope.",
      "Private module domains in GOPRIVATE require operator review."
    ],
    batch: 10
  },
  "openjdk-runtime": {
    status: "pass",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: default-jdk / openjdk-* + maven.",
      "Config: Maven settings and Java profile configs are scanned with repository credential patterns.",
      "Validate: `java -version`, `javac -version`, and `mvn --version`.",
      "Data strategy: none; Maven local repository cache is rebuilt."
    ],
    remainingRisks: [
      "JVM tuning (heap, GC) is left to the operator.",
      "Private Maven repository credentials require explicit review."
    ],
    batch: 10
  },
  "rust-toolchain": {
    status: "pass",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: rustup / cargo / rustc binaries.",
      "Config: Cargo config and credentials files are scanned with registry token patterns.",
      "Validate: `rustc --version` and `cargo --version`.",
      "Data strategy: none; target directories and registry cache are rebuilt."
    ],
    remainingRisks: [
      "Cargo packages and target-specific toolchains require operator review.",
      "Private registry tokens must be redacted before reports are shared."
    ],
    batch: 10
  },
  "git-version-control": {
    status: "pass",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: git, git-lfs.",
      "Config: gitconfig files are scanned for include paths, credential helpers, and URL rewrites.",
      "Validate: `git --version`.",
      "Data strategy: none; repositories, SSH keys, and GPG signing keys are not copied by this card."
    ],
    remainingRisks: [
      "User-level ~/.gitconfig migration must still be reviewed by the operator.",
      "Credential helper and signing key references require explicit confirmation."
    ],
    batch: 10
  },
  "certbot-ssl": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: certbot binary, certbot timer, nginx/apache plugins, and /etc/letsencrypt renewal metadata.",
      "Configs scan /etc/letsencrypt plus web-server certificate references; private keys are secret-confirm gated.",
      "Validate `certbot certificates` plus nginx/apache syntax when applicable; rollback restores prior renewal metadata and web-server certificate references.",
      "Domain ownership and DNS / ACME validation are structured manual steps; dry-run never contacts ACME."
    ],
    remainingRisks: [
      "Certificate private keys require explicit operator confirmation before migrate.",
      "DNS ownership and public HTTP-01 / DNS-01 reachability must be confirmed outside EnvForge."
    ],
    batch: 2
  },
  "fail2ban-protection": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect covers fail2ban package, fail2ban-client binary, fail2ban.service, jail.local, jail.conf, and jail.d globs.",
      "SSHD jail baseline is represented as a managed review step; custom filters and action scripts are captured for review.",
      "Validate runs `fail2ban-client status` with `systemctl is-active fail2ban` fallback; rollback restores jail configs and service state."
    ],
    remainingRisks: [
      "Custom jail rules may reference removed services after migrate.",
      "Custom action scripts and log paths can expose tokens or private filesystem paths and require operator review."
    ],
    batch: 1
  },
  "prometheus-monitoring": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: prometheus + prometheus-node-exporter packages.",
      "Validate: `systemctl is-active prometheus`.",
      "Config: prometheus.yml, rule files, scrape targets, alertmanager references, and bearer token files are scanned.",
      "Full migration strategy: package/config rebuild plus manual TSDB snapshot/export confirmation.",
      "Data: scrape data not migrated by default — rebuildable strategy."
    ],
    remainingRisks: [
      "Long-term storage (TSDB) requires snapshot/export not yet automated.",
      "Scrape targets and Alertmanager endpoints may be environment-specific and must be reachable from the target.",
      "Remote write credentials and bearer token files are secrets and are redacted before transport."
    ],
    batch: 10
  },
  "grafana-dashboard": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: grafana package.",
      "Configs: /etc/grafana/grafana.ini, provisioning dirs.",
      "Validate: HTTP probe to /api/health (allowFailure on first apply).",
      "Full migration strategy: package/config rebuild plus manual /var/lib/grafana backup/restore and plugin compatibility review."
    ],
    remainingRisks: [
      "Datasource passwords require operator confirmation.",
      "Grafana secret_key, OAuth client secrets, and datasource secureJsonData require explicit review.",
      "Dashboard database and plugin state must use backup/snapshot handling, not blind live copy."
    ],
    batch: 10
  },
  "mongodb": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: mongodb-org package, mongod.service, mongod/mongosh binaries, and /etc/mongod.conf.",
      "Config: mongod.conf is scanned for storage paths, auth, replica-set, bind address, and keyFile references.",
      "Validate: `mongosh --eval 'db.runCommand({ ping: 1 })'` with service-state fallback.",
      "Data strategy: manual mongodump/mongorestore or replica-set resync; never raw-copy /var/lib/mongodb."
    ],
    remainingRisks: [
      "Replica-set members, keyFile auth, users, roles, and bind IPs require environment-specific review.",
      "Database content migration must use mongodump/mongorestore — not yet automated."
    ],
    batch: 10
  },
  "rabbitmq": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: rabbitmq-server package + RABBITMQ_NODENAME env file.",
      "Configs: /etc/rabbitmq/rabbitmq.conf and enabled_plugins.",
      "Validate: `rabbitmq-diagnostics ping`.",
      "Full migration strategy: definitions export/import, Erlang cookie review, and queue-content strategy confirmation."
    ],
    remainingRisks: [
      "Definitions export/import (queues, exchanges, bindings) is left to the operator.",
      "Durable queue contents require an operator-approved drain or backup strategy.",
      ".erlang.cookie and TLS material are secrets and must travel out of band."
    ],
    batch: 10
  },
  "wireguard-vpn": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: wireguard package + wg binary + /etc/wireguard configs.",
      "Configs.sensitivity: secret (private keys live there).",
      "Validate: `wg show`; rollback restores previous /etc/wireguard.",
      "Full migration strategy: package/config rebuild plus manual peer key, endpoint, forwarding, and firewall review."
    ],
    remainingRisks: [
      "Per-peer private keys and preshared keys must NOT leave the source host without operator confirmation.",
      "Peer endpoints, AllowedIPs, NAT, and IP forwarding depend on target network topology."
    ],
    batch: 5
  },
  // ── Batch 2 (items 21-40) ─────────────────────────────────────────
  "netdata-monitoring": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: netdata binary, systemd unit, and /etc/netdata configs.",
      "Validate: `systemctl is-active netdata` (allowFailure on first apply).",
      "Configs.sensitivity: review (alarm endpoints may contain webhooks).",
      "Full migration strategy: config rebuild plus explicit cloud-claim, stream, and metric-history review."
    ],
    remainingRisks: [
      "Cloud claim tokens / streaming credentials must be rotated on migrate.",
      "Metric history under /var/lib/netdata and /var/cache/netdata is rebuilt unless the operator exports it explicitly."
    ],
    batch: 10
  },
  "minio-storage": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: minio/mc binaries, minio.service, /etc/default/minio, and service ports 9000/9001.",
      "Config: MinIO env/default files are scanned for volumes, root credentials, server URL, and KMS references.",
      "Validate: `/minio/health/live` or `mc admin info` with service-state fallback.",
      "Data strategy: manual `mc mirror` / replication / vendor backup; never blind-copy bucket data."
    ],
    remainingRisks: [
      "Bucket data on /var/minio is NOT migrated by default; operators must replicate via `mc mirror` or vendor tools.",
      "MINIO_ROOT_USER / MINIO_ROOT_PASSWORD, KMS keys, and site URLs must be re-issued or explicitly approved on the target."
    ],
    batch: 10
  },
  "traefik-proxy": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: traefik binary + /etc/traefik configs + systemd unit.",
      "Validate: `traefik healthcheck` with service-state fallback.",
      "Configs scan /etc/traefik/{traefik.yml,dynamic/}; ACME storage flagged secret.",
      "Plan includes structured ACME storage review, Docker provider review, and dashboard exposure review."
    ],
    remainingRisks: [
      "acme.json holds private TLS keys -- must be confirmed before migrate.",
      "Docker provider rules depend on the docker-host-profile being migrated first.",
      "Dashboard exposure and dynamic provider files require operator review."
    ],
    batch: 4
  },
  "elasticsearch": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: elasticsearch package, elasticsearch.service, /etc/elasticsearch, and HTTP/transport ports.",
      "Config: elasticsearch.yml, JVM options, data paths, discovery settings, and keystore references are scanned.",
      "Validate: HTTP probe to localhost:9200/_cluster/health with service-state fallback.",
      "Data strategy: manual snapshot repository + `_snapshot` restore; never raw-copy /var/lib/elasticsearch."
    ],
    remainingRisks: [
      "Index data under /var/lib/elasticsearch is NOT copied; use snapshot repository + `_snapshot` API.",
      "elasticsearch.keystore, TLS material, bootstrap passwords, and cluster discovery settings must be confirmed before migrate."
    ],
    batch: 10
  },
  "cockpit-panel": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "managed-config",
    reasons: [
      "Detect: cockpit + cockpit-ws packages + cockpit.socket.",
      "Server-panel category: kept at managed-config per quality gate §5.1; never promoted to full-migration.",
      "Validate: `systemctl is-active cockpit.socket` (allowFailure)."
    ],
    remainingRisks: [
      "Cockpit is a server administration UI; do not feature on the home Recommended row.",
      "PAM / sudoers integration on the target must already be in place; otherwise the panel is unreachable."
    ],
    reviewerNotes: "Quality gate marks (panel|cockpit|portainer|filebrowser|webmin) as panel-class -- forbidden at full-migration.",
    batch: 2
  },
  "htop-tools": {
    status: "fixed",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Bundles htop + btop + ncdu + iotop + sysstat as a single capability.",
      "All five companion packages are now declared in components so detect can recognise any one of them.",
      "Config: htop and sysstat config files are scanned; historical sar data is not migrated.",
      "Validate: `htop --version` or `iostat -V`."
    ],
    missingFieldsBefore: ["components.iotop", "components.sysstat"],
    changesMade: [
      "Added `iotop` and `sysstat` software components so detect/install lists every companion the family rule requires."
    ],
    remainingRisks: [
      "iotop requires CAP_NET_ADMIN / root to read process IO; expected behaviour.",
      "Per-user UI preferences may differ by target user."
    ],
    batch: 10
  },
  "swap-config": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: /etc/fstab swap entries + active swap on the target.",
      "Privileged action: changes /etc/fstab and runs `mkswap`/`swapon` -- riskLevel: privileged.",
      "Validate: `swapon --show`; rollback removes the swap file and reverts /etc/fstab.",
      "Full migration strategy: reviewed /etc/fstab/sysctl change with filesystem, zram, and cloud-image compatibility checks."
    ],
    remainingRisks: [
      "Cloud images (esp. minimal VPS) may forbid swap files on certain filesystems.",
      "Existing zram setups can collide with file-backed swap; operator review required."
    ],
    batch: 7
  },
  "mariadb": {
    status: "pass",
    originalSupportLevel: "full-migration",
    finalSupportLevel: "full-migration",
    reasons: [
      "Shares capabilityKey `database.mysql` with mysql-server; both honour the same MySQL/MariaDB rule.",
      "Data strategy: dump-restore via mysqldump/mariadb-dump; never copy live InnoDB files.",
      "Validate: `mariadb --version` and `systemctl is-active mariadb`.",
      "Plan carries the same explicit logical dump / restore approval as mysql-server."
    ],
    remainingRisks: [
      "Galera cluster nodes require explicit operator coordination -- not a single-host migrate.",
      "Users / grants must be exported with --all-databases or per-DB scripts."
    ],
    batch: 6
  },
  "sqlite": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: sqlite3 binary + libsqlite3-* package.",
      "Embedded database: no service, no config, no system data directory to migrate.",
      "Kept at detect-only because the meaningful data lives inside individual application paths that EnvForge cannot enumerate generically."
    ],
    remainingRisks: [
      "Application-level .db files must be migrated as part of the owning application's plan, not as a SQLite plan."
    ],
    batch: 2
  },
  "nodejs-version-mgr": {
    status: "pass",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: ~/.nvm, nvm.sh, shell init files, and Node/npm binaries.",
      "Config: NVM shell init, default alias, and npm registry config are scanned with token redaction.",
      "Install: official curl install script plus cross-distro build prerequisites; runtime is per-user under ~/.nvm.",
      "Validate: `nvm --version` after sourcing nvm.sh, falling back to `node --version`.",
      "Data strategy: optional manual review of ~/.nvm; caches and globals are rebuilt intentionally."
    ],
    remainingRisks: [
      "Per-user ~/.nvm requires target-user review; system-wide Node should use node-runtime-profile instead.",
      "Globally installed npm packages and npm cache under ~/.nvm/versions/* are not migrated by default."
    ],
    batch: 3
  },
  "pyenv-toolchain": {
    status: "pass",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: ~/.pyenv, .python-version, shell init files, pyenv binary, and Python build prerequisites.",
      "Config: pyenv version files, shell initialization, and pip private index settings are scanned with redaction.",
      "Install: pyenv-installer script plus cross-distro compiler/library dependencies.",
      "Validate: `pyenv --version` with `python3 --version` fallback.",
      "Data strategy: optional manual review of ~/.pyenv; compiled interpreters and virtualenvs are rebuilt or explicitly selected."
    ],
    remainingRisks: [
      "Compiling Python versions can take minutes and build dependency names vary by distro.",
      "Compiled versions under ~/.pyenv/versions and virtualenvs require explicit operator review before transport."
    ],
    batch: 3
  },
  "zsh-shell": {
    status: "pass",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: zsh package + /usr/bin/zsh.",
      "Config: zsh dotfiles and Oh My Zsh custom snippets are scanned for sourced files and plugin references.",
      "Validate: `zsh --version`.",
      "Data strategy: none; live shells and per-user plugin directories are rebuilt or reviewed."
    ],
    remainingRisks: [
      "`chsh` requires the target user to exist on the destination; operator review required.",
      "Custom .zshrc plugins are user-level and out of scope for EnvForge automated migrate."
    ],
    batch: 8
  },
  "neovim-editor": {
    status: "pass",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: neovim package + /usr/bin/nvim.",
      "Config: init.lua/init.vim and Lua/plugin config trees are scanned for includes and plugin references.",
      "Validate: `nvim --version`.",
      "Data strategy: none; plugins, LSP servers, and cache directories are rebuilt."
    ],
    remainingRisks: [
      "Lua/LSP plugins under ~/.config/nvim are user-level dotfiles and require operator review.",
      "LSP server binaries and plugin manager state are rebuilt, not copied."
    ],
    batch: 8
  },
  "tmux-multiplex": {
    status: "pass",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: tmux package + /usr/bin/tmux.",
      "Config: ~/.tmux.conf, ~/.config/tmux/tmux.conf, and plugin references are scanned.",
      "Validate: `tmux -V`.",
      "Data strategy: none; live sessions and plugin directories are not migrated."
    ],
    remainingRisks: [
      "~/.tmux.conf is user-level and must be reviewed before transport.",
      "Existing tmux sessions and plugin directories are not migrated."
    ],
    batch: 8
  },
  "ansible-tool": {
    status: "pass",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: ansible package + ansible binary.",
      "Config: ansible.cfg and inventory paths are scanned for vault password and private key references.",
      "Validate: `ansible --version` and `ansible-playbook --version`.",
      "Data strategy: none; inventories, playbooks, and vault files are project/user-owned."
    ],
    remainingRisks: [
      "Ansible inventories / vault keys live in user repos and are NOT migrated.",
      "ansible.cfg in /etc/ansible may reference plugins not installed on target -- operator review required."
    ],
    batch: 10
  },
  "nextcloud": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: snap nextcloud or apt nextcloud + occ binary.",
      "Config: config.php is scanned for DB credentials, instance secrets, trusted domains, and data directory.",
      "Validate: `nextcloud.occ status` or the packaged occ command.",
      "Full migration strategy: maintenance-mode backup with DB dump/restore, data directory transfer, and `occ maintenance:data-fingerprint`."
    ],
    remainingRisks: [
      "Snap-installed nextcloud uses a self-contained MySQL; do not assume the host's mysql-server applies.",
      "config.php holds credentials and instance secrets and must never be transported in plaintext.",
      "Apps, previews, external storage mounts, and trusted domains require operator review after restore."
    ],
    batch: 7
  },
  "gitea-server": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: gitea binary + systemd unit + /etc/gitea + /var/lib/gitea.",
      "Config: app.ini is scanned for DB, repository, LFS, OAuth, and secret references.",
      "Validate: `gitea --version` and service-state fallback.",
      "Full migration strategy: `gitea dump` / restore with explicit repository, LFS, hook, and app.ini secret review."
    ],
    remainingRisks: [
      "Repository git objects must be migrated with `gitea dump` / restore; do NOT rsync /var/lib/gitea blindly.",
      "OAuth provider secrets in app.ini must be re-issued on target."
    ],
    batch: 7
  },
  "portainer": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: portainer container or portainer-ce systemd unit + portainer_data volume.",
      "Server-panel category: detect-only is the maximum allowed by the quality gate §5.1.",
      "Card explicitly does NOT offer migrate / build."
    ],
    remainingRisks: [
      "Do not feature on the home Recommended row; this is a server admin panel, not a workload.",
      "Endpoint credentials and TLS material in portainer_data require operator-driven export."
    ],
    reviewerNotes: "Quality gate forbids panel-class items at full-migration; detect-only is correct.",
    batch: 2
  },
  "jellyfin-media": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: jellyfin package + jellyfin.service + /etc/jellyfin + /var/lib/jellyfin.",
      "Config: system.xml and Jellyfin config dirs are scanned for metadata, cache, and library paths.",
      "Validate: HTTP public info probe or jellyfin.service state.",
      "Full migration strategy: config/library metadata backup plus explicit media bind-mount and hardware-acceleration review."
    ],
    remainingRisks: [
      "Media files (movies/TV) are typically on bind mounts; those are operator-level decisions, not part of this card.",
      "Hardware acceleration (VAAPI / NVENC) requires distro-specific drivers that EnvForge does not provision."
    ],
    batch: 7
  },
  "samba-share": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: samba package + smbd / nmbd services + /etc/samba/smb.conf.",
      "Validate: `testparm -s` ensures smb.conf parses; `systemctl is-active smbd` confirms the service.",
      "Configs.sensitivity: review (share definitions reference filesystem paths, ACLs, and account mappings).",
      "Data strategy: optional manual review of exported share paths; never infer or copy arbitrary shares automatically."
    ],
    remainingRisks: [
      "Samba user accounts (smbpasswd) are NOT exported automatically -- operators must rebuild them.",
      "Share filesystem paths, ACLs, valid users, and client access scopes must exist on the target before smbd starts."
    ],
    batch: 10
  },
  // ── Batch 3 (items 41-60) ─────────────────────────────────────────
  "rsync-tools": {
    status: "fixed",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Bundles rsync + rclone + borgbackup + restic as a single capability.",
      "All four companion packages now declared in components so detect catches any one of them.",
      "Config: rsync daemon config, filters, and secrets files are scanned with secret patterns.",
      "Validate: `rsync --version`.",
      "Data strategy: none for this card; backup repositories and remote datasets stay operator-owned."
    ],
    missingFieldsBefore: ["components.borgbackup", "components.restic"],
    changesMade: [
      "Added `borgbackup` and `restic` software components so detect/install lists every companion the family rule advertises in `assets`."
    ],
    remainingRisks: [
      "Backup repositories (borg/restic stores) and rclone remotes are operator-owned and out of scope for catalog migrate.",
      "rsync daemon secrets and SSH keys require explicit review."
    ],
    batch: 10
  },
  "mosquitto-mqtt": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: mosquitto package + mosquitto.service + /etc/mosquitto/{mosquitto.conf,conf.d/}.",
      "Validate: `mosquitto -t -c /etc/mosquitto/mosquitto.conf` parses config; `systemctl is-active mosquitto` confirms service.",
      "Configs.sensitivity: review (passwd_file path and TLS material live there).",
      "Full migration strategy: package/config rebuild plus explicit retained-message and bridge/TLS review."
    ],
    remainingRisks: [
      "mosquitto_passwd files hold password hashes -- must be confirmed before migrate.",
      "TLS bridge / cluster topologies require operator coordination beyond a single-host plan.",
      "Retained message persistence under /var/lib/mosquitto is optional and must not be copied while the broker is live."
    ],
    batch: 10
  },
  "zabbix-monitoring": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: zabbix-agent / zabbix-agent2 package + zabbix-agent.service + /etc/zabbix/zabbix_agentd.conf.",
      "Validate: `zabbix_agentd -t agent.ping` (allowFailure) and `systemctl is-active zabbix-agent`.",
      "Configs.sensitivity: review (Server / ServerActive endpoints + TLS PSK identifiers).",
      "Full migration strategy: agent config rebuild plus TLS PSK and UserParameter script review."
    ],
    remainingRisks: [
      "TLS PSK keys and tls_psk_file content must be re-issued on the target.",
      "User-defined UserParameters scripts in /etc/zabbix/zabbix_agentd.d/ are operator-owned.",
      "Server / ServerActive endpoints must be reachable from the target and may change by environment."
    ],
    batch: 10
  },
  "dotnet-runtime": {
    status: "pass",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: dotnet-sdk-8.0 / dotnet-runtime-8.0 packages + dotnet binary.",
      "Config: NuGet.Config files are scanned for package sources and private feed credentials.",
      "Validate: `dotnet --version`.",
      "Data strategy: none; NuGet caches and project build outputs are rebuilt."
    ],
    remainingRisks: [
      "NuGet package cache and per-project builds are explicitly out of scope.",
      "Operators on rhel-family must accept the Microsoft repo signing key during install."
    ],
    batch: 10
  },
  "php-toolchain": {
    status: "pass",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: php / php8.* packages + php binary + composer.",
      "Config: PHP CLI ini files plus Composer config are scanned with private repository token patterns.",
      "Validate: `php --version` and `composer --version`.",
      "Data strategy: none; project composer.lock/vendor trees are intentionally out of system-scope migration."
    ],
    remainingRisks: [
      "/etc/php/*/fpm pools are handled by the separate php-fpm card.",
      "Globally installed Composer packages (vendor/bin) are user-level."
    ],
    reviewerNotes: "PHP-FPM remains a separate managed capability; this card covers CLI/runtime and Composer config only.",
    batch: 6
  },
  "ruby-toolchain": {
    status: "pass",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: ruby-full package + ruby + gem + bundler.",
      "Config: .gemrc / Bundler config are scanned with RubyGems and private source secret patterns.",
      "Validate: `ruby --version`, `gem --version`, `bundle --version`.",
      "Data strategy: none; project Gemfile.lock and vendor/bundle trees are application-owned."
    ],
    remainingRisks: [
      "Globally installed gems are user-level and not migrated.",
      "Distro-shipped Ruby version may lag; operators wanting newer should layer on rbenv (separate card)."
    ],
    batch: 6
  },
  "code-server": {
    status: "pass",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: code-server binary, code-server service unit, ~/.config/code-server, and default port 8080.",
      "Config: config.yaml and user settings are scanned for bind address, password/hash, TLS cert paths, and auth mode.",
      "Install: official curl install script plus cross-distro curl/ca-certificates prerequisites.",
      "Validate: `code-server --version` with service-state fallback.",
      "Data strategy: optional manual review of extensions/settings; workspaces and repositories remain operator-owned."
    ],
    remainingRisks: [
      "code-server config (port, password/hash, auth mode) lives under ~/.config/code-server and must be reviewed before exposure.",
      "Reverse-proxy / TLS termination should be handled by nginx-web-service, caddy-server, or traefik-proxy, not this card.",
      "Workspace repositories and SSH/GPG developer credentials are not copied by this card."
    ],
    batch: 10
  },
  "fish-shell": {
    status: "pass",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: fish package + /usr/bin/fish.",
      "Config: fish config, conf.d, functions, and Starship prompt config are scanned.",
      "Validate: `fish --version`.",
      "Data strategy: none; shell state and completions are rebuilt or reviewed."
    ],
    remainingRisks: [
      "Setting fish as default shell requires `chsh` and the target user to exist.",
      "Fish functions and Starship prompt config are per-user and require review."
    ],
    batch: 8
  },
  "jenkins-ci": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: jenkins package + jenkins.service + /etc/default/jenkins + JENKINS_HOME (default /var/lib/jenkins).",
      "Validate: HTTP probe to /login on the configured port (allowFailure on first apply).",
      "Configs.sensitivity: review (Jenkins URL, port, JAVA_OPTS).",
      "Full migration strategy: package/config rebuild plus operator-approved JENKINS_HOME snapshot/export."
    ],
    remainingRisks: [
      "JENKINS_HOME contains job history, credentials store, and plugin state -- migration requires `jenkins-cli` export or filesystem snapshot, not part of this card.",
      "Plugin compatibility between source and target Jenkins versions must be confirmed by operator.",
      "credentials.xml, master.key, and secret.key are secrets and must travel out of band."
    ],
    batch: 10
  },
  "gitlab-runner": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: gitlab-runner package + gitlab-runner.service + /etc/gitlab-runner/config.toml.",
      "Validate: `gitlab-runner verify` (allowFailure) and `systemctl is-active gitlab-runner`.",
      "Configs.sensitivity: secret (config.toml contains runner registration tokens).",
      "Full migration strategy: package/config rebuild with runner re-registration preferred over token copy."
    ],
    remainingRisks: [
      "Runner registration tokens are scoped to GitLab projects/groups -- operators typically re-register a fresh runner on the target rather than copy tokens.",
      "Custom executor binaries (docker, shell, virtualbox) need their respective capabilities present on target.",
      "Job caches and builds_dir/cache_dir contents are intentionally not migrated automatically."
    ],
    batch: 10
  },
  "vault-secrets": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: vault binary + vault.service + /etc/vault.d/vault.hcl.",
      "Privileged: vault holds secrets -- riskLevel `privileged`; secret policy: confirm.",
      "Validate: `vault status` (allowFailure; sealed Vault returns non-zero by design).",
      "Full migration strategy: package/config rebuild plus operator-approved Vault snapshot/restore."
    ],
    remainingRisks: [
      "Vault data (storage backend) MUST be migrated via Vault snapshot/restore APIs, not filesystem copy.",
      "Unseal keys / root token are out of band; EnvForge never transports them.",
      "Auto-unseal via cloud KMS is operator-owned configuration."
    ],
    reviewerNotes: "Full migration support is structured snapshot/restore and secret review; EnvForge still never transports unseal keys or root tokens.",
    batch: 5
  },
  "terraform-iac": {
    status: "pass",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: terraform binary + HashiCorp apt repo signature.",
      "Config: .terraformrc and Terraform credentials files are scanned with token patterns.",
      "Validate: `terraform version`.",
      "Data strategy: blocked for state files; this card migrates only CLI/config, never terraform.tfstate."
    ],
    remainingRisks: [
      "Terraform state files (terraform.tfstate) are project-owned and must NEVER be migrated by EnvForge automatically.",
      "Provider plugins are downloaded per-workspace on `terraform init` -- not a system concern."
    ],
    batch: 10
  },
  "kubernetes-tools": {
    status: "pass",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: kubectl + helm binaries.",
      "Config: kubeconfig and Helm repository/registry configs are scanned with token and client key patterns.",
      "Validate: `kubectl version --client` and `helm version`.",
      "Data strategy: none; kubeconfig transport requires explicit credential review."
    ],
    remainingRisks: [
      "~/.kube/config contains cluster credentials and is user-owned, NOT migrated.",
      "Helm chart repositories and locally cached charts are user-level."
    ],
    batch: 10
  },
  "loki-logging": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: loki + promtail packages + their systemd units + /etc/loki/loki.yaml.",
      "Validate: HTTP probe to localhost:3100/ready (allowFailure on first apply).",
      "Configs.sensitivity: review (storage backend path / S3 endpoint).",
      "Full migration strategy: config rebuild plus manual chunk/index retention and object-storage credential review."
    ],
    remainingRisks: [
      "Loki chunks / index data under /var/lib/loki are NOT copied; long-term retention typically uses object storage (S3 / GCS) which is operator-managed.",
      "Promtail positions file should be reset on a fresh target to avoid replaying old offsets.",
      "Object storage credentials and tenant auth headers are secrets and are redacted before transport."
    ],
    batch: 10
  },
  "openvpn-server": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: openvpn package + openvpn-server@*.service + /etc/openvpn/server/.",
      "Privileged: VPN concentrator -- riskLevel `privileged`.",
      "Validate: `systemctl is-active openvpn-server@*` (allowFailure for instance-name variability).",
      "Full migration strategy: package/config rebuild plus manual PKI, route push, and client-config-dir review."
    ],
    remainingRisks: [
      "PKI material (ca.crt, server.key, dh.pem, client certs) MUST be operator-confirmed before migrate.",
      "Pushed routes and client-config-dir entries depend on target network topology.",
      "tls-auth / tls-crypt static keys are secrets and must not leave the source host without explicit confirmation."
    ],
    batch: 5
  },
  "haproxy-lb": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: haproxy package + haproxy.service + /etc/haproxy/haproxy.cfg.",
      "Validate: `haproxy -c -f /etc/haproxy/haproxy.cfg` parses config; `systemctl is-active haproxy` confirms service.",
      "Configs.sensitivity: review (backend host:port references).",
      "Data strategy: manual review for referenced cert bundles and backend availability; /var/lib/haproxy is not copied blindly.",
      "Cross-distro package and service maps cover apt/dnf/yum/pacman/apk."
    ],
    remainingRisks: [
      "TLS certificate files referenced by `bind` lines are typically separate paths (often /etc/letsencrypt) -- operator must confirm those are present on target.",
      "Backend health requires the underlying services to already exist on target; operators should sequence haproxy after its backends."
    ],
    batch: 6
  },
  "sonarqube": {
    status: "pass",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: SonarQube container/service footprint, Docker dependency, compose files, and port 9000.",
      "Config: sonar.properties, compose/env files, JDBC URL/password, and volume references are scanned.",
      "Validate: HTTP probe to localhost:9000/api/system/status with docker ps fallback.",
      "Data strategy: manual SonarQube database backup/restore and plugin/profile review; never blind-copy Docker volumes."
    ],
    remainingRisks: [
      "Project history, quality profiles, and rule customisations live in the bundled or external Postgres -- migration requires SonarQube backup/restore, not a Docker volume copy.",
      "Default admin/admin credentials must be rotated immediately on first login.",
      "Plugin compatibility and Elasticsearch index rebuild timing must be reviewed during restore."
    ],
    reviewerNotes: "Docker-oriented; Full Migration Certified means structured backup/restore review, not automatic volume transport.",
    batch: 10
  },
  "rust-cli-tools": {
    status: "fixed",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Bundles 7 modern CLI tools: bat, ripgrep, fd, exa, zoxide, fzf, tldr.",
      "All seven companion packages now declared in components so detect catches any one of them.",
      "Config: bat/ripgrep/fd/zoxide/fzf/tldr config paths are scanned.",
      "Validate: `rg --version`, with fzf/zoxide fallback checks.",
      "Data strategy: none; tool caches and shell integration are rebuilt."
    ],
    missingFieldsBefore: ["components.exa", "components.zoxide", "components.fzf", "components.tldr"],
    changesMade: [
      "Added `exa`, `zoxide`, `fzf`, `tldr` software components so detect/install matches the assets list."
    ],
    remainingRisks: [
      "On rhel-family the package names differ (`bat` vs `batcat`, `fd-find` vs `fd`); crossDistro packageMap drives the install action.",
      "Some distros (Debian 11) do not ship `exa`; install will fall back to apt repo or skip on miss."
    ],
    batch: 8
  },
  "memcached": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: memcached package + memcached.service + /etc/memcached.conf.",
      "Config: /etc/memcached.conf plus distro default/sysconfig files are scanned.",
      "Validate: `memcached -h` and memcached.service status.",
      "Data strategy: none; Memcached is in-memory only."
    ],
    remainingRisks: [
      "Memcached is in-memory only; there is no data to migrate by design.",
      "Operators must verify the bind address (-l) is not 0.0.0.0 on internet-facing hosts."
    ],
    batch: 8
  },
  "flutter-sdk": {
    status: "pass",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: Flutter/Dart binaries, SDK clone path, pub cache, and shell PATH integration.",
      "Config: Flutter settings, pub credentials, and shell init files are scanned with redaction.",
      "Install: git clone of the official Flutter repo plus cross-distro archive/build prerequisites.",
      "Validate: `flutter --version` with `dart --version` fallback.",
      "Data strategy: optional manual review of SDK path and pub cache; platform SDKs stay out of scope."
    ],
    remainingRisks: [
      "Flutter SDK clone path and ~/.pub-cache are user-level and require explicit target-user review.",
      "Android SDK, emulator images, and Xcode toolchains are out of scope; this card only governs Dart/Flutter SDK setup."
    ],
    batch: 3
  },
  // ── Batch 4 (items 61-80) ─────────────────────────────────────────
  "nodejs-pm2": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: pm2 binary (typically under /usr/local/bin or per-user nvm path).",
      "Config: ~/.pm2/dump.pm2 and module_conf.json are scanned for app paths and environment references.",
      "Validate: `pm2 --version && pm2 ls` with user-context review.",
      "Full migration strategy: PM2 runtime rebuild plus per-user `pm2 save` dump review; application directories remain owned by app plans."
    ],
    remainingRisks: [
      "PM2 saved process list (`pm2 save`) lives in ~/.pm2/dump.pm2; not migrated automatically.",
      "Should be paired with a node-runtime-profile or nodejs-version-mgr plan first."
    ],
    batch: 7
  },
  "openresty": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: openresty package + /usr/local/openresty binary + /etc/openresty/.",
      "Validate: `openresty -t` parses config; `systemctl is-active openresty` confirms service.",
      "Conflicts with nginx-web-service (both bind :80/:443) -- planner must surface the conflict before apply.",
      "Plan includes structured Lua module, site-root, upstream, and TLS reference review."
    ],
    remainingRisks: [
      "Lua modules under /usr/local/openresty/lualib are part of the installation and rebuilt on install -- custom modules need operator review.",
      "Mutually exclusive with nginx-web-service on the same host.",
      "TLS private key paths and upstream service references must be reviewed before migrate."
    ],
    reviewerNotes: "OpenResty and nginx-web-service share port 80/443; planner emits an exclusivity warning when both are queued.",
    batch: 4
  },
  "nethogs-bandwidth": {
    status: "fixed",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Bundles 5 network monitoring tools: nethogs, iftop, vnstat, tcpdump, nmap.",
      "All five companion packages now declared in components so detect catches any one of them.",
      "Config: vnstat and nmap config paths are scanned.",
      "Validate: nethogs/vnstat/nmap version checks.",
      "Data strategy: none; vnstat historical counters are not migrated."
    ],
    missingFieldsBefore: ["components.iftop", "components.tcpdump", "components.nmap"],
    changesMade: [
      "Added `iftop`, `tcpdump`, `nmap` software components so detect/install matches the assets list."
    ],
    remainingRisks: [
      "tcpdump and nethogs require CAP_NET_RAW / root to capture; expected behaviour.",
      "vnstat collects per-interface counters under /var/lib/vnstat -- not migrated automatically."
    ],
    batch: 8
  },
  "firewalld": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: firewalld package + firewalld.service + /etc/firewalld/{zones,services}/.",
      "Privileged: firewall ruleset -- riskLevel `privileged`.",
      "Validate: `firewall-cmd --state` and `firewall-cmd --list-all`; rollback restores prior /etc/firewalld snapshots.",
      "Conflicts with firewall-baseline (UFW) -- planner must surface the conflict before apply.",
      "Full migration strategy: safe firewall config rebuild with SSH reachability confirmation and auto-rollback."
    ],
    remainingRisks: [
      "Mutually exclusive with UFW on the same host; running both produces undefined behaviour.",
      "Operators must confirm the `public` zone still allows SSH on port 22 before apply.",
      "Safe-apply must schedule an auto-rollback timer to avoid SSH lockout."
    ],
    reviewerNotes: "Same exclusivity contract as firewall-baseline (UFW). Planner emits a warning when both are queued.",
    batch: 5
  },
  "x-ui-panel": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: x-ui binary + x-ui.service + /etc/x-ui/x-ui.db.",
      "Server-panel category: detect-only is the maximum allowed by quality gate §5.1.",
      "Card explicitly does NOT advertise migrate/build."
    ],
    remainingRisks: [
      "Do NOT feature on home Recommended row; this is a network proxy admin panel.",
      "x-ui.db (SQLite) holds inbound configurations + admin password hash + user secrets -- must be confirmed before any migrate.",
      "Xray inbound credentials (UUID, password) leaving the source host require explicit operator confirmation."
    ],
    reviewerNotes: "Quality gate forbids panel-class items at full-migration; detect-only is correct.",
    batch: 4
  },
  "vaultwarden": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: vaultwarden docker container + ./vw-data/db.sqlite3.",
      "Privileged: holds password vault data -- riskLevel `privileged`; secret policy: confirm.",
      "Kept at detect-only because vault data migration must use Bitwarden's own export tooling, not filesystem copy."
    ],
    remainingRisks: [
      "vw-data/db.sqlite3 + vw-data/attachments + vw-data/sends contain user vaults -- never transport without operator confirmation.",
      "ADMIN_TOKEN, SMTP credentials, and YubiKey secrets in env file are secrets.",
      "PUSH notification keys (HCAPTCHA, Bitwarden push) are tied to specific deployments and must be re-issued."
    ],
    reviewerNotes: "Holds password manager state; quality gate requires secret-confirm policy and forbids automatic migrate.",
    batch: 4
  },
  "caddy-server": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: caddy binary + caddy.service + /etc/caddy/Caddyfile.",
      "Validate: `caddy validate --config /etc/caddy/Caddyfile`; rollback restores prior Caddyfile.",
      "Configs.sensitivity: review (Caddyfile references upstream services + ACME email).",
      "Conflicts with nginx-web-service / openresty / traefik-proxy on ports 80/443 -- planner emits exclusivity warning.",
      "Plan includes structured ACME storage, DNS challenge credential, site-root, and upstream review."
    ],
    remainingRisks: [
      "Caddy auto-issues TLS via Let's Encrypt; ports 80 and 443 must be free -- operators must remove conflicting reverse-proxy first.",
      "ACME storage under /var/lib/caddy holds private keys; secret policy: confirm before transport.",
      "Cloudflare DNS challenge requires CF API token -- treat as secret."
    ],
    reviewerNotes: "Mutually exclusive with nginx / openresty / traefik on a single host; planner surfaces the conflict.",
    batch: 4
  },
  "pihole": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: pihole/pihole docker container + /etc/pihole/ + /etc/dnsmasq.d/.",
      "Privileged: DNS service affects the entire network -- riskLevel `privileged`.",
      "Kept at detect-only because the pi-hole DB schema and Group Management state require pi-hole's `pihole -a -t` teleporter export."
    ],
    remainingRisks: [
      "Conflicts with system resolver on port 53; operators must disable systemd-resolved DNSStubListener before apply.",
      "Web admin password lives in /etc/pihole/setupVars.conf -- secret policy: confirm.",
      "Adlists subscriptions and per-client overrides should be exported via Pi-hole Teleporter, not rsync /etc/pihole."
    ],
    batch: 4
  },
  "authentik": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: ghcr.io/goauthentik/server container + bundled Postgres/Redis volumes.",
      "Privileged: identity provider -- riskLevel `privileged`; secret policy: confirm.",
      "Kept at detect-only because IdP migration requires Authentik's own backup APIs (`ak dump_config`)."
    ],
    remainingRisks: [
      "Postgres data + media volumes hold user / group / OAuth client secrets -- never transport via filesystem copy.",
      "AUTHENTIK_SECRET_KEY and email credentials are secrets that must be confirmed before any move.",
      "OIDC client secrets shared with downstream applications must be re-issued on the target."
    ],
    reviewerNotes: "Identity provider; quality gate requires secret-confirm policy and forbids automatic migrate.",
    batch: 4
  },
  "meilisearch": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: meilisearch binary + meilisearch.service + ./data.ms or /var/lib/meilisearch.",
      "Validate: HTTP probe to localhost:7700/health (allowFailure on first apply).",
      "Configs.sensitivity: review (master key + analytics opt-out).",
      "Full migration strategy: config rebuild plus dump/import review for /var/lib/meilisearch or data.ms."
    ],
    remainingRisks: [
      "MEILI_MASTER_KEY is required to read the data directory; must be confirmed before transport.",
      "Index data under /var/lib/meilisearch should be migrated via Meilisearch's `dump` API rather than filesystem copy.",
      "API key derivation depends on MEILI_MASTER_KEY -- changing the master key invalidates downstream tokens."
    ],
    batch: 10
  },
  "wikijs": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: requarks/wiki:2 docker container + bundled Postgres volume.",
      "Kept at detect-only because Wiki.js data migration requires its own `wiki backup` flow + Postgres dump."
    ],
    remainingRisks: [
      "Postgres volume holds page revisions, user accounts, and locale data -- never transport via raw rsync.",
      "Git sync repository credentials (PAT / SSH key) are secrets -- must be confirmed and re-issued."
    ],
    batch: 4
  },
  "n8n": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: n8nio/n8n docker container + ~/.n8n volume.",
      "Kept at detect-only: n8n credential store is encrypted with N8N_ENCRYPTION_KEY; safe migration needs operator-driven export."
    ],
    remainingRisks: [
      "~/.n8n/database.sqlite holds workflow definitions + encrypted credentials -- both N8N_ENCRYPTION_KEY and the file must travel together.",
      "Webhook URLs encoded in workflows are tied to the public hostname; targets with different hostnames must rewrite them."
    ],
    batch: 4
  },
  "valkey-server": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: valkey package + valkey-server.service + /etc/valkey/valkey.conf.",
      "Command-compatible with Redis: redis-cli works against valkey.",
      "Config: valkey.conf, default/sysconfig files, ACL/password references, and include files are scanned.",
      "Validate: `valkey-cli ping` with service status fallback.",
      "Data strategy: explicit SAVE/BGSAVE review; never raw-copy /var/lib/valkey."
    ],
    remainingRisks: [
      "Mutually exclusive with redis-server on default port 6379 -- planner surfaces the conflict.",
      "Persistence files (RDB / AOF) under /var/lib/valkey require dump-restore strategy, not raw filesystem copy.",
      "MASTERAUTH / requirepass values are secrets and must travel out of band."
    ],
    reviewerNotes: "Separate capabilityKey `cache.valkey`; planner emits a warning when redis-server and valkey-server are queued together.",
    batch: 8
  },
  "clickhouse": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: clickhouse-server / clickhouse-client packages + /etc/clickhouse-server/.",
      "Validate: `clickhouse-client --query 'SELECT 1'` (allowFailure on first apply).",
      "Configs.sensitivity: review (users.xml may reference SHA256 password hashes).",
      "Data strategy: manual BACKUP/RESTORE or clickhouse-backup; never raw-copy /var/lib/clickhouse.",
      "Cross-distro package/service maps cover apt/dnf/yum/pacman/apk with service validation."
    ],
    remainingRisks: [
      "Table data under /var/lib/clickhouse should be migrated via `BACKUP TABLE` / `clickhouse-backup`, not raw rsync.",
      "ZooKeeper / ClickHouse Keeper coordination state is a separate service.",
      "users.xml password hashes and LDAP / Kerberos integration must be reviewed manually."
    ],
    batch: 10
  },
  "influxdb": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: influxdb2 package + influxdb.service + /etc/influxdb/.",
      "Validate: HTTP probe to localhost:8086/health (allowFailure on first apply).",
      "Configs.sensitivity: review (admin token + bucket retention policies).",
      "Data strategy: manual `influxd backup` / `influxd restore`; never raw-copy TSDB files.",
      "Cross-distro package/service maps cover apt/dnf/yum/pacman/apk with service validation."
    ],
    remainingRisks: [
      "TSDB data under /var/lib/influxdb requires `influxd backup` / `influxd restore`, not raw filesystem copy.",
      "Operator API tokens stored in /etc/influxdb/influxd.bolt are secrets and must travel out of band.",
      "InfluxDB v1 vs v2 schemas are incompatible; cards target v2 only."
    ],
    batch: 10
  },
  "bookstack": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: lscr.io/linuxserver/bookstack container + bundled MariaDB volume.",
      "Kept at detect-only: BookStack relies on its own `php artisan` migrate flow + MariaDB dump for safe migration."
    ],
    remainingRisks: [
      "MariaDB volume holds page content + user accounts; needs mysqldump for cross-host migration.",
      "APP_KEY and DB password env values are secrets and must be confirmed.",
      "Uploaded images live under the bookstack container's /config/www/uploads; volumes must be migrated explicitly."
    ],
    batch: 4
  },
  "home-assistant": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: homeassistant/home-assistant container + ./config volume.",
      "Kept at detect-only: HA config is a complex YAML+SQLite tree with hundreds of integrations; safe migration uses HA's built-in backup/restore."
    ],
    remainingRisks: [
      "secrets.yaml holds API tokens / device credentials; must be confirmed before transport.",
      "Lovelace dashboards reference local entity ids that may not exist on a fresh target.",
      "Z-Wave / Zigbee USB device pass-through is hardware-specific and out of scope."
    ],
    batch: 4
  },
  "gitlab-ce": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: gitlab/gitlab-ce container + /etc/gitlab + /var/opt/gitlab + /var/log/gitlab volumes.",
      "Privileged: holds repository data + secrets -- riskLevel `privileged`.",
      "Kept at detect-only: GitLab CE migration MUST use `gitlab-backup create` + `gitlab-backup restore`, not filesystem copy."
    ],
    remainingRisks: [
      "Repositories, CI artifacts, container registry images, and Postgres state require `gitlab-backup` -- never raw rsync.",
      "/etc/gitlab/gitlab-secrets.json holds db_key_base, otp_key_base, and rotational secrets that must travel together with the data.",
      "GitLab versions on source and target must match exactly during restore.",
      "4GB RAM minimum; targets below this fail to start the unicorn workers."
    ],
    reviewerNotes: "Largest single capability in the catalog; quality gate forbids any direct migrate path.",
    batch: 4
  },
  "umami": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: ghcr.io/umami-software/umami container + bundled Postgres volume.",
      "Kept at detect-only: analytics history lives in Postgres; safe migration uses pg_dump + restore."
    ],
    remainingRisks: [
      "DATABASE_URL credentials and HASH_SALT env values are secrets.",
      "Tracking script ids (website ids) are stable across restore -- but only if HASH_SALT is preserved."
    ],
    batch: 4
  },
  "nocodb": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: nocodb/nocodb container + ./nc_data volume (SQLite or external DB).",
      "Kept at detect-only: NocoDB connects to user-supplied databases that EnvForge cannot migrate as part of the NocoDB plan."
    ],
    remainingRisks: [
      "External database connections in nc_data hold credentials -- secret policy: confirm.",
      "JWT secret (NC_AUTH_JWT_SECRET) must be preserved on restore or all sessions invalidate."
    ],
    batch: 4
  },
  // ── Batch 5 (items 81-100) ────────────────────────────────────────
  "nfs-server": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: nfs-kernel-server / nfs-utils package + nfs-server.service + /etc/exports.",
      "Validate: `exportfs -s` lists active exports; `systemctl is-active nfs-server` confirms the daemon.",
      "Configs.sensitivity: review (export paths + client subnets).",
      "Data strategy: optional manual review of exported paths; EnvForge does not infer or copy arbitrary export roots.",
      "Cross-distro package/service maps cover Debian/RHEL/Fedora/Arch/Alpine service names."
    ],
    remainingRisks: [
      "Export paths must exist on the target filesystem before nfs-server starts.",
      "Network ACLs (allowed_hosts, no_root_squash) leak access scope -- operator review required.",
      "Kerberos / sec=krb5 deployments require external KDC and are out of scope for this card."
    ],
    batch: 10
  },
  "adguard-home": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: adguard/adguardhome container + ./conf + ./work volumes.",
      "Privileged: DNS service affecting the entire network -- riskLevel `privileged`.",
      "Kept at detect-only because filter list state and per-client overrides require AdGuard's `AdGuardHome.yaml` export."
    ],
    remainingRisks: [
      "Mutually exclusive with pihole and the system resolver on port 53; operators must disable systemd-resolved DNSStubListener.",
      "AdGuardHome.yaml holds users + bcrypt password hashes -- secret policy: confirm.",
      "DoH / DoT listener TLS material must travel out of band."
    ],
    reviewerNotes: "Same DNS responsibility as pihole; planner emits exclusivity warning when both are queued.",
    batch: 5
  },
  "tailscale": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: tailscale package + tailscaled.service + /var/lib/tailscale/tailscaled.state.",
      "Validate: `tailscale status` (allowFailure if not yet authenticated).",
      "Configs.sensitivity: secret (tailscaled.state holds the node key).",
      "Data strategy: manual re-authentication with reusable/ephemeral auth key is preferred over state copy.",
      "Cross-distro package/service maps cover apt/dnf/yum/pacman/apk."
    ],
    remainingRisks: [
      "Node identity key in /var/lib/tailscale/tailscaled.state is per-host -- moving the file copies the node identity, which is rarely the desired behaviour. The expected migration path is `tailscale up --authkey=<reusable-or-ephemeral>` on the new host.",
      "ACL / subnet-router advertisements are coordinator-side state, not local config.",
      "MagicDNS suffix is account-wide and not per-host."
    ],
    reviewerNotes: "Full migration support is structured re-authentication and config review; copying tailscaled.state remains discouraged.",
    batch: 10
  },
  "keycloak": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: quay.io/keycloak/keycloak container + bundled Postgres volume.",
      "Privileged: enterprise SSO -- riskLevel `privileged`; secret policy: confirm.",
      "Validate: HTTP probe to /health/ready (allowFailure during bootstrap).",
      "Full migration strategy: Keycloak realm export/import plus DB backup/restore and custom provider/theme review."
    ],
    remainingRisks: [
      "Realm exports (`kc.sh export`) must be used for safe migration; never raw rsync the Postgres volume.",
      "KEYCLOAK_ADMIN_PASSWORD, smtp credentials, and per-realm OIDC client secrets are all secrets.",
      "Custom themes / SPI providers under /opt/keycloak/providers must be carried separately.",
      "Mutually exclusive with authentik / authelia at the SSO role level on a single deployment."
    ],
    reviewerNotes: "Identity provider; planner emits exclusivity warning when keycloak + authentik + authelia are queued.",
    batch: 7
  },
  "authelia": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: authelia/authelia container + ./config/configuration.yml + ./config/db.sqlite3.",
      "Privileged: forward-auth gatekeeper -- riskLevel `privileged`; secret policy: confirm.",
      "Validate: HTTP probe to /api/state (allowFailure during bootstrap).",
      "Full migration strategy: configuration rebuild plus SQLite/TOTP/WebAuthn state backup and reverse-proxy pairing review."
    ],
    remainingRisks: [
      "configuration.yml + secret env vars (JWT_SECRET, SESSION_SECRET, STORAGE_ENCRYPTION_KEY) are secrets.",
      "TOTP / WebAuthn enrolments live in db.sqlite3; users must re-enrol if the DB is regenerated.",
      "Forward-auth pairing requires a compatible reverse proxy (nginx-web-service / traefik-proxy / caddy-server) on the same plan."
    ],
    reviewerNotes: "Lightweight forward-auth SSO; same exclusivity advisory as keycloak / authentik.",
    batch: 7
  },
  "docker-mailserver": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: ghcr.io/docker-mailserver/docker-mailserver container + ./docker-data/dms volumes.",
      "Privileged: outbound mail server -- riskLevel `privileged`; secret policy: confirm.",
      "Kept at detect-only because mail migration requires preserving Maildir + DKIM keys + DNS records (SPF / DKIM / DMARC / MTA-STS) -- a workflow EnvForge cannot drive end-to-end."
    ],
    remainingRisks: [
      "DKIM private keys in ./docker-data/dms/config/opendkim/ are secrets; rotating them invalidates published DNS DKIM records.",
      "DNS records (A/MX/SPF/DKIM/DMARC/MTA-STS) live at the registrar -- EnvForge does not touch them.",
      "IP reputation: moving outbound mail to a fresh IP often triggers greylisting at major providers.",
      "Postfix smtpd_relay_restrictions misconfiguration creates an open relay -- operator review required."
    ],
    reviewerNotes: "Mail is the highest-risk capability in the catalog; quality gate forbids any one-shot migrate.",
    batch: 5
  },
  "onlyoffice-docs": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: onlyoffice/documentserver container + bundled Postgres + RabbitMQ.",
      "Kept at detect-only because OnlyOffice document cache + JWT secret coordination with downstream Nextcloud / SeaTable requires careful joint migration."
    ],
    remainingRisks: [
      "JWT_SECRET must match the value configured in the integrating app (Nextcloud / SeaTable / etc).",
      "Document cache under /var/lib/onlyoffice may hold open document state from active users.",
      "Postgres + RabbitMQ side-cars must be migrated together; copying only the document server volume leaves orphan state."
    ],
    batch: 5
  },
  "immich": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: ghcr.io/immich-app/immich-server + immich-machine-learning containers + Postgres (pgvecto-rs).",
      "Kept at detect-only because Immich data lives in a customised Postgres (pgvecto-rs extension) plus the photo library; both must move together."
    ],
    remainingRisks: [
      "Photo library volumes (/usr/src/app/upload) are the bulk of the data -- operator-driven copy, not part of this card.",
      "ML model cache regenerates after move (long warm-up); validate with allowFailure.",
      "DB_PASSWORD + JWT_SECRET + UPLOAD_LOCATION env values are required for a clean restore.",
      "pgvecto-rs vector index must be reindexed after restore on a fresh Postgres."
    ],
    batch: 5
  },
  "forgejo": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: codeberg.org/forgejo/forgejo container + Postgres volume.",
      "Kept at detect-only because forgejo / gitea data migration uses `forgejo dump` + restore; raw rsync of /data corrupts repository hooks."
    ],
    remainingRisks: [
      "JWT_SECRET, INTERNAL_TOKEN, SECRET_KEY in app.ini are secrets that must travel with the data.",
      "Repository hooks under /data/git/repositories/<owner>/<repo>/hooks reference absolute paths -- forgejo dump rewrites them on restore.",
      "Federated ActivityPub key pairs are tied to the instance hostname."
    ],
    batch: 5
  },
  "k3s": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: k3s binary + k3s.service + /etc/rancher/k3s/k3s.yaml.",
      "Privileged: container orchestrator -- riskLevel `privileged`.",
      "Validate: `k3s kubectl get nodes` (allowFailure during bootstrap).",
      "Full migration strategy: package/config rebuild plus coordinated k3s snapshot/restore and kubeconfig secret review."
    ],
    remainingRisks: [
      "Workload state lives in /var/lib/rancher/k3s/server/db (SQLite) -- migration is a coordinated `etcd-snapshot save` / restore (or `db backup` for SQLite mode).",
      "/etc/rancher/k3s/k3s.yaml contains the cluster CA and admin token -- secret policy: confirm.",
      "Persistent volumes provisioned by local-path-provisioner are tied to the host filesystem; cross-host migration requires CSI plugins.",
      "Token-based agent join requires the node-token under /var/lib/rancher/k3s/server/node-token."
    ],
    reviewerNotes: "Minimal Kubernetes; planner must surface conflicts with kubernetes-tools (which manages a different cluster).",
    batch: 5
  },
  "filebrowser": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: filebrowser/filebrowser container or filebrowser binary + filebrowser.db.",
      "Kept at detect-only: filebrowser.db (SQLite) carries user accounts + per-user scoped roots; safe migration is operator-driven."
    ],
    remainingRisks: [
      "filebrowser.db holds bcrypt password hashes -- secret policy: confirm.",
      "Mounted root directories are operator-owned bind mounts; not migrated as part of this card.",
      "Server-panel-style UI: do not feature on the home Recommended row."
    ],
    reviewerNotes: "Quality gate flags `(filebrowser)` as panel-class; detect-only is the correct ceiling.",
    batch: 5
  },
  "uptime-kuma": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: louislam/uptime-kuma container + ./uptime-kuma volume.",
      "Kept at detect-only because monitor history + notification credentials live in the SQLite database that requires Uptime Kuma's own backup flow."
    ],
    remainingRisks: [
      "Notification credentials (SMTP / Telegram bot tokens / webhook secrets) are encrypted with the instance secret -- secret policy: confirm.",
      "Status page custom domains and reverse-proxy headers are operator-owned settings."
    ],
    batch: 5
  },
  "homepage": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: ghcr.io/gethomepage/homepage container + ./config volume.",
      "Certified through a config-driven dashboard rule with explicit downstream URL, widget token, and reverse-proxy authentication review.",
      "Validate: container/HTTP health probe; data strategy is reviewed config, not blind volume copy."
    ],
    remainingRisks: [
      "settings.yaml / services.yaml reference internal hostnames; operators must rewrite them after migrate.",
      "API tokens for widgets (Sonarr / Plex / Portainer / etc) are secrets.",
      "Per-user authentication relies on the upstream reverse proxy (Authelia / Authentik / etc)."
    ],
    batch: 5
  },
  "dozzle": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: amir20/dozzle container with /var/run/docker.sock mounted.",
      "Privileged: mounts the docker socket and exposes container logs -- riskLevel `privileged`.",
      "Kept at detect-only: stateless log viewer -- nothing meaningful to migrate."
    ],
    remainingRisks: [
      "Mounting /var/run/docker.sock grants root-equivalent access to the host; expose only behind authenticated reverse proxy.",
      "DOZZLE_AUTH_PROVIDER + downstream auth headers must remain configured on the target."
    ],
    batch: 5
  },
  "paperless-ngx": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: ghcr.io/paperless-ngx/paperless-ngx container + bundled Postgres + Redis.",
      "Kept at detect-only because Paperless data + tag taxonomy live in Postgres; safe migration uses `document_exporter` / `document_importer` Django commands."
    ],
    remainingRisks: [
      "PAPERLESS_SECRET_KEY must be preserved or all encrypted fields become unreadable.",
      "OCR-processed PDFs in /usr/src/paperless/data/media are operator-owned; copy is straightforward but DB references must match.",
      "Tika / Gotenberg side-cars are part of the compose stack and must be migrated together."
    ],
    batch: 5
  },
  "navidrome": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: deluan/navidrome container + ./data + ./music volumes.",
      "Kept at detect-only because the music library bind mount is operator-managed; only metadata and play history live in the Navidrome DB."
    ],
    remainingRisks: [
      "navidrome.db contains play counts + playlists + user accounts; migrate via filesystem copy IS supported but only after stopping the container.",
      "Subsonic API tokens for downstream apps are derived from the salted password hash -- changing passwords invalidates them."
    ],
    batch: 5
  },
  "audiobookshelf": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: ghcr.io/advplyr/audiobookshelf container + ./config + ./metadata + ./audiobooks volumes.",
      "Kept at detect-only because audiobook progress + per-user state live in NeDB / SQLite that EnvForge cannot migrate generically."
    ],
    remainingRisks: [
      "Audiobook media library (./audiobooks) is operator-owned bind mount; not part of this card's migrate.",
      "JWT secret + API tokens for native apps must be preserved or users must re-authenticate."
    ],
    batch: 5
  },
  "freshrss": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect: freshrss/freshrss container + bundled Postgres or SQLite volume.",
      "Kept at detect-only because subscription state + read flags live in the DB; migrate must use FreshRSS OPML export + per-user state restore."
    ],
    remainingRisks: [
      "Per-user OPML lists are user-owned and migrated via the in-app exporter, not by EnvForge.",
      "Fever API password hashes are tied to the user account password."
    ],
    batch: 5
  },
  "stirling-pdf": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: stirlingtools/stirling-pdf container.",
      "Stateless PDF processor -- nothing meaningful to migrate.",
      "Certified as a mostly stateless service with optional auth/custom-files review and harness coverage."
    ],
    remainingRisks: [
      "Uploaded PDFs are processed in-memory and not persisted by default; user-uploaded files leaving the host should be reviewed for PII."
    ],
    batch: 5
  },
  "mealie": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: ghcr.io/mealie-recipes/mealie container + bundled Postgres volume.",
      "Certified through Mealie's built-in backup/restore path or reviewed database dump, never raw live volume copy.",
      "Validate: application health/API probe plus backup artifact review."
    ],
    remainingRisks: [
      "Mealie supports an in-app backup/restore that produces a portable zip -- operators should use that, not raw Postgres dumps.",
      "Uploaded recipe images live in the data volume; backup zip already includes them."
    ],
    batch: 5
  },
  // ── Batch 6 (items 101-115) ───────────────────────────────────────
  "linkwarden": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: ghcr.io/linkwarden/linkwarden container + bundled Postgres volume.",
      "Certified with explicit archive-volume, PostgreSQL backup, and NEXTAUTH_SECRET continuity review.",
      "Validate: service health probe plus archive/secret checklist."
    ],
    remainingRisks: [
      "NEXTAUTH_SECRET + DATABASE_URL env values are secrets and must be confirmed.",
      "Archived web pages (HTML / PDF / screenshots) live under ./data/data; volume copy is straightforward but operator-owned.",
      "Per-user OAuth tokens for downstream services are stored encrypted -- preserve NEXTAUTH_SECRET to keep them readable."
    ],
    batch: 6
  },
  "seafile": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect: seafileltd/seafile-mc container + MariaDB + Memcached side-cars + ./shared volume.",
      "Certified through `seaf-backup` / `seaf-fsck` plus MariaDB dump/restore; raw rsync alone remains forbidden.",
      "Validate: Seafile backup/check tooling and DB restore checklist."
    ],
    remainingRisks: [
      "Block storage under ./shared/seafile-data is content-addressable; corruption requires `seaf-fsck` to repair.",
      "MariaDB volume holds user accounts + library metadata + share links -- mysqldump for cross-host migration.",
      "Encrypted libraries depend on per-user passwords; the master server cannot decrypt them on restore.",
      "JWT_PRIVATE_KEY + admin password + SMTP credentials in conf/seahub_settings.py / .env are secrets."
    ],
    batch: 6
  },
  "lamp-stack": {
    status: "pass",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Combo: apache-httpd (full-migration) + mysql-server (full-migration) + php-toolchain (full-migration).",
      "Dedicated combo orchestration rule and harness now cover Apache config, MySQL dump strategy, PHP modules, and TLS/site-root review.",
      "Validate: `apachectl configtest || httpd -t`, `mysqladmin ping || mariadb-admin ping`, and `php --version`."
    ],
    remainingRisks: [
      "Apache vhost config under /etc/apache2/sites-available is managed by apache-httpd, not by this combo card.",
      "MySQL data still requires the mysql-server card's dump-restore data strategy -- operators should run mysql-server as a follow-on plan for full migrate.",
      "PHP modules and pool config (mod_php vs php-fpm) need operator review."
    ],
    reviewerNotes: "Certified in the final backlog batch by composing already-certified component strategies with a dedicated combo rule and scenario.",
    batch: 6
  },
  "lemp-stack": {
    status: "pass",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Combo: nginx-web-service (full-migration) + mysql-server (full-migration) + php-fpm (full-migration) + php-toolchain.",
      "Dedicated combo orchestration rule and harness now cover Nginx, MySQL, PHP-FPM pool config, and TLS/site-root review.",
      "Validate: `nginx -t`, `php-fpm -t || php-fpm8.3 -t || php-fpm8.2 -t`, and `mysqladmin ping || mariadb-admin ping`."
    ],
    remainingRisks: [
      "php-fpm pool definitions under /etc/php/*/fpm/pool.d/ are managed by the php-fpm card, not by this combo card.",
      "Nginx + MySQL + PHP-FPM components individually carry full-migration depth via their own cards; operators wanting that should run them as separate plans.",
      "Combo Stepper UI must surface the depth gap so users do not assume one-shot full migrate."
    ],
    reviewerNotes: "Certified in the final backlog batch by composing already-certified component strategies with a dedicated combo rule and scenario.",
    batch: 6
  },
  "node-production-deploy": {
    status: "pass",
    originalSupportLevel: "basic-rebuild",
    finalSupportLevel: "full-migration",
    reasons: [
      "Combo: nginx-web-service (full-migration) + nodejs (managed-config) + npm install -g pm2 (detect-only).",
      "Certified with PM2/app-source manual review, Nginx upstream validation, and runtime token redaction.",
      "Validate: `node --version`, `npm --version`, `pm2 --version || true`, and `nginx -t`."
    ],
    remainingRisks: [
      "PM2 saved process list is per-user under ~/.pm2 and not migrated by this combo.",
      "Application source (the actual node app) is operator-owned and not part of the combo.",
      "Nginx upstream config pointing at the node app must be rewritten to match the new host."
    ],
    batch: 6
  },
  "docker-compose-dev": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Combo: docker-host-profile (full-migration) + docker-compose-plugin + docker-buildx-plugin.",
      "Certified as Docker/Compose/Buildx tooling with daemon.json, registry auth, buildx state, and compose-project ownership review.",
      "Validate: `docker version`, `docker compose version`, `docker buildx version || true`."
    ],
    remainingRisks: [
      "User must be added to the `docker` group before `docker run` works without sudo -- operator-owned step.",
      "Compose stacks themselves are user repos and not migrated by this combo.",
      "Buildx builders persist state under ~/.docker/buildx; per-user, not migrated."
    ],
    batch: 6
  },
  "security-baseline": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Combo: firewall-baseline (UFW, managed-config) + fail2ban (managed-config) + ssh-hardening (full-migration) + unattended-upgrades.",
      "Privileged: every component touches security; combo riskLevel `privileged`.",
      "Certified with SSH and firewall lockout approval gates plus dedicated dry-run harness.",
      "Validate: `sshd -t`, `fail2ban-client status || systemctl is-active fail2ban`, and `ufw status || firewall-cmd --state`."
    ],
    remainingRisks: [
      "Mutually exclusive with firewalld at the layer-4 packet filter level; planner must surface the conflict.",
      "Auto-rollback timer required for both UFW and sshd_config to avoid SSH lockout.",
      "Unattended-upgrades pattern for security-only updates must match the target distro (debian-family vs rhel-family)."
    ],
    reviewerNotes: "One of the highest-value combos; safe-apply must include the SSH lockout protection for both firewall and sshd components.",
    batch: 6
  },
  "monitoring-stack": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Combo: prometheus (managed-config) + grafana (managed-config) + loki (managed-config) + node_exporter + cadvisor.",
      "Certified with compose-level data/retention review across Prometheus, Grafana, Loki, node_exporter, and cadvisor.",
      "Validate: Prometheus /-/healthy, Grafana /api/health, and Loki /ready probes."
    ],
    remainingRisks: [
      "Long-term TSDB / log retention typically uses external object storage (S3 / GCS); the combo only configures local volumes.",
      "Grafana datasource definitions are wired by the compose file; custom dashboards still need to be exported separately.",
      "cadvisor mounts host paths (`/`, `/var/lib/docker`) read-only; ensure the docker driver matches (overlay2 vs btrfs)."
    ],
    batch: 6
  },
  "selfhost-essentials": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Combo: traefik-proxy (managed-config) + vaultwarden (detect-only) + pihole (detect-only) + home-assistant (detect-only).",
      "Combo supportLevel = min(component supportLevels) = detect-only (vaultwarden / pihole / home-assistant are all detect-only).",
      "Privileged: vault + DNS + smart home -- combo riskLevel `privileged`."
    ],
    remainingRisks: [
      "Each detect-only component has its own data + secret migration story; this combo cannot collapse them into one plan.",
      "Pi-hole and any system DNS resolver fight over port 53; planner must surface the conflict.",
      "Home Assistant USB device pass-through is host-specific and not part of the combo."
    ],
    reviewerNotes: "Combo cannot exceed its weakest component; detect-only is correct.",
    batch: 6
  },
  "ai-localllm-stack": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Combo: ollama (uncatalogued) + open-webui (uncatalogued) + searxng (uncatalogued).",
      "All three components are uncatalogued top-level; combo defaults to detect-only.",
      "GPU pass-through (NVIDIA Container Toolkit) is a host-specific prerequisite outside the combo."
    ],
    remainingRisks: [
      "Ollama model weights under /root/.ollama or ./ollama volume can run into hundreds of GB -- migration is operator-driven.",
      "Open-WebUI auth state lives in ./data/webui.db; preserve WEBUI_SECRET_KEY.",
      "SearxNG configuration references upstream search engines that may rate-limit on a fresh IP.",
      "GPU drivers + NVIDIA Container Toolkit are host-specific and not part of any catalog card."
    ],
    batch: 6
  },
  "mail-stack": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Combo: docker-mailserver (detect-only) + roundcube + caddy-server (managed-config).",
      "Combo supportLevel = min = detect-only because docker-mailserver is detect-only.",
      "Privileged: outbound mail -- combo riskLevel `privileged`."
    ],
    remainingRisks: [
      "All risks of the docker-mailserver card apply: DKIM, DNS, IP reputation, open-relay misconfig.",
      "Roundcube session state in its own volume; admin auto-config not migrated.",
      "Caddy auto-issues TLS for the mail hostname -- DNS A record must already point at the new host before apply."
    ],
    reviewerNotes: "Mail stack inherits mail-server's high-risk profile; quality gate forbids any one-shot migrate.",
    batch: 6
  },
  "sso-stack": {
    status: "pass",
    originalSupportLevel: "managed-config",
    finalSupportLevel: "full-migration",
    reasons: [
      "Combo: traefik-proxy (managed-config) + authelia (managed-config) + redis-server (full-migration as session store).",
      "Privileged: SSO gatekeeper + reverse proxy -- combo riskLevel `privileged`.",
      "Certified with identity-provider and secret-continuity approval gates plus dedicated dry-run harness."
    ],
    remainingRisks: [
      "configuration.yml + JWT_SECRET + SESSION_SECRET + STORAGE_ENCRYPTION_KEY must all migrate together.",
      "Redis session data is volatile by design; resetting the cache logs all users out.",
      "Forward-auth headers depend on traefik-proxy's middleware chain being applied on every protected route."
    ],
    batch: 6
  },
  "homelab-dashboard": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Combo: homepage (detect-only) + uptime-kuma (detect-only) + dozzle (detect-only).",
      "Combo supportLevel = detect-only (all components are detect-only).",
      "Privileged: dozzle mounts /var/run/docker.sock; combo riskLevel `privileged`."
    ],
    remainingRisks: [
      "Each component has its own state; this combo only orchestrates start order, not migrate.",
      "Dozzle exposing the docker socket must be behind authenticated reverse proxy on internet-facing hosts."
    ],
    batch: 6
  },
  "selfhost-media": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Combo: jellyfin-media (detect-only) + navidrome (detect-only) + audiobookshelf (detect-only).",
      "Combo supportLevel = detect-only."
    ],
    remainingRisks: [
      "Three media libraries are typically on bind mounts to large storage; operator-owned, not part of this combo.",
      "Hardware acceleration (VAAPI / NVENC) for Jellyfin requires distro-specific drivers."
    ],
    batch: 6
  },
  "selfhost-pkm": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Combo: wikijs (detect-only) + freshrss (detect-only) + linkwarden (detect-only).",
      "Combo supportLevel = detect-only."
    ],
    remainingRisks: [
      "Each component has its own DB-backed state; the combo only fronts them with a shared compose file.",
      "Wiki.js git sync repo, FreshRSS OPML, and Linkwarden archives all need separate operator-driven backup/restore."
    ],
    batch: 6
  },
  // ── Enforcement-phase additions (items 116-119) ───────────────────
  "apache-httpd": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect covers apache2/httpd packages, apachectl, systemd units, and ports 80/443.",
      "Config covers apache2/httpd base config, vhost globs, and enabled module snippets with TLS key secret patterns.",
      "Validate runs `apachectl configtest` plus service-state checks.",
      "Data strategy: manual review for site roots, TLS certs, enabled modules, and PHP handler coupling."
    ],
    remainingRisks: [
      "vhost configs under /etc/apache2/sites-available and /etc/httpd/conf.d can reference app roots that must exist on target.",
      "Module enable state (a2enmod/a2dismod) varies between distros.",
      "mod_php vs php-fpm routing must be reviewed with php-toolchain/php-fpm plans."
    ],
    batch: 6
  },
  "php-fpm": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "full-migration",
    reasons: [
      "Detect covers php-fpm packages, php-fpm binaries, versioned services, and port 9000.",
      "Config covers php-fpm.conf and pool.d globs across Debian/RHEL layouts with env secret patterns.",
      "Validate runs php-fpm syntax checks plus service-state checks.",
      "Data strategy: manual review for sockets, session paths, per-app env vars, and web-server upstream coupling."
    ],
    remainingRisks: [
      "Pool definitions under /etc/php/*/fpm/pool.d hold per-app tuning that operators write by hand.",
      "Socket vs TCP listener choice impacts nginx/apache upstream blocks.",
      "Pool env vars can contain application secrets and must be redacted before reports are shared."
    ],
    batch: 6
  },
  "certbot-letsencrypt": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Stub aliased to certbot-ssl via `alternativeOf`; both share `security.tls.certbot`.",
      "Carved out so the catalog reflects the ACME-only naming used in operator runbooks."
    ],
    remainingRisks: [
      "Certificate private keys under /etc/letsencrypt require explicit operator confirmation before transport."
    ],
    reviewerNotes: "Drop-in alternative for certbot-ssl; UI surfaces both as the same capability.",
    batch: 7
  },
  "systemd-resolved": {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "detect-only",
    reasons: [
      "Detect-only stub introduced during the Catalog Audit Enforcement phase.",
      "Used by the conflict detector to surface DNS resolver overlap with Pi-hole / AdGuard Home.",
      "Privileged sensitivity recorded because disabling DNSStubListener affects the entire host's name resolution."
    ],
    remainingRisks: [
      "Disabling the DNSStubListener rewrites /etc/resolv.conf -- operator must verify nothing else relies on 127.0.0.53:53.",
      "When pihole or adguard-home is queued in the same plan, planner emits a `dns-resolver` block conflict that must be resolved before apply."
    ],
    reviewerNotes: "Conflict-only stub; never installed by EnvForge -- detection drives the dns-resolver conflict rule.",
    batch: 7
  }
};

function batch20FullMigrationRecord(input: {
  detect: string;
  config: string;
  data: string;
  validate: string;
  remainingRisks: string[];
  reviewerNotes?: string;
}): CatalogAuditRecord {
  return {
    status: "pass",
    originalSupportLevel: "detect-only",
    finalSupportLevel: "full-migration",
    reasons: [
      input.detect,
      input.config,
      input.data,
      input.validate
    ],
    remainingRisks: input.remainingRisks,
    ...(input.reviewerNotes ? { reviewerNotes: input.reviewerNotes } : {}),
    batch: 20
  };
}

Object.assign(catalogAuditRecords, {
  "vaultwarden": batch20FullMigrationRecord({
    detect: "Detect covers Vaultwarden container evidence, Docker runtime, HTTP port, compose files, and vw-data paths.",
    config: "Config covers compose/env files with ADMIN_TOKEN, SMTP, and database secret patterns.",
    data: "Data strategy: reviewed backup/export for SQLite/PostgreSQL vault data plus attachment directory handling.",
    validate: "Validate uses the Vaultwarden alive endpoint or container presence check.",
    remainingRisks: [
      "Password-vault data and attachments are highly sensitive and require explicit export/backup review.",
      "ADMIN_TOKEN, SMTP credentials, and database URL must be redacted and confirmed."
    ],
    reviewerNotes: "Specific self-hosted app, not a panel; promoted with secret and data approval gates."
  }),
  "pihole": batch20FullMigrationRecord({
    detect: "Detect covers Pi-hole Docker/runtime evidence, DNS/Web ports, compose files, and etc-pihole paths.",
    config: "Config covers compose/env and Pi-hole config files with WEBPASSWORD/admin secret patterns.",
    data: "Data strategy: manual DNS cutover plus gravity/custom-list/DHCP scope review.",
    validate: "Validate checks the admin endpoint or Pi-hole container presence.",
    remainingRisks: [
      "Pi-hole owns UDP/TCP 53 and conflicts with AdGuard Home or systemd-resolved DNSStubListener.",
      "DHCP mode, custom lists, gravity data, and admin password hashes require operator review."
    ],
    reviewerNotes: "Promoted as a DNS app with explicit DNS cutover gates; conflict rules block resolver overlap."
  }),
  "authentik": batch20FullMigrationRecord({
    detect: "Detect covers Authentik Docker/runtime evidence, ports 9000/9443, compose files, and Postgres/Redis volumes.",
    config: "Config covers compose/env files with AUTHENTIK_SECRET_KEY, database, SMTP, and client secret patterns.",
    data: "Data strategy: blueprint export/import or approved DB backup plus outpost and media review.",
    validate: "Validate uses Authentik health readiness endpoint or container presence check.",
    remainingRisks: [
      "Identity-provider users, groups, flows, providers, and outposts need version-aware export/restore.",
      "AUTHENTIK_SECRET_KEY, OIDC/SAML secrets, SMTP credentials, and token material require explicit review."
    ],
    reviewerNotes: "SSO provider; planner warns when queued with Keycloak/Authelia."
  }),
  "wikijs": batch20FullMigrationRecord({
    detect: "Detect covers Wiki.js container evidence, Docker runtime, port 3000, compose files, and database volume hints.",
    config: "Config covers compose/env files with DB, session, and auth-provider secret patterns.",
    data: "Data strategy: database backup/export plus uploads and optional git sync repository review.",
    validate: "Validate checks Wiki.js health endpoint or container presence.",
    remainingRisks: [
      "Markdown content, uploads, and git-sync repositories must be backed up consistently.",
      "Auth provider secrets and search/index plugins require target-specific review."
    ]
  }),
  "n8n": batch20FullMigrationRecord({
    detect: "Detect covers n8n container evidence, Docker runtime, port 5678, compose files, and n8n data volume.",
    config: "Config covers compose/env files with encryption key, webhook, queue, and DB secret patterns.",
    data: "Data strategy: workflow/credential database backup plus binary-data storage review.",
    validate: "Validate checks n8n health endpoint or container presence.",
    remainingRisks: [
      "N8N_ENCRYPTION_KEY must remain consistent or stored credentials become unreadable.",
      "Webhook URLs, queue mode, external DB settings, and binary file storage require review."
    ]
  }),
  "bookstack": batch20FullMigrationRecord({
    detect: "Detect covers BookStack container evidence, Docker runtime, HTTP port, compose files, and app/database volumes.",
    config: "Config covers compose/env files with APP_KEY, DB_PASSWORD, mail, and auth-provider secret patterns.",
    data: "Data strategy: database backup plus uploads/images and APP_KEY continuity review.",
    validate: "Validate checks BookStack login endpoint or container presence.",
    remainingRisks: [
      "APP_KEY, database state, uploads, images, and mail/OIDC settings must be moved consistently.",
      "Database engine/version and filesystem permissions require review."
    ]
  }),
  "home-assistant": batch20FullMigrationRecord({
    detect: "Detect covers Home Assistant container evidence, Docker runtime, port 8123, compose files, and config directory.",
    config: "Config covers configuration.yaml, secrets.yaml, compose/env files, and integration secret patterns.",
    data: "Data strategy: manual review for recorder DB, secrets.yaml, and hardware-bound integrations.",
    validate: "Validate checks Home Assistant HTTP endpoint or container presence.",
    remainingRisks: [
      "USB/Zigbee/Z-Wave device bindings and host networking are target-specific.",
      "secrets.yaml, long-lived tokens, recorder database, and cloud integrations require review."
    ]
  }),
  "gitlab-ce": batch20FullMigrationRecord({
    detect: "Detect covers GitLab CE container evidence, Docker runtime, SSH/HTTP/registry ports, compose files, and gitlab data volumes.",
    config: "Config covers gitlab.rb, compose/env files, and gitlab-secrets.json patterns.",
    data: "Data strategy: gitlab-backup create/restore with source/target version compatibility.",
    validate: "Validate checks GitLab health endpoint or container presence.",
    remainingRisks: [
      "Repositories, LFS, registry data, CI variables, and database state must move through GitLab backup tooling.",
      "gitlab-secrets.json and initial/root credentials are secret material."
    ],
    reviewerNotes: "Large privileged DevOps app; promoted only with backup and secret gates."
  }),
  "umami": batch20FullMigrationRecord({
    detect: "Detect covers Umami container evidence, Docker runtime, port 3000, compose files, and PostgreSQL volume hints.",
    config: "Config covers compose/env files with DATABASE_URL and APP_SECRET patterns.",
    data: "Data strategy: PostgreSQL backup/restore plus tracking-domain and retention review.",
    validate: "Validate checks Umami heartbeat endpoint or container presence.",
    remainingRisks: [
      "Analytics database, website IDs, APP_SECRET, and tracker script/domain choices require review.",
      "Retention policy and privacy/GDPR settings are operator-owned."
    ]
  }),
  "nocodb": batch20FullMigrationRecord({
    detect: "Detect covers NocoDB container evidence, Docker runtime, port 8080, compose files, and nc_data paths.",
    config: "Config covers compose/env files with JWT, DB, webhook, and external connection secret patterns.",
    data: "Data strategy: metadata database backup plus upload and external-base credential review.",
    validate: "Validate checks NocoDB health endpoint or container presence.",
    remainingRisks: [
      "Metadata DB, uploads, JWT secret, webhook settings, and external DB credentials must be reviewed.",
      "Connections to existing MySQL/PostgreSQL/SQLite bases are outside raw copy scope."
    ]
  }),
  "adguard-home": batch20FullMigrationRecord({
    detect: "Detect covers AdGuard Home container evidence, Docker runtime, DNS/Web ports, compose files, and config/work directories.",
    config: "Config covers AdGuardHome.yaml and compose/env files with user-hash, DoH/DoT, and upstream secret patterns.",
    data: "Data strategy: manual DNS cutover plus query-log, filter, and encrypted DNS certificate review.",
    validate: "Validate checks AdGuard Home control status endpoint or container presence.",
    remainingRisks: [
      "AdGuard Home owns UDP/TCP 53 and conflicts with Pi-hole or systemd-resolved DNSStubListener.",
      "User hashes, DoH/DoT certificates, query logs, and upstream DNS settings require review."
    ],
    reviewerNotes: "Promoted as a DNS app with explicit DNS cutover gates; conflict rules block resolver overlap."
  }),
  "docker-mailserver": batch20FullMigrationRecord({
    detect: "Detect covers docker-mailserver container evidence, Docker runtime, SMTP/IMAP ports, compose files, and mail data paths.",
    config: "Config covers compose/env and mailserver config files with DKIM, LDAP, TLS, and account secret patterns.",
    data: "Data strategy: manual maildir/account backup plus DNS reputation and DKIM/TLS secret review.",
    validate: "Validate checks mailserver container presence or active mail ports.",
    remainingRisks: [
      "Maildir data, account state, DKIM private keys, TLS material, spam policy, and Fail2Ban state need explicit review.",
      "A/MX/SPF/DKIM/DMARC/MTA-STS DNS and IP reputation cutover are operator-owned."
    ],
    reviewerNotes: "Privileged mail system; full-migration means reviewed plan generation, not blind maildir copy."
  }),
  "onlyoffice-docs": batch20FullMigrationRecord({
    detect: "Detect covers OnlyOffice Document Server container evidence, Docker runtime, HTTP ports, compose files, and dependency volumes.",
    config: "Config covers compose/env files with JWT, PostgreSQL, and RabbitMQ secret patterns.",
    data: "Data strategy: backup/review for PostgreSQL, RabbitMQ, document cache, fonts, and plugin state.",
    validate: "Validate checks OnlyOffice healthcheck endpoint or container presence.",
    remainingRisks: [
      "JWT_SECRET must stay aligned with Nextcloud/other integrating apps.",
      "PostgreSQL, RabbitMQ, document cache, fonts, and plugin dependencies require review."
    ]
  }),
  "immich": batch20FullMigrationRecord({
    detect: "Detect covers Immich server/ML container evidence, Docker runtime, port 2283, compose files, and upload/database paths.",
    config: "Config covers compose/env files with DB, JWT, object storage, and ML secret patterns.",
    data: "Data strategy: photo-library transfer plus PostgreSQL/vector-extension backup and ML cache review.",
    validate: "Validate checks Immich server ping endpoint or container presence.",
    remainingRisks: [
      "Photo uploads, external library mounts, database/vector extension state, and object storage settings must be reviewed.",
      "Immich version compatibility matters during database restore."
    ]
  }),
  "forgejo": batch20FullMigrationRecord({
    detect: "Detect covers Forgejo container evidence, Docker runtime, ports 3000/2222, compose files, and repository/data paths.",
    config: "Config covers app.ini, compose/env files, and Forgejo secret patterns.",
    data: "Data strategy: Forgejo dump/restore for repositories, LFS, hooks, database state, and app.ini secrets.",
    validate: "Validate checks Forgejo health endpoint or container presence.",
    remainingRisks: [
      "Repositories, LFS objects, hooks, database state, and app.ini secrets must move consistently.",
      "OAuth providers, webhooks, SSH port, and ROOT_URL require target review."
    ]
  }),
  "uptime-kuma": batch20FullMigrationRecord({
    detect: "Detect covers Uptime Kuma container evidence, Docker runtime, port 3001, compose files, and kuma data volume.",
    config: "Config covers compose/env files and notifier/webhook secret patterns.",
    data: "Data strategy: SQLite database backup plus notifier credentials and status-page domain review.",
    validate: "Validate checks Uptime Kuma HTTP endpoint or container presence.",
    remainingRisks: [
      "kuma.db stores monitors, status pages, notification credentials, and user data.",
      "Docker socket monitors and external endpoint reachability are target-specific."
    ]
  }),
  "paperless-ngx": batch20FullMigrationRecord({
    detect: "Detect covers Paperless-ngx container evidence, Docker runtime, port 8000, compose files, and data/media paths.",
    config: "Config covers compose/env files with PAPERLESS_SECRET_KEY, DB, Redis, mail, and OCR patterns.",
    data: "Data strategy: document media plus PostgreSQL metadata backup and Redis broker review.",
    validate: "Validate checks Paperless API endpoint or container presence.",
    remainingRisks: [
      "Document media, consume/export directories, database metadata, Redis broker state, and OCR language packs require review.",
      "PAPERLESS_SECRET_KEY and mail credentials must be handled as secrets."
    ]
  }),
  "navidrome": batch20FullMigrationRecord({
    detect: "Detect covers Navidrome container evidence, Docker runtime, port 4533, compose files, and music/data paths.",
    config: "Config covers compose/env files with music folder, data folder, and external API secret patterns.",
    data: "Data strategy: manual review for music bind mounts plus SQLite metadata and cache backup.",
    validate: "Validate checks Navidrome ping endpoint or container presence.",
    remainingRisks: [
      "Music folders are operator-owned bind mounts and may be too large for EnvForge transport.",
      "SQLite metadata, cover cache, Last.fm/Spotify secrets, and permissions require review."
    ]
  }),
  "audiobookshelf": batch20FullMigrationRecord({
    detect: "Detect covers Audiobookshelf container evidence, Docker runtime, port 13378, compose files, and library/config paths.",
    config: "Config covers compose/env files with token, JWT, SMTP, and password secret patterns.",
    data: "Data strategy: manual review for audiobook/podcast bind mounts plus metadata and user progress backup.",
    validate: "Validate checks Audiobookshelf ping endpoint or container presence.",
    remainingRisks: [
      "Audiobook/podcast libraries are operator-owned bind mounts and need explicit scope review.",
      "Metadata, user progress, podcast feeds, and auth tokens require backup/restore review."
    ]
  }),
  "freshrss": batch20FullMigrationRecord({
    detect: "Detect covers FreshRSS container evidence, Docker runtime, HTTP port, compose files, and data/database paths.",
    config: "Config covers compose/env files with DB, OIDC, API, and feed secret patterns.",
    data: "Data strategy: DB backup or OPML export/import plus API token and feed credential review.",
    validate: "Validate checks FreshRSS web endpoint or container presence.",
    remainingRisks: [
      "Users, OPML/feed lists, Fever/API tokens, cron settings, and feed credentials require review.",
      "Database engine choice and multi-user restore order are target-specific."
    ]
  })
});
