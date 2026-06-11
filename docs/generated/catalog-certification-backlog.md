# Capability Certification Backlog

Generated from `docs/generated/catalog-certification.json` at 2026-06-11T08:34:00.136Z.

> The long-term goal is for every capability the platform retains to be Full Migration Certified.
> Until then, end users only see the items in the **Currently certified** list. Everything else
> stays hidden in the admin registry. Open upgrade-backlog items are actionable; terminal
> decision items are intentionally blocked, archive candidates, or pending product policy.

## Totals

- catalog : **119**
- certified : **105**
- not-ready : **14**
- open upgrade backlog : **0**
- terminal decisions : **14**
  - blocked : **5**
  - archive-candidate : **3**
  - needs-human-decision : **6**

## Currently certified

- **node-runtime-profile** (`runtime.nodejs`) — score 100/100
- **docker-host-profile** (`container.docker`) — score 100/100
- **ssh-hardening** (`security.ssh`) — score 100/100
- **nginx-web-service** (`web-server.nginx`) — score 100/100
- **postgres-profile** (`database.postgresql`) — score 100/100
- **firewall-baseline** (`security.firewall.ufw`) — score 100/100
- **python-toolchain** (`runtime.python`) — score 100/100
- **redis-server** (`cache.redis`) — score 100/100
- **mysql-server** (`database.mysql`) — score 100/100
- **golang-runtime** (`runtime.go`) — score 100/100
- **openjdk-runtime** (`runtime.java`) — score 100/100
- **rust-toolchain** (`runtime.rust`) — score 100/100
- **git-version-control** (`developer.git`) — score 100/100
- **certbot-ssl** (`security.tls.certbot`) — score 100/100
- **fail2ban-protection** (`security.fail2ban`) — score 100/100
- **prometheus-monitoring** (`observability.metrics.prometheus`) — score 100/100
- **grafana-dashboard** (`observability.dashboard.grafana`) — score 100/100
- **mongodb** (`database.mongodb`) — score 100/100
- **rabbitmq** (`messaging.amqp.rabbitmq`) — score 100/100
- **wireguard-vpn** (`network.vpn.wireguard`) — score 100/100
- **netdata-monitoring** (`observability.metrics.netdata`) — score 100/100
- **minio-storage** (`storage.object.minio`) — score 100/100
- **traefik-proxy** (`network.reverse-proxy.traefik`) — score 100/100
- **elasticsearch** (`database.search.elasticsearch`) — score 100/100
- **htop-tools** (`ops.monitoring.tools`) — score 100/100
- **swap-config** (`system.swap`) — score 100/100
- **mariadb** (`database.mysql`) — score 100/100
- **nodejs-version-mgr** (`runtime.nodejs.nvm`) — score 100/100
- **pyenv-toolchain** (`runtime.python.pyenv`) — score 100/100
- **zsh-shell** (`shell.zsh`) — score 100/100
- **neovim-editor** (`developer.neovim`) — score 100/100
- **tmux-multiplex** (`developer.tmux`) — score 100/100
- **ansible-tool** (`developer.ansible`) — score 100/100
- **nextcloud** (`app.nextcloud`) — score 100/100
- **gitea-server** (`developer.gitea`) — score 100/100
- **jellyfin-media** (`app.media.jellyfin`) — score 100/100
- **samba-share** (`fs.share.samba`) — score 100/100
- **rsync-tools** (`ops.backup.rsync`) — score 100/100
- **mosquitto-mqtt** (`messaging.mqtt.mosquitto`) — score 100/100
- **zabbix-monitoring** (`observability.metrics.zabbix`) — score 100/100
- **dotnet-runtime** (`runtime.dotnet`) — score 100/100
- **php-toolchain** (`runtime.php`) — score 100/100
- **ruby-toolchain** (`runtime.ruby`) — score 100/100
- **code-server** (`developer.code-server`) — score 100/100
- **fish-shell** (`shell.fish`) — score 100/100
- **jenkins-ci** (`ci.jenkins`) — score 100/100
- **gitlab-runner** (`ci.gitlab-runner`) — score 100/100
- **vault-secrets** (`security.secrets.vault`) — score 100/100
- **terraform-iac** (`developer.terraform`) — score 100/100
- **kubernetes-tools** (`developer.kubectl`) — score 100/100
- **loki-logging** (`observability.logs.loki`) — score 100/100
- **openvpn-server** (`network.vpn.openvpn`) — score 100/100
- **haproxy-lb** (`network.load-balancer.haproxy`) — score 100/100
- **sonarqube** (`developer.sonarqube`) — score 100/100
- **rust-cli-tools** (`developer.cli-tools`) — score 100/100
- **memcached** (`cache.memcached`) — score 100/100
- **flutter-sdk** (`developer.flutter`) — score 100/100
- **nodejs-pm2** (`runtime.nodejs.pm2`) — score 100/100
- **openresty** (`web-server.openresty`) — score 100/100
- **nethogs-bandwidth** (`network.monitoring.tools`) — score 100/100
- **firewalld** (`security.firewall.firewalld`) — score 100/100
- **vaultwarden** (`app.password.vaultwarden`) — score 100/100
- **caddy-server** (`web-server.caddy`) — score 100/100
- **pihole** (`app.dns.pihole`) — score 100/100
- **authentik** (`security.sso.authentik`) — score 100/100
- **meilisearch** (`database.search.meilisearch`) — score 100/100
- **wikijs** (`app.docs.wikijs`) — score 100/100
- **n8n** (`app.automation.n8n`) — score 100/100
- **valkey-server** (`cache.valkey`) — score 100/100
- **clickhouse** (`database.olap.clickhouse`) — score 100/100
- **influxdb** (`database.timeseries.influxdb`) — score 100/100
- **bookstack** (`app.docs.bookstack`) — score 100/100
- **home-assistant** (`app.home.home-assistant`) — score 100/100
- **gitlab-ce** (`developer.gitlab`) — score 100/100
- **umami** (`app.analytics.umami`) — score 100/100
- **nocodb** (`app.nocodb`) — score 100/100
- **nfs-server** (`fs.share.nfs`) — score 100/100
- **adguard-home** (`app.dns.adguard-home`) — score 100/100
- **tailscale** (`network.vpn.tailscale`) — score 100/100
- **keycloak** (`security.sso.keycloak`) — score 100/100
- **authelia** (`security.sso.authelia`) — score 100/100
- **docker-mailserver** (`app.mail.docker-mailserver`) — score 100/100
- **onlyoffice-docs** (`app.office.onlyoffice`) — score 100/100
- **immich** (`app.photos.immich`) — score 100/100
- **forgejo** (`developer.forgejo`) — score 100/100
- **k3s** (`container.kubernetes.k3s`) — score 100/100
- **uptime-kuma** (`observability.uptime-kuma`) — score 100/100
- **homepage** (`catalog.homepage`) — score 100/100
- **paperless-ngx** (`app.docs.paperless`) — score 100/100
- **navidrome** (`app.media.navidrome`) — score 100/100
- **audiobookshelf** (`app.media.audiobookshelf`) — score 100/100
- **freshrss** (`app.rss.freshrss`) — score 100/100
- **stirling-pdf** (`catalog.stirling-pdf`) — score 100/100
- **mealie** (`catalog.mealie`) — score 100/100
- **linkwarden** (`catalog.linkwarden`) — score 100/100
- **seafile** (`catalog.seafile`) — score 100/100
- **apache-httpd** (`web-server.apache`) — score 100/100
- **php-fpm** (`runtime.php-fpm`) — score 100/100
- **lamp-stack** (`catalog.lamp-stack`) — score 100/100
- **lemp-stack** (`catalog.lemp-stack`) — score 100/100
- **node-production-deploy** (`catalog.node-production-deploy`) — score 100/100
- **docker-compose-dev** (`catalog.docker-compose-dev`) — score 100/100
- **security-baseline** (`catalog.security-baseline`) — score 100/100
- **monitoring-stack** (`catalog.monitoring-stack`) — score 100/100
- **sso-stack** (`catalog.sso-stack`) — score 100/100

