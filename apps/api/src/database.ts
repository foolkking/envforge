import fs from "node:fs/promises";
import path from "node:path";
import type { CatalogItem } from "./catalog.js";
import { listCatalogItems } from "./catalog.js";
import { catalogAuditRecords } from "./catalog-audit-records.js";
import { resolveFromRoot } from "./repo.js";

export interface AppDatabase {
  schemaVersion: string;
  catalog: CatalogItem[];
  migrationStrategies: MigrationStrategy[];
}

export interface MigrationStrategy {
  id: string;
  name: string;
  source: string;
  useCase: string;
  conflictModes: Array<"skip-existing" | "replace-existing">;
}

const seedPath = "configs/database/seed.json";

export async function readDatabase(): Promise<AppDatabase> {
  const absolutePath = resolveFromRoot(seedPath);

  try {
    const raw = await fs.readFile(absolutePath, "utf8");
    return normalizeDatabase(JSON.parse(raw) as AppDatabase);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const seeded = createSeedDatabase();
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, `${JSON.stringify(seeded, null, 2)}\n`, "utf8");
    return seeded;
  }
}

function normalizeDatabase(database: AppDatabase): AppDatabase {
  return {
    ...database,
    catalog: database.catalog.length ? database.catalog : listCatalogItems()
  };
}

export async function listCatalogFromDatabase(): Promise<CatalogItem[]> {
  const baseline = (await readDatabase()).catalog;
  const { mergeCatalog } = await import("./catalog-overrides.js");
  const { readRuntimeDatabase } = await import("./runtime-store.js");
  const rdb = await readRuntimeDatabase();
  return mergeCatalog(baseline, rdb.catalogOverrides).map(withCapabilityMetadata);
}

export async function getCatalogItemFromDatabase(id: string): Promise<CatalogItem | undefined> {
  return (await listCatalogFromDatabase()).find((item) => item.id === id);
}

export async function readCatalogGuide(id: string): Promise<{
  item: CatalogItem;
  markdown: string;
}> {
  const item = await getCatalogItemFromDatabase(id);
  if (!item) {
    throw new Error(`Catalog item not found: ${id}`);
  }

  // Override-aware: prefer admin-edited markdown, fall back to baseline guidePath
  const { loadOverrideMarkdown } = await import("./catalog-overrides.js");
  const overrideMd = await loadOverrideMarkdown(id);
  if (overrideMd !== null) return { item, markdown: overrideMd };

  try {
    const markdown = await fs.readFile(resolveFromRoot(item.guidePath), "utf8");
    return { item, markdown };
  } catch {
    // No baseline guide either — return empty
    return { item, markdown: "" };
  }
}

export async function listMigrationStrategies(): Promise<MigrationStrategy[]> {
  return (await readDatabase()).migrationStrategies;
}

function createSeedDatabase(): AppDatabase {
  return {
    schemaVersion: "0.2.0",
    catalog: listCatalogItems(),
    migrationStrategies: [
      {
        id: "windows-usmt",
        name: "Windows User State Migration Tool style",
        source: "Microsoft USMT",
        useCase: "迁移用户文件、桌面偏好、应用设置和系统偏好，适合 Windows 到 Windows。",
        conflictModes: ["skip-existing", "replace-existing"]
      },
      {
        id: "rsync-home",
        name: "rsync home directory style",
        source: "rsync",
        useCase: "复制用户主目录、dotfiles 和应用数据目录，适合 Linux/macOS/SSH。",
        conflictModes: ["skip-existing", "replace-existing"]
      },
      {
        id: "declarative-profile",
        name: "Declarative profile style",
        source: "chezmoi / Home Manager",
        useCase: "用声明式清单恢复软件、alias、shell profile 和开发偏好，适合公开或半公开配置。",
        conflictModes: ["skip-existing", "replace-existing"]
      }
    ]
  };
}

