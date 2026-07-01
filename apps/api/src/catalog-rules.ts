import type { ConfigFileInfo } from "./config-files.js";

export type PackageManager = "apt" | "rpm" | "snap" | "flatpak" | "npm" | "pip" | "gem" | "cargo" | "docker";
export type ConfigSensitivity = "safe" | "review" | "secret";
export type MigrationStrategy = "package-only" | "template-or-copy" | "copy-with-review" | "manual-review";
export type SupportLevel = "detect-only" | "basic-rebuild" | "managed-config" | "full-migration";

export interface CatalogDetectionRule {
  id: string;
  kind: "software";
  displayName: string;
  capabilityKey: string;
  capability: string;
  supportLevel: SupportLevel;
  category: "runtime" | "developer" | "database" | "container" | "security" | "network" | "service";
  detect: {
    packages?: Partial<Record<PackageManager, string[]>>;
    binaries?: string[];
    systemd?: string[];
    ports?: number[];
  };
  config?: {
    files?: string[];
    globs?: string[];
    exclude?: string[];
    maxSizeKB?: number;
    secretPatterns?: string[];
  };
  data?: {
    paths?: string[];
  };
  intentSignals?: {
    high: string[];
    medium: string[];
    low: string[];
  };
  references?: Array<{ pattern: string; type: "configInclude" | "filesystemPath" | "secretFile" | "serviceDependency" | "envFile" }>;
  migrationCompleteness?: {
    configOnly: "complete" | "partial" | "insufficient";
    missingRisks: string[];
  };
  security?: {
    risk: "safe" | "review" | "privileged";
    notes: string[];
  };
  crossDistro?: {
    packageMap: Partial<Record<"apt" | "dnf" | "yum" | "pacman" | "apk", string[]>>;
    serviceMap?: Partial<Record<"debian" | "rhel" | "fedora" | "arch" | "alpine", string[]>>;
  };
  migrate: {
    package: boolean;
    config: boolean;
    data: "none" | "optional" | "recommended";
    strategy: MigrationStrategy;
    restartServices?: string[];
    validate?: string[];
  };
}

const commonSecretPatterns = [
  "password",
  "passwd",
  "token",
  "secret",
  "private_key",
  "BEGIN PRIVATE KEY",
  "AWS_ACCESS_KEY_ID",
  "DATABASE_URL"
];

export type DockerAppRuleInput = {
  id: string;
  displayName: string;
  capabilityKey: string;
  category: CatalogDetectionRule["category"];
  ports?: number[];
  configFiles?: string[];
  configGlobs?: string[];
  dataPaths?: string[];
  secretPatterns?: string[];
  references: NonNullable<CatalogDetectionRule["references"]>;
  missingRisks: string[];
  securityRisk?: NonNullable<CatalogDetectionRule["security"]>["risk"];
  securityNotes: string[];
  validate: string[];
};

export function dockerAppRule(input: DockerAppRuleInput): CatalogDetectionRule {
  return {
    id: input.id,
    kind: "software",
    displayName: input.displayName,
    capabilityKey: input.capabilityKey,
    capability: input.capabilityKey,
    supportLevel: "full-migration",
    category: input.category,
    detect: {
      packages: { docker: [input.id], apt: ["docker.io", "docker-compose-plugin"], rpm: ["docker", "docker-compose-plugin"] },
      binaries: ["docker"],
      ports: input.ports ?? []
    },
    config: {
      files: input.configFiles ?? ["./docker-compose.yml", "./compose.yml", ".env"],
      globs: input.configGlobs ?? [`./${input.id}/**/*.yml`, `./${input.id}/**/*.yaml`, `./${input.id}/**/*.env`],
      maxSizeKB: 512,
      secretPatterns: [...(input.secretPatterns ?? []), ...commonSecretPatterns]
    },
    data: { paths: input.dataPaths ?? [`./${input.id}_data`] },
    intentSignals: defaultIntentSignals(),
    references: input.references,
    migrationCompleteness: { configOnly: "partial", missingRisks: input.missingRisks },
    security: { risk: input.securityRisk ?? "review", notes: input.securityNotes },
    crossDistro: {
      packageMap: {
        apt: ["docker.io", "docker-compose-plugin"],
        dnf: ["docker", "docker-compose-plugin"],
        yum: ["docker", "docker-compose-plugin"],
        pacman: ["docker", "docker-compose"],
        apk: ["docker", "docker-cli-compose"]
      },
      serviceMap: { debian: ["docker"], rhel: ["docker"], fedora: ["docker"], arch: ["docker"], alpine: ["docker"] }
    },
    migrate: {
      package: true,
      config: true,
      data: "optional",
      strategy: "manual-review",
      restartServices: ["docker"],
      validate: input.validate
    }
  };
}

/**
 * nativeRule — archetype factory for native (non-Docker) capabilities:
 * package-based services, databases, runtimes, and security tools.
 *
 * Collapses the ~25-line hand-written CatalogDetectionRule literal to a
 * dozen essential params, defaulting the repetitive scaffolding that was
 * identical across rules:
 *   - kind="software", capability = capabilityKey (override-able)
 *   - intentSignals = defaultIntentSignals()
 *   - config.maxSizeKB = 256, config.secretPatterns = [...extra, ...commonSecretPatterns]
 *   - migrate.package / migrate.config default true
 *
 * Optional keys (data, config.files/globs/exclude, migrate.restartServices)
 * are emitted ONLY when provided, so a runtime rule (no systemd/data) and a
 * database rule (systemd + data) both round-trip exactly. crossDistro
 * (packageMap + serviceMap) is passed through verbatim — distro package
 * names are genuinely per-capability and stay explicit in Phase A.
 */
export type NativeRuleInput = {
  id: string;
  displayName: string;
  capabilityKey: string;
  capability?: string;
  category: CatalogDetectionRule["category"];
  supportLevel?: SupportLevel;
  detect: CatalogDetectionRule["detect"];
  configFiles?: string[];
  configGlobs?: string[];
  configExclude?: string[];
  configMaxSizeKB?: number;
  extraSecretPatterns?: string[];
  dataPaths?: string[];
  references: NonNullable<CatalogDetectionRule["references"]>;
  migrationCompleteness: NonNullable<CatalogDetectionRule["migrationCompleteness"]>;
  security: NonNullable<CatalogDetectionRule["security"]>;
  crossDistro: NonNullable<CatalogDetectionRule["crossDistro"]>;
  migrate: {
    package?: boolean;
    config?: boolean;
    data: CatalogDetectionRule["migrate"]["data"];
    strategy: MigrationStrategy;
    restartServices?: string[];
    validate: string[];
  };
};

export function nativeRule(input: NativeRuleInput): CatalogDetectionRule {
  const config: NonNullable<CatalogDetectionRule["config"]> = {
    ...(input.configFiles ? { files: input.configFiles } : {}),
    ...(input.configGlobs ? { globs: input.configGlobs } : {}),
    ...(input.configExclude ? { exclude: input.configExclude } : {}),
    maxSizeKB: input.configMaxSizeKB ?? 256,
    secretPatterns: [...(input.extraSecretPatterns ?? []), ...commonSecretPatterns]
  };
  const migrate: CatalogDetectionRule["migrate"] = {
    package: input.migrate.package ?? true,
    config: input.migrate.config ?? true,
    data: input.migrate.data,
    strategy: input.migrate.strategy,
    ...(input.migrate.restartServices ? { restartServices: input.migrate.restartServices } : {}),
    validate: input.migrate.validate
  };
  return {
    id: input.id,
    kind: "software",
    displayName: input.displayName,
    capabilityKey: input.capabilityKey,
    capability: input.capability ?? input.capabilityKey,
    supportLevel: input.supportLevel ?? "full-migration",
    category: input.category,
    detect: input.detect,
    config,
    ...(input.dataPaths ? { data: { paths: input.dataPaths } } : {}),
    intentSignals: defaultIntentSignals(),
    references: input.references,
    migrationCompleteness: input.migrationCompleteness,
    security: input.security,
    crossDistro: input.crossDistro,
    migrate
  };
}

const finalBatchDockerAppRules: CatalogDetectionRule[] = [
  dockerAppRule({
    id: "homepage",
    displayName: "Homepage app dashboard",
    capabilityKey: "catalog.homepage",
    category: "service",
    ports: [3000],
    dataPaths: ["./homepage/config"],
    secretPatterns: ["HOMEPAGE_VAR_", "API_KEY", "TOKEN"],
    references: [
      { pattern: "services.yaml", type: "configInclude" },
      { pattern: "widgets", type: "serviceDependency" },
      { pattern: "HOMEPAGE_VAR_", type: "secretFile" }
    ],
    missingRisks: ["downstream service URLs", "widget API tokens", "reverse-proxy authentication"],
    securityNotes: ["Homepage is config-driven; downstream URLs and widget tokens require operator review."],
    validate: ["docker ps --filter name=homepage || curl -fsS http://127.0.0.1:3000/ || true"]
  }),
  dockerAppRule({
    id: "stirling-pdf",
    displayName: "Stirling PDF toolkit",
    capabilityKey: "catalog.stirling-pdf",
    category: "service",
    ports: [8080],
    dataPaths: ["./stirling-pdf/configs", "./stirling-pdf/customFiles"],
    secretPatterns: ["SECURITY_ENABLELOGIN", "PASSWORD", "API_KEY"],
    references: [
      { pattern: "customFiles", type: "filesystemPath" },
      { pattern: "configs", type: "configInclude" },
      { pattern: "SECURITY_", type: "secretFile" }
    ],
    missingRisks: ["optional login config", "custom fonts/scripts", "uploaded PDFs are not migrated"],
    securityNotes: ["Stirling PDF is mostly stateless; optional auth and custom files still require review."],
    validate: ["curl -fsS http://127.0.0.1:8080/ || docker ps --filter name=stirling || true"]
  }),
  dockerAppRule({
    id: "mealie",
    displayName: "Mealie recipe manager",
    capabilityKey: "catalog.mealie",
    category: "service",
    ports: [9000],
    dataPaths: ["./mealie/data", "./postgres_data"],
    secretPatterns: ["POSTGRES_PASSWORD", "LDAP_", "OIDC_", "SMTP_PASSWORD"],
    references: [
      { pattern: "POSTGRES_PASSWORD", type: "secretFile" },
      { pattern: "postgres", type: "serviceDependency" },
      { pattern: "backup", type: "filesystemPath" }
    ],
    missingRisks: ["official backup zip", "recipe images", "OIDC/LDAP/SMTP secrets"],
    securityNotes: ["Mealie data should move through the application's backup/restore path or reviewed DB dump."],
    validate: ["curl -fsS http://127.0.0.1:9000/api/app/about || docker ps --filter name=mealie || true"]
  }),
  dockerAppRule({
    id: "linkwarden",
    displayName: "Linkwarden bookmarks and archive",
    capabilityKey: "catalog.linkwarden",
    category: "service",
    ports: [3000],
    dataPaths: ["./linkwarden/data", "./postgres_data"],
    secretPatterns: ["NEXTAUTH_SECRET", "DATABASE_URL", "POSTGRES_PASSWORD"],
    references: [
      { pattern: "NEXTAUTH_SECRET", type: "secretFile" },
      { pattern: "DATABASE_URL", type: "serviceDependency" },
      { pattern: "archives", type: "filesystemPath" }
    ],
    missingRisks: ["archive artifacts", "PostgreSQL backup", "NEXTAUTH_SECRET continuity", "OAuth tokens"],
    securityNotes: ["Linkwarden archives and encrypted OAuth state require explicit backup and secret continuity review."],
    validate: ["curl -fsS http://127.0.0.1:3000/api/v1/health || docker ps --filter name=linkwarden || true"]
  }),
  dockerAppRule({
    id: "seafile",
    displayName: "Seafile file sync",
    capabilityKey: "catalog.seafile",
    category: "service",
    ports: [80, 443, 8082],
    dataPaths: ["./seafile/shared", "./seafile/mysql", "./seafile/seafile-data"],
    secretPatterns: ["SEAFILE_ADMIN_PASSWORD", "DB_ROOT_PASSWD", "JWT_PRIVATE_KEY"],
    references: [
      { pattern: "seafile-data", type: "filesystemPath" },
      { pattern: "DB_ROOT_PASSWD", type: "secretFile" },
      { pattern: "mariadb", type: "serviceDependency" }
    ],
    missingRisks: ["seaf-backup/seaf-fsck", "MariaDB dump", "encrypted libraries", "JWT/admin secrets"],
    securityNotes: ["Seafile migration requires content-store validation plus database backup/restore; raw rsync alone is insufficient."],
    validate: ["docker exec seafile seaf-fsck --help >/dev/null 2>&1 || docker ps --filter name=seafile || true"]
  })
];

function comboRule(input: {
  id: string;
  displayName: string;
  capabilityKey: string;
  category: CatalogDetectionRule["category"];
  detectPackages: Partial<Record<PackageManager, string[]>>;
  binaries: string[];
  systemd?: string[];
  ports?: number[];
  configFiles?: string[];
  configGlobs: string[];
  dataPaths: string[];
  references: NonNullable<CatalogDetectionRule["references"]>;
  packageMap: Partial<Record<"apt" | "dnf" | "yum" | "pacman" | "apk", string[]>>;
  serviceMap: Partial<Record<"debian" | "rhel" | "fedora" | "arch" | "alpine", string[]>>;
  restartServices?: string[];
  validate: string[];
  missingRisks: string[];
  securityRisk?: NonNullable<CatalogDetectionRule["security"]>["risk"];
  securityNotes: string[];
}): CatalogDetectionRule {
  return {
    id: input.id,
    kind: "software",
    displayName: input.displayName,
    capabilityKey: input.capabilityKey,
    capability: input.capabilityKey,
    supportLevel: "full-migration",
    category: input.category,
    detect: {
      packages: input.detectPackages,
      binaries: input.binaries,
      systemd: input.systemd,
      ports: input.ports
    },
    config: {
      files: input.configFiles ?? [],
      globs: input.configGlobs,
      maxSizeKB: 512,
      secretPatterns: commonSecretPatterns
    },
    data: { paths: input.dataPaths },
    intentSignals: defaultIntentSignals(),
    references: input.references,
    migrationCompleteness: { configOnly: "partial", missingRisks: input.missingRisks },
    security: { risk: input.securityRisk ?? "review", notes: input.securityNotes },
    crossDistro: { packageMap: input.packageMap, serviceMap: input.serviceMap },
    migrate: {
      package: true,
      config: true,
      data: "optional",
      strategy: "manual-review",
      restartServices: input.restartServices,
      validate: input.validate
    }
  };
}