## Open upgrade backlog

_No open upgrade-backlog items remain. All hidden not-ready items have explicit terminal decisions._

## Terminal decisions

### blocked - 5 item(s)

#### cockpit-panel - score 31/100

- capabilityKey: `ops.panel.cockpit`
- category: service
- reason: server-panel-style administration UI; catalog quality gate forbids Full Migration certification for panels.
- blockers:
  - blocked: server-panel-style administration UI; catalog quality gate forbids Full Migration certification for panels.
- hidden from end users: yes

#### portainer - score 23/100

- capabilityKey: `ops.panel.portainer`
- category: container
- reason: server-panel-style Docker administration UI; endpoint credentials and docker access must remain operator-controlled.
- blockers:
  - audit support level is detect-only
  - blocked: server-panel-style Docker administration UI; endpoint credentials and docker access must remain operator-controlled.
- hidden from end users: yes

#### filebrowser - score 23/100

- capabilityKey: `catalog.filebrowser`
- category: service
- reason: server-panel-style file manager; scoped roots and account database require operator-owned export decisions.
- blockers:
  - audit support level is detect-only
  - blocked: server-panel-style file manager; scoped roots and account database require operator-owned export decisions.
- hidden from end users: yes

#### x-ui-panel - score 15/100

- capabilityKey: `catalog.x-ui-panel`
- category: network
- reason: network proxy administration panel with credential-bearing SQLite state; keep detect-only until a human migration policy is approved.
- blockers:
  - audit support level is detect-only
  - blocked: network proxy administration panel with credential-bearing SQLite state; keep detect-only until a human migration policy is approved.