function withCapabilityMetadata(item: CatalogItem): CatalogItem {
  const capabilityKey = item.capabilityKey ?? capabilityKeyForCatalogId(item.id);
  const rule = ruleMetadataForCapabilityKey(capabilityKey);
  const configAware = item.components.some((component) => component.type === "system-config");

  // Resolve supportLevel:
  //   1. explicit field on the item (admin override)
  //   2. registered capability rule
  //   3. fallback: items without a registered capability key get
  //      `detect-only` so EnvForge never promises a clean rebuild for an
  //      unaudited capability. The legacy heuristic that promoted any
  //      configAware item to managed-config was too generous and caused
  //      "looks-installable" cards in the UI; managed-config now requires
  //      an explicit rule entry.
  const supportLevel: NonNullable<CatalogItem["supportLevel"]> =
    item.supportLevel ?? rule?.supportLevel ?? "detect-only";

  // V2 audit metadata: read from catalog-audit-records.ts. Items not yet
  // audited get a synthetic `pending` record so the UI can render
  // progress.
  const auditRecord = catalogAuditRecords[item.id];
  const audit: NonNullable<CatalogItem["audit"]> = auditRecord
    ? { ...auditRecord }
    : { status: "pending", originalSupportLevel: supportLevel, finalSupportLevel: supportLevel, reasons: ["Not yet audited under V2."], batch: 0 };

  return {
    ...item,
    capabilityKey,
    supportLevel,
    modeSupport: item.modeSupport ?? {
      migrate: supportLevel !== "detect-only",
      build: supportLevel !== "detect-only",
      maintain: supportLevel === "managed-config" || supportLevel === "full-migration"
    },
    managedActions: item.managedActions ?? [
      "detect",
      ...(supportLevel !== "detect-only" ? ["install"] as const : []),
      ...(supportLevel === "managed-config" || supportLevel === "full-migration" ? ["config-read", "validate", "rollback"] as const : []),
      ...(supportLevel === "full-migration" ? ["config-migrate", "data-strategy"] as const : [])
    ],
    sensitivity: item.sensitivity === "safe" && rule?.security?.risk === "privileged" ? "privileged" : item.sensitivity,
    audit,
    // configAware lookup retained as a hint; future planners can use it to
    // surface "this card has system-config components but no capability
    // rule yet" warnings.
    ...(configAware ? {} : {})
  };
}

/**
 * Capability key registry — every visible catalog item gets an explicit
 * mapping so detection rules and visible cards stay in sync.
 *
 * EnvForge separates "what the user sees" (the catalog item) from "what the
 * detection / migration rule promises" (the capability rule). Two cards
 * with different ids may share one capabilityKey when they describe the same
 * underlying capability (e.g. `mysql-server` and `mariadb` both map to
 * `database.mysql`). When a card has no real rule yet, the synthetic key
 * `catalog.<id>` is used so the rule lookup table can still record it as
 * `detect-only`.
 *
 * P2 audit: every item in the static catalog appears here. New items must
 * be added to {@link catalogCapabilityKeys} and to {@link capabilitySupport}
 * in the same change.
 */