const finalBatchComboRules: CatalogDetectionRule[] = [
  comboRule({
    id: "lamp-stack",
    displayName: "LAMP full stack",
    capabilityKey: "catalog.lamp-stack",
    category: "service",
    detectPackages: { apt: ["apache2", "mysql-server", "php", "libapache2-mod-php"], rpm: ["httpd", "mariadb-server", "php"] },
    binaries: ["apache2", "httpd", "mysql", "php"],
    systemd: ["apache2.service", "httpd.service", "mysql.service", "mariadb.service"],
    ports: [80, 443, 3306],
    configFiles: ["/etc/apache2/apache2.conf", "/etc/httpd/conf/httpd.conf", "/etc/mysql/my.cnf"],
    configGlobs: ["/etc/apache2/sites-enabled/*.conf", "/etc/httpd/conf.d/*.conf", "/etc/php/*/apache2/*.ini", "/etc/mysql/conf.d/*.cnf"],
    dataPaths: ["/var/www", "/var/lib/mysql"],
    references: [
      { pattern: "DocumentRoot", type: "filesystemPath" },
      { pattern: "SSLCertificateKeyFile", type: "secretFile" },
      { pattern: "mysql", type: "serviceDependency" }
    ],
    packageMap: { apt: ["apache2", "mysql-server", "php", "libapache2-mod-php", "php-mysql"], dnf: ["httpd", "mariadb-server", "php", "php-mysqlnd"], yum: ["httpd", "mariadb-server", "php", "php-mysqlnd"], pacman: ["apache", "mariadb", "php", "php-apache"], apk: ["apache2", "mariadb", "php", "php-mysqli"] },
    serviceMap: { debian: ["apache2", "mysql"], rhel: ["httpd", "mariadb"], fedora: ["httpd", "mariadb"], arch: ["httpd", "mariadb"], alpine: ["apache2", "mariadb"] },
    restartServices: ["apache2", "httpd", "mysql", "mariadb"],
    validate: ["apachectl configtest || httpd -t", "mysqladmin ping || mariadb-admin ping", "php --version"],
    missingRisks: ["Apache vhosts", "MySQL dump/restore", "PHP module parity", "TLS keys"],
    securityNotes: ["LAMP delegates database data to the MySQL dump/restore strategy and web roots to explicit operator review."]
  }),
  comboRule({
    id: "lemp-stack",
    displayName: "LEMP full stack",
    capabilityKey: "catalog.lemp-stack",
    category: "service",
    detectPackages: { apt: ["nginx", "mysql-server", "php-fpm", "php-mysql"], rpm: ["nginx", "mariadb-server", "php-fpm", "php-mysqlnd"] },
    binaries: ["nginx", "mysql", "php-fpm", "php"],
    systemd: ["nginx.service", "mysql.service", "mariadb.service", "php-fpm.service"],
    ports: [80, 443, 3306, 9000],
    configFiles: ["/etc/nginx/nginx.conf", "/etc/mysql/my.cnf"],
    configGlobs: ["/etc/nginx/conf.d/*.conf", "/etc/nginx/sites-enabled/*", "/etc/php/*/fpm/pool.d/*.conf", "/etc/mysql/conf.d/*.cnf"],
    dataPaths: ["/var/www", "/var/lib/mysql", "/var/lib/php/sessions"],
    references: [
      { pattern: "fastcgi_pass", type: "serviceDependency" },
      { pattern: "root", type: "filesystemPath" },
      { pattern: "ssl_certificate_key", type: "secretFile" }
    ],
    packageMap: { apt: ["nginx", "mysql-server", "php-fpm", "php-mysql"], dnf: ["nginx", "mariadb-server", "php-fpm", "php-mysqlnd"], yum: ["nginx", "mariadb-server", "php-fpm", "php-mysqlnd"], pacman: ["nginx", "mariadb", "php-fpm"], apk: ["nginx", "mariadb", "php-fpm", "php-mysqli"] },
    serviceMap: { debian: ["nginx", "mysql", "php-fpm"], rhel: ["nginx", "mariadb", "php-fpm"], fedora: ["nginx", "mariadb", "php-fpm"], arch: ["nginx", "mariadb", "php-fpm"], alpine: ["nginx", "mariadb", "php-fpm"] },
    restartServices: ["nginx", "mysql", "mariadb", "php-fpm"],
    validate: ["nginx -t", "php-fpm -t || php-fpm8.3 -t || php-fpm8.2 -t", "mysqladmin ping || mariadb-admin ping"],
    missingRisks: ["Nginx vhosts", "MySQL dump/restore", "PHP-FPM pool parity", "TLS keys"],
    securityNotes: ["LEMP migration composes certified Nginx, MySQL, and PHP-FPM strategies with explicit data review."]
  }),
  comboRule({
    id: "node-production-deploy",
    displayName: "Node.js production deploy",
    capabilityKey: "catalog.node-production-deploy",
    category: "service",
    detectPackages: { apt: ["nodejs", "npm", "nginx"], rpm: ["nodejs", "npm", "nginx"] },
    binaries: ["node", "npm", "pm2", "nginx"],
    systemd: ["nginx.service"],
    ports: [80, 443, 3000],
    configFiles: ["/etc/nginx/nginx.conf"],
    configGlobs: ["/etc/nginx/conf.d/*.conf", "/etc/nginx/sites-enabled/*", "/home/*/.pm2/dump.pm2", "/home/*/.npmrc"],
    dataPaths: ["/srv", "/var/www", "/home/*/.pm2"],
    references: [
      { pattern: "proxy_pass", type: "serviceDependency" },
      { pattern: "ecosystem.config", type: "configInclude" },
      { pattern: ".npmrc", type: "secretFile" }
    ],
    packageMap: { apt: ["nodejs", "npm", "nginx"], dnf: ["nodejs", "npm", "nginx"], yum: ["nodejs", "npm", "nginx"], pacman: ["nodejs", "npm", "nginx"], apk: ["nodejs", "npm", "nginx"] },
    serviceMap: { debian: ["nginx"], rhel: ["nginx"], fedora: ["nginx"], arch: ["nginx"], alpine: ["nginx"] },
    restartServices: ["nginx"],
    validate: ["node --version", "npm --version", "pm2 --version || true", "nginx -t"],
    missingRisks: ["application source", "PM2 process dump", "environment secrets", "Nginx upstreams"],
    securityNotes: ["Application source and PM2 environment secrets are operator-owned and require explicit review."]
  }),
  comboRule({
    id: "docker-compose-dev",
    displayName: "Docker Compose development environment",
    capabilityKey: "catalog.docker-compose-dev",
    category: "container",
    detectPackages: { apt: ["docker.io", "docker-compose-plugin", "docker-buildx-plugin"], rpm: ["docker", "docker-compose-plugin", "docker-buildx-plugin"] },
    binaries: ["docker"],
    systemd: ["docker.service"],
    configFiles: ["/etc/docker/daemon.json"],
    configGlobs: ["/etc/docker/*.json", "/home/*/.docker/config.json"],
    dataPaths: ["/var/lib/docker", "/home/*/.docker/buildx"],
    references: [
      { pattern: "registry", type: "serviceDependency" },
      { pattern: "auths", type: "secretFile" },
      { pattern: "buildx", type: "filesystemPath" }
    ],
    packageMap: { apt: ["docker.io", "docker-compose-plugin", "docker-buildx-plugin"], dnf: ["docker", "docker-compose-plugin", "docker-buildx-plugin"], yum: ["docker", "docker-compose-plugin"], pacman: ["docker", "docker-compose", "docker-buildx"], apk: ["docker", "docker-cli-compose"] },
    serviceMap: { debian: ["docker"], rhel: ["docker"], fedora: ["docker"], arch: ["docker"], alpine: ["docker"] },
    restartServices: ["docker"],
    validate: ["docker version", "docker compose version", "docker buildx version || true"],
    missingRisks: ["daemon.json registry/proxy auth", "compose project data", "buildx state", "docker group membership"],
    securityNotes: ["Compose projects and /var/lib/docker data are not blindly migrated; this rule certifies tooling and reviewed config only."]
  }),
  comboRule({
    id: "security-baseline",
    displayName: "Security baseline",
    capabilityKey: "catalog.security-baseline",
    category: "security",
    detectPackages: { apt: ["ufw", "fail2ban", "openssh-server", "unattended-upgrades"], rpm: ["firewalld", "fail2ban", "openssh-server"] },
    binaries: ["ufw", "firewall-cmd", "fail2ban-client", "sshd"],
    systemd: ["ufw.service", "firewalld.service", "fail2ban.service", "ssh.service", "sshd.service"],
    ports: [22],
    configFiles: ["/etc/ssh/sshd_config", "/etc/fail2ban/jail.local", "/etc/ufw/user.rules"],
    configGlobs: ["/etc/ssh/sshd_config.d/*.conf", "/etc/fail2ban/jail.d/*.conf", "/etc/firewalld/zones/*.xml", "/etc/apt/apt.conf.d/50unattended-upgrades"],
    dataPaths: ["/var/lib/fail2ban"],
    references: [
      { pattern: "Port", type: "serviceDependency" },
      { pattern: "jail.d", type: "configInclude" },
      { pattern: "ssh", type: "serviceDependency" }
    ],
    packageMap: { apt: ["ufw", "fail2ban", "openssh-server", "unattended-upgrades"], dnf: ["firewalld", "fail2ban", "openssh-server"], yum: ["firewalld", "fail2ban", "openssh-server"], pacman: ["ufw", "fail2ban", "openssh"], apk: ["ufw", "fail2ban", "openssh"] },
    serviceMap: { debian: ["ufw", "fail2ban", "ssh"], rhel: ["firewalld", "fail2ban", "sshd"], fedora: ["firewalld", "fail2ban", "sshd"], arch: ["ufw", "fail2ban", "sshd"], alpine: ["ufw", "fail2ban", "sshd"] },
    restartServices: ["fail2ban", "ssh", "sshd"],
    validate: ["sshd -t", "fail2ban-client status || systemctl is-active fail2ban", "ufw status || firewall-cmd --state"],
    missingRisks: ["SSH lockout", "firewall lockout", "custom jail actions", "distro-specific unattended-upgrades"],
    securityRisk: "privileged",
    securityNotes: ["Security baseline requires explicit SSH/firewall lockout approval and staged rollback before live apply."]
  }),
  comboRule({
    id: "monitoring-stack",
    displayName: "Monitoring stack",
    capabilityKey: "catalog.monitoring-stack",
    category: "service",
    detectPackages: { docker: ["prom/prometheus", "grafana/grafana-oss", "grafana/loki"], apt: ["docker.io", "docker-compose-plugin"], rpm: ["docker", "docker-compose-plugin"] },
    binaries: ["docker"],
    ports: [3000, 9090, 3100, 9100, 8080],
    configFiles: ["./docker-compose.yml", "./prometheus.yml", "./loki-config.yml"],
    configGlobs: ["./monitoring/**/*.yml", "./monitoring/**/*.yaml", "./grafana/provisioning/**/*.yml"],
    dataPaths: ["./prometheus_data", "./grafana_data", "./loki_data"],
    references: [
      { pattern: "datasources", type: "configInclude" },
      { pattern: "remote_write", type: "secretFile" },
      { pattern: "node-exporter", type: "serviceDependency" }
    ],
    packageMap: { apt: ["docker.io", "docker-compose-plugin"], dnf: ["docker", "docker-compose-plugin"], yum: ["docker", "docker-compose-plugin"], pacman: ["docker", "docker-compose"], apk: ["docker", "docker-cli-compose"] },
    serviceMap: { debian: ["docker"], rhel: ["docker"], fedora: ["docker"], arch: ["docker"], alpine: ["docker"] },
    restartServices: ["docker"],
    validate: ["curl -fsS http://127.0.0.1:9090/-/healthy || true", "curl -fsS http://127.0.0.1:3000/api/health || true", "curl -fsS http://127.0.0.1:3100/ready || true"],
    missingRisks: ["Prometheus TSDB retention", "Grafana database backup", "Loki chunk storage", "host path mounts"],
    securityNotes: ["Monitoring data can be rebuilt or backed up per component; datasource credentials are redacted."]
  }),
  comboRule({
    id: "sso-stack",
    displayName: "SSO stack",
    capabilityKey: "catalog.sso-stack",
    category: "security",
    detectPackages: { docker: ["authelia/authelia", "traefik", "redis"], apt: ["docker.io", "docker-compose-plugin"], rpm: ["docker", "docker-compose-plugin"] },
    binaries: ["docker"],
    ports: [80, 443, 9091, 6379],
    configFiles: ["./docker-compose.yml", "./authelia/configuration.yml", "./traefik/traefik.yml"],
    configGlobs: ["./authelia/**/*.yml", "./traefik/**/*.yml", "./redis/**/*.conf"],
    dataPaths: ["./authelia", "./redis_data", "./traefik/acme.json"],
    references: [
      { pattern: "JWT_SECRET", type: "secretFile" },
      { pattern: "forwardAuth", type: "serviceDependency" },
      { pattern: "acme.json", type: "secretFile" }
    ],
    packageMap: { apt: ["docker.io", "docker-compose-plugin"], dnf: ["docker", "docker-compose-plugin"], yum: ["docker", "docker-compose-plugin"], pacman: ["docker", "docker-compose"], apk: ["docker", "docker-cli-compose"] },
    serviceMap: { debian: ["docker"], rhel: ["docker"], fedora: ["docker"], arch: ["docker"], alpine: ["docker"] },
    restartServices: ["docker"],
    validate: ["curl -fsS http://127.0.0.1:9091/api/health || true", "redis-cli ping || true", "traefik healthcheck || true"],
    missingRisks: ["Authelia storage encryption key", "session reset", "Traefik middleware coverage", "ACME/private keys"],
    securityRisk: "privileged",
    securityNotes: ["SSO stack gates authentication for other apps; identity and secret continuity must be explicitly approved."]
  })
];

const batch20DockerAppRules: CatalogDetectionRule[] = [
  dockerAppRule({
    id: "vaultwarden",
    displayName: "Vaultwarden password manager",
    capabilityKey: "app.password.vaultwarden",
    category: "service",
    ports: [80, 8080],
    dataPaths: ["./vw-data", "./vaultwarden"],
    secretPatterns: ["ADMIN_TOKEN", "DATABASE_URL", "SMTP_PASSWORD"],
    references: [
      { pattern: "ADMIN_TOKEN", type: "secretFile" },
      { pattern: "DATABASE_URL", type: "serviceDependency" },
      { pattern: "vw-data", type: "filesystemPath" }
    ],
    missingRisks: ["SQLite/PostgreSQL backup", "attachments", "ADMIN_TOKEN", "SMTP credentials"],
    securityRisk: "privileged",
    securityNotes: ["Vaultwarden stores password-vault data; migration requires explicit export/backup and secret continuity review."],
    validate: ["curl -fsS http://127.0.0.1:8080/alive || docker ps --filter name=vaultwarden || true"]
  }),
  dockerAppRule({
    id: "pihole",
    displayName: "Pi-hole DNS filter",
    capabilityKey: "app.dns.pihole",
    category: "network",
    ports: [53, 67, 80],
    dataPaths: ["./etc-pihole", "./etc-dnsmasq.d"],
    secretPatterns: ["WEBPASSWORD", "FTLCONF_webserver_api_password"],
    references: [
      { pattern: "53", type: "serviceDependency" },
      { pattern: "WEBPASSWORD", type: "secretFile" },
      { pattern: "etc-pihole", type: "filesystemPath" }
    ],
    missingRisks: ["DNS port 53 ownership", "gravity database", "DHCP mode", "admin password hash"],
    securityRisk: "privileged",
    securityNotes: ["Pi-hole owns host DNS and can break name resolution; systemd-resolved conflicts and web password handling require review."],
    validate: ["curl -fsS http://127.0.0.1/admin/ || docker ps --filter name=pihole || true"]
  }),
  dockerAppRule({
    id: "authentik",
    displayName: "Authentik identity provider",
    capabilityKey: "security.sso.authentik",
    category: "security",
    ports: [9000, 9443],
    dataPaths: ["./authentik", "./postgres_data", "./redis_data"],
    secretPatterns: ["AUTHENTIK_SECRET_KEY", "POSTGRES_PASSWORD", "SMTP_PASSWORD"],
    references: [
      { pattern: "AUTHENTIK_SECRET_KEY", type: "secretFile" },
      { pattern: "postgres", type: "serviceDependency" },
      { pattern: "blueprints", type: "filesystemPath" }
    ],
    missingRisks: ["blueprint export/import", "PostgreSQL backup", "Redis cache", "OIDC/SAML secrets"],
    securityRisk: "privileged",
    securityNotes: ["Authentik is an identity provider; realm/user migration and client secrets require explicit approval."],
    validate: ["curl -fsS http://127.0.0.1:9000/-/health/ready || docker ps --filter name=authentik || true"]
  }),
  dockerAppRule({
    id: "wikijs",
    displayName: "Wiki.js knowledge base",
    capabilityKey: "app.docs.wikijs",
    category: "service",
    ports: [3000],
    dataPaths: ["./wikijs", "./postgres_data"],
    secretPatterns: ["DB_PASS", "SESSION_SECRET"],
    references: [
      { pattern: "DB_HOST", type: "serviceDependency" },
      { pattern: "DB_PASS", type: "secretFile" },
      { pattern: "repo", type: "filesystemPath" }
    ],
    missingRisks: ["PostgreSQL backup", "git sync repository", "uploads", "auth provider secrets"],
    securityNotes: ["Wiki.js content and auth provider secrets require backup/restore review."],
    validate: ["curl -fsS http://127.0.0.1:3000/healthz || docker ps --filter name=wikijs || true"]
  }),
  dockerAppRule({
    id: "n8n",
    displayName: "n8n workflow automation",
    capabilityKey: "app.automation.n8n",
    category: "service",
    ports: [5678],
    dataPaths: ["./n8n_data"],
    secretPatterns: ["N8N_ENCRYPTION_KEY", "WEBHOOK_URL", "DB_POSTGRESDB_PASSWORD"],
    references: [
      { pattern: "N8N_ENCRYPTION_KEY", type: "secretFile" },
      { pattern: "WEBHOOK_URL", type: "serviceDependency" },
      { pattern: "n8n_data", type: "filesystemPath" }
    ],
    missingRisks: ["workflow credential encryption key", "webhook URL", "queue/DB mode", "binary data storage"],
    securityNotes: ["n8n workflow credentials are encrypted with N8N_ENCRYPTION_KEY and must stay consistent or be rotated."],
    validate: ["curl -fsS http://127.0.0.1:5678/healthz || docker ps --filter name=n8n || true"]
  }),
  dockerAppRule({
    id: "bookstack",
    displayName: "BookStack documentation platform",
    capabilityKey: "app.docs.bookstack",
    category: "service",
    ports: [80],
    dataPaths: ["./bookstack", "./mariadb"],
    secretPatterns: ["APP_KEY", "DB_PASSWORD", "MAIL_PASSWORD"],
    references: [
      { pattern: "APP_KEY", type: "secretFile" },
      { pattern: "DB_HOST", type: "serviceDependency" },
      { pattern: "uploads", type: "filesystemPath" }
    ],
    missingRisks: ["database backup", "APP_KEY continuity", "uploads/images", "mail/OIDC secrets"],
    securityNotes: ["BookStack APP_KEY and DB state must be migrated together to keep attachments and auth working."],
    validate: ["curl -fsS http://127.0.0.1/login || docker ps --filter name=bookstack || true"]
  }),
  dockerAppRule({
    id: "home-assistant",
    displayName: "Home Assistant",
    capabilityKey: "app.home.home-assistant",
    category: "service",
    ports: [8123],
    dataPaths: ["./homeassistant", "./config"],
    secretPatterns: ["secrets.yaml", "long_lived_access_token", "api_key"],
    references: [
      { pattern: "secrets.yaml", type: "secretFile" },
      { pattern: "configuration.yaml", type: "configInclude" },
      { pattern: "config", type: "filesystemPath" }
    ],
    missingRisks: ["device integrations", "secrets.yaml", "SQLite recorder database", "USB/Zigbee/Z-Wave hardware"],
    securityNotes: ["Home Assistant integrations often bind to physical devices and cloud tokens; target hardware must be reviewed."],
    validate: ["curl -fsS http://127.0.0.1:8123/ || docker ps --filter name=home-assistant || true"]
  }),
  dockerAppRule({
    id: "gitlab-ce",
    displayName: "GitLab Community Edition",
    capabilityKey: "developer.gitlab",
    category: "developer",
    ports: [22, 80, 443, 5050],
    dataPaths: ["./gitlab/config", "./gitlab/logs", "./gitlab/data"],
    secretPatterns: ["gitlab-secrets.json", "initial_root_password", "registry_key_path"],
    references: [
      { pattern: "gitlab-secrets.json", type: "secretFile" },
      { pattern: "external_url", type: "serviceDependency" },
      { pattern: "repositories", type: "filesystemPath" }
    ],
    missingRisks: ["gitlab-backup version match", "registry data", "repositories/LFS", "gitlab-secrets.json"],
    securityRisk: "privileged",
    securityNotes: ["GitLab owns repositories, CI secrets, registry data, and SSH/HTTP ports; migration must use gitlab-backup tooling."],
    validate: ["curl -fsS http://127.0.0.1/-/health || docker ps --filter name=gitlab || true"]
  }),
  dockerAppRule({
    id: "umami",
    displayName: "Umami analytics",
    capabilityKey: "app.analytics.umami",
    category: "service",
    ports: [3000],
    dataPaths: ["./umami", "./postgres_data"],
    secretPatterns: ["DATABASE_URL", "APP_SECRET"],
    references: [
      { pattern: "DATABASE_URL", type: "secretFile" },
      { pattern: "TRACKER_SCRIPT_NAME", type: "serviceDependency" },
      { pattern: "postgres_data", type: "filesystemPath" }
    ],
    missingRisks: ["PostgreSQL backup", "APP_SECRET", "tracking domain", "retention policy"],
    securityNotes: ["Umami analytics data and app secret require backup/restore and domain review."],
    validate: ["curl -fsS http://127.0.0.1:3000/api/heartbeat || docker ps --filter name=umami || true"]
  }),
  dockerAppRule({
    id: "nocodb",
    displayName: "NocoDB",
    capabilityKey: "app.nocodb",
    category: "service",
    ports: [8080],
    dataPaths: ["./nocodb", "./nc_data"],
    secretPatterns: ["NC_AUTH_JWT_SECRET", "DATABASE_URL", "DB_PASSWORD"],
    references: [
      { pattern: "NC_AUTH_JWT_SECRET", type: "secretFile" },
      { pattern: "DATABASE_URL", type: "serviceDependency" },
      { pattern: "nc_data", type: "filesystemPath" }
    ],
    missingRisks: ["metadata database", "JWT secret", "external DB/base connections", "uploaded attachments"],
    securityNotes: ["NocoDB stores base metadata and external DB credentials; secret continuity requires review."],
    validate: ["curl -fsS http://127.0.0.1:8080/api/v1/health || docker ps --filter name=nocodb || true"]
  }),
  dockerAppRule({
    id: "adguard-home",
    displayName: "AdGuard Home DNS filter",
    capabilityKey: "app.dns.adguard-home",
    category: "network",
    ports: [53, 80, 3000],
    dataPaths: ["./adguard/work", "./adguard/conf"],
    secretPatterns: ["users:", "password:", "dnscrypt", "api_key"],
    references: [
      { pattern: "53", type: "serviceDependency" },
      { pattern: "AdGuardHome.yaml", type: "secretFile" },
      { pattern: "work", type: "filesystemPath" }
    ],
    missingRisks: ["DNS port 53 ownership", "AdGuardHome.yaml user hashes", "query logs", "DoH/DoT certificates"],
    securityRisk: "privileged",
    securityNotes: ["AdGuard Home owns DNS resolution and encrypted DNS settings; port conflicts and admin credentials require review."],
    validate: ["curl -fsS http://127.0.0.1:3000/control/status || docker ps --filter name=adguard || true"]
  }),
  dockerAppRule({
    id: "docker-mailserver",
    displayName: "docker-mailserver",
    capabilityKey: "app.mail.docker-mailserver",
    category: "service",
    ports: [25, 143, 465, 587, 993],
    dataPaths: ["./docker-data/dms", "./mail-data", "./mail-state", "./config"],
    secretPatterns: ["DKIM", "private.key", "LDAP_BIND_PW", "POSTMASTER_PASSWORD"],
    references: [
      { pattern: "opendkim", type: "secretFile" },
      { pattern: "mail-data", type: "filesystemPath" },
      { pattern: "MX", type: "serviceDependency" }
    ],
    missingRisks: ["maildir data", "DKIM private keys", "DNS reputation", "postfix/dovecot account state"],
    securityRisk: "privileged",
    securityNotes: ["Mail migration touches DNS, private keys, spam policy, and mailbox data; apply requires operator DNS confirmation."],
    validate: ["docker ps --filter name=mailserver || ss -ltn | grep -E ':(25|587|993)\\\\b' || true"]
  }),
  dockerAppRule({
    id: "onlyoffice-docs",
    displayName: "OnlyOffice Document Server",
    capabilityKey: "app.office.onlyoffice",
    category: "service",
    ports: [80, 443],
    dataPaths: ["./onlyoffice", "./postgres_data", "./rabbitmq_data"],
    secretPatterns: ["JWT_SECRET", "DB_PWD", "AMQP_URI"],
    references: [
      { pattern: "JWT_SECRET", type: "secretFile" },
      { pattern: "postgres", type: "serviceDependency" },
      { pattern: "rabbitmq", type: "serviceDependency" }
    ],
    missingRisks: ["JWT secret", "PostgreSQL backup", "RabbitMQ state", "document cache"],
    securityNotes: ["OnlyOffice JWT and storage dependencies must be kept in sync with the integrating app."],
    validate: ["curl -fsS http://127.0.0.1/healthcheck || docker ps --filter name=onlyoffice || true"]
  }),
  dockerAppRule({
    id: "immich",
    displayName: "Immich photos",
    capabilityKey: "app.photos.immich",
    category: "service",
    ports: [2283],
    dataPaths: ["./immich/upload", "./postgres_data", "./immich-machine-learning"],
    secretPatterns: ["DB_PASSWORD", "JWT_SECRET", "TYPESENSE_API_KEY"],
    references: [
      { pattern: "UPLOAD_LOCATION", type: "filesystemPath" },
      { pattern: "DB_PASSWORD", type: "secretFile" },
      { pattern: "machine-learning", type: "serviceDependency" }
    ],
    missingRisks: ["photo library transfer", "PostgreSQL/vector extension backup", "machine-learning cache", "external library mounts"],
    securityNotes: ["Immich photo libraries and database/vector extension state require version-aware backup/restore."],
    validate: ["curl -fsS http://127.0.0.1:2283/api/server/ping || docker ps --filter name=immich || true"]
  }),
  dockerAppRule({
    id: "forgejo",
    displayName: "Forgejo Git server",
    capabilityKey: "developer.forgejo",
    category: "service",
    ports: [3000, 2222],
    dataPaths: ["./forgejo", "./postgres_data"],
    secretPatterns: ["SECRET_KEY", "INTERNAL_TOKEN", "JWT_SECRET", "DB_PASSWD"],
    references: [
      { pattern: "SECRET_KEY", type: "secretFile" },
      { pattern: "ROOT", type: "filesystemPath" },
      { pattern: "DB_TYPE", type: "serviceDependency" }
    ],
    missingRisks: ["forgejo dump/restore", "repositories", "LFS objects", "OAuth/webhook secrets"],
    securityNotes: ["Forgejo follows Gitea-style dump/restore; repository and app.ini secrets require review."],
    validate: ["curl -fsS http://127.0.0.1:3000/api/healthz || docker ps --filter name=forgejo || true"]
  }),
  dockerAppRule({
    id: "uptime-kuma",
    displayName: "Uptime Kuma",
    capabilityKey: "observability.uptime-kuma",
    category: "service",
    ports: [3001],
    dataPaths: ["./uptime-kuma"],
    secretPatterns: ["notification", "token", "webhook", "password"],
    references: [
      { pattern: "kuma.db", type: "filesystemPath" },
      { pattern: "notification", type: "secretFile" },
      { pattern: "monitor", type: "serviceDependency" }
    ],
    missingRisks: ["SQLite database", "notification credentials", "status page domains", "Docker socket monitors"],
    securityNotes: ["Uptime Kuma monitors and notifier credentials require secret redaction and endpoint review."],
    validate: ["curl -fsS http://127.0.0.1:3001/ || docker ps --filter name=uptime-kuma || true"]
  }),
  dockerAppRule({
    id: "paperless-ngx",
    displayName: "Paperless-ngx",
    capabilityKey: "app.docs.paperless",
    category: "service",
    ports: [8000],
    dataPaths: ["./paperless/data", "./paperless/media", "./paperless/export", "./postgres_data", "./redis_data"],
    secretPatterns: ["PAPERLESS_SECRET_KEY", "PAPERLESS_DBPASS", "PAPERLESS_EMAIL_HOST_PASSWORD"],
    references: [
      { pattern: "PAPERLESS_SECRET_KEY", type: "secretFile" },
      { pattern: "media", type: "filesystemPath" },
      { pattern: "redis", type: "serviceDependency" }
    ],
    missingRisks: ["document media", "PostgreSQL backup", "Redis broker", "secret key continuity"],
    securityNotes: ["Paperless document media and metadata database must be migrated together; mail/OCR secrets are redacted."],
    validate: ["curl -fsS http://127.0.0.1:8000/api/ || docker ps --filter name=paperless || true"]
  }),
  dockerAppRule({
    id: "navidrome",
    displayName: "Navidrome music streaming",
    capabilityKey: "app.media.navidrome",
    category: "service",
    ports: [4533],
    dataPaths: ["./navidrome/data", "./music"],
    secretPatterns: ["ND_AUTHREQUESTLIMIT", "lastfm.apiSecret", "spotify.secret"],
    references: [
      { pattern: "MusicFolder", type: "filesystemPath" },
      { pattern: "DataFolder", type: "filesystemPath" },
      { pattern: "lastfm", type: "secretFile" }
    ],
    missingRisks: ["music bind mounts", "SQLite database", "cover cache", "Last.fm/Spotify secrets"],
    securityNotes: ["Navidrome media paths are operator-owned bind mounts; metadata DB and external API secrets require review."],
    validate: ["curl -fsS http://127.0.0.1:4533/ping || docker ps --filter name=navidrome || true"]
  }),
  dockerAppRule({
    id: "audiobookshelf",
    displayName: "Audiobookshelf",
    capabilityKey: "app.media.audiobookshelf",
    category: "service",
    ports: [13378],
    dataPaths: ["./audiobookshelf/config", "./audiobookshelf/metadata", "./audiobooks", "./podcasts"],
    secretPatterns: ["token", "jwt", "smtp", "password"],
    references: [
      { pattern: "metadata", type: "filesystemPath" },
      { pattern: "audiobooks", type: "filesystemPath" },
      { pattern: "token", type: "secretFile" }
    ],
    missingRisks: ["library bind mounts", "metadata/user DB", "podcast feeds", "auth tokens"],
    securityNotes: ["Audiobookshelf libraries are usually bind mounts; user progress and tokens require backup review."],
    validate: ["curl -fsS http://127.0.0.1:13378/ping || docker ps --filter name=audiobookshelf || true"]
  }),
  dockerAppRule({
    id: "freshrss",
    displayName: "FreshRSS",
    capabilityKey: "app.rss.freshrss",
    category: "service",
    ports: [80],
    dataPaths: ["./freshrss/data", "./postgres_data"],
    secretPatterns: ["CRON_MIN", "FRESHRSS_ENV", "DB_PASSWORD", "OIDC"],
    references: [
      { pattern: "data/users", type: "filesystemPath" },
      { pattern: "DB_PASSWORD", type: "secretFile" },
      { pattern: "postgres", type: "serviceDependency" }
    ],
    missingRisks: ["OPML/users", "PostgreSQL backup", "feed credentials", "Fever/API tokens"],
    securityNotes: ["FreshRSS user feeds and API credentials require export/import or DB backup review."],
    validate: ["curl -fsS http://127.0.0.1/i/ || docker ps --filter name=freshrss || true"]
  })
];