- hidden from end users: yes

#### dozzle - score 15/100

- capabilityKey: `catalog.dozzle`
- category: developer
- reason: privileged docker-socket log viewer; stateless review card, not a migratable workload.
- blockers:
  - audit support level is detect-only
  - blocked: privileged docker-socket log viewer; stateless review card, not a migratable workload.
- hidden from end users: yes

### archive-candidate - 3 item(s)

#### certbot-letsencrypt - score 85/100

- capabilityKey: `security.tls.certbot`
- category: security
- reason: legacy alias for certbot-ssl; the canonical certbot-ssl capability is already certified.
- blockers:
  - audit support level is detect-only
  - archive-candidate: legacy alias for certbot-ssl; the canonical certbot-ssl capability is already certified.
- hidden from end users: yes

#### sqlite - score 23/100

- capabilityKey: `database.sqlite`
- category: database
- reason: embedded database engine; meaningful .db files belong to the owning application plan, not a standalone SQLite migration.
- blockers:
  - audit support level is detect-only
  - archive-candidate: embedded database engine; meaningful .db files belong to the owning application plan, not a standalone SQLite migration.
- hidden from end users: yes

#### systemd-resolved - score 15/100

- capabilityKey: `system.dns.systemd-resolved`
- category: network
- reason: conflict-only DNS resolver stub; retained for pihole/adguard conflict detection, not direct user-side apply.
- blockers:
  - audit support level is detect-only
  - archive-candidate: conflict-only DNS resolver stub; retained for pihole/adguard conflict detection, not direct user-side apply.
- hidden from end users: yes

### needs-human-decision - 6 item(s)

#### ai-localllm-stack - score 23/100

- capabilityKey: `catalog.ai-localllm-stack`
- category: service
- reason: uncatalogued GPU/model/runtime prerequisites require a product decision before EnvForge can certify migration.
- blockers:
  - audit support level is detect-only
  - needs-human-decision: uncatalogued GPU/model/runtime prerequisites require a product decision before EnvForge can certify migration.
- hidden from end users: yes

#### mail-stack - score 23/100

- capabilityKey: `catalog.mail-stack`
- category: service
- reason: mail delivery depends on registrar DNS, DKIM, MTA reputation, and mailbox data strategy; keep blocked until a dedicated mail migration policy exists.
- blockers:
  - audit support level is detect-only
  - needs-human-decision: mail delivery depends on registrar DNS, DKIM, MTA reputation, and mailbox data strategy; keep blocked until a dedicated mail migration policy exists.
- hidden from end users: yes

#### selfhost-media - score 23/100

- capabilityKey: `catalog.selfhost-media`
- category: service
- reason: large media bind mounts and hardware acceleration are operator-specific; aggregate combo should not promise one-shot migration.
- blockers:
  - audit support level is detect-only
  - needs-human-decision: large media bind mounts and hardware acceleration are operator-specific; aggregate combo should not promise one-shot migration.
- hidden from end users: yes

#### selfhost-pkm - score 23/100

- capabilityKey: `catalog.selfhost-pkm`
- category: service
- reason: aggregate PKM combo spans multiple app backup models; certify child apps separately before exposing the combo.
- blockers:
  - audit support level is detect-only
  - needs-human-decision: aggregate PKM combo spans multiple app backup models; certify child apps separately before exposing the combo.
- hidden from end users: yes

#### selfhost-essentials - score 15/100

- capabilityKey: `catalog.selfhost-essentials`
- category: service
- reason: broad combo still includes multiple high-risk components and should be decomposed into certified child plans.
- blockers:
  - audit support level is detect-only
  - needs-human-decision: broad combo still includes multiple high-risk components and should be decomposed into certified child plans.
- hidden from end users: yes

#### homelab-dashboard - score 15/100

- capabilityKey: `catalog.homelab-dashboard`
- category: service
- reason: combo contains panel/log-viewer components; split into certified app cards and keep the aggregate hidden.
- blockers:
  - audit support level is detect-only
  - needs-human-decision: combo contains panel/log-viewer components; split into certified app cards and keep the aggregate hidden.
- hidden from end users: yes
