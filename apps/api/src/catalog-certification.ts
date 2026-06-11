/**
 * catalog-certification.ts — Full Migration Certified registry.
 *
 * The product decision: end users see exactly two states:
 *
 *   - certified  → visible in Build / Migrate / Maintain.
 *   - not-ready  → hidden from end users; admin registry only.
 *
 * The audit machinery in `scripts/check-full-migration-certification.mjs`
 * audits every catalog item against the requirements in `docs/catalog.md`.
 * This module is the runtime source of truth that the API + UI consult
 * to decide what to expose.
 *
 * Adding a capability to `CERTIFIED_OPT_IN` is necessary but **not**
 * sufficient: the CI audit (`npm run certification:check`) re-derives
 * every requirement and refuses to mark an item certified when any
 * structural check fails. The runtime in this module mirrors that
 * gate by re-validating the audit-record metadata before answering.
 */

import type { CatalogItem } from "./catalog.js";
import { computeRequiredApprovalsForCatalogItem } from "./environment-plan.js";

export type CertificationStatus = "certified" | "not-ready";

/**
 * Capabilities the team has explicitly opted into Full Migration
 * Certified for the current phase. The set is intentionally small;
 * promoting an item requires:
 *
 *   - a passing harness scenario in scripts/harness/scenarios/,
 *   - the catalog audit at full-migration depth,
 *   - the catalog rule registry exposing crossDistro + validate,
 *   - approval gates configured in environment-plan.ts when the item
 *     is privileged,
 *   - a Managed Execution adapter that produces ActionRunRecord
 *     entries for apply / verify / rollback.
 */
export const CERTIFIED_OPT_IN: ReadonlySet<string> = new Set([
  "nginx-web-service",
  "docker-host-profile",
  "ssh-hardening",
  "firewall-baseline",
  "fail2ban-protection",
  "redis-server",
  "postgres-profile",
  "mysql-server",
  "certbot-ssl",
  "node-runtime-profile",
  "nodejs-version-mgr",
  "python-toolchain",
  "pyenv-toolchain",
  "mariadb",
  "haproxy-lb",
  "apache-httpd",
  "php-fpm",
  "php-toolchain",
  "ruby-toolchain",
  "golang-runtime",
  "openjdk-runtime",
  "rust-toolchain",
  "dotnet-runtime",
  "git-version-control",
  "ansible-tool",
  "terraform-iac",
  "kubernetes-tools",
  "flutter-sdk",
  "rsync-tools",
  "htop-tools",
  "zsh-shell",
  "fish-shell",
  "neovim-editor",
  "tmux-multiplex",
  "rust-cli-tools",
  "nethogs-bandwidth",
  "memcached",
  "valkey-server",
  "prometheus-monitoring",
  "grafana-dashboard",
  "netdata-monitoring",
  "zabbix-monitoring",
  "loki-logging",
  "mosquitto-mqtt",
  "rabbitmq",
  "meilisearch",
  "gitlab-runner",
  "jenkins-ci",
  "caddy-server",
  "openresty",
  "traefik-proxy",
  "wireguard-vpn",
  "openvpn-server",
  "firewalld",
  "vault-secrets",
  "k3s",
  "swap-config",
  "nodejs-pm2",
  "gitea-server",
  "nextcloud",
  "jellyfin-media",
  "keycloak",
  "authelia",
  "samba-share",
  "nfs-server",
  "tailscale",
  "code-server",
  "sonarqube",
  "mongodb",
  "minio-storage",
  "elasticsearch",
  "clickhouse",
  "influxdb",
  "vaultwarden",
  "pihole",
  "authentik",
  "wikijs",
  "n8n",
  "bookstack",
  "home-assistant",
  "gitlab-ce",
  "umami",
  "nocodb",
  "adguard-home",
  "docker-mailserver",
  "onlyoffice-docs",
  "immich",
  "forgejo",
  "uptime-kuma",
  "paperless-ngx",
  "navidrome",
  "audiobookshelf",
  "freshrss",
  "homepage",
  "stirling-pdf",
  "mealie",
  "linkwarden",
  "seafile",
  "lamp-stack",
  "lemp-stack",
  "node-production-deploy",
  "docker-compose-dev",
  "security-baseline",
  "monitoring-stack",
  "sso-stack"
]);

export interface CertificationMetadata {
  status: CertificationStatus;
  visibleToUsers: boolean;
  reasons: string[];
}

/**
 * Decide a catalog item's certification metadata at runtime.
 *
 * The check is conservative: even an opted-in item is downgraded to
 * `not-ready` when an obvious structural prerequisite is missing.
 * Anything else stays `not-ready` regardless of the item's
 * supportLevel. Detect-only items are NEVER certified.
 */
export function deriveCertification(item: CatalogItem): CertificationMetadata {
  const reasons: string[] = [];
  const optedIn = CERTIFIED_OPT_IN.has(item.id);
  const supportLevel = item.audit?.finalSupportLevel ?? item.audit?.originalSupportLevel ?? item.supportLevel;

  if (!optedIn) {
    reasons.push("not in CERTIFIED_OPT_IN list");
  }
  if (supportLevel === "detect-only") {
    reasons.push("support level is detect-only");
  }
  if (!item.capabilityKey) {
    reasons.push("capabilityKey missing");
  }
  if (item.sensitivity === "privileged") {
    const approvals = computeRequiredApprovalsForCatalogItem(`runtime:${item.id}`, item);
    if (!Array.isArray(approvals) || approvals.length === 0) {
      reasons.push("privileged capability without configured approval gates");
    }
  }

  if (reasons.length === 0) {
    return { status: "certified", visibleToUsers: true, reasons: [] };
  }
  return { status: "not-ready", visibleToUsers: false, reasons };
}

/**
 * Filter a list of catalog items down to the ones a non-admin user
 * may see in the Build / Migrate / Maintain main flow.
 */
export function filterUserVisible(items: CatalogItem[]): CatalogItem[] {
  return items.filter((item) => deriveCertification(item).visibleToUsers);
}

/**
 * Annotate every item with `certification: { status, visibleToUsers, reasons }`.
 * The original CatalogItem is preserved so admin-side consumers see the
 * full detail.
 */
export function annotateCertification(items: CatalogItem[]): Array<CatalogItem & { certification: CertificationMetadata }> {
  return items.map((item) => ({ ...item, certification: deriveCertification(item) }));
}

/** Throw if any of the supplied catalog ids is not user-visible. */
export function ensureUserVisibleOrThrow(items: CatalogItem[]): void {
  for (const item of items) {
    const cert = deriveCertification(item);
    if (!cert.visibleToUsers) {
      throw new CertificationRefusedError(item.id, cert);
    }
  }
}

export class CertificationRefusedError extends Error {
  readonly catalogId: string;
  readonly certification: CertificationMetadata;
  constructor(catalogId: string, certification: CertificationMetadata) {
    super(
      `Catalog item "${catalogId}" is not Full Migration Certified and cannot be used in user-side flows. Reasons: ${certification.reasons.join("; ")}`
    );
    this.name = "CertificationRefusedError";
    this.catalogId = catalogId;
    this.certification = certification;
  }
}
