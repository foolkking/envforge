/**
 * catalog-certification.test.ts — verifies the runtime Full Migration
 * Certified gate that hides not-ready capabilities from end users.
 *
 * The audit script (`scripts/check-full-migration-certification.mjs`)
 * is the source of truth for the certified set; this runtime gate
 * mirrors it. The tests below pin both:
 *
 *   - exactly the documented capabilities are certified today,
 *   - every detect-only / non-opted-in item is hidden from end users,
 *   - filterUserVisible / annotateCertification / ensureUserVisibleOrThrow
 *     all agree on the same predicate.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CERTIFIED_OPT_IN,
  CertificationRefusedError,
  annotateCertification,
  deriveCertification,
  ensureUserVisibleOrThrow,
  filterUserVisible
} from "../../catalog-certification.js";
import { listCatalogFromDatabase } from "../../database.js";
import type { CatalogItem } from "../../catalog.js";

test("CERTIFIED_OPT_IN contains Full Migration Certified capabilities", () => {
  assert.deepEqual(
    [...CERTIFIED_OPT_IN].sort(),
    [
      "ansible-tool",
      "apache-httpd",
      "adguard-home",
      "audiobookshelf",
      "authelia",
      "authentik",
      "bookstack",
      "caddy-server",
      "certbot-ssl",
      "clickhouse",
      "code-server",
      "docker-host-profile",
      "docker-mailserver",
      "dotnet-runtime",
      "elasticsearch",
      "fail2ban-protection",
      "firewall-baseline",
      "firewalld",
      "fish-shell",
      "flutter-sdk",
      "forgejo",
      "freshrss",
      "git-version-control",
      "gitea-server",
      "gitlab-ce",
      "gitlab-runner",
      "golang-runtime",
      "grafana-dashboard",
      "haproxy-lb",
      "home-assistant",
      "homepage",
      "htop-tools",
      "influxdb",
      "immich",
      "jellyfin-media",
      "jenkins-ci",
      "k3s",
      "keycloak",
      "kubernetes-tools",
      "lamp-stack",
      "lemp-stack",
      "linkwarden",
      "loki-logging",
      "mariadb",
      "mealie",
      "meilisearch",
      "memcached",
      "minio-storage",
      "mongodb",
      "monitoring-stack",
      "mosquitto-mqtt",
      "mysql-server",
      "neovim-editor",
      "netdata-monitoring",
      "nethogs-bandwidth",
      "nextcloud",
      "nfs-server",
      "nginx-web-service",
      "n8n",
      "navidrome",
      "nocodb",
      "node-production-deploy",
      "node-runtime-profile",
      "docker-compose-dev",
      "nodejs-pm2",
      "nodejs-version-mgr",
      "openjdk-runtime",
      "openresty",
      "openvpn-server",
      "onlyoffice-docs",
      "paperless-ngx",
      "pihole",
      "php-fpm",
      "php-toolchain",
      "postgres-profile",
      "prometheus-monitoring",
      "pyenv-toolchain",
      "python-toolchain",
      "rabbitmq",
      "redis-server",
      "rsync-tools",
      "ruby-toolchain",
      "rust-cli-tools",
      "rust-toolchain",
      "samba-share",
      "seafile",
      "security-baseline",
      "sonarqube",
      "sso-stack",
      "ssh-hardening",
      "stirling-pdf",
      "swap-config",
      "tailscale",
      "terraform-iac",
      "tmux-multiplex",
      "traefik-proxy",
      "umami",
      "uptime-kuma",
      "valkey-server",
      "vault-secrets",
      "vaultwarden",
      "wireguard-vpn",
      "wikijs",
      "zabbix-monitoring",
      "zsh-shell"
    ].sort()
  );
});

test("deriveCertification: nginx-web-service is certified and visible to users", async () => {
  const items = await listCatalogFromDatabase();
  const nginx = items.find((i) => i.id === "nginx-web-service");
  assert.ok(nginx, "nginx-web-service must exist in the catalog");
  const cert = deriveCertification(nginx!);
  assert.equal(cert.status, "certified");
  assert.equal(cert.visibleToUsers, true);
  assert.deepEqual(cert.reasons, []);
});

test("deriveCertification: docker-host-profile is certified", async () => {
  const items = await listCatalogFromDatabase();
  const docker = items.find((i) => i.id === "docker-host-profile");
  assert.ok(docker);
  const cert = deriveCertification(docker!);
  assert.equal(cert.status, "certified");
});

test("deriveCertification: ssh-hardening is certified", async () => {
  const items = await listCatalogFromDatabase();
  const ssh = items.find((i) => i.id === "ssh-hardening");
  assert.ok(ssh);
  assert.equal(deriveCertification(ssh!).status, "certified");
});

test("deriveCertification: promoted capabilities are certified", async () => {
  const items = await listCatalogFromDatabase();
  for (const id of [
    "firewall-baseline",
    "firewalld",
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
    "k3s",
    "swap-config",
    "nodejs-pm2",
    "gitea-server",
    "nextcloud",
    "jellyfin-media",
    "keycloak",
    "authelia",
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
    "sso-stack",
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
    "vault-secrets",
    "samba-share",
    "nfs-server",
    "tailscale",
    "code-server",
    "sonarqube",
    "mongodb",
    "minio-storage",
    "elasticsearch",
    "clickhouse",
    "influxdb"
  ]) {
    const item = items.find((i) => i.id === id);
    assert.ok(item, `${id} must exist in the catalog`);
    const cert = deriveCertification(item!);
    assert.equal(cert.status, "certified", `${id} should be certified`);
    assert.equal(cert.visibleToUsers, true, `${id} should be visible after certification`);
    assert.deepEqual(cert.reasons, []);
  }
});

test("deriveCertification: detect-only items are NEVER certified", async () => {
  const items = await listCatalogFromDatabase();
  const detectOnly = items.filter((i) => (i.audit?.finalSupportLevel ?? i.supportLevel) === "detect-only");
  assert.ok(detectOnly.length > 0, "expected at least one detect-only item in the catalog");
  for (const item of detectOnly) {
    const cert = deriveCertification(item);
    assert.equal(cert.status, "not-ready", `${item.id} should be not-ready`);
    assert.equal(cert.visibleToUsers, false);
  }
});

test("deriveCertification: non-opted-in full-migration items stay not-ready when present", async () => {
  const items = await listCatalogFromDatabase();
  const fullMigration = items.filter(
    (i) => (i.audit?.finalSupportLevel ?? i.supportLevel) === "full-migration" && !CERTIFIED_OPT_IN.has(i.id)
  );
  for (const item of fullMigration) {
    const cert = deriveCertification(item);
    assert.equal(cert.status, "not-ready", `${item.id} must be not-ready until opted in`);
    assert.match(cert.reasons.join(" "), /CERTIFIED_OPT_IN/);
  }
});

test("filterUserVisible: returns only certified items", async () => {
  const items = await listCatalogFromDatabase();
  const visible = filterUserVisible(items);
  for (const item of visible) {
    assert.ok(
      CERTIFIED_OPT_IN.has(item.id),
      `filterUserVisible leaked non-certified item ${item.id}`
    );
  }
  // Equal to the opt-in list size when every opt-in passes the
  // structural check; smaller if some opt-in item is missing a
  // requirement.
  assert.ok(visible.length <= CERTIFIED_OPT_IN.size);
});

test("annotateCertification: annotates every item with status + visibleToUsers", async () => {
  const items = await listCatalogFromDatabase();
  const annotated = annotateCertification(items);
  assert.equal(annotated.length, items.length);
  for (const item of annotated) {
    assert.ok(item.certification);
    assert.ok(item.certification.status === "certified" || item.certification.status === "not-ready");
    if (item.certification.status === "not-ready") {
      assert.ok(item.certification.reasons.length > 0, `${item.id}: not-ready without reasons`);
      assert.equal(item.certification.visibleToUsers, false);
    }
  }
});

test("ensureUserVisibleOrThrow: throws CertificationRefusedError for not-ready items", () => {
  const fakeNotReady = {
    id: "fake-detect-only",
    capabilityKey: "fake.cap",
    sensitivity: "review",
    supportLevel: "detect-only",
    audit: { finalSupportLevel: "detect-only" }
  } as unknown as CatalogItem;
  assert.throws(() => ensureUserVisibleOrThrow([fakeNotReady]), (err: unknown) => {
    return err instanceof CertificationRefusedError && err.catalogId === "fake-detect-only";
  });
});

test("ensureUserVisibleOrThrow: passes when every supplied item is certified", async () => {
  const items = await listCatalogFromDatabase();
  const optedIn = items.filter((i) => CERTIFIED_OPT_IN.has(i.id) && deriveCertification(i).visibleToUsers);
  // Should not throw.
  ensureUserVisibleOrThrow(optedIn);
});

test("certification audit JSON: counts match annotateCertification", async () => {
  const items = await listCatalogFromDatabase();
  const annotated = annotateCertification(items);
  const certified = annotated.filter((i) => i.certification.status === "certified").length;
  const notReady = annotated.filter((i) => i.certification.status === "not-ready").length;
  // We commit the audit JSON; this assertion catches drift between
  // the runtime gate and the audit script.
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "../../../../..");
  const auditPath = path.resolve(repoRoot, "docs/generated/catalog-certification.json");
  const raw = await fs.readFile(auditPath, "utf8");
  const parsed = JSON.parse(raw);
  assert.equal(parsed.totals.certified, certified, "audit JSON certified count differs from runtime gate");
  assert.equal(parsed.totals.notReady, notReady, "audit JSON not-ready count differs from runtime gate");
  const openBacklog = parsed.records.filter(
    (r: { certificationStatus: string; decisionStatus?: string }) =>
      r.certificationStatus === "not-ready" && r.decisionStatus === "upgrade-backlog"
  ).length;
  const terminalDecisions = parsed.records.filter(
    (r: { certificationStatus: string; decisionStatus?: string }) =>
      r.certificationStatus === "not-ready" && r.decisionStatus !== "upgrade-backlog"
  ).length;
  assert.equal(parsed.totals.upgradeBacklog, openBacklog, "audit JSON open backlog count differs from records");
  assert.equal(parsed.totals.terminalDecisions, terminalDecisions, "audit JSON terminal decision count differs from records");
  assert.equal(openBacklog, 0, "all remaining not-ready capabilities should have explicit terminal decisions");
});