const catalogCapabilityKeys: Record<string, string> = {
  // 10 deeply-supported capabilities
  "nginx-web-service": "web-server.nginx",
  "docker-host-profile": "container.docker",
  "postgres-profile": "database.postgresql",
  "mysql-server": "database.mysql",
  "mariadb": "database.mysql",
  "redis-server": "cache.redis",
  "node-runtime-profile": "runtime.nodejs",
  "python-toolchain": "runtime.python",
  "ssh-hardening": "security.ssh",
  "firewall-baseline": "security.firewall.ufw",
  "fail2ban-protection": "security.fail2ban",

  // managed-config: capabilities with config paths, validation, backups
  "openresty": "web-server.openresty",
  "haproxy-lb": "network.load-balancer.haproxy",
  "traefik-proxy": "network.reverse-proxy.traefik",
  "certbot-ssl": "security.tls.certbot",
  "wireguard-vpn": "network.vpn.wireguard",
  "openvpn-server": "network.vpn.openvpn",
  "samba-share": "fs.share.samba",
  "nfs-server": "fs.share.nfs",
  "tailscale": "network.vpn.tailscale",
  "keycloak": "security.sso.keycloak",
  "authelia": "security.sso.authelia",
  "k3s": "container.kubernetes.k3s",
  "mosquitto-mqtt": "messaging.mqtt.mosquitto",  "rabbitmq": "messaging.amqp.rabbitmq",
  "mongodb": "database.mongodb",
  "memcached": "cache.memcached",
  "elasticsearch": "database.search.elasticsearch",
  "minio-storage": "storage.object.minio",
  "prometheus-monitoring": "observability.metrics.prometheus",
  "grafana-dashboard": "observability.dashboard.grafana",
  "loki-logging": "observability.logs.loki",
  "netdata-monitoring": "observability.metrics.netdata",
  "zabbix-monitoring": "observability.metrics.zabbix",
  "jenkins-ci": "ci.jenkins",
  "gitlab-runner": "ci.gitlab-runner",
  "vault-secrets": "security.secrets.vault",
  "cockpit-panel": "ops.panel.cockpit",
  "swap-config": "system.swap",
  "firewalld": "security.firewall.firewalld",
  "caddy-server": "web-server.caddy",
  "valkey-server": "cache.valkey",
  "clickhouse": "database.olap.clickhouse",
  "influxdb": "database.timeseries.influxdb",
  "meilisearch": "database.search.meilisearch",

  // basic-rebuild: runtime / language toolchain / dev tools
  "golang-runtime": "runtime.go",
  "openjdk-runtime": "runtime.java",
  "rust-toolchain": "runtime.rust",
  "dotnet-runtime": "runtime.dotnet",
  "php-toolchain": "runtime.php",
  "ruby-toolchain": "runtime.ruby",
  "nodejs-version-mgr": "runtime.nodejs.nvm",
  "pyenv-toolchain": "runtime.python.pyenv",
  "git-version-control": "developer.git",
  "ansible-tool": "developer.ansible",
  "terraform-iac": "developer.terraform",
  "kubernetes-tools": "developer.kubectl",
  "flutter-sdk": "developer.flutter",
  "nodejs-pm2": "runtime.nodejs.pm2",
  "code-server": "developer.code-server",
  "sonarqube": "developer.sonarqube",
  "rust-cli-tools": "developer.cli-tools",
  "rsync-tools": "ops.backup.rsync",
  "zsh-shell": "shell.zsh",
  "fish-shell": "shell.fish",
  "neovim-editor": "developer.neovim",
  "tmux-multiplex": "developer.tmux",
  "htop-tools": "ops.monitoring.tools",
  "nethogs-bandwidth": "network.monitoring.tools",

  // detect-only / installable apps where EnvForge cannot promise full migration
  "sqlite": "database.sqlite",
  "nextcloud": "app.nextcloud",
  "gitea-server": "developer.gitea",
  "portainer": "ops.panel.portainer",
  "jellyfin-media": "app.media.jellyfin",
  "vaultwarden": "app.password.vaultwarden",
  "pihole": "app.dns.pihole",
  "authentik": "security.sso.authentik",
  "wikijs": "app.docs.wikijs",
  "n8n": "app.automation.n8n",
  "bookstack": "app.docs.bookstack",
  "home-assistant": "app.home.home-assistant",
  "gitlab-ce": "developer.gitlab",
  "umami": "app.analytics.umami",
  "nocodb": "app.nocodb",
  "adguard-home": "app.dns.adguard-home",
  "docker-mailserver": "app.mail.docker-mailserver",
  "onlyoffice-docs": "app.office.onlyoffice",
  "immich": "app.photos.immich",
  "forgejo": "developer.forgejo",
  "uptime-kuma": "observability.uptime-kuma",
  "paperless-ngx": "app.docs.paperless",
  "navidrome": "app.media.navidrome",
  "audiobookshelf": "app.media.audiobookshelf",
  "freshrss": "app.rss.freshrss"
};