export const catalogDetectionRules: CatalogDetectionRule[] = [
  ...batch20DockerAppRules,
  nativeRule({
    id: "nginx",
    displayName: "Nginx",
    capabilityKey: "web-server.nginx",
    capability: "web-server.reverse-proxy",
    category: "service",
    detect: {
      packages: { apt: ["nginx", "nginx-full", "nginx-extras"], rpm: ["nginx"] },
      binaries: ["nginx"],
      systemd: ["nginx.service"],
      ports: [80, 443]
    },
    configFiles: ["/etc/nginx/nginx.conf", "/etc/nginx/mime.types"],
    configGlobs: ["/etc/nginx/conf.d/*.conf", "/etc/nginx/sites-available/*", "/etc/nginx/sites-enabled/*"],
    configExclude: ["/etc/nginx/*.default"],
    extraSecretPatterns: ["ssl_certificate_key"],
    dataPaths: ["/var/www", "/usr/share/nginx/html"],
    references: [
      { pattern: "include", type: "configInclude" },
      { pattern: "root", type: "filesystemPath" },
      { pattern: "ssl_certificate_key", type: "secretFile" },
      { pattern: "proxy_pass", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["site roots", "TLS certificates", "upstream services"] },
    security: { risk: "review", notes: ["Configs may reference TLS private keys and upstream internal services."] },
    crossDistro: { packageMap: { apt: ["nginx"], dnf: ["nginx"], yum: ["nginx"], pacman: ["nginx"], apk: ["nginx"] }, serviceMap: { debian: ["nginx"], rhel: ["nginx"], fedora: ["nginx"], arch: ["nginx"], alpine: ["nginx"] } },
    migrate: { data: "optional", strategy: "template-or-copy", restartServices: ["nginx"], validate: ["nginx -t"] }
  }),
  nativeRule({
    id: "caddy",
    displayName: "Caddy",
    capabilityKey: "web-server.caddy",
    capability: "web-server.reverse-proxy",
    category: "service",
    detect: {
      packages: { apt: ["caddy"], rpm: ["caddy"] },
      binaries: ["caddy"],
      systemd: ["caddy.service"],
      ports: [80, 443]
    },
    configFiles: ["/etc/caddy/Caddyfile"],
    configGlobs: ["/etc/caddy/conf.d/*.caddy", "/etc/caddy/sites-enabled/*"],
    extraSecretPatterns: ["tls", "dns", "api_token", "CF_API_TOKEN"],
    dataPaths: ["/var/lib/caddy", "/srv", "/var/www"],
    references: [
      { pattern: "import", type: "configInclude" },
      { pattern: "root", type: "filesystemPath" },
      { pattern: "reverse_proxy", type: "serviceDependency" },
      { pattern: "tls", type: "secretFile" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["site roots", "ACME storage", "DNS challenge credentials", "upstream services"] },
    security: { risk: "review", notes: ["Caddy ACME storage contains private keys; DNS challenge credentials must be approved before transport."] },
    crossDistro: { packageMap: { apt: ["caddy"], dnf: ["caddy"], yum: ["caddy"], pacman: ["caddy"], apk: ["caddy"] }, serviceMap: { debian: ["caddy"], rhel: ["caddy"], fedora: ["caddy"], arch: ["caddy"], alpine: ["caddy"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["caddy"], validate: ["caddy validate --config /etc/caddy/Caddyfile", "systemctl is-active caddy"] }
  }),
  nativeRule({
    id: "openresty",
    displayName: "OpenResty",
    capabilityKey: "web-server.openresty",
    capability: "web-server.reverse-proxy",
    category: "network",
    detect: {
      packages: { apt: ["openresty"], rpm: ["openresty"] },
      binaries: ["openresty", "resty"],
      systemd: ["openresty.service"],
      ports: [80, 443]
    },
    configFiles: ["/usr/local/openresty/nginx/conf/nginx.conf", "/etc/openresty/nginx.conf"],
    configGlobs: ["/etc/openresty/conf.d/*.conf", "/usr/local/openresty/nginx/conf/conf.d/*.conf", "/etc/nginx/conf.d/*.conf"],
    extraSecretPatterns: ["ssl_certificate_key", "lua_shared_dict"],
    dataPaths: ["/usr/local/openresty/lualib", "/var/www", "/srv"],
    references: [
      { pattern: "include", type: "configInclude" },
      { pattern: "root", type: "filesystemPath" },
      { pattern: "ssl_certificate_key", type: "secretFile" },
      { pattern: "proxy_pass", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["custom Lua modules", "site roots", "TLS certificates", "upstream services"] },
    security: { risk: "review", notes: ["OpenResty config may reference TLS private keys and custom Lua code requiring review."] },
    crossDistro: { packageMap: { apt: ["openresty"], dnf: ["openresty"], yum: ["openresty"], pacman: ["openresty"], apk: ["openresty"] }, serviceMap: { debian: ["openresty"], rhel: ["openresty"], fedora: ["openresty"], arch: ["openresty"], alpine: ["openresty"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["openresty"], validate: ["openresty -t", "systemctl is-active openresty"] }
  }),
  nativeRule({
    id: "traefik",
    displayName: "Traefik",
    capabilityKey: "network.reverse-proxy.traefik",
    capability: "web-server.reverse-proxy",
    category: "network",
    detect: {
      packages: { apt: ["traefik"], rpm: ["traefik"] },
      binaries: ["traefik"],
      systemd: ["traefik.service"],
      ports: [80, 443, 8080]
    },
    configFiles: ["/etc/traefik/traefik.yml", "/etc/traefik/traefik.yaml", "/etc/traefik/acme.json"],
    configGlobs: ["/etc/traefik/dynamic/*.yml", "/etc/traefik/dynamic/*.yaml", "/etc/traefik/conf.d/*.yml"],
    extraSecretPatterns: ["acme.json", "certificatesResolvers", "apiToken", "CF_API_TOKEN"],
    dataPaths: ["/etc/traefik/acme.json", "/var/lib/traefik"],
    references: [
      { pattern: "providers", type: "serviceDependency" },
      { pattern: "file", type: "configInclude" },
      { pattern: "acme", type: "secretFile" },
      { pattern: "certificatesResolvers", type: "secretFile" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["ACME storage", "Docker provider labels", "dynamic file provider configs", "dashboard exposure"] },
    security: { risk: "review", notes: ["Traefik acme.json contains private keys; Docker provider and dashboard exposure require review."] },
    crossDistro: { packageMap: { apt: ["traefik"], dnf: ["traefik"], yum: ["traefik"], pacman: ["traefik"], apk: ["traefik"] }, serviceMap: { debian: ["traefik"], rhel: ["traefik"], fedora: ["traefik"], arch: ["traefik"], alpine: ["traefik"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["traefik"], validate: ["traefik healthcheck", "systemctl is-active traefik"] }
  }),
  nativeRule({
    id: "haproxy",
    displayName: "HAProxy",
    capabilityKey: "network.load-balancer.haproxy",
    capability: "network.load-balancer",
    category: "network",
    detect: {
      packages: { apt: ["haproxy"], rpm: ["haproxy"] },
      binaries: ["haproxy"],
      systemd: ["haproxy.service"],
      ports: [80, 443, 8404]
    },
    configFiles: ["/etc/haproxy/haproxy.cfg"],
    configGlobs: ["/etc/haproxy/conf.d/*.cfg"],
    extraSecretPatterns: ["ssl", "crt", "ca-file"],
    dataPaths: ["/etc/haproxy/certs", "/var/lib/haproxy"],
    references: [
      { pattern: "bind", type: "serviceDependency" },
      { pattern: "server", type: "serviceDependency" },
      { pattern: "crt", type: "secretFile" },
      { pattern: "ca-file", type: "secretFile" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["TLS certificates", "backend services", "stats socket access"] },
    security: { risk: "review", notes: ["HAProxy configs can reference TLS private keys and backend service addresses."] },
    crossDistro: { packageMap: { apt: ["haproxy"], dnf: ["haproxy"], yum: ["haproxy"], pacman: ["haproxy"], apk: ["haproxy"] }, serviceMap: { debian: ["haproxy"], rhel: ["haproxy"], fedora: ["haproxy"], arch: ["haproxy"], alpine: ["haproxy"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["haproxy"], validate: ["haproxy -c -f /etc/haproxy/haproxy.cfg", "systemctl is-active haproxy"] }
  }),
  nativeRule({
    id: "apache",
    displayName: "Apache HTTP Server",
    capabilityKey: "web-server.apache",
    capability: "web-server.http",
    category: "service",
    detect: {
      packages: { apt: ["apache2", "libapache2-mod-php"], rpm: ["httpd", "mod_ssl"] },
      binaries: ["apache2", "httpd", "apachectl"],
      systemd: ["apache2.service", "httpd.service"],
      ports: [80, 443]
    },
    configFiles: ["/etc/apache2/apache2.conf", "/etc/httpd/conf/httpd.conf"],
    configGlobs: ["/etc/apache2/sites-available/*.conf", "/etc/apache2/sites-enabled/*.conf", "/etc/apache2/mods-enabled/*.load", "/etc/apache2/mods-enabled/*.conf", "/etc/httpd/conf.d/*.conf"],
    configExclude: ["/etc/apache2/sites-available/000-default.conf"],
    extraSecretPatterns: ["SSLCertificateKeyFile", "AuthUserFile"],
    dataPaths: ["/var/www", "/srv/www"],
    references: [
      { pattern: "Include", type: "configInclude" },
      { pattern: "DocumentRoot", type: "filesystemPath" },
      { pattern: "SSLCertificateKeyFile", type: "secretFile" },
      { pattern: "ProxyPass", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["site roots", "TLS certificates", "enabled module state", "php-fpm or mod_php coupling"] },
    security: { risk: "review", notes: ["Apache vhosts can reference TLS keys, .htaccess policies, PHP handlers, and upstream services."] },
    crossDistro: { packageMap: { apt: ["apache2"], dnf: ["httpd"], yum: ["httpd"], pacman: ["apache"], apk: ["apache2"] }, serviceMap: { debian: ["apache2"], rhel: ["httpd"], fedora: ["httpd"], arch: ["httpd"], alpine: ["apache2"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["apache2", "httpd"], validate: ["apachectl configtest", "systemctl is-active apache2 || systemctl is-active httpd"] }
  }),
  nativeRule({
    id: "php-fpm",
    displayName: "PHP-FPM",
    capabilityKey: "runtime.php-fpm",
    category: "service",
    detect: {
      packages: { apt: ["php-fpm", "php8.2-fpm", "php8.3-fpm"], rpm: ["php-fpm"] },
      binaries: ["php-fpm", "php-fpm8.2", "php-fpm8.3"],
      systemd: ["php-fpm.service", "php8.2-fpm.service", "php8.3-fpm.service"],
      ports: [9000]
    },
    configGlobs: ["/etc/php/*/fpm/php-fpm.conf", "/etc/php/*/fpm/pool.d/*.conf", "/etc/php-fpm.conf", "/etc/php-fpm.d/*.conf"],
    extraSecretPatterns: ["env[", "php_admin_value"],
    dataPaths: ["/var/lib/php/sessions", "/run/php"],
    references: [
      { pattern: "include", type: "configInclude" },
      { pattern: "listen", type: "serviceDependency" },
      { pattern: "chdir", type: "filesystemPath" },
      { pattern: "env[", type: "secretFile" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["pool sizing", "socket paths", "per-app env secrets", "web-server upstream coupling"] },
    security: { risk: "review", notes: ["PHP-FPM pool configs may contain environment secrets and app-specific socket/user settings."] },
    crossDistro: { packageMap: { apt: ["php-fpm"], dnf: ["php-fpm"], yum: ["php-fpm"], pacman: ["php-fpm"], apk: ["php-fpm"] }, serviceMap: { debian: ["php8.2-fpm", "php8.3-fpm", "php-fpm"], rhel: ["php-fpm"], fedora: ["php-fpm"], arch: ["php-fpm"], alpine: ["php-fpm"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["php-fpm", "php8.2-fpm", "php8.3-fpm"], validate: ["php-fpm -t || php-fpm8.2 -t || php-fpm8.3 -t", "systemctl is-active php-fpm || systemctl is-active php8.2-fpm || systemctl is-active php8.3-fpm"] }
  }),
  nativeRule({
    id: "docker",
    displayName: "Docker",
    capabilityKey: "container.docker",
    capability: "container.runtime",
    supportLevel: "full-migration",
    category: "container",
    detect: {
      packages: { apt: ["docker.io", "docker-ce", "docker-compose-plugin"], rpm: ["docker-ce", "moby-engine"] },
      binaries: ["docker", "docker-compose"],
      systemd: ["docker.service"],
      ports: []
    },
    configFiles: ["/etc/docker/daemon.json"],
    configGlobs: [
      "/opt/*/docker-compose.yml", "/opt/*/compose.yaml", "/opt/*/.env",
      "/srv/*/docker-compose.yml", "/srv/*/compose.yaml", "/srv/*/.env"
    ],
    configMaxSizeKB: 256,
    dataPaths: ["/var/lib/docker"],
    references: [
      { pattern: "docker-compose.yml", type: "configInclude" },
      { pattern: "compose.yaml", type: "configInclude" },
      { pattern: ".env", type: "envFile" },
      { pattern: "volumes:", type: "filesystemPath" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["compose env files", "bind mounts", "named volumes", "external networks"] },
    security: { risk: "privileged", notes: ["Do not blindly migrate /var/lib/docker; prefer compose, env files, bind mounts, and volume inventory."] },
    crossDistro: { packageMap: { apt: ["docker.io"], dnf: ["docker-ce"], yum: ["docker-ce"], pacman: ["docker"], apk: ["docker"] }, serviceMap: { debian: ["docker"], rhel: ["docker"], fedora: ["docker"], arch: ["docker"], alpine: ["docker"] } },
    migrate: { data: "optional", strategy: "copy-with-review", restartServices: ["docker"], validate: ["docker version", "docker compose version"] }
  }),
  nativeRule({
    id: "postgresql",
    displayName: "PostgreSQL",
    capabilityKey: "database.postgresql",
    category: "database",
    detect: {
      packages: { apt: ["postgresql", "postgresql-16", "postgresql-client"], rpm: ["postgresql", "postgresql-server"] },
      binaries: ["psql"],
      systemd: ["postgresql.service"],
      ports: [5432]
    },
    configGlobs: ["/etc/postgresql/*/main/postgresql.conf", "/etc/postgresql/*/main/pg_hba.conf"],
    dataPaths: ["/var/lib/postgresql"],
    references: [{ pattern: "data_directory", type: "filesystemPath" }, { pattern: "include", type: "configInclude" }],
    migrationCompleteness: { configOnly: "insufficient", missingRisks: ["roles", "databases", "extensions", "logical dump/restore"] },
    security: { risk: "privileged", notes: ["Database data should use logical dump/restore before any filesystem copy is considered."] },
    crossDistro: { packageMap: { apt: ["postgresql"], dnf: ["postgresql-server"], yum: ["postgresql-server"], pacman: ["postgresql"], apk: ["postgresql"] }, serviceMap: { debian: ["postgresql"], rhel: ["postgresql"], fedora: ["postgresql"], arch: ["postgresql"], alpine: ["postgresql"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["postgresql"], validate: ["psql -c 'select 1'", "systemctl is-active postgresql"] }
  }),
  nativeRule({
    id: "mysql",
    displayName: "MySQL / MariaDB",
    capabilityKey: "database.mysql",
    capability: "database.mysql-compatible",
    category: "database",
    detect: {
      packages: { apt: ["mysql-server", "mariadb-server"], rpm: ["mysql-server", "mariadb-server"] },
      binaries: ["mysql"],
      systemd: ["mysql.service", "mariadb.service"],
      ports: [3306]
    },
    configFiles: ["/etc/mysql/my.cnf"],
    configGlobs: ["/etc/mysql/mysql.conf.d/*.cnf", "/etc/mysql/mariadb.conf.d/*.cnf"],
    dataPaths: ["/var/lib/mysql"],
    references: [{ pattern: "!includedir", type: "configInclude" }, { pattern: "datadir", type: "filesystemPath" }],
    migrationCompleteness: { configOnly: "insufficient", missingRisks: ["users", "grants", "databases", "logical dump/restore"] },
    security: { risk: "privileged", notes: ["Prefer mysqldump/mariadb-dump; config may include credentials or socket paths."] },
    crossDistro: { packageMap: { apt: ["mysql-server", "mariadb-server"], dnf: ["mysql-server", "mariadb-server"], yum: ["mysql-server", "mariadb-server"], pacman: ["mariadb"], apk: ["mariadb"] }, serviceMap: { debian: ["mysql", "mariadb"], rhel: ["mysqld", "mariadb"], fedora: ["mysqld", "mariadb"], arch: ["mariadb"], alpine: ["mariadb"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["mysql", "mariadb"], validate: ["mysqladmin ping", "mysql --execute 'select 1'"] }
  }),
  nativeRule({
    id: "redis",
    displayName: "Redis",
    capabilityKey: "cache.redis",
    capability: "database.redis-cache",
    category: "database",
    detect: {
      packages: { apt: ["redis", "redis-server"], rpm: ["redis", "redis6"] },
      binaries: ["redis-server", "redis-cli"],
      systemd: ["redis.service", "redis-server.service"],
      ports: [6379]
    },
    configFiles: ["/etc/redis/redis.conf"],
    extraSecretPatterns: ["requirepass"],
    dataPaths: ["/var/lib/redis"],
    references: [{ pattern: "dir", type: "filesystemPath" }, { pattern: "include", type: "configInclude" }],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["RDB/AOF persistence files", "ACLs", "requirepass secrets"] },
    security: { risk: "review", notes: ["redis.conf may contain requirepass and persistence paths."] },
    crossDistro: { packageMap: { apt: ["redis-server"], dnf: ["redis"], yum: ["redis"], pacman: ["redis"], apk: ["redis"] }, serviceMap: { debian: ["redis-server", "redis"], rhel: ["redis"], fedora: ["redis"], arch: ["redis"], alpine: ["redis"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["redis", "redis-server"], validate: ["redis-cli ping"] }
  }),
  nativeRule({
    id: "nodejs",
    displayName: "Node.js / npm",
    capabilityKey: "runtime.nodejs",
    supportLevel: "managed-config",
    category: "runtime",
    detect: {
      packages: { apt: ["nodejs", "npm"], rpm: ["nodejs", "npm"], npm: ["npm"] },
      binaries: ["node", "npm"]
    },
    configFiles: ["~/.npmrc"],
    configMaxSizeKB: 64,
    extraSecretPatterns: ["_authToken"],
    references: [{ pattern: "registry", type: "serviceDependency" }, { pattern: "_authToken", type: "secretFile" }],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["project package-lock files", "nvm/asdf versions", "npm auth tokens"] },
    security: { risk: "review", notes: ["~/.npmrc may contain auth tokens and private registry credentials."] },
    crossDistro: { packageMap: { apt: ["nodejs", "npm"], dnf: ["nodejs", "npm"], yum: ["nodejs", "npm"], pacman: ["nodejs", "npm"], apk: ["nodejs", "npm"] }, serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] } },
    migrate: { data: "none", strategy: "template-or-copy", validate: ["node --version", "npm --version"] }
  }),
  nativeRule({
    id: "nodejs-version-mgr",
    displayName: "NVM Node version manager",
    capabilityKey: "runtime.nodejs.nvm",
    category: "runtime",
    detect: {
      packages: { apt: ["curl", "git", "ca-certificates", "build-essential"], rpm: ["curl", "git", "ca-certificates", "gcc-c++", "make"] },
      binaries: ["node", "npm", "npx"]
    },
    configFiles: ["~/.nvm/nvm.sh", "~/.nvm/alias/default", "~/.npmrc", "~/.bashrc", "~/.zshrc", "~/.profile"],
    configGlobs: ["~/.nvm/versions/node/*/etc/npmrc", "~/.config/npm/*"],
    configMaxSizeKB: 128,
    extraSecretPatterns: ["_authToken", "NVM_DIR"],
    dataPaths: ["~/.nvm"],
    references: [
      { pattern: "NVM_DIR", type: "filesystemPath" },
      { pattern: "nvm.sh", type: "configInclude" },
      { pattern: "registry", type: "serviceDependency" },
      { pattern: "_authToken", type: "secretFile" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["per-user Node versions", "global npm packages", "npm cache", "private registry tokens"] },
    security: { risk: "safe", notes: ["NVM is per-user; shell init and npm credentials are surfaced for review while caches are rebuilt."] },
    crossDistro: { packageMap: { apt: ["curl", "git", "ca-certificates", "build-essential"], dnf: ["curl", "git", "ca-certificates", "gcc-c++", "make"], yum: ["curl", "git", "ca-certificates", "gcc-c++", "make"], pacman: ["curl", "git", "base-devel"], apk: ["curl", "git", "build-base"] }, serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] } },
    migrate: { data: "optional", strategy: "manual-review", validate: ["bash -lc 'source ~/.nvm/nvm.sh 2>/dev/null && nvm --version || node --version'"] }
  }),
  nativeRule({
    id: "python",
    displayName: "Python / pip",
    capabilityKey: "runtime.python",
    supportLevel: "managed-config",
    category: "runtime",
    detect: {
      packages: { apt: ["python3", "python3-pip", "pipx"], rpm: ["python3", "python3-pip", "pipx"], pip: ["pip", "pipx"] },
      binaries: ["python3", "pip3", "pipx"]
    },
    configFiles: ["~/.config/pip/pip.conf", "/etc/pip.conf"],
    configMaxSizeKB: 64,
    references: [{ pattern: "index-url", type: "serviceDependency" }, { pattern: "extra-index-url", type: "serviceDependency" }],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["venvs", "requirements files", "pipx apps", "private index credentials"] },
    security: { risk: "review", notes: ["pip config can include private index URLs with embedded credentials."] },
    crossDistro: { packageMap: { apt: ["python3", "python3-pip", "pipx"], dnf: ["python3", "python3-pip", "pipx"], yum: ["python3", "python3-pip"], pacman: ["python", "python-pip", "python-pipx"], apk: ["python3", "py3-pip"] }, serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] } },
    migrate: { data: "none", strategy: "template-or-copy", validate: ["python3 --version", "pip3 --version"] }
  }),
  nativeRule({
    id: "pyenv-toolchain",
    displayName: "pyenv Python version manager",
    capabilityKey: "runtime.python.pyenv",
    capability: "runtime.python.pyenv",
    supportLevel: "full-migration",
    category: "runtime",
    detect: {
      packages: { apt: ["curl", "git", "build-essential", "libssl-dev", "zlib1g-dev", "libbz2-dev", "libreadline-dev", "libsqlite3-dev", "xz-utils", "tk-dev", "libffi-dev"], rpm: ["curl", "git", "gcc", "make", "openssl-devel", "zlib-devel", "bzip2", "bzip2-devel", "readline-devel", "sqlite-devel", "xz", "tk-devel", "libffi-devel"] },
      binaries: ["pyenv", "python", "python3"]
    },
    configFiles: ["~/.pyenv/version", "~/.python-version", "~/.config/pip/pip.conf", "~/.bashrc", "~/.zshrc", "~/.profile"],
    configGlobs: ["~/.pyenv/plugins/*", "~/.pyenv/versions/*/pip.conf"],
    configMaxSizeKB: 128,
    extraSecretPatterns: ["PYENV_ROOT", "index-url", "extra-index-url"],
    dataPaths: ["~/.pyenv"],
    references: [
      { pattern: "PYENV_ROOT", type: "filesystemPath" },
      { pattern: "pyenv init", type: "configInclude" },
      { pattern: "index-url", type: "serviceDependency" },
      { pattern: "extra-index-url", type: "secretFile" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["compiled Python versions", "pyenv plugins", "pip private indexes", "virtualenvs"] },
    security: { risk: "safe", notes: ["pyenv builds are per-user; Python versions and virtualenvs are rebuilt or explicitly reviewed."] },
    crossDistro: { packageMap: { apt: ["curl", "git", "build-essential", "libssl-dev", "zlib1g-dev", "libbz2-dev", "libreadline-dev", "libsqlite3-dev", "xz-utils", "tk-dev", "libffi-dev"], dnf: ["curl", "git", "gcc", "make", "openssl-devel", "zlib-devel", "bzip2", "bzip2-devel", "readline-devel", "sqlite-devel", "xz", "tk-devel", "libffi-devel"], yum: ["curl", "git", "gcc", "make", "openssl-devel", "zlib-devel", "bzip2", "bzip2-devel", "readline-devel", "sqlite-devel", "xz", "tk-devel", "libffi-devel"], pacman: ["curl", "git", "base-devel", "openssl", "zlib", "bzip2", "readline", "sqlite", "xz", "tk", "libffi"], apk: ["curl", "git", "build-base", "openssl-dev", "zlib-dev", "bzip2-dev", "readline-dev", "sqlite-dev", "xz", "tk-dev", "libffi-dev"] }, serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] } },
    migrate: { data: "optional", strategy: "manual-review", validate: ["pyenv --version || python3 --version"] }
  }),
  nativeRule({
    id: "php",
    displayName: "PHP / Composer",
    capabilityKey: "runtime.php",
    category: "runtime",
    detect: {
      packages: { apt: ["php", "php-cli", "composer"], rpm: ["php", "php-cli", "composer"] },
      binaries: ["php", "composer"]
    },
    configFiles: ["~/.composer/config.json", "~/.config/composer/config.json"],
    configGlobs: ["/etc/php/*/cli/php.ini", "/etc/php.d/*.ini", "/etc/php/*/mods-available/*.ini"],
    configMaxSizeKB: 128,
    extraSecretPatterns: ["github-oauth", "gitlab-token", "http-basic"],
    references: [
      { pattern: "extension", type: "serviceDependency" },
      { pattern: "include_path", type: "filesystemPath" },
      { pattern: "github-oauth", type: "secretFile" },
      { pattern: "repositories", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["project composer.lock files", "global Composer packages", "private repository tokens"] },
    security: { risk: "review", notes: ["Composer config can contain private repository credentials and OAuth tokens."] },
    crossDistro: { packageMap: { apt: ["php-cli", "composer"], dnf: ["php-cli", "composer"], yum: ["php-cli", "composer"], pacman: ["php", "composer"], apk: ["php", "composer"] }, serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] } },
    migrate: { data: "none", strategy: "template-or-copy", validate: ["php --version", "composer --version"] }
  }),
  nativeRule({
    id: "ruby",
    displayName: "Ruby / Bundler",
    capabilityKey: "runtime.ruby",
    category: "runtime",
    detect: {
      packages: { apt: ["ruby", "ruby-full", "bundler"], rpm: ["ruby", "rubygems", "rubygem-bundler"] },
      binaries: ["ruby", "gem", "bundle", "bundler"]
    },
    configFiles: ["~/.gemrc", "~/.bundle/config"],
    configGlobs: ["/etc/gemrc", "/usr/local/etc/gemrc"],
    configMaxSizeKB: 128,
    extraSecretPatterns: ["rubygems_api_key", "BUNDLE_"],
    references: [
      { pattern: "gem:", type: "serviceDependency" },
      { pattern: "sources:", type: "serviceDependency" },
      { pattern: "path:", type: "filesystemPath" },
      { pattern: "rubygems_api_key", type: "secretFile" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["project Gemfile.lock files", "global gemsets", "private gem credentials"] },
    security: { risk: "review", notes: ["RubyGems and Bundler configs may contain private source credentials."] },
    crossDistro: { packageMap: { apt: ["ruby-full", "bundler"], dnf: ["ruby", "rubygem-bundler"], yum: ["ruby", "rubygem-bundler"], pacman: ["ruby", "ruby-bundler"], apk: ["ruby", "ruby-bundler"] }, serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] } },
    migrate: { data: "none", strategy: "template-or-copy", validate: ["ruby --version", "gem --version", "bundle --version"] }
  }),
  nativeRule({
    id: "golang",
    displayName: "Go",
    capabilityKey: "runtime.go",
    category: "runtime",
    detect: {
      packages: { apt: ["golang-go"], rpm: ["golang"] },
      binaries: ["go", "gofmt"]
    },
    configFiles: ["~/.config/go/env"],
    configGlobs: ["/etc/profile.d/go*.sh"],
    configMaxSizeKB: 64,
    extraSecretPatterns: ["GOPRIVATE", "GONOSUMDB"],
    references: [
      { pattern: "GOPRIVATE", type: "serviceDependency" },
      { pattern: "GONOSUMDB", type: "serviceDependency" },
      { pattern: "GOMODCACHE", type: "filesystemPath" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["project go.mod files", "module cache", "private module access"] },
    security: { risk: "review", notes: ["Go env can reveal private module domains; module cache is rebuilt, not copied."] },
    crossDistro: { packageMap: { apt: ["golang-go"], dnf: ["golang"], yum: ["golang"], pacman: ["go"], apk: ["go"] }, serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] } },
    migrate: { data: "none", strategy: "template-or-copy", validate: ["go version"] }
  }),
  nativeRule({
    id: "openjdk",
    displayName: "OpenJDK / Maven",
    capabilityKey: "runtime.java",
    category: "runtime",
    detect: {
      packages: { apt: ["default-jdk", "openjdk-17-jdk", "maven"], rpm: ["java-17-openjdk-devel", "maven"] },
      binaries: ["java", "javac", "mvn"]
    },
    configFiles: ["~/.m2/settings.xml", "/etc/maven/settings.xml"],
    configGlobs: ["/etc/java-*/**/*.conf"],
    configMaxSizeKB: 128,
    extraSecretPatterns: ["<password>", "<privateKey>"],
    references: [
      { pattern: "<mirror>", type: "serviceDependency" },
      { pattern: "<server>", type: "secretFile" },
      { pattern: "localRepository", type: "filesystemPath" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["project pom/gradle files", "Maven local repository", "private repository credentials"] },
    security: { risk: "review", notes: ["Maven settings may contain repository credentials; local artifact cache is rebuilt."] },
    crossDistro: { packageMap: { apt: ["default-jdk", "maven"], dnf: ["java-17-openjdk-devel", "maven"], yum: ["java-17-openjdk-devel", "maven"], pacman: ["jdk-openjdk", "maven"], apk: ["openjdk17", "maven"] }, serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] } },
    migrate: { data: "none", strategy: "template-or-copy", validate: ["java -version", "javac -version", "mvn --version"] }
  }),
  nativeRule({
    id: "rust",
    displayName: "Rust / Cargo",
    capabilityKey: "runtime.rust",
    capability: "runtime.rust",
    supportLevel: "full-migration",
    category: "runtime",
    detect: {
      packages: { apt: ["rustc", "cargo"], rpm: ["rust", "cargo"] },
      binaries: ["rustc", "cargo"]
    },
    configFiles: ["~/.cargo/config.toml", "~/.cargo/credentials.toml"],
    configGlobs: ["/etc/cargo/config.toml"],
    configMaxSizeKB: 128,
    extraSecretPatterns: ["token", "registry"],
    references: [
      { pattern: "registry", type: "serviceDependency" },
      { pattern: "credential-provider", type: "secretFile" },
      { pattern: "target-dir", type: "filesystemPath" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["project Cargo.lock files", "target directories", "private registry tokens"] },
    security: { risk: "review", notes: ["Cargo credentials and private registries require review; build artifacts are rebuilt."] },
    crossDistro: { packageMap: { apt: ["rustc", "cargo"], dnf: ["rust", "cargo"], yum: ["rust", "cargo"], pacman: ["rust"], apk: ["rust", "cargo"] }, serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] } },
    migrate: { data: "none", strategy: "template-or-copy", validate: ["rustc --version", "cargo --version"] }
  }),
  nativeRule({
    id: "dotnet",
    displayName: ".NET SDK",
    capabilityKey: "runtime.dotnet",
    category: "runtime",
    detect: {
      packages: { apt: ["dotnet-sdk-8.0", "dotnet-runtime-8.0"], rpm: ["dotnet-sdk-8.0", "dotnet-runtime-8.0"] },
      binaries: ["dotnet"]
    },
    configFiles: ["~/.nuget/NuGet/NuGet.Config", "/etc/nuget/NuGet.Config"],
    configGlobs: ["~/.dotnet/tools/.store/*"],
    configMaxSizeKB: 128,
    extraSecretPatterns: ["ClearTextPassword", "apikey"],
    references: [
      { pattern: "packageSources", type: "serviceDependency" },
      { pattern: "packageSourceCredentials", type: "secretFile" },
      { pattern: "globalPackagesFolder", type: "filesystemPath" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["project restore state", "NuGet package cache", "private feed credentials"] },
    security: { risk: "review", notes: ["NuGet.Config can contain private feed credentials; package caches are rebuilt."] },
    crossDistro: { packageMap: { apt: ["dotnet-sdk-8.0"], dnf: ["dotnet-sdk-8.0"], yum: ["dotnet-sdk-8.0"], pacman: ["dotnet-sdk"], apk: ["dotnet8-sdk"] }, serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] } },
    migrate: { data: "none", strategy: "template-or-copy", validate: ["dotnet --version"] }
  }),
  nativeRule({
    id: "git",
    displayName: "Git",
    capabilityKey: "developer.git",
    category: "developer",
    detect: {
      packages: { apt: ["git"], rpm: ["git"] },
      binaries: ["git"]
    },
    configFiles: ["~/.gitconfig", "~/.config/git/config", "/etc/gitconfig"],
    configMaxSizeKB: 128,
    extraSecretPatterns: ["credential.helper", "insteadOf"],
    references: [
      { pattern: "include.path", type: "configInclude" },
      { pattern: "credential.helper", type: "secretFile" },
      { pattern: "url.", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["repository working trees", "credential helpers", "SSH/GPG signing keys"] },
    security: { risk: "review", notes: ["Git configs can point to credential helpers and signing keys; repositories are not copied by this card."] },
    crossDistro: { packageMap: { apt: ["git"], dnf: ["git"], yum: ["git"], pacman: ["git"], apk: ["git"] }, serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] } },
    migrate: { data: "none", strategy: "copy-with-review", validate: ["git --version"] }
  }),
  nativeRule({
    id: "ansible",
    displayName: "Ansible",
    capabilityKey: "developer.ansible",
    capability: "developer.ansible",
    supportLevel: "full-migration",
    category: "developer",
    detect: {
      packages: { apt: ["ansible"], rpm: ["ansible-core"] },
      binaries: ["ansible", "ansible-playbook"]
    },
    configFiles: ["/etc/ansible/ansible.cfg", "~/.ansible.cfg"],
    configGlobs: ["/etc/ansible/hosts", "~/ansible/inventory*"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["vault_password_file", "private_key_file"],
    references: [
      { pattern: "inventory", type: "filesystemPath" },
      { pattern: "vault_password_file", type: "secretFile" },
      { pattern: "private_key_file", type: "secretFile" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["inventories", "vault passwords", "collections cache", "SSH keys"] },
    security: { risk: "review", notes: ["Ansible inventories and vault password references require review before transport."] },
    crossDistro: { packageMap: { apt: ["ansible"], dnf: ["ansible-core"], yum: ["ansible-core"], pacman: ["ansible"], apk: ["ansible"] }, serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] } },
    migrate: { data: "none", strategy: "copy-with-review", validate: ["ansible --version", "ansible-playbook --version"] }
  }),
  nativeRule({
    id: "terraform",
    displayName: "Terraform",
    capabilityKey: "developer.terraform",
    capability: "developer.terraform",
    supportLevel: "full-migration",
    category: "developer",
    detect: {
      packages: { apt: ["terraform"], rpm: ["terraform"] },
      binaries: ["terraform"]
    },
    configFiles: ["~/.terraformrc", "~/.terraform.d/credentials.tfrc.json"],
    configGlobs: ["~/.terraform.d/plugin-cache/*"],
    configMaxSizeKB: 128,
    extraSecretPatterns: ["credentials", "token"],
    references: [
      { pattern: "credentials", type: "secretFile" },
      { pattern: "plugin_cache_dir", type: "filesystemPath" },
      { pattern: "provider_installation", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["terraform.tfstate files", "provider plugins", "cloud credentials"] },
    security: { risk: "review", notes: ["Terraform state is project-owned and must not be migrated automatically."] },
    crossDistro: { packageMap: { apt: ["terraform"], dnf: ["terraform"], yum: ["terraform"], pacman: ["terraform"], apk: ["terraform"] }, serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] } },
    migrate: { data: "none", strategy: "copy-with-review", validate: ["terraform version"] }
  }),
  nativeRule({
    id: "kubectl",
    displayName: "kubectl / Helm",
    capabilityKey: "developer.kubectl",
    capability: "developer.kubernetes-client",
    supportLevel: "full-migration",
    category: "developer",
    detect: {
      packages: { apt: ["kubectl", "helm"], rpm: ["kubectl", "helm"] },
      binaries: ["kubectl", "helm"]
    },
    configFiles: ["~/.kube/config", "/etc/kubernetes/admin.conf"],
    configGlobs: ["~/.config/helm/repositories.yaml", "~/.config/helm/registry/config.json"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["client-key-data", "token", "certificate-authority-data"],
    references: [
      { pattern: "cluster:", type: "serviceDependency" },
      { pattern: "client-key-data", type: "secretFile" },
      { pattern: "certificate-authority", type: "filesystemPath" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["cluster credentials", "helm registry tokens", "current context drift"] },
    security: { risk: "review", notes: ["Kubeconfigs contain credentials and cluster endpoints; transport requires explicit review."] },
    crossDistro: { packageMap: { apt: ["kubectl", "helm"], dnf: ["kubectl", "helm"], yum: ["kubectl", "helm"], pacman: ["kubectl", "helm"], apk: ["kubectl", "helm"] }, serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] } },
    migrate: { data: "none", strategy: "copy-with-review", validate: ["kubectl version --client", "helm version"] }
  }),
  nativeRule({
    id: "flutter-sdk",
    displayName: "Flutter SDK",
    capabilityKey: "developer.flutter",
    capability: "developer.flutter",
    supportLevel: "full-migration",
    category: "developer",
    detect: {
      packages: { apt: ["git", "curl", "unzip", "xz-utils"], rpm: ["git", "curl", "unzip", "xz"] },
      binaries: ["flutter", "dart"]
    },
    configFiles: ["~/.flutter_settings", "~/.pub-cache/credentials.json", "~/.bashrc", "~/.zshrc", "~/.profile"],
    configGlobs: ["~/.config/flutter/*", "~/.pub-cache/hosted/*"],
    configMaxSizeKB: 128,
    extraSecretPatterns: ["credentials.json", "PUB_HOSTED_URL", "FLUTTER_STORAGE_BASE_URL"],
    dataPaths: ["~/development/flutter", "~/.pub-cache"],
    references: [
      { pattern: "flutter", type: "filesystemPath" },
      { pattern: "PUB_HOSTED_URL", type: "serviceDependency" },
      { pattern: "credentials.json", type: "secretFile" },
      { pattern: "PATH", type: "configInclude" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["SDK clone path", "pub cache", "Android SDK", "Xcode toolchain"] },
    security: { risk: "safe", notes: ["Flutter SDK is per-user; pub credentials are surfaced for review and platform SDKs stay out of scope."] },
    crossDistro: { packageMap: { apt: ["git", "curl", "unzip", "xz-utils"], dnf: ["git", "curl", "unzip", "xz"], yum: ["git", "curl", "unzip", "xz"], pacman: ["git", "curl", "unzip", "xz"], apk: ["git", "curl", "unzip", "xz"] }, serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] } },
    migrate: { data: "optional", strategy: "manual-review", validate: ["flutter --version || dart --version"] }
  }),
  nativeRule({
    id: "rsync",
    displayName: "rsync",
    capabilityKey: "ops.backup.rsync",
    capability: "ops.backup.rsync",
    supportLevel: "full-migration",
    category: "developer",
    detect: {
      packages: { apt: ["rsync"], rpm: ["rsync"] },
      binaries: ["rsync"]
    },
    configFiles: ["/etc/rsyncd.conf", "~/.rsync-filter"],
    configGlobs: ["/etc/rsyncd.secrets"],
    configMaxSizeKB: 128,
    extraSecretPatterns: ["secrets file", "password"],
    references: [
      { pattern: "path", type: "filesystemPath" },
      { pattern: "secrets file", type: "secretFile" },
      { pattern: "hosts allow", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["module paths", "rsync secrets", "SSH keys"] },
    security: { risk: "review", notes: ["rsync daemon secrets and module paths require review; backup datasets are not copied by this card."] },
    crossDistro: { packageMap: { apt: ["rsync"], dnf: ["rsync"], yum: ["rsync"], pacman: ["rsync"], apk: ["rsync"] }, serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] } },
    migrate: { data: "none", strategy: "copy-with-review", validate: ["rsync --version"] }
  }),
  nativeRule({
    id: "ops-tools",
    displayName: "Ops monitoring tools",
    capabilityKey: "ops.monitoring.tools",
    capability: "ops.monitoring.tools",
    supportLevel: "full-migration",
    category: "developer",
    detect: {
      packages: { apt: ["htop", "iotop", "sysstat"], rpm: ["htop", "iotop", "sysstat"] },
      binaries: ["htop", "iotop", "iostat"]
    },
    configFiles: ["~/.config/htop/htoprc", "/etc/sysstat/sysstat"],
    configGlobs: ["/etc/sysstat/*.conf"],
    configMaxSizeKB: 64,
    references: [
      { pattern: "SADC_OPTIONS", type: "serviceDependency" },
      { pattern: "HISTFILE", type: "filesystemPath" }
    ],
    migrationCompleteness: { configOnly: "complete", missingRisks: ["per-user UI preferences", "historical sar data"] },
    security: { risk: "safe", notes: ["Monitoring tool configs are low risk; historical samples are not migrated."] },
    crossDistro: { packageMap: { apt: ["htop", "iotop", "sysstat"], dnf: ["htop", "iotop", "sysstat"], yum: ["htop", "iotop", "sysstat"], pacman: ["htop", "iotop", "sysstat"], apk: ["htop", "iotop", "sysstat"] }, serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] } },
    migrate: { data: "none", strategy: "template-or-copy", validate: ["htop --version || true", "iostat -V || true"] }
  }),
  nativeRule({
    id: "zsh",
    displayName: "Zsh",
    capabilityKey: "shell.zsh",
    capability: "shell.zsh",
    supportLevel: "full-migration",
    category: "developer",
    detect: {
      packages: { apt: ["zsh"], rpm: ["zsh"] },
      binaries: ["zsh"]
    },
    configFiles: ["~/.zshrc", "~/.zprofile", "~/.zshenv", "/etc/zsh/zshrc", "/etc/zshrc"],
    configGlobs: ["~/.oh-my-zsh/custom/**/*.zsh"],
    configMaxSizeKB: 128,
    extraSecretPatterns: ["export", "source"],
    references: [
      { pattern: "source", type: "configInclude" },
      { pattern: "plugins=", type: "serviceDependency" },
      { pattern: "ZSH=", type: "filesystemPath" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["default shell change", "per-user dotfiles", "custom plugins"] },
    security: { risk: "safe", notes: ["Zsh installation is package-only; chsh and user dotfiles stay operator-reviewed."] },
    crossDistro: { packageMap: { apt: ["zsh"], dnf: ["zsh"], yum: ["zsh"], pacman: ["zsh"], apk: ["zsh"] }, serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] } },
    migrate: { data: "none", strategy: "template-or-copy", validate: ["zsh --version"] }
  }),
  nativeRule({
    id: "fish",
    displayName: "Fish shell",
    capabilityKey: "shell.fish",
    capability: "shell.fish",
    supportLevel: "full-migration",
    category: "developer",
    detect: {
      packages: { apt: ["fish"], rpm: ["fish"] },
      binaries: ["fish"]
    },
    configFiles: ["~/.config/fish/config.fish", "/etc/fish/config.fish", "~/.config/starship.toml"],
    configGlobs: ["~/.config/fish/conf.d/*.fish", "~/.config/fish/functions/*.fish"],
    configMaxSizeKB: 128,
    extraSecretPatterns: ["set -x", "set -gx"],
    references: [
      { pattern: "source", type: "configInclude" },
      { pattern: "fish_add_path", type: "filesystemPath" },
      { pattern: "starship", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["default shell change", "per-user fish functions", "Starship prompt config"] },
    security: { risk: "safe", notes: ["Fish installation is package-only; default-shell switching remains manual."] },
    crossDistro: { packageMap: { apt: ["fish"], dnf: ["fish"], yum: ["fish"], pacman: ["fish"], apk: ["fish"] }, serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] } },
    migrate: { data: "none", strategy: "template-or-copy", validate: ["fish --version"] }
  }),
  nativeRule({
    id: "neovim",
    displayName: "Neovim",
    capabilityKey: "developer.neovim",
    capability: "developer.neovim",
    supportLevel: "full-migration",
    category: "developer",
    detect: {
      packages: { apt: ["neovim"], rpm: ["neovim"] },
      binaries: ["nvim"]
    },
    configFiles: ["~/.config/nvim/init.lua", "~/.config/nvim/init.vim", "/etc/xdg/nvim/sysinit.vim"],
    configGlobs: ["~/.config/nvim/lua/**/*.lua", "~/.config/nvim/plugin/*"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["token", "github.com"],
    references: [
      { pattern: "require", type: "configInclude" },
      { pattern: "plug", type: "serviceDependency" },
      { pattern: "runtimepath", type: "filesystemPath" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["plugin manager state", "LSP server binaries", "per-user cache"] },
    security: { risk: "safe", notes: ["Neovim package and reviewed config are portable; plugin caches and LSP binaries are rebuilt."] },
    crossDistro: { packageMap: { apt: ["neovim"], dnf: ["neovim"], yum: ["neovim"], pacman: ["neovim"], apk: ["neovim"] }, serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] } },
    migrate: { data: "none", strategy: "template-or-copy", validate: ["nvim --version"] }
  }),
  nativeRule({
    id: "tmux",
    displayName: "tmux",
    capabilityKey: "developer.tmux",
    capability: "developer.tmux",
    supportLevel: "full-migration",
    category: "developer",
    detect: {
      packages: { apt: ["tmux"], rpm: ["tmux"] },
      binaries: ["tmux"]
    },
    configFiles: ["~/.tmux.conf", "~/.config/tmux/tmux.conf", "/etc/tmux.conf"],
    configGlobs: ["~/.tmux/*.conf", "~/.config/tmux/plugins/*"],
    configMaxSizeKB: 128,
    extraSecretPatterns: ["run-shell", "set-environment"],
    references: [
      { pattern: "source-file", type: "configInclude" },
      { pattern: "run-shell", type: "serviceDependency" },
      { pattern: "@plugin", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["live sessions", "plugin directories", "per-user tmux state"] },
    security: { risk: "safe", notes: ["tmux config may run shell hooks; hooks are surfaced for review."] },
    crossDistro: { packageMap: { apt: ["tmux"], dnf: ["tmux"], yum: ["tmux"], pacman: ["tmux"], apk: ["tmux"] }, serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] } },
    migrate: { data: "none", strategy: "template-or-copy", validate: ["tmux -V"] }
  }),
  nativeRule({
    id: "modern-cli-tools",
    displayName: "Modern CLI tools",
    capabilityKey: "developer.cli-tools",
    capability: "developer.cli-tools",
    supportLevel: "full-migration",
    category: "developer",
    detect: {
      packages: {
        apt: ["bat", "ripgrep", "fd-find", "fd", "exa", "eza", "lsd", "zoxide", "fzf", "tldr", "tealdeer"],
        rpm: ["bat", "ripgrep", "fd-find", "fd", "exa", "eza", "lsd", "zoxide", "fzf", "tldr", "tealdeer"]
      },
      binaries: ["bat", "batcat", "rg", "fd", "fdfind", "exa", "eza", "lsd", "zoxide", "fzf", "tldr", "tealdeer"]
    },
    configFiles: ["~/.config/zoxide/config.toml", "~/.config/fzf/fzf.bash", "~/.config/fzf/fzf.zsh", "~/.tldrrc"],
    configGlobs: ["~/.config/bat/*", "~/.config/ripgrep/*", "~/.config/fd/*", "~/.config/lsd/*", "~/.config/eza/*"],
    configMaxSizeKB: 128,
    references: [
      { pattern: "FZF_DEFAULT_COMMAND", type: "serviceDependency" },
      { pattern: "BAT_THEME", type: "serviceDependency" },
      { pattern: "config", type: "filesystemPath" }
    ],
    migrationCompleteness: { configOnly: "complete", missingRisks: ["per-user shell integration", "distro package name drift", "tool caches"] },
    security: { risk: "safe", notes: ["Modern CLI tools are package/config only; caches are rebuilt."] },
    crossDistro: {
      packageMap: {
        apt: ["bat", "ripgrep", "fd-find", "eza", "lsd", "zoxide", "fzf", "tldr"],
        dnf: ["bat", "ripgrep", "fd-find", "eza", "lsd", "zoxide", "fzf", "tldr"],
        yum: ["bat", "ripgrep", "fd-find", "eza", "lsd", "zoxide", "fzf", "tldr"],
        pacman: ["bat", "ripgrep", "fd", "eza", "lsd", "zoxide", "fzf", "tldr"],
        apk: ["bat", "ripgrep", "fd", "eza", "lsd", "zoxide", "fzf", "tealdeer"]
      },
      serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] }
    },
    migrate: {
      package: true,
      config: true,
      data: "none",
      strategy: "template-or-copy",
      validate: [
        "bat --version || batcat --version || true",
        "rg --version",
        "fd --version || fdfind --version || true",
        "lsd --version || true",
        "fzf --version || true",
        "zoxide --version || true"
      ]
    }
  }),
  nativeRule({
    id: "network-monitoring-tools",
    displayName: "Network monitoring tools",
    capabilityKey: "network.monitoring.tools",
    capability: "network.monitoring.tools",
    supportLevel: "full-migration",
    category: "network",
    detect: {
      packages: { apt: ["nethogs", "vnstat", "iftop", "tcpdump", "nmap"], rpm: ["nethogs", "vnstat", "iftop", "tcpdump", "nmap"] },
      binaries: ["nethogs", "vnstat", "iftop", "tcpdump", "nmap"]
    },
    configFiles: ["/etc/vnstat.conf", "/etc/default/vnstat", "/etc/sysconfig/vnstat"],
    configGlobs: ["~/.nmap/*", "/etc/nmap/*"],
    configMaxSizeKB: 128,
    dataPaths: ["/var/lib/vnstat"],
    references: [
      { pattern: "Interface", type: "serviceDependency" },
      { pattern: "DatabaseDir", type: "filesystemPath" },
      { pattern: "tcpdump", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["packet capture privileges", "vnstat historical counters", "interface names"] },
    security: { risk: "review", notes: ["Packet capture tools require root/CAP_NET_RAW; historical vnstat counters are not migrated."] },
    crossDistro: { packageMap: { apt: ["nethogs", "vnstat", "iftop", "tcpdump", "nmap"], dnf: ["nethogs", "vnstat", "iftop", "tcpdump", "nmap"], yum: ["nethogs", "vnstat", "iftop", "tcpdump", "nmap"], pacman: ["nethogs", "vnstat", "iftop", "tcpdump", "nmap"], apk: ["nethogs", "vnstat", "iftop", "tcpdump", "nmap"] }, serviceMap: { debian: ["vnstat"], rhel: ["vnstat"], fedora: ["vnstat"], arch: ["vnstat"], alpine: ["vnstat"] } },
    migrate: { data: "none", strategy: "template-or-copy", validate: ["nethogs -V || true", "vnstat --version || true", "nmap --version"] }
  }),
  nativeRule({
    id: "memcached",
    displayName: "Memcached",
    capabilityKey: "cache.memcached",
    capability: "cache.memcached",
    supportLevel: "full-migration",
    category: "database",
    detect: {
      packages: { apt: ["memcached"], rpm: ["memcached"] },
      binaries: ["memcached", "memcached-tool"],
      systemd: ["memcached.service"],
      ports: [11211]
    },
    configFiles: ["/etc/memcached.conf", "/etc/default/memcached", "/etc/sysconfig/memcached"],
    configMaxSizeKB: 128,
    references: [
      { pattern: "-l", type: "serviceDependency" },
      { pattern: "-m", type: "serviceDependency" },
      { pattern: "OPTIONS", type: "configInclude" }
    ],
    migrationCompleteness: { configOnly: "complete", missingRisks: ["bind address review", "memory limit tuning", "no persistent cache data"] },
    security: { risk: "review", notes: ["Memcached is in-memory only; bind address and memory caps require review before exposure."] },
    crossDistro: { packageMap: { apt: ["memcached"], dnf: ["memcached"], yum: ["memcached"], pacman: ["memcached"], apk: ["memcached"] }, serviceMap: { debian: ["memcached"], rhel: ["memcached"], fedora: ["memcached"], arch: ["memcached"], alpine: ["memcached"] } },
    migrate: { data: "none", strategy: "template-or-copy", restartServices: ["memcached"], validate: ["memcached -h", "systemctl is-active memcached || true"] }
  }),
  nativeRule({
    id: "valkey",
    displayName: "Valkey",
    capabilityKey: "cache.valkey",
    capability: "cache.valkey",
    supportLevel: "full-migration",
    category: "database",
    detect: {
      packages: { apt: ["valkey-server"], rpm: ["valkey"] },
      binaries: ["valkey-server", "valkey-cli"],
      systemd: ["valkey.service", "valkey-server.service"],
      ports: [6379]
    },
    configFiles: ["/etc/valkey/valkey.conf", "/etc/valkey.conf", "/etc/default/valkey-server", "/etc/sysconfig/valkey"],
    configGlobs: ["/etc/valkey/*.conf"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["requirepass", "masterauth", "aclfile"],
    dataPaths: ["/var/lib/valkey"],
    references: [
      { pattern: "include", type: "configInclude" },
      { pattern: "dir", type: "filesystemPath" },
      { pattern: "requirepass", type: "secretFile" },
      { pattern: "replicaof", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["RDB/AOF persistence", "ACL secrets", "Redis port conflict"] },
    security: { risk: "review", notes: ["Valkey persistence uses explicit SAVE/BGSAVE review; requirepass/masterauth values are secrets."] },
    crossDistro: { packageMap: { apt: ["valkey-server"], dnf: ["valkey"], yum: ["valkey"], pacman: ["valkey"], apk: ["valkey"] }, serviceMap: { debian: ["valkey-server"], rhel: ["valkey"], fedora: ["valkey"], arch: ["valkey"], alpine: ["valkey"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["valkey", "valkey-server"], validate: ["valkey-cli ping || redis-cli ping", "systemctl is-active valkey || systemctl is-active valkey-server || true"] }
  }),
  nativeRule({
    id: "prometheus",
    displayName: "Prometheus monitoring",
    capabilityKey: "observability.metrics.prometheus",
    capability: "observability.metrics.prometheus",
    supportLevel: "full-migration",
    category: "service",
    detect: {
      packages: { apt: ["prometheus", "prometheus-node-exporter"], rpm: ["prometheus", "node_exporter"] },
      binaries: ["prometheus", "promtool", "node_exporter"],
      systemd: ["prometheus.service", "prometheus-node-exporter.service", "node_exporter.service"],
      ports: [9090, 9100]
    },
    configFiles: ["/etc/prometheus/prometheus.yml", "/etc/default/prometheus", "/etc/sysconfig/prometheus"],
    configGlobs: ["/etc/prometheus/*.yml", "/etc/prometheus/rules/*.yml", "/etc/prometheus/console_libraries/*"],
    configMaxSizeKB: 512,
    extraSecretPatterns: ["bearer_token", "bearer_token_file", "authorization", "basic_auth"],
    dataPaths: ["/var/lib/prometheus"],
    references: [
      { pattern: "scrape_configs", type: "serviceDependency" },
      { pattern: "rule_files", type: "configInclude" },
      { pattern: "alertmanagers", type: "serviceDependency" },
      { pattern: "bearer_token_file", type: "secretFile" },
      { pattern: "tls_config", type: "secretFile" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["TSDB snapshots", "remote_write credentials", "target reachability"] },
    security: { risk: "review", notes: ["Prometheus configs can contain scrape credentials and remote_write tokens; TSDB data is snapshot/restore only."] },
    crossDistro: { packageMap: { apt: ["prometheus", "prometheus-node-exporter"], dnf: ["prometheus", "node_exporter"], yum: ["prometheus", "node_exporter"], pacman: ["prometheus", "prometheus-node-exporter"], apk: ["prometheus", "prometheus-node-exporter"] }, serviceMap: { debian: ["prometheus", "prometheus-node-exporter"], rhel: ["prometheus", "node_exporter"], fedora: ["prometheus", "node_exporter"], arch: ["prometheus"], alpine: ["prometheus"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["prometheus", "prometheus-node-exporter", "node_exporter"], validate: ["promtool check config /etc/prometheus/prometheus.yml", "systemctl is-active prometheus || true"] }
  }),
  nativeRule({
    id: "grafana",
    displayName: "Grafana",
    capabilityKey: "observability.dashboard.grafana",
    capability: "observability.dashboard.grafana",
    supportLevel: "full-migration",
    category: "service",
    detect: {
      packages: { apt: ["grafana"], rpm: ["grafana"] },
      binaries: ["grafana", "grafana-server", "grafana-cli"],
      systemd: ["grafana-server.service"],
      ports: [3000]
    },
    configFiles: ["/etc/grafana/grafana.ini", "/etc/default/grafana-server", "/etc/sysconfig/grafana-server"],
    configGlobs: ["/etc/grafana/provisioning/**/*.yaml", "/etc/grafana/provisioning/**/*.yml", "/etc/grafana/provisioning/**/*.json"],
    configMaxSizeKB: 512,
    extraSecretPatterns: ["secret_key", "password", "secureJsonData", "client_secret"],
    dataPaths: ["/var/lib/grafana"],
    references: [
      { pattern: "provisioning", type: "configInclude" },
      { pattern: "datasources", type: "serviceDependency" },
      { pattern: "secureJsonData", type: "secretFile" },
      { pattern: "plugins", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["dashboard database backup", "datasource credentials", "plugin compatibility"] },
    security: { risk: "review", notes: ["Datasource credentials and Grafana secret_key are secrets; dashboard DB migration is backup/restore only."] },
    crossDistro: { packageMap: { apt: ["grafana"], dnf: ["grafana"], yum: ["grafana"], pacman: ["grafana"], apk: ["grafana"] }, serviceMap: { debian: ["grafana-server"], rhel: ["grafana-server"], fedora: ["grafana-server"], arch: ["grafana"], alpine: ["grafana"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["grafana-server", "grafana"], validate: ["curl -fsS http://127.0.0.1:3000/api/health || systemctl is-active grafana-server || true"] }
  }),
  nativeRule({
    id: "netdata",
    displayName: "Netdata monitoring",
    capabilityKey: "observability.metrics.netdata",
    capability: "observability.metrics.netdata",
    supportLevel: "full-migration",
    category: "service",
    detect: {
      packages: { apt: ["netdata"], rpm: ["netdata"] },
      binaries: ["netdata"],
      systemd: ["netdata.service"],
      ports: [19999]
    },
    configFiles: ["/etc/netdata/netdata.conf", "/etc/netdata/stream.conf", "/etc/netdata/health_alarm_notify.conf"],
    configGlobs: ["/etc/netdata/**/*.conf", "/etc/netdata/go.d/*.conf", "/etc/netdata/python.d/*.conf"],
    configMaxSizeKB: 512,
    extraSecretPatterns: ["claim_token", "api_key", "webhook", "slack"],
    dataPaths: ["/var/lib/netdata", "/var/cache/netdata"],
    references: [
      { pattern: "claim_token", type: "secretFile" },
      { pattern: "stream", type: "serviceDependency" },
      { pattern: "health_alarm_notify", type: "configInclude" },
      { pattern: "dbengine", type: "filesystemPath" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["metric history", "cloud claim tokens", "streaming parent topology"] },
    security: { risk: "review", notes: ["Netdata alert endpoints and cloud claim tokens are redacted; metric history is rebuilt unless explicitly exported."] },
    crossDistro: { packageMap: { apt: ["netdata"], dnf: ["netdata"], yum: ["netdata"], pacman: ["netdata"], apk: ["netdata"] }, serviceMap: { debian: ["netdata"], rhel: ["netdata"], fedora: ["netdata"], arch: ["netdata"], alpine: ["netdata"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["netdata"], validate: ["systemctl is-active netdata || curl -fsS http://127.0.0.1:19999/api/v1/info || true"] }
  }),
  nativeRule({
    id: "zabbix-agent",
    displayName: "Zabbix agent",
    capabilityKey: "observability.metrics.zabbix",
    capability: "observability.metrics.zabbix",
    supportLevel: "full-migration",
    category: "service",
    detect: {
      packages: { apt: ["zabbix-agent", "zabbix-agent2"], rpm: ["zabbix-agent", "zabbix-agent2"] },
      binaries: ["zabbix_agentd", "zabbix_agent2"],
      systemd: ["zabbix-agent.service", "zabbix-agent2.service"],
      ports: [10050]
    },
    configFiles: ["/etc/zabbix/zabbix_agentd.conf", "/etc/zabbix/zabbix_agent2.conf"],
    configGlobs: ["/etc/zabbix/zabbix_agentd.d/*.conf", "/etc/zabbix/zabbix_agent2.d/*.conf"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["TLSPSKFile", "TLSPSKIdentity", "UserParameter"],
    references: [
      { pattern: "Include", type: "configInclude" },
      { pattern: "Server", type: "serviceDependency" },
      { pattern: "TLSPSKFile", type: "secretFile" },
      { pattern: "UserParameter", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["Zabbix server reachability", "TLS PSK re-issue", "custom UserParameter scripts"] },
    security: { risk: "review", notes: ["Zabbix agent TLS PSK files and custom scripts require review before transport."] },
    crossDistro: { packageMap: { apt: ["zabbix-agent"], dnf: ["zabbix-agent"], yum: ["zabbix-agent"], pacman: ["zabbix-agent"], apk: ["zabbix-agent"] }, serviceMap: { debian: ["zabbix-agent"], rhel: ["zabbix-agent"], fedora: ["zabbix-agent"], arch: ["zabbix-agent"], alpine: ["zabbix-agent"] } },
    migrate: { data: "none", strategy: "template-or-copy", restartServices: ["zabbix-agent", "zabbix-agent2"], validate: ["zabbix_agentd -t agent.ping || zabbix_agent2 -t agent.ping || true", "systemctl is-active zabbix-agent || systemctl is-active zabbix-agent2 || true"] }
  }),
  nativeRule({
    id: "loki",
    displayName: "Grafana Loki",
    capabilityKey: "observability.logs.loki",
    capability: "observability.logs.loki",
    supportLevel: "full-migration",
    category: "service",
    detect: {
      packages: { apt: ["loki", "promtail"], rpm: ["loki", "promtail"] },
      binaries: ["loki", "promtail"],
      systemd: ["loki.service", "promtail.service"],
      ports: [3100]
    },
    configFiles: ["/etc/loki/loki.yaml", "/etc/loki/config.yml", "/etc/promtail/config.yml"],
    configGlobs: ["/etc/loki/*.yaml", "/etc/promtail/*.yaml"],
    configMaxSizeKB: 512,
    extraSecretPatterns: ["s3", "access_key", "secret_key", "bearer_token"],
    dataPaths: ["/var/lib/loki", "/var/lib/promtail"],
    references: [
      { pattern: "storage_config", type: "serviceDependency" },
      { pattern: "positions", type: "filesystemPath" },
      { pattern: "clients", type: "serviceDependency" },
      { pattern: "s3", type: "secretFile" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["chunk/index data", "object storage credentials", "promtail offsets"] },
    security: { risk: "review", notes: ["Loki object storage credentials are secrets; chunks and indices require operator-selected retention/export strategy."] },
    crossDistro: { packageMap: { apt: ["loki", "promtail"], dnf: ["loki", "promtail"], yum: ["loki", "promtail"], pacman: ["loki"], apk: ["loki"] }, serviceMap: { debian: ["loki", "promtail"], rhel: ["loki", "promtail"], fedora: ["loki", "promtail"], arch: ["loki"], alpine: ["loki"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["loki", "promtail"], validate: ["curl -fsS http://127.0.0.1:3100/ready || systemctl is-active loki || true"] }
  }),
  nativeRule({
    id: "mosquitto",
    displayName: "Mosquitto MQTT",
    capabilityKey: "messaging.mqtt.mosquitto",
    capability: "messaging.mqtt.mosquitto",
    supportLevel: "full-migration",
    category: "service",
    detect: {
      packages: { apt: ["mosquitto", "mosquitto-clients"], rpm: ["mosquitto"] },
      binaries: ["mosquitto", "mosquitto_pub", "mosquitto_sub"],
      systemd: ["mosquitto.service"],
      ports: [1883, 8883]
    },
    configFiles: ["/etc/mosquitto/mosquitto.conf"],
    configGlobs: ["/etc/mosquitto/conf.d/*.conf", "/etc/mosquitto/passwd*"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["password_file", "psk_file", "cafile", "certfile", "keyfile"],
    dataPaths: ["/var/lib/mosquitto"],
    references: [
      { pattern: "include_dir", type: "configInclude" },
      { pattern: "password_file", type: "secretFile" },
      { pattern: "listener", type: "serviceDependency" },
      { pattern: "bridge", type: "serviceDependency" },
      { pattern: "keyfile", type: "secretFile" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["password hashes", "TLS material", "retained messages"] },
    security: { risk: "review", notes: ["Mosquitto password files and TLS private keys are secret surfaces; retained message DB is optional."] },
    crossDistro: { packageMap: { apt: ["mosquitto", "mosquitto-clients"], dnf: ["mosquitto"], yum: ["mosquitto"], pacman: ["mosquitto"], apk: ["mosquitto", "mosquitto-clients"] }, serviceMap: { debian: ["mosquitto"], rhel: ["mosquitto"], fedora: ["mosquitto"], arch: ["mosquitto"], alpine: ["mosquitto"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["mosquitto"], validate: ["mosquitto -c /etc/mosquitto/mosquitto.conf -t || true", "systemctl is-active mosquitto || true"] }
  }),
  nativeRule({
    id: "rabbitmq",
    displayName: "RabbitMQ",
    capabilityKey: "messaging.amqp.rabbitmq",
    capability: "messaging.amqp.rabbitmq",
    supportLevel: "full-migration",
    category: "service",
    detect: {
      packages: { apt: ["rabbitmq-server"], rpm: ["rabbitmq-server"] },
      binaries: ["rabbitmqctl", "rabbitmq-diagnostics"],
      systemd: ["rabbitmq-server.service"],
      ports: [5672, 15672]
    },
    configFiles: ["/etc/rabbitmq/rabbitmq.conf", "/etc/rabbitmq/enabled_plugins", "/etc/rabbitmq/rabbitmq-env.conf"],
    configGlobs: ["/etc/rabbitmq/conf.d/*.conf", "/etc/rabbitmq/advanced.config"],
    configMaxSizeKB: 512,
    extraSecretPatterns: [".erlang.cookie", "default_pass", "ssl_options"],
    dataPaths: ["/var/lib/rabbitmq"],
    references: [
      { pattern: "enabled_plugins", type: "configInclude" },
      { pattern: "definitions", type: "filesystemPath" },
      { pattern: ".erlang.cookie", type: "secretFile" },
      { pattern: "ssl_options", type: "secretFile" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["definitions export/import", "queue contents", "Erlang cookie"] },
    security: { risk: "review", notes: ["RabbitMQ definitions and Erlang cookie are reviewed; queue contents require explicit operator strategy."] },
    crossDistro: { packageMap: { apt: ["rabbitmq-server"], dnf: ["rabbitmq-server"], yum: ["rabbitmq-server"], pacman: ["rabbitmq"], apk: ["rabbitmq-server"] }, serviceMap: { debian: ["rabbitmq-server"], rhel: ["rabbitmq-server"], fedora: ["rabbitmq-server"], arch: ["rabbitmq"], alpine: ["rabbitmq-server"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["rabbitmq-server", "rabbitmq"], validate: ["rabbitmq-diagnostics ping || systemctl is-active rabbitmq-server || true"] }
  }),
  nativeRule({
    id: "meilisearch",
    displayName: "Meilisearch",
    capabilityKey: "database.search.meilisearch",
    capability: "database.search.meilisearch",
    supportLevel: "full-migration",
    category: "database",
    detect: {
      packages: { apt: ["meilisearch"], rpm: ["meilisearch"] },
      binaries: ["meilisearch"],
      systemd: ["meilisearch.service"],
      ports: [7700]
    },
    configFiles: ["/etc/meilisearch.toml", "/etc/meilisearch/config.toml", "/etc/default/meilisearch", "/etc/sysconfig/meilisearch"],
    configGlobs: ["/etc/meilisearch/*.toml"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["MEILI_MASTER_KEY", "master_key", "api_key"],
    dataPaths: ["/var/lib/meilisearch", "./data.ms"],
    references: [
      { pattern: "master_key", type: "secretFile" },
      { pattern: "db_path", type: "filesystemPath" },
      { pattern: "dump_dir", type: "filesystemPath" },
      { pattern: "http_addr", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["dump/import flow", "master key continuity", "index rebuild window"] },
    security: { risk: "review", notes: ["Meilisearch master key and dumps must be confirmed; index data moves through dump/import."] },
    crossDistro: { packageMap: { apt: ["meilisearch"], dnf: ["meilisearch"], yum: ["meilisearch"], pacman: ["meilisearch"], apk: ["meilisearch"] }, serviceMap: { debian: ["meilisearch"], rhel: ["meilisearch"], fedora: ["meilisearch"], arch: ["meilisearch"], alpine: ["meilisearch"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["meilisearch"], validate: ["curl -fsS http://127.0.0.1:7700/health || systemctl is-active meilisearch || true"] }
  }),
  nativeRule({
    id: "jenkins",
    displayName: "Jenkins CI",
    capabilityKey: "ci.jenkins",
    capability: "ci.jenkins",
    supportLevel: "full-migration",
    category: "developer",
    detect: {
      packages: { apt: ["jenkins"], rpm: ["jenkins"] },
      binaries: ["jenkins", "jenkins-cli"],
      systemd: ["jenkins.service"],
      ports: [8080]
    },
    configFiles: ["/etc/default/jenkins", "/etc/sysconfig/jenkins", "/etc/jenkins/jenkins.yaml"],
    configGlobs: ["/var/lib/jenkins/*.xml", "/var/lib/jenkins/init.groovy.d/*.groovy"],
    configMaxSizeKB: 512,
    extraSecretPatterns: ["credentials.xml", "master.key", "secret.key", "hudson.util.Secret"],
    dataPaths: ["/var/lib/jenkins"],
    references: [
      { pattern: "JENKINS_HOME", type: "filesystemPath" },
      { pattern: "JAVA_OPTS", type: "serviceDependency" },
      { pattern: "credentials.xml", type: "secretFile" },
      { pattern: "plugins", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["JENKINS_HOME snapshot", "credentials store", "plugin compatibility"] },
    security: { risk: "review", notes: ["Jenkins credentials store and master keys are secrets; job history uses operator snapshot/export."] },
    crossDistro: { packageMap: { apt: ["jenkins"], dnf: ["jenkins"], yum: ["jenkins"], pacman: ["jenkins"], apk: ["jenkins"] }, serviceMap: { debian: ["jenkins"], rhel: ["jenkins"], fedora: ["jenkins"], arch: ["jenkins"], alpine: ["jenkins"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["jenkins"], validate: ["curl -fsS http://127.0.0.1:8080/login || systemctl is-active jenkins || true"] }
  }),
  nativeRule({
    id: "gitlab-runner",
    displayName: "GitLab Runner",
    capabilityKey: "ci.gitlab-runner",
    capability: "ci.gitlab-runner",
    supportLevel: "full-migration",
    category: "developer",
    detect: {
      packages: { apt: ["gitlab-runner"], rpm: ["gitlab-runner"] },
      binaries: ["gitlab-runner"],
      systemd: ["gitlab-runner.service"]
    },
    configFiles: ["/etc/gitlab-runner/config.toml"],
    configGlobs: ["/etc/gitlab-runner/*.toml", "/home/gitlab-runner/.gitlab-runner/*.toml"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["token", "registration-token", "tls-ca-file"],
    dataPaths: ["/home/gitlab-runner", "/var/lib/gitlab-runner"],
    references: [
      { pattern: "token", type: "secretFile" },
      { pattern: "executor", type: "serviceDependency" },
      { pattern: "builds_dir", type: "filesystemPath" },
      { pattern: "cache_dir", type: "filesystemPath" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["runner registration token", "executor dependencies", "job caches"] },
    security: { risk: "review", notes: ["GitLab Runner tokens are project/group scoped; re-registration is preferred over copying tokens."] },
    crossDistro: { packageMap: { apt: ["gitlab-runner"], dnf: ["gitlab-runner"], yum: ["gitlab-runner"], pacman: ["gitlab-runner"], apk: ["gitlab-runner"] }, serviceMap: { debian: ["gitlab-runner"], rhel: ["gitlab-runner"], fedora: ["gitlab-runner"], arch: ["gitlab-runner"], alpine: ["gitlab-runner"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["gitlab-runner"], validate: ["gitlab-runner verify || systemctl is-active gitlab-runner || true"] }
  }),
  nativeRule({
    id: "certbot",
    displayName: "Certbot / Let's Encrypt",
    capabilityKey: "security.tls.certbot",
    capability: "security.tls.acme-client",
    supportLevel: "full-migration",
    category: "security",
    detect: {
      packages: { apt: ["certbot", "python3-certbot-nginx", "python3-certbot-apache"], rpm: ["certbot", "python3-certbot-nginx", "python3-certbot-apache"] },
      binaries: ["certbot"],
      systemd: ["certbot.timer", "certbot-renew.timer"],
      ports: [80, 443]
    },
    configFiles: ["/etc/letsencrypt/cli.ini", "/etc/letsencrypt/renewal-hooks/deploy/envforge.sh"],
    configGlobs: ["/etc/letsencrypt/renewal/*.conf", "/etc/letsencrypt/renewal-hooks/*/*", "/etc/nginx/sites-enabled/*", "/etc/apache2/sites-enabled/*"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["privkey.pem", "fullchain.pem", "certbot_dns", "dns_"],
    dataPaths: ["/etc/letsencrypt"],
    references: [
      { pattern: "archive", type: "filesystemPath" },
      { pattern: "live", type: "filesystemPath" },
      { pattern: "privkey.pem", type: "secretFile" },
      { pattern: "server_name", type: "serviceDependency" },
      { pattern: "SSLCertificateFile", type: "filesystemPath" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["domain ownership", "DNS validation", "private keys", "web-server config references"] },
    security: { risk: "review", notes: ["Private keys under /etc/letsencrypt require explicit operator approval; ACME issuance is represented as a manual DNS/domain step in dry-run harnesses."] },
    crossDistro: { packageMap: { apt: ["certbot", "python3-certbot-nginx"], dnf: ["certbot", "python3-certbot-nginx"], yum: ["certbot", "python3-certbot-nginx"], pacman: ["certbot", "certbot-nginx"], apk: ["certbot", "certbot-nginx"] }, serviceMap: { debian: ["certbot.timer"], rhel: ["certbot-renew.timer"], fedora: ["certbot-renew.timer"], arch: ["certbot-renew.timer"], alpine: [] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["nginx", "apache2", "httpd"], validate: ["certbot certificates", "nginx -t", "apachectl configtest"] }
  }),
  nativeRule({
    id: "ssh",
    displayName: "OpenSSH",
    capabilityKey: "security.ssh",
    capability: "security.ssh-access",
    supportLevel: "full-migration",
    category: "security",
    detect: {
      packages: { apt: ["openssh-server", "ssh"], rpm: ["openssh-server", "openssh-clients"] },
      binaries: ["ssh", "sshd"],
      systemd: ["ssh.service", "sshd.service"],
      ports: [22]
    },
    configFiles: ["/etc/ssh/sshd_config", "~/.ssh/config"],
    configGlobs: ["/etc/ssh/sshd_config.d/*.conf"],
    configMaxSizeKB: 128,
    extraSecretPatterns: ["IdentityFile"],
    references: [{ pattern: "Include", type: "configInclude" }, { pattern: "IdentityFile", type: "secretFile" }],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["authorized_keys", "host keys", "firewall access", "lockout rollback timer"] },
    security: { risk: "privileged", notes: ["sshd_config changes must validate with sshd -t and keep the current session open."] },
    crossDistro: { packageMap: { apt: ["openssh-server"], dnf: ["openssh-server"], yum: ["openssh-server"], pacman: ["openssh"], apk: ["openssh"] }, serviceMap: { debian: ["ssh", "sshd"], rhel: ["sshd"], fedora: ["sshd"], arch: ["sshd"], alpine: ["sshd"] } },
    migrate: { data: "none", strategy: "copy-with-review", restartServices: ["ssh", "sshd"], validate: ["sshd -t"] }
  }),
  nativeRule({
    id: "ufw",
    displayName: "UFW firewall",
    capabilityKey: "security.firewall.ufw",
    category: "security",
    detect: {
      packages: { apt: ["ufw"], rpm: ["firewalld"] },
      binaries: ["ufw", "firewall-cmd"],
      systemd: ["ufw.service", "firewalld.service"]
    },
    configFiles: ["/etc/ufw/user.rules", "/etc/ufw/user6.rules", "/etc/default/ufw", "/etc/firewalld/firewalld.conf"],
    configGlobs: ["/etc/firewalld/zones/*.xml"],
    references: [
      { pattern: "allow", type: "serviceDependency" },
      { pattern: "deny", type: "serviceDependency" },
      { pattern: "firewalld", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "complete", missingRisks: ["cloud security groups must still be reviewed outside the VM"] },
    security: { risk: "privileged", notes: ["Firewall migration can lock out SSH; safeFirewallApply refuses when the current SSH port is unknown or not allowed."] },
    crossDistro: { packageMap: { apt: ["ufw"], dnf: ["firewalld"], yum: ["firewalld"], pacman: ["ufw"], apk: ["ufw"] }, serviceMap: { debian: ["ufw"], rhel: ["firewalld"], fedora: ["firewalld"], arch: ["ufw"], alpine: ["ufw"] } },
    migrate: { data: "none", strategy: "copy-with-review", restartServices: ["ufw", "firewalld"], validate: ["ufw status", "firewall-cmd --state || true"] }
  }),
  nativeRule({
    id: "firewalld",
    displayName: "firewalld dynamic firewall",
    capabilityKey: "security.firewall.firewalld",
    capability: "security.firewall.firewalld",
    supportLevel: "full-migration",
    category: "security",
    detect: {
      packages: { apt: ["firewalld"], rpm: ["firewalld"] },
      binaries: ["firewall-cmd"],
      systemd: ["firewalld.service"]
    },
    configFiles: ["/etc/firewalld/firewalld.conf"],
    configGlobs: ["/etc/firewalld/zones/*.xml", "/etc/firewalld/services/*.xml", "/etc/firewalld/policies/*.xml", "/etc/firewalld/ipsets/*.xml"],
    configMaxSizeKB: 256,
    dataPaths: ["/etc/firewalld"],
    references: [
      { pattern: "zone", type: "serviceDependency" },
      { pattern: "service", type: "serviceDependency" },
      { pattern: "port", type: "serviceDependency" },
      { pattern: "source", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "complete", missingRisks: ["SSH lockout protection", "cloud security groups", "UFW/firewalld exclusivity"] },
    security: { risk: "privileged", notes: ["firewalld rules can lock out SSH; apply requires a public-zone SSH check and rollback timer."] },
    crossDistro: { packageMap: { apt: ["firewalld"], dnf: ["firewalld"], yum: ["firewalld"], pacman: ["firewalld"], apk: ["firewalld"] }, serviceMap: { debian: ["firewalld"], rhel: ["firewalld"], fedora: ["firewalld"], arch: ["firewalld"], alpine: ["firewalld"] } },
    migrate: { data: "optional", strategy: "copy-with-review", restartServices: ["firewalld"], validate: ["firewall-cmd --check-config", "firewall-cmd --state"] }
  }),
  nativeRule({
    id: "wireguard",
    displayName: "WireGuard VPN server",
    capabilityKey: "network.vpn.wireguard",
    capability: "network.vpn.wireguard",
    supportLevel: "full-migration",
    category: "network",
    detect: {
      packages: { apt: ["wireguard", "wireguard-tools"], rpm: ["wireguard-tools"] },
      binaries: ["wg", "wg-quick"],
      systemd: ["wg-quick@wg0.service"],
      ports: [51820]
    },
    configFiles: ["/etc/wireguard/wg0.conf"],
    configGlobs: ["/etc/wireguard/*.conf"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["PrivateKey", "PresharedKey"],
    dataPaths: ["/etc/wireguard"],
    references: [
      { pattern: "PrivateKey", type: "secretFile" },
      { pattern: "PresharedKey", type: "secretFile" },
      { pattern: "Endpoint", type: "serviceDependency" },
      { pattern: "AllowedIPs", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["private keys", "peer endpoint reachability", "IP forwarding/NAT rules", "client reconfiguration"] },
    security: { risk: "privileged", notes: ["WireGuard configs contain private keys and route policy; migration requires explicit key handling approval."] },
    crossDistro: { packageMap: { apt: ["wireguard", "wireguard-tools"], dnf: ["wireguard-tools"], yum: ["wireguard-tools"], pacman: ["wireguard-tools"], apk: ["wireguard-tools"] }, serviceMap: { debian: ["wg-quick@wg0"], rhel: ["wg-quick@wg0"], fedora: ["wg-quick@wg0"], arch: ["wg-quick@wg0"], alpine: ["wg-quick@wg0"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["wg-quick@wg0"], validate: ["wg show || systemctl is-active wg-quick@wg0 || true"] }
  }),
  nativeRule({
    id: "openvpn",
    displayName: "OpenVPN server",
    capabilityKey: "network.vpn.openvpn",
    capability: "network.vpn.openvpn",
    supportLevel: "full-migration",
    category: "network",
    detect: {
      packages: { apt: ["openvpn", "easy-rsa"], rpm: ["openvpn", "easy-rsa"] },
      binaries: ["openvpn", "easyrsa"],
      systemd: ["openvpn.service", "openvpn-server@server.service"],
      ports: [1194]
    },
    configFiles: ["/etc/openvpn/server/server.conf", "/etc/openvpn/openvpn.conf"],
    configGlobs: ["/etc/openvpn/**/*.conf", "/etc/openvpn/**/*.ovpn", "/etc/openvpn/**/*.key", "/etc/openvpn/**/*.crt", "/etc/openvpn/ccd/*"],
    configMaxSizeKB: 512,
    extraSecretPatterns: ["tls-auth", "tls-crypt", "server.key", "client.key", "ca.key", "dh.pem"],
    dataPaths: ["/etc/openvpn", "/var/lib/openvpn"],
    references: [
      { pattern: "ca", type: "secretFile" },
      { pattern: "cert", type: "secretFile" },
      { pattern: "key", type: "secretFile" },
      { pattern: "client-config-dir", type: "filesystemPath" },
      { pattern: "push", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["PKI material", "client certificates", "pushed routes", "target network topology"] },
    security: { risk: "privileged", notes: ["OpenVPN PKI and route push policy are sensitive and must travel out of band."] },
    crossDistro: { packageMap: { apt: ["openvpn", "easy-rsa"], dnf: ["openvpn", "easy-rsa"], yum: ["openvpn", "easy-rsa"], pacman: ["openvpn", "easy-rsa"], apk: ["openvpn", "easy-rsa"] }, serviceMap: { debian: ["openvpn", "openvpn-server@server"], rhel: ["openvpn-server@server"], fedora: ["openvpn-server@server"], arch: ["openvpn-server@server"], alpine: ["openvpn"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["openvpn", "openvpn-server@server"], validate: ["openvpn --version && (systemctl is-active openvpn-server@server || systemctl is-active openvpn || true)"] }
  }),
  nativeRule({
    id: "vault",
    displayName: "HashiCorp Vault",
    capabilityKey: "security.secrets.vault",
    capability: "security.secrets.vault",
    supportLevel: "full-migration",
    category: "security",
    detect: {
      packages: { apt: ["vault"], rpm: ["vault"] },
      binaries: ["vault"],
      systemd: ["vault.service"],
      ports: [8200, 8201]
    },
    configFiles: ["/etc/vault.d/vault.hcl"],
    configGlobs: ["/etc/vault.d/*.hcl", "/etc/vault.d/*.json", "/opt/vault/*.hcl"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["VAULT_TOKEN", "seal", "unseal", "root_token", "storage", "transit"],
    dataPaths: ["/opt/vault/data", "/var/lib/vault"],
    references: [
      { pattern: "storage", type: "filesystemPath" },
      { pattern: "seal", type: "secretFile" },
      { pattern: "api_addr", type: "serviceDependency" },
      { pattern: "cluster_addr", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["Vault snapshot/restore", "unseal keys", "root token", "auto-unseal KMS dependencies"] },
    security: { risk: "privileged", notes: ["Vault stores secrets; state migration must use Vault APIs and operator-held unseal material."] },
    crossDistro: { packageMap: { apt: ["vault"], dnf: ["vault"], yum: ["vault"], pacman: ["vault"], apk: ["vault"] }, serviceMap: { debian: ["vault"], rhel: ["vault"], fedora: ["vault"], arch: ["vault"], alpine: ["vault"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["vault"], validate: ["vault status || systemctl is-active vault || true"] }
  }),
  nativeRule({
    id: "k3s",
    displayName: "K3s lightweight Kubernetes",
    capabilityKey: "container.kubernetes.k3s",
    capability: "container.kubernetes.k3s",
    supportLevel: "full-migration",
    category: "container",
    detect: {
      packages: { apt: ["k3s"], rpm: ["k3s"] },
      binaries: ["k3s", "kubectl", "ctr"],
      systemd: ["k3s.service", "k3s-agent.service"],
      ports: [6443, 10250]
    },
    configFiles: ["/etc/rancher/k3s/config.yaml", "/etc/rancher/k3s/k3s.yaml"],
    configGlobs: ["/etc/rancher/k3s/*.yaml", "/var/lib/rancher/k3s/server/manifests/*.yaml"],
    configMaxSizeKB: 512,
    extraSecretPatterns: ["token", "node-token", "client-key-data", "certificate-authority-data"],
    dataPaths: ["/var/lib/rancher/k3s"],
    references: [
      { pattern: "k3s.yaml", type: "secretFile" },
      { pattern: "node-token", type: "secretFile" },
      { pattern: "server/db", type: "filesystemPath" },
      { pattern: "local-path-provisioner", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["etcd/SQLite snapshot", "cluster CA/admin token", "agent node-token", "persistent volumes"] },
    security: { risk: "privileged", notes: ["K3s owns cluster control-plane state; migration requires snapshot/restore and explicit kubeconfig token handling."] },
    crossDistro: { packageMap: { apt: ["k3s"], dnf: ["k3s"], yum: ["k3s"], pacman: ["k3s"], apk: ["k3s"] }, serviceMap: { debian: ["k3s"], rhel: ["k3s"], fedora: ["k3s"], arch: ["k3s"], alpine: ["k3s"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["k3s"], validate: ["k3s kubectl get nodes || systemctl is-active k3s || true"] }
  }),
  nativeRule({
    id: "swap",
    displayName: "Swap space configuration",
    capabilityKey: "system.swap",
    capability: "system.swap",
    supportLevel: "full-migration",
    category: "service",
    detect: {
      packages: { apt: ["util-linux"], rpm: ["util-linux"] },
      binaries: ["swapon", "swapoff", "mkswap", "fallocate"],
      systemd: ["systemd-swap.service"]
    },
    configFiles: ["/etc/fstab", "/etc/sysctl.conf"],
    configGlobs: ["/etc/sysctl.d/*.conf", "/etc/systemd/swap.conf.d/*.conf"],
    configMaxSizeKB: 256,
    dataPaths: ["/swapfile"],
    references: [
      { pattern: "swap", type: "filesystemPath" },
      { pattern: "vm.swappiness", type: "serviceDependency" },
      { pattern: "zram", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["filesystem support", "zram conflicts", "cloud image swap policy"] },
    security: { risk: "privileged", notes: ["Swap changes write /etc/fstab and can consume root filesystem space; filesystem and zram compatibility require review."] },
    crossDistro: { packageMap: { apt: ["util-linux"], dnf: ["util-linux"], yum: ["util-linux"], pacman: ["util-linux"], apk: ["util-linux"] }, serviceMap: { debian: [], rhel: [], fedora: [], arch: [], alpine: [] } },
    migrate: { package: false, data: "optional", strategy: "copy-with-review", validate: ["swapon --show"] }
  }),
  nativeRule({
    id: "pm2",
    displayName: "PM2 process manager",
    capabilityKey: "runtime.nodejs.pm2",
    capability: "runtime.nodejs.pm2",
    supportLevel: "full-migration",
    category: "service",
    detect: {
      packages: { npm: ["pm2"], apt: ["nodejs", "npm"], rpm: ["nodejs", "npm"] },
      binaries: ["pm2"],
      systemd: ["pm2.service", "pm2-root.service"]
    },
    configFiles: ["~/.pm2/dump.pm2", "~/.pm2/module_conf.json"],
    configGlobs: ["~/.pm2/conf.js", "~/.pm2/*.json", "/etc/systemd/system/pm2-*.service"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["env", "PM2_HOME"],
    dataPaths: ["~/.pm2"],
    references: [
      { pattern: "script", type: "filesystemPath" },
      { pattern: "cwd", type: "filesystemPath" },
      { pattern: "env", type: "secretFile" },
      { pattern: "interpreter", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["saved process list", "per-user PM2_HOME", "application working directories", "environment secrets"] },
    security: { risk: "review", notes: ["PM2 dump files can include app paths and environment variables; migration is per target user."] },
    crossDistro: { packageMap: { apt: ["nodejs", "npm"], dnf: ["nodejs", "npm"], yum: ["nodejs", "npm"], pacman: ["nodejs", "npm"], apk: ["nodejs", "npm"] }, serviceMap: { debian: ["pm2"], rhel: ["pm2"], fedora: ["pm2"], arch: ["pm2"], alpine: ["pm2"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["pm2"], validate: ["pm2 --version && pm2 ls || true"] }
  }),
  nativeRule({
    id: "nextcloud",
    displayName: "Nextcloud private cloud",
    capabilityKey: "app.nextcloud",
    capability: "app.nextcloud",
    supportLevel: "full-migration",
    category: "service",
    detect: {
      packages: { snap: ["nextcloud"], apt: ["nextcloud"], rpm: ["nextcloud"] },
      binaries: ["nextcloud.occ", "occ"],
      systemd: ["snap.nextcloud.apache.service", "snap.nextcloud.mysql.service", "apache2.service", "httpd.service"],
      ports: [80, 443]
    },
    configFiles: ["/var/snap/nextcloud/current/nextcloud/config/config.php", "/var/www/nextcloud/config/config.php"],
    configGlobs: ["/var/snap/nextcloud/current/nextcloud/config/*.php", "/var/www/nextcloud/config/*.php"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["passwordsalt", "secret", "dbpassword", "instanceid"],
    dataPaths: ["/var/snap/nextcloud/common/nextcloud/data", "/var/www/nextcloud/data"],
    references: [
      { pattern: "datadirectory", type: "filesystemPath" },
      { pattern: "dbhost", type: "serviceDependency" },
      { pattern: "dbpassword", type: "secretFile" },
      { pattern: "trusted_domains", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["database dump/restore", "data directory transfer", "config.php secrets", "app compatibility"] },
    security: { risk: "review", notes: ["Nextcloud config.php contains instance secrets and DB credentials; data migration must follow maintenance-mode and DB backup steps."] },
    crossDistro: { packageMap: { apt: ["snapd"], dnf: ["snapd"], yum: ["snapd"], pacman: ["snapd"], apk: ["snapd"] }, serviceMap: { debian: ["snap.nextcloud.apache", "apache2"], rhel: ["snap.nextcloud.apache", "httpd"], fedora: ["snap.nextcloud.apache", "httpd"], arch: ["snap.nextcloud.apache", "httpd"], alpine: ["apache2"] } },
    migrate: { data: "optional", strategy: "manual-review", validate: ["nextcloud.occ status || sudo -u www-data php /var/www/nextcloud/occ status || true"] }
  }),
  nativeRule({
    id: "gitea",
    displayName: "Gitea Git server",
    capabilityKey: "developer.gitea",
    capability: "developer.gitea",
    supportLevel: "full-migration",
    category: "service",
    detect: {
      packages: { apt: ["gitea"], rpm: ["gitea"] },
      binaries: ["gitea"],
      systemd: ["gitea.service"],
      ports: [3000, 2222]
    },
    configFiles: ["/etc/gitea/app.ini", "/var/lib/gitea/custom/conf/app.ini"],
    configGlobs: ["/etc/gitea/*.ini", "/var/lib/gitea/custom/conf/*.ini"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["SECRET_KEY", "INTERNAL_TOKEN", "JWT_SECRET", "PASSWD"],
    dataPaths: ["/var/lib/gitea", "/home/git/gitea-repositories"],
    references: [
      { pattern: "ROOT", type: "filesystemPath" },
      { pattern: "LFS_CONTENT_PATH", type: "filesystemPath" },
      { pattern: "DB_TYPE", type: "serviceDependency" },
      { pattern: "SECRET_KEY", type: "secretFile" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["gitea dump/restore", "repositories", "LFS objects", "OAuth secrets"] },
    security: { risk: "review", notes: ["Gitea migration uses gitea dump/restore; app.ini secrets and OAuth providers require rotation/review."] },
    crossDistro: { packageMap: { apt: ["gitea"], dnf: ["gitea"], yum: ["gitea"], pacman: ["gitea"], apk: ["gitea"] }, serviceMap: { debian: ["gitea"], rhel: ["gitea"], fedora: ["gitea"], arch: ["gitea"], alpine: ["gitea"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["gitea"], validate: ["gitea --version && (systemctl is-active gitea || true)"] }
  }),
  nativeRule({
    id: "jellyfin",
    displayName: "Jellyfin media server",
    capabilityKey: "app.media.jellyfin",
    capability: "app.media.jellyfin",
    supportLevel: "full-migration",
    category: "service",
    detect: {
      packages: { apt: ["jellyfin"], rpm: ["jellyfin"] },
      binaries: ["jellyfin"],
      systemd: ["jellyfin.service"],
      ports: [8096, 8920]
    },
    configFiles: ["/etc/jellyfin/system.xml", "/var/lib/jellyfin/config/system.xml"],
    configGlobs: ["/etc/jellyfin/*.xml", "/var/lib/jellyfin/config/*.xml"],
    configMaxSizeKB: 512,
    extraSecretPatterns: ["api", "token"],
    dataPaths: ["/var/lib/jellyfin", "/var/cache/jellyfin", "/media"],
    references: [
      { pattern: "MetadataPath", type: "filesystemPath" },
      { pattern: "CachePath", type: "filesystemPath" },
      { pattern: "/media", type: "filesystemPath" },
      { pattern: "HardwareAcceleration", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["metadata database", "media bind mounts", "hardware acceleration drivers", "per-user state"] },
    security: { risk: "review", notes: ["Jellyfin media libraries are usually operator-owned bind mounts; user/library metadata requires backup/restore review."] },
    crossDistro: { packageMap: { apt: ["jellyfin"], dnf: ["jellyfin"], yum: ["jellyfin"], pacman: ["jellyfin"], apk: ["jellyfin"] }, serviceMap: { debian: ["jellyfin"], rhel: ["jellyfin"], fedora: ["jellyfin"], arch: ["jellyfin"], alpine: ["jellyfin"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["jellyfin"], validate: ["curl -fsS http://127.0.0.1:8096/System/Info/Public || systemctl is-active jellyfin || true"] }
  }),
  nativeRule({
    id: "keycloak",
    displayName: "Keycloak identity provider",
    capabilityKey: "security.sso.keycloak",
    capability: "security.sso.keycloak",
    supportLevel: "full-migration",
    category: "security",
    detect: {
      packages: { apt: ["docker.io", "docker-compose-plugin"], rpm: ["docker", "docker-compose-plugin"] },
      binaries: ["docker"],
      ports: [8080, 8443]
    },
    configFiles: ["./docker-compose.yml", "./compose.yml", "/opt/keycloak/conf/keycloak.conf"],
    configGlobs: ["./keycloak*/**/*.yml", "./keycloak*/**/*.env", "/opt/keycloak/conf/*.conf", "/opt/keycloak/providers/*"],
    configMaxSizeKB: 512,
    extraSecretPatterns: ["KEYCLOAK_ADMIN_PASSWORD", "KC_DB_PASSWORD", "client-secret", "SMTP_PASSWORD"],
    dataPaths: ["./keycloak_data", "./postgres_data", "/opt/keycloak/data", "/opt/keycloak/providers"],
    references: [
      { pattern: "KC_DB_URL", type: "serviceDependency" },
      { pattern: "KC_DB_PASSWORD", type: "secretFile" },
      { pattern: "providers", type: "filesystemPath" },
      { pattern: "8080", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["realm export/import", "OIDC client secrets", "custom providers/themes", "database backup/restore"] },
    security: { risk: "privileged", notes: ["Keycloak is an identity provider; migration requires realm export/import and secret review."] },
    crossDistro: { packageMap: { apt: ["docker.io", "docker-compose-plugin"], dnf: ["docker", "docker-compose-plugin"], yum: ["docker", "docker-compose-plugin"], pacman: ["docker", "docker-compose"], apk: ["docker", "docker-cli-compose"] }, serviceMap: { debian: ["docker"], rhel: ["docker"], fedora: ["docker"], arch: ["docker"], alpine: ["docker"] } },
    migrate: { data: "optional", strategy: "manual-review", validate: ["curl -fsS http://127.0.0.1:8080/realms/master || docker ps --filter name=keycloak || true"] }
  }),
  nativeRule({
    id: "authelia",
    displayName: "Authelia lightweight SSO",
    capabilityKey: "security.sso.authelia",
    capability: "security.sso.authelia",
    supportLevel: "full-migration",
    category: "security",
    detect: {
      packages: { apt: ["docker.io", "docker-compose-plugin"], rpm: ["docker", "docker-compose-plugin"] },
      binaries: ["docker"],
      ports: [9091]
    },
    configFiles: ["./config/configuration.yml", "./docker-compose.yml", "./compose.yml"],
    configGlobs: ["./authelia*/**/*.yml", "./authelia*/**/*.env", "./config/*.yml", "./config/*.yaml"],
    configMaxSizeKB: 512,
    extraSecretPatterns: ["JWT_SECRET", "SESSION_SECRET", "STORAGE_ENCRYPTION_KEY", "SMTP_PASSWORD"],
    dataPaths: ["./config/db.sqlite3", "./authelia_data"],
    references: [
      { pattern: "storage", type: "filesystemPath" },
      { pattern: "jwt_secret", type: "secretFile" },
      { pattern: "session", type: "secretFile" },
      { pattern: "default_redirection_url", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["SQLite/user state", "TOTP/WebAuthn enrolments", "reverse-proxy forward-auth pairing", "secret continuity"] },
    security: { risk: "privileged", notes: ["Authelia gates access to other apps; secret continuity and reverse-proxy pairing must be reviewed."] },
    crossDistro: { packageMap: { apt: ["docker.io", "docker-compose-plugin"], dnf: ["docker", "docker-compose-plugin"], yum: ["docker", "docker-compose-plugin"], pacman: ["docker", "docker-compose"], apk: ["docker", "docker-cli-compose"] }, serviceMap: { debian: ["docker"], rhel: ["docker"], fedora: ["docker"], arch: ["docker"], alpine: ["docker"] } },
    migrate: { data: "optional", strategy: "manual-review", validate: ["curl -fsS http://127.0.0.1:9091/api/state || docker ps --filter name=authelia || true"] }
  }),
  nativeRule({
    id: "fail2ban",
    displayName: "Fail2Ban",
    capabilityKey: "security.fail2ban",
    capability: "security.intrusion-prevention.fail2ban",
    supportLevel: "full-migration",
    category: "security",
    detect: {
      packages: { apt: ["fail2ban"], rpm: ["fail2ban"] },
      binaries: ["fail2ban-client"],
      systemd: ["fail2ban.service"]
    },
    configFiles: ["/etc/fail2ban/jail.local", "/etc/fail2ban/jail.conf"],
    configGlobs: ["/etc/fail2ban/jail.d/*.conf"],
    configMaxSizeKB: 256,
    references: [{ pattern: "logpath", type: "filesystemPath" }, { pattern: "filter", type: "configInclude" }],
    migrationCompleteness: { configOnly: "complete", missingRisks: ["custom action scripts and service-specific log paths still require operator review"] },
    security: { risk: "review", notes: ["Jail rules depend on service logs and firewall backend availability; custom action paths are scanned with secret patterns."] },
    crossDistro: { packageMap: { apt: ["fail2ban"], dnf: ["fail2ban"], yum: ["fail2ban"], pacman: ["fail2ban"], apk: ["fail2ban"] }, serviceMap: { debian: ["fail2ban"], rhel: ["fail2ban"], fedora: ["fail2ban"], arch: ["fail2ban"], alpine: ["fail2ban"] } },
    migrate: { data: "none", strategy: "copy-with-review", restartServices: ["fail2ban"], validate: ["fail2ban-client status", "systemctl is-active fail2ban"] }
  }),
  nativeRule({
    id: "samba",
    displayName: "Samba file sharing",
    capabilityKey: "fs.share.samba",
    capability: "fs.share.samba",
    supportLevel: "full-migration",
    category: "network",
    detect: {
      packages: { apt: ["samba", "smbclient"], rpm: ["samba", "samba-client"] },
      binaries: ["smbd", "smbclient", "testparm"],
      systemd: ["smbd.service", "smb.service", "nmbd.service"],
      ports: [139, 445]
    },
    configFiles: ["/etc/samba/smb.conf"],
    configGlobs: ["/etc/samba/conf.d/*.conf", "/etc/samba/smb.conf.d/*.conf"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["passdb backend", "valid users", "smbpasswd"],
    dataPaths: ["/srv/samba", "/var/lib/samba"],
    references: [
      { pattern: "include", type: "configInclude" },
      { pattern: "path", type: "filesystemPath" },
      { pattern: "valid users", type: "serviceDependency" },
      { pattern: "passdb backend", type: "secretFile" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["share paths", "Samba passdb", "ACLs", "client subnets"] },
    security: { risk: "review", notes: ["Samba shares expose filesystem paths and account mappings; passdb and ACL handling require review."] },
    crossDistro: { packageMap: { apt: ["samba", "smbclient"], dnf: ["samba", "samba-client"], yum: ["samba", "samba-client"], pacman: ["samba", "smbclient"], apk: ["samba", "samba-client"] }, serviceMap: { debian: ["smbd", "nmbd"], rhel: ["smb", "nmb"], fedora: ["smb", "nmb"], arch: ["smb"], alpine: ["samba"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["smbd", "smb", "nmbd"], validate: ["testparm -s", "systemctl is-active smbd || systemctl is-active smb || true"] }
  }),
  nativeRule({
    id: "nfs-server",
    displayName: "NFS file server",
    capabilityKey: "fs.share.nfs",
    capability: "fs.share.nfs",
    supportLevel: "full-migration",
    category: "network",
    detect: {
      packages: { apt: ["nfs-kernel-server", "nfs-common"], rpm: ["nfs-utils"] },
      binaries: ["exportfs", "showmount"],
      systemd: ["nfs-server.service", "nfs-kernel-server.service"],
      ports: [2049]
    },
    configFiles: ["/etc/exports", "/etc/nfs.conf", "/etc/idmapd.conf"],
    configGlobs: ["/etc/exports.d/*.exports"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["no_root_squash", "sec=krb5"],
    dataPaths: ["/srv/nfs", "/export"],
    references: [
      { pattern: "/srv", type: "filesystemPath" },
      { pattern: "/export", type: "filesystemPath" },
      { pattern: "include", type: "configInclude" },
      { pattern: "sec=krb5", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["export paths", "client CIDRs", "root-squash policy", "Kerberos/KDC dependencies"] },
    security: { risk: "review", notes: ["NFS exports define network filesystem access; paths and client scopes require operator review."] },
    crossDistro: { packageMap: { apt: ["nfs-kernel-server", "nfs-common"], dnf: ["nfs-utils"], yum: ["nfs-utils"], pacman: ["nfs-utils"], apk: ["nfs-utils"] }, serviceMap: { debian: ["nfs-kernel-server", "nfs-server"], rhel: ["nfs-server"], fedora: ["nfs-server"], arch: ["nfs-server"], alpine: ["nfs"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["nfs-server", "nfs-kernel-server"], validate: ["exportfs -s", "systemctl is-active nfs-server || systemctl is-active nfs-kernel-server || true"] }
  }),
  nativeRule({
    id: "tailscale",
    displayName: "Tailscale mesh VPN",
    capabilityKey: "network.vpn.tailscale",
    capability: "network.vpn.tailscale",
    supportLevel: "full-migration",
    category: "network",
    detect: {
      packages: { apt: ["tailscale"], rpm: ["tailscale"] },
      binaries: ["tailscale", "tailscaled"],
      systemd: ["tailscaled.service"]
    },
    configFiles: ["/etc/default/tailscaled", "/etc/sysconfig/tailscaled", "/var/lib/tailscale/tailscaled.state"],
    configGlobs: ["/etc/tailscale/*.conf"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["PrivateMachineKey", "NodeKey", "authkey"],
    dataPaths: ["/var/lib/tailscale"],
    references: [
      { pattern: "tailscaled.state", type: "secretFile" },
      { pattern: "advertise-routes", type: "serviceDependency" },
      { pattern: "advertise-exit-node", type: "serviceDependency" },
      { pattern: "/var/lib/tailscale", type: "filesystemPath" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["node identity key", "auth key re-enrollment", "subnet-router advertisements"] },
    security: { risk: "review", notes: ["The Tailscale node key is host identity; normal migration re-authenticates instead of copying state."] },
    crossDistro: { packageMap: { apt: ["tailscale"], dnf: ["tailscale"], yum: ["tailscale"], pacman: ["tailscale"], apk: ["tailscale"] }, serviceMap: { debian: ["tailscaled"], rhel: ["tailscaled"], fedora: ["tailscaled"], arch: ["tailscaled"], alpine: ["tailscaled"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["tailscaled"], validate: ["tailscale status || systemctl is-active tailscaled"] }
  }),
  nativeRule({
    id: "code-server",
    displayName: "code-server",
    capabilityKey: "developer.code-server",
    capability: "developer.code-server",
    supportLevel: "full-migration",
    category: "developer",
    detect: {
      packages: { apt: ["curl", "ca-certificates"], rpm: ["curl", "ca-certificates"] },
      binaries: ["code-server"],
      systemd: ["code-server.service", "code-server@.service"],
      ports: [8080]
    },
    configFiles: ["~/.config/code-server/config.yaml", "/etc/code-server/config.yaml", "~/.local/share/code-server/User/settings.json"],
    configGlobs: ["~/.local/share/code-server/extensions/*", "~/.config/code-server/*.yaml"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["password:", "hashed-password", "cert-key"],
    dataPaths: ["~/.local/share/code-server", "~/.config/code-server"],
    references: [
      { pattern: "bind-addr", type: "serviceDependency" },
      { pattern: "password", type: "secretFile" },
      { pattern: "cert", type: "filesystemPath" },
      { pattern: "auth", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["remote dev password", "extensions", "TLS/reverse-proxy endpoint", "workspace repos"] },
    security: { risk: "review", notes: ["code-server exposes an interactive development shell; auth, TLS, and reverse-proxy settings require review."] },
    crossDistro: { packageMap: { apt: ["curl", "ca-certificates"], dnf: ["curl", "ca-certificates"], yum: ["curl", "ca-certificates"], pacman: ["curl", "ca-certificates"], apk: ["curl", "ca-certificates"] }, serviceMap: { debian: ["code-server"], rhel: ["code-server"], fedora: ["code-server"], arch: ["code-server"], alpine: ["code-server"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["code-server"], validate: ["code-server --version || systemctl is-active code-server || true"] }
  }),
  nativeRule({
    id: "sonarqube",
    displayName: "SonarQube",
    capabilityKey: "developer.sonarqube",
    capability: "developer.sonarqube",
    supportLevel: "full-migration",
    category: "developer",
    detect: {
      packages: { apt: ["docker.io", "docker-compose-plugin"], rpm: ["docker", "docker-compose-plugin"] },
      binaries: ["docker"],
      ports: [9000]
    },
    configFiles: ["/opt/sonarqube/conf/sonar.properties", "./docker-compose.yml", "./compose.yml"],
    configGlobs: ["./sonarqube*/**/*.yml", "./sonarqube*/**/*.env"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["SONAR_JDBC_PASSWORD", "sonar.jdbc.password", "admin"],
    dataPaths: ["/opt/sonarqube/data", "/opt/sonarqube/extensions", "./sonarqube_data"],
    references: [
      { pattern: "sonar.jdbc.url", type: "serviceDependency" },
      { pattern: "sonar.jdbc.password", type: "secretFile" },
      { pattern: "volumes:", type: "filesystemPath" },
      { pattern: "9000", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["database backup/restore", "quality profiles", "plugins", "default admin credentials"] },
    security: { risk: "review", notes: ["SonarQube data belongs in its DB; Docker volumes and credentials require explicit review."] },
    crossDistro: { packageMap: { apt: ["docker.io", "docker-compose-plugin"], dnf: ["docker", "docker-compose-plugin"], yum: ["docker", "docker-compose-plugin"], pacman: ["docker", "docker-compose"], apk: ["docker", "docker-cli-compose"] }, serviceMap: { debian: ["docker"], rhel: ["docker"], fedora: ["docker"], arch: ["docker"], alpine: ["docker"] } },
    migrate: { data: "optional", strategy: "manual-review", validate: ["curl -fsS http://127.0.0.1:9000/api/system/status || docker ps --filter name=sonarqube || true"] }
  }),
  nativeRule({
    id: "mongodb",
    displayName: "MongoDB",
    capabilityKey: "database.mongodb",
    capability: "database.mongodb",
    supportLevel: "full-migration",
    category: "database",
    detect: {
      packages: { apt: ["mongodb-org"], rpm: ["mongodb-org"] },
      binaries: ["mongod", "mongosh", "mongo"],
      systemd: ["mongod.service"],
      ports: [27017]
    },
    configFiles: ["/etc/mongod.conf"],
    configGlobs: ["/etc/mongodb/*.conf", "/etc/mongod.conf.d/*.conf"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["keyFile", "authorization", "clusterAuthMode"],
    dataPaths: ["/var/lib/mongodb"],
    references: [
      { pattern: "storage.dbPath", type: "filesystemPath" },
      { pattern: "keyFile", type: "secretFile" },
      { pattern: "replication", type: "serviceDependency" },
      { pattern: "net.bindIp", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["mongodump/mongorestore", "replica-set membership", "auth keyFile", "users/roles"] },
    security: { risk: "review", notes: ["MongoDB data must use logical backup/restore; keyFile and auth settings are sensitive."] },
    crossDistro: { packageMap: { apt: ["mongodb-org"], dnf: ["mongodb-org"], yum: ["mongodb-org"], pacman: ["mongodb-bin"], apk: ["mongodb"] }, serviceMap: { debian: ["mongod"], rhel: ["mongod"], fedora: ["mongod"], arch: ["mongodb"], alpine: ["mongodb"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["mongod", "mongodb"], validate: ["mongosh --eval 'db.runCommand({ ping: 1 })' || mongo --eval 'db.runCommand({ ping: 1 })' || systemctl is-active mongod"] }
  }),
  nativeRule({
    id: "minio",
    displayName: "MinIO",
    capabilityKey: "storage.object.minio",
    capability: "storage.object.minio",
    supportLevel: "full-migration",
    category: "service",
    detect: {
      packages: { apt: ["minio"], rpm: ["minio"] },
      binaries: ["minio", "mc"],
      systemd: ["minio.service"],
      ports: [9000, 9001]
    },
    configFiles: ["/etc/default/minio", "/etc/sysconfig/minio", "/etc/minio/minio.conf"],
    configGlobs: ["/etc/minio/*.env", "/etc/minio/*.conf"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["MINIO_ROOT_USER", "MINIO_ROOT_PASSWORD", "MINIO_KMS"],
    dataPaths: ["/var/minio", "/srv/minio"],
    references: [
      { pattern: "MINIO_VOLUMES", type: "filesystemPath" },
      { pattern: "MINIO_ROOT_PASSWORD", type: "secretFile" },
      { pattern: "MINIO_SERVER_URL", type: "serviceDependency" },
      { pattern: "KMS", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["bucket data replication", "root credentials", "KMS keys", "site URL"] },
    security: { risk: "review", notes: ["Object data must move through MinIO replication/mirror tooling; root credentials require rotation/review."] },
    crossDistro: { packageMap: { apt: ["minio"], dnf: ["minio"], yum: ["minio"], pacman: ["minio"], apk: ["minio"] }, serviceMap: { debian: ["minio"], rhel: ["minio"], fedora: ["minio"], arch: ["minio"], alpine: ["minio"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["minio"], validate: ["curl -fsS http://127.0.0.1:9000/minio/health/live || mc admin info local || systemctl is-active minio"] }
  }),
  nativeRule({
    id: "elasticsearch",
    displayName: "Elasticsearch",
    capabilityKey: "database.search.elasticsearch",
    capability: "database.search.elasticsearch",
    supportLevel: "full-migration",
    category: "database",
    detect: {
      packages: { apt: ["elasticsearch"], rpm: ["elasticsearch"] },
      binaries: ["elasticsearch"],
      systemd: ["elasticsearch.service"],
      ports: [9200, 9300]
    },
    configFiles: ["/etc/elasticsearch/elasticsearch.yml", "/etc/default/elasticsearch", "/etc/sysconfig/elasticsearch"],
    configGlobs: ["/etc/elasticsearch/*.yml", "/etc/elasticsearch/jvm.options.d/*.options"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["xpack.security", "keystore", "bootstrap.password"],
    dataPaths: ["/var/lib/elasticsearch"],
    references: [
      { pattern: "path.data", type: "filesystemPath" },
      { pattern: "discovery.seed_hosts", type: "serviceDependency" },
      { pattern: "elasticsearch.keystore", type: "secretFile" },
      { pattern: "snapshot", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["snapshot repository", "index data", "keystore secrets", "cluster discovery"] },
    security: { risk: "review", notes: ["Elasticsearch index data must use snapshot/restore; keystore and TLS material require review."] },
    crossDistro: { packageMap: { apt: ["elasticsearch"], dnf: ["elasticsearch"], yum: ["elasticsearch"], pacman: ["elasticsearch"], apk: ["elasticsearch"] }, serviceMap: { debian: ["elasticsearch"], rhel: ["elasticsearch"], fedora: ["elasticsearch"], arch: ["elasticsearch"], alpine: ["elasticsearch"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["elasticsearch"], validate: ["curl -fsS http://127.0.0.1:9200/_cluster/health || systemctl is-active elasticsearch"] }
  }),
  nativeRule({
    id: "clickhouse",
    displayName: "ClickHouse",
    capabilityKey: "database.olap.clickhouse",
    capability: "database.olap.clickhouse",
    supportLevel: "full-migration",
    category: "database",
    detect: {
      packages: { apt: ["clickhouse-server", "clickhouse-client"], rpm: ["clickhouse-server", "clickhouse-client"] },
      binaries: ["clickhouse-server", "clickhouse-client"],
      systemd: ["clickhouse-server.service"],
      ports: [8123, 9000]
    },
    configFiles: ["/etc/clickhouse-server/config.xml", "/etc/clickhouse-server/users.xml"],
    configGlobs: ["/etc/clickhouse-server/config.d/*.xml", "/etc/clickhouse-server/users.d/*.xml"],
    configMaxSizeKB: 512,
    extraSecretPatterns: ["password_sha256_hex", "ldap", "kerberos"],
    dataPaths: ["/var/lib/clickhouse"],
    references: [
      { pattern: "<path>", type: "filesystemPath" },
      { pattern: "remote_servers", type: "serviceDependency" },
      { pattern: "password_sha256_hex", type: "secretFile" },
      { pattern: "keeper", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["BACKUP/RESTORE workflow", "Keeper/ZooKeeper state", "user secrets", "large table data"] },
    security: { risk: "review", notes: ["ClickHouse data must use BACKUP/RESTORE or clickhouse-backup; user secrets and cluster topology require review."] },
    crossDistro: { packageMap: { apt: ["clickhouse-server", "clickhouse-client"], dnf: ["clickhouse-server", "clickhouse-client"], yum: ["clickhouse-server", "clickhouse-client"], pacman: ["clickhouse"], apk: ["clickhouse"] }, serviceMap: { debian: ["clickhouse-server"], rhel: ["clickhouse-server"], fedora: ["clickhouse-server"], arch: ["clickhouse-server"], alpine: ["clickhouse-server"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["clickhouse-server"], validate: ["clickhouse-client --query 'SELECT 1' || systemctl is-active clickhouse-server"] }
  }),
  nativeRule({
    id: "influxdb",
    displayName: "InfluxDB",
    capabilityKey: "database.timeseries.influxdb",
    capability: "database.timeseries.influxdb",
    supportLevel: "full-migration",
    category: "database",
    detect: {
      packages: { apt: ["influxdb2"], rpm: ["influxdb2"] },
      binaries: ["influxd", "influx"],
      systemd: ["influxdb.service"],
      ports: [8086]
    },
    configFiles: ["/etc/influxdb/config.toml", "/etc/influxdb/influxdb.conf"],
    configGlobs: ["/etc/influxdb/*.toml", "/etc/influxdb/*.conf"],
    configMaxSizeKB: 256,
    extraSecretPatterns: ["token", "INFLUX_TOKEN", "bolt"],
    dataPaths: ["/var/lib/influxdb", "/var/lib/influxdb2"],
    references: [
      { pattern: "engine-path", type: "filesystemPath" },
      { pattern: "bolt-path", type: "filesystemPath" },
      { pattern: "token", type: "secretFile" },
      { pattern: "retention", type: "serviceDependency" }
    ],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["influxd backup/restore", "operator tokens", "bucket retention", "v1/v2 schema drift"] },
    security: { risk: "review", notes: ["InfluxDB TSDB data must use influxd backup/restore; tokens and bolt DB state require review."] },
    crossDistro: { packageMap: { apt: ["influxdb2"], dnf: ["influxdb2"], yum: ["influxdb2"], pacman: ["influxdb"], apk: ["influxdb"] }, serviceMap: { debian: ["influxdb"], rhel: ["influxdb"], fedora: ["influxdb"], arch: ["influxdb"], alpine: ["influxdb"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["influxdb"], validate: ["curl -fsS http://127.0.0.1:8086/health || influx ping || systemctl is-active influxdb"] }
  }),
  ...finalBatchComboRules,
  ...finalBatchDockerAppRules
];

/**
 * Runtime detection-rule overlay (Phase B2).
 *
 * UI-authored rules are loaded from the runtime store into this cache at
 * boot (and refreshed on mutation) via `setRuntimeDetectionRules`. They
 * extend DETECTION/classification only — `getDetectionRules()` is the
 * merged view consumed by detection paths. Certification deliberately
 * does NOT use this view: the CI audit and `deriveCertification` read the
 * static `catalogDetectionRules` export, so runtime rules can never make a
 * capability "certified" or user-visible in Build.
 */
let runtimeDetectionRules: CatalogDetectionRule[] = [];

export function setRuntimeDetectionRules(rules: CatalogDetectionRule[]): void {
  runtimeDetectionRules = rules;
}

/** Static baseline rules merged with the runtime overlay, for DETECTION only. */
export function getDetectionRules(): CatalogDetectionRule[] {
  return runtimeDetectionRules.length === 0
    ? catalogDetectionRules
    : [...catalogDetectionRules, ...runtimeDetectionRules];
}

export function findRuleForPackage(name: string, source?: string): CatalogDetectionRule | undefined {
  const normalized = normalizeName(name);
  const rules = getDetectionRules();
  const exactRule = rules.find((rule) => normalizeName(rule.id) === normalized);
  if (exactRule) return exactRule;
  if (normalized === "docker-compose-plugin" || normalized === "docker-buildx-plugin") {
    const composeRule = rules.find((rule) => rule.id === "docker-compose-dev");
    if (composeRule) return composeRule;
  }
  return rules.find((rule) => {
    if (rule.displayName.toLowerCase().includes(normalized)) return true;
    const packageSets = rule.detect.packages ?? {};
    for (const [manager, names] of Object.entries(packageSets)) {
      if (source && source !== manager && !(source === "apt-manual" && manager === "apt")) continue;
      if (names?.some((pkg) => normalizeName(pkg) === normalized)) return true;
    }
    return rule.detect.binaries?.some((bin) => normalizeName(bin) === normalized) ?? false;
  });
}

export function getConfigDiscoveryRules(installedSoftware: string[]): Array<{
  rule: CatalogDetectionRule;
  path: string;
  category: ConfigFileInfo["category"];
  isGlob: boolean;
}> {
  const names = new Set(installedSoftware.map(normalizeName));
  const matched = getDetectionRules().filter((rule) => {
    const packageNames = Object.values(rule.detect.packages ?? {}).flat().map(normalizeName);
    const binaries = (rule.detect.binaries ?? []).map(normalizeName);
    return [...packageNames, ...binaries, normalizeName(rule.id)].some((name) => names.has(name));
  });

  return matched.flatMap((rule) => {
    const files = (rule.config?.files ?? []).map((path) => ({ rule, path, category: "app" as const, isGlob: false }));
    const globs = (rule.config?.globs ?? []).map((path) => ({ rule, path, category: "app" as const, isGlob: true }));
    return [...files, ...globs];
  });
}

export function ruleSecretPatterns(rule?: CatalogDetectionRule): string[] {
  return [...new Set([...(rule?.config?.secretPatterns ?? []), ...commonSecretPatterns])];
}

function defaultIntentSignals(): NonNullable<CatalogDetectionRule["intentSignals"]> {
  return {
    high: ["serviceRunning", "serviceEnabled", "listeningPort", "customConfig"],
    medium: ["packageMarkedManual", "binaryExists", "catalogMatch"],
    low: ["packageInstalledOnly"]
  };
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\.service$/, "").replace(/^docker\.io$/, "docker").trim();
}