function capabilityKeyForCatalogId(id: string): string {
  return catalogCapabilityKeys[id] ?? `catalog.${id}`;
}

/**
 * supportLevel + security risk per capability key.
 *
 * The four supportLevels follow the contract in
 * `docs/catalog.md`:
 *
 *   - detect-only: EnvForge can identify the capability but does not plan
 *     changes automatically. Rebuild Plan generation is blocked at the UI.
 *   - basic-rebuild: package install + minimal verification.
 *   - managed-config: detect + install + config paths + validate + backup +
 *     rollback. Migrate / Maintain modes can use this.
 *   - full-migration: all of managed-config plus data strategy, references,
 *     and cross-distro mapping.
 */
const capabilitySupport: Record<string, { supportLevel: NonNullable<CatalogItem["supportLevel"]>; security?: { risk: CatalogItem["sensitivity"] } }> = {
  // full-migration (Batch 1 certified + deeply-supported data/security capabilities)
  "web-server.nginx": { supportLevel: "full-migration", security: { risk: "review" } },
  "container.docker": { supportLevel: "full-migration", security: { risk: "privileged" } },
  "database.postgresql": { supportLevel: "full-migration", security: { risk: "privileged" } },
  "database.mysql": { supportLevel: "full-migration", security: { risk: "privileged" } },
  "cache.redis": { supportLevel: "full-migration", security: { risk: "review" } },
  "runtime.nodejs": { supportLevel: "full-migration", security: { risk: "review" } },
  "runtime.python": { supportLevel: "full-migration", security: { risk: "review" } },
  "security.ssh": { supportLevel: "full-migration", security: { risk: "privileged" } },
  "security.firewall.ufw": { supportLevel: "full-migration", security: { risk: "privileged" } },
  "security.fail2ban": { supportLevel: "full-migration", security: { risk: "review" } },
  "web-server.openresty": { supportLevel: "full-migration", security: { risk: "review" } },
  "network.reverse-proxy.traefik": { supportLevel: "full-migration", security: { risk: "review" } },
  "web-server.caddy": { supportLevel: "full-migration", security: { risk: "review" } },
  "network.load-balancer.haproxy": { supportLevel: "full-migration", security: { risk: "review" } },
  "web-server.apache": { supportLevel: "full-migration", security: { risk: "review" } },
  "runtime.php-fpm": { supportLevel: "full-migration", security: { risk: "review" } },
  "runtime.php": { supportLevel: "full-migration", security: { risk: "review" } },
  "runtime.ruby": { supportLevel: "full-migration", security: { risk: "review" } },
  "runtime.go": { supportLevel: "full-migration", security: { risk: "review" } },
  "runtime.java": { supportLevel: "full-migration", security: { risk: "review" } },
  "runtime.rust": { supportLevel: "full-migration", security: { risk: "review" } },
  "runtime.dotnet": { supportLevel: "full-migration", security: { risk: "review" } },
  "developer.git": { supportLevel: "full-migration", security: { risk: "review" } },
  "developer.ansible": { supportLevel: "full-migration", security: { risk: "review" } },
  "developer.terraform": { supportLevel: "full-migration", security: { risk: "review" } },
  "developer.kubectl": { supportLevel: "full-migration", security: { risk: "review" } },
  "ops.backup.rsync": { supportLevel: "full-migration", security: { risk: "review" } },
  "ops.monitoring.tools": { supportLevel: "full-migration", security: { risk: "safe" } },
  "shell.zsh": { supportLevel: "full-migration", security: { risk: "safe" } },
  "shell.fish": { supportLevel: "full-migration", security: { risk: "safe" } },
  "developer.neovim": { supportLevel: "full-migration", security: { risk: "safe" } },
  "developer.tmux": { supportLevel: "full-migration", security: { risk: "safe" } },
  "developer.cli-tools": { supportLevel: "full-migration", security: { risk: "safe" } },
  "network.monitoring.tools": { supportLevel: "full-migration", security: { risk: "review" } },
  "cache.memcached": { supportLevel: "full-migration", security: { risk: "review" } },
  "cache.valkey": { supportLevel: "full-migration", security: { risk: "review" } },

  // managed-config
  "security.tls.certbot": { supportLevel: "full-migration", security: { risk: "privileged" } },
  "network.vpn.wireguard": { supportLevel: "full-migration", security: { risk: "privileged" } },
  "network.vpn.openvpn": { supportLevel: "full-migration", security: { risk: "privileged" } },
  "fs.share.samba": { supportLevel: "full-migration", security: { risk: "review" } },
  "fs.share.nfs": { supportLevel: "full-migration", security: { risk: "review" } },
  "network.vpn.tailscale": { supportLevel: "full-migration", security: { risk: "review" } },
  "security.sso.keycloak": { supportLevel: "full-migration", security: { risk: "privileged" } },
  "security.sso.authelia": { supportLevel: "full-migration", security: { risk: "privileged" } },
  "container.kubernetes.k3s": { supportLevel: "full-migration", security: { risk: "privileged" } },
  "messaging.mqtt.mosquitto": { supportLevel: "full-migration", security: { risk: "review" } },
  "messaging.amqp.rabbitmq": { supportLevel: "full-migration", security: { risk: "review" } },
  "database.mongodb": { supportLevel: "full-migration", security: { risk: "review" } },
  "database.search.elasticsearch": { supportLevel: "full-migration", security: { risk: "review" } },
  "storage.object.minio": { supportLevel: "full-migration", security: { risk: "review" } },
  "observability.metrics.prometheus": { supportLevel: "full-migration", security: { risk: "review" } },
  "observability.dashboard.grafana": { supportLevel: "full-migration", security: { risk: "review" } },
  "observability.logs.loki": { supportLevel: "full-migration", security: { risk: "review" } },
  "observability.metrics.netdata": { supportLevel: "full-migration", security: { risk: "review" } },
  "observability.metrics.zabbix": { supportLevel: "full-migration", security: { risk: "review" } },
  "ci.jenkins": { supportLevel: "full-migration", security: { risk: "review" } },
  "ci.gitlab-runner": { supportLevel: "full-migration", security: { risk: "review" } },
  "security.secrets.vault": { supportLevel: "full-migration", security: { risk: "privileged" } },
  "ops.panel.cockpit": { supportLevel: "managed-config", security: { risk: "privileged" } },
  "system.swap": { supportLevel: "full-migration", security: { risk: "privileged" } },
  "security.firewall.firewalld": { supportLevel: "full-migration", security: { risk: "privileged" } },
  "database.olap.clickhouse": { supportLevel: "full-migration", security: { risk: "review" } },
  "database.timeseries.influxdb": { supportLevel: "full-migration", security: { risk: "review" } },
  "database.search.meilisearch": { supportLevel: "full-migration", security: { risk: "review" } },

  // basic-rebuild
  "runtime.nodejs.nvm": { supportLevel: "full-migration", security: { risk: "safe" } },
  "runtime.python.pyenv": { supportLevel: "full-migration", security: { risk: "safe" } },
  "developer.flutter": { supportLevel: "full-migration", security: { risk: "safe" } },
  "runtime.nodejs.pm2": { supportLevel: "full-migration", security: { risk: "review" } },
  "developer.code-server": { supportLevel: "full-migration", security: { risk: "review" } },
  "developer.sonarqube": { supportLevel: "full-migration", security: { risk: "review" } },

  // detect-only — applications EnvForge can recognise but cannot promise to migrate cleanly
  "database.sqlite": { supportLevel: "detect-only", security: { risk: "review" } },
  "catalog.homepage": { supportLevel: "full-migration", security: { risk: "review" } },
  "catalog.stirling-pdf": { supportLevel: "full-migration", security: { risk: "safe" } },
  "catalog.mealie": { supportLevel: "full-migration", security: { risk: "review" } },
  "catalog.linkwarden": { supportLevel: "full-migration", security: { risk: "review" } },
  "catalog.seafile": { supportLevel: "full-migration", security: { risk: "review" } },
  "app.nextcloud": { supportLevel: "full-migration", security: { risk: "review" } },
  "developer.gitea": { supportLevel: "full-migration", security: { risk: "review" } },
  "ops.panel.portainer": { supportLevel: "detect-only", security: { risk: "privileged" } },
  "app.media.jellyfin": { supportLevel: "full-migration", security: { risk: "review" } },
  "app.password.vaultwarden": { supportLevel: "full-migration", security: { risk: "privileged" } },
  "app.dns.pihole": { supportLevel: "full-migration", security: { risk: "privileged" } },
  "security.sso.authentik": { supportLevel: "full-migration", security: { risk: "privileged" } },
  "app.docs.wikijs": { supportLevel: "full-migration", security: { risk: "review" } },
  "app.automation.n8n": { supportLevel: "full-migration", security: { risk: "review" } },
  "app.docs.bookstack": { supportLevel: "full-migration", security: { risk: "review" } },
  "app.home.home-assistant": { supportLevel: "full-migration", security: { risk: "review" } },
  "developer.gitlab": { supportLevel: "full-migration", security: { risk: "privileged" } },
  "app.analytics.umami": { supportLevel: "full-migration", security: { risk: "review" } },
  "app.nocodb": { supportLevel: "full-migration", security: { risk: "review" } },
  "app.dns.adguard-home": { supportLevel: "full-migration", security: { risk: "privileged" } },
  "app.mail.docker-mailserver": { supportLevel: "full-migration", security: { risk: "privileged" } },
  "app.office.onlyoffice": { supportLevel: "full-migration", security: { risk: "review" } },
  "app.photos.immich": { supportLevel: "full-migration", security: { risk: "review" } },
  "developer.forgejo": { supportLevel: "full-migration", security: { risk: "review" } },
  "observability.uptime-kuma": { supportLevel: "full-migration", security: { risk: "review" } },
  "app.docs.paperless": { supportLevel: "full-migration", security: { risk: "review" } },
  "app.media.navidrome": { supportLevel: "full-migration", security: { risk: "review" } },
  "app.media.audiobookshelf": { supportLevel: "full-migration", security: { risk: "review" } },
  "app.rss.freshrss": { supportLevel: "full-migration", security: { risk: "review" } },
  "catalog.lamp-stack": { supportLevel: "full-migration", security: { risk: "review" } },
  "catalog.lemp-stack": { supportLevel: "full-migration", security: { risk: "review" } },
  "catalog.node-production-deploy": { supportLevel: "full-migration", security: { risk: "review" } },
  "catalog.docker-compose-dev": { supportLevel: "full-migration", security: { risk: "review" } },
  "catalog.security-baseline": { supportLevel: "full-migration", security: { risk: "privileged" } },
  "catalog.monitoring-stack": { supportLevel: "full-migration", security: { risk: "review" } },
  "catalog.sso-stack": { supportLevel: "full-migration", security: { risk: "privileged" } },
  // Enforcement-phase additions: critical capability stubs at detect-only
  "system.dns.systemd-resolved": { supportLevel: "detect-only", security: { risk: "privileged" } }
};

function ruleMetadataForCapabilityKey(capabilityKey: string): {
  supportLevel: NonNullable<CatalogItem["supportLevel"]>;
  security?: { risk: CatalogItem["sensitivity"] };
} | undefined {
  return capabilitySupport[capabilityKey];
}
