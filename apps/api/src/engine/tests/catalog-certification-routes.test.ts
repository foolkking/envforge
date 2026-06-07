/**
 * catalog-certification-routes.test.ts — exercises the HTTP surface
 * that gates Build / Catalog access on Full Migration Certification.
 *
 * Verified contracts:
 *   1. GET /api/catalog (anonymous / non-admin) returns ONLY certified
 *      items.
 *   2. GET /api/catalog?include=all from a non-admin is treated as a
 *      regular user request — server still returns certified-only.
 *   3. GET /api/catalog/certification refuses non-admin tokens with 403.
 *   4. POST /api/plans with capability-selection refuses any not-ready
 *      capability id for non-admin users with a structured error.
 *   5. GET /api/build/:targetId/suggestions only returns certified
 *      suggestions.
 */
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import Fastify from "fastify";
import { _resetStoreForTests, readRuntimeDatabase, updateRuntimeDatabase } from "../../runtime-store.js";
import { registerRoutes } from "../../routes.js";

async function bootApp() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "envforge-cert-routes-"));
  const dbPath = path.join(tmpDir, "runtime.json");
  const seed = {
    schemaVersion: "0.3.0",
    users: [],
    sessions: [],
    connections: [],
    userProfiles: [],
    tasks: [],
    playbooks: []
  };
  await fs.writeFile(dbPath, JSON.stringify(seed));
  process.env.FOOL_RUNTIME_DB = dbPath;
  process.env.FOOL_DATA_DIR = tmpDir;
  process.env.NODE_ENV = "development";
  process.env.SMTP_HOST = "";
  process.env.SMTP_USER = "";
  process.env.SMTP_PASS = "";
  if (!process.env.ENVFORGE_MASTER_KEY) {
    process.env.ENVFORGE_MASTER_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  }
  _resetStoreForTests();
  const app = Fastify({ logger: false });
  await registerRoutes(app);
  return { app, tmpDir };
}

async function makeUser(role: "admin" | "user"): Promise<{ token: string; userId: string }> {
  const userId = `u-${role}-${Math.random().toString(36).slice(2, 8)}`;
  const sessionToken = `t-${role}-${Math.random().toString(36).slice(2, 8)}`;
  await updateRuntimeDatabase(async (db) => {
    db.users.push({
      id: userId,
      name: role,
      email: `${userId}@example.com`,
      role,
      passwordHash: "x",
      createdAt: new Date().toISOString()
    } as never);
    db.sessions = db.sessions ?? [];
    (db.sessions as unknown as Array<Record<string, unknown>>).push({
      token: sessionToken,
      userId,
      kind: "regular",
      ip: "127.0.0.1",
      userAgent: "test",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600_000).toISOString()
    });
  });
  return { token: sessionToken, userId };
}

async function makeConnection(userId: string): Promise<string> {
  const connId = `c-${Math.random().toString(36).slice(2, 8)}`;
  await updateRuntimeDatabase(async (db) => {
    db.connections.push({
      id: connId,
      userId,
      method: "ssh-key",
      label: "test target",
      tags: [],
      status: "validated",
      fields: { host: "127.0.0.1", port: "22", username: "root" },
      maskedSecrets: [],
      realConnection: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as never);
  });
  return connId;
}

test("GET /api/catalog (anonymous) returns only Full Migration Certified items", async () => {
  const { app } = await bootApp();
  try {
    const res = await app.inject({ method: "GET", url: "/api/catalog" });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { items: Array<{ id: string; certification?: { status: string } }>; meta?: { viewer: string; total: number; certified: number } };
    assert.ok(body.meta, "meta block must be present");
    assert.equal(body.meta!.viewer, "user-certified-only");
    // Every returned item must be certified.
    for (const item of body.items) {
      assert.equal(item.certification?.status, "certified", `${item.id} leaked into the user-side surface`);
    }
    // Catalog exposes only the currently certified set.
    assert.equal(body.items.length, 105);
  } finally {
    await app.close();
  }
});

test("GET /api/catalog?include=all is ignored for non-admin tokens", async () => {
  const { app } = await bootApp();
  try {
    const { token } = await makeUser("user");
    const res = await app.inject({
      method: "GET",
      url: "/api/catalog?include=all",
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { items: Array<{ certification?: { status: string } }>; meta?: { viewer: string } };
    assert.equal(body.meta?.viewer, "user-certified-only");
    for (const item of body.items) {
      assert.equal(item.certification?.status, "certified");
    }
  } finally {
    await app.close();
  }
});

test("GET /api/catalog?include=all is honoured for admin tokens", async () => {
  const { app } = await bootApp();
  try {
    const { token } = await makeUser("admin");
    const res = await app.inject({
      method: "GET",
      url: "/api/catalog?include=all",
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { items: Array<{ certification?: { status: string } }>; meta: { viewer: string; total: number } };
    assert.equal(body.meta.viewer, "admin-all");
    // Admin sees everything (119 items today) including not-ready ones.
    assert.ok(body.items.length > 3);
    assert.ok(body.items.some((i) => i.certification?.status === "not-ready"));
  } finally {
    await app.close();
  }
});

test("GET /api/catalog/certification refuses non-admin tokens", async () => {
  const { app } = await bootApp();
  try {
    const { token } = await makeUser("user");
    const res = await app.inject({
      method: "GET",
      url: "/api/catalog/certification",
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(res.statusCode, 403);
  } finally {
    await app.close();
  }
});

test("GET /api/catalog/certification returns full registry for admin tokens", async () => {
  const { app } = await bootApp();
  try {
    const { token } = await makeUser("admin");
    const res = await app.inject({
      method: "GET",
      url: "/api/catalog/certification",
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as {
      items: Array<{ id: string; certification: { status: string; reasons: string[] } }>;
      meta: { total: number; certified: number; notReady: number };
    };
    assert.equal(body.meta.total, 119);
    assert.equal(body.meta.certified, 105);
    assert.equal(body.meta.notReady, 14);
    // Every not-ready item carries human-readable reasons.
    const sampleNotReady = body.items.find((i) => i.certification.status === "not-ready");
    assert.ok(sampleNotReady);
    assert.ok(sampleNotReady!.certification.reasons.length > 0);
  } finally {
    await app.close();
  }
});

test("GET /api/admin/capability-standards returns the default Full Migration profile", async () => {
  const { app } = await bootApp();
  try {
    const { token } = await makeUser("admin");
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/capability-standards",
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { activeProfileId: string; profiles: Array<{ id: string; sections: unknown[] }> };
    assert.equal(body.activeProfileId, "full-migration-v1");
    assert.equal(body.profiles[0].id, "full-migration-v1");
    assert.equal(body.profiles[0].sections.length, 13);
  } finally {
    await app.close();
  }
});

test("capability standard profiles can be cloned, activated, patched, selected, and audited", async () => {
  const { app } = await bootApp();
  try {
    const { token } = await makeUser("admin");
    const clone = await app.inject({
      method: "POST",
      url: "/api/admin/capability-standards/full-migration-v1/clone",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Online Full Migration", status: "active" }
    });
    assert.equal(clone.statusCode, 200);
    const cloneBody = clone.json() as { profile: { id: string; status: string; sections: Array<{ id: string; label: string }> } };
    assert.notEqual(cloneBody.profile.id, "full-migration-v1");
    assert.equal(cloneBody.profile.status, "active");

    const standards = await app.inject({
      method: "GET",
      url: "/api/admin/capability-standards",
      headers: { authorization: `Bearer ${token}` }
    });
    const standardsBody = standards.json() as { activeProfileId: string };
    assert.equal(standardsBody.activeProfileId, cloneBody.profile.id);

    const patch = await app.inject({
      method: "PATCH",
      url: `/api/admin/capability-standards/${cloneBody.profile.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: "Online Full Migration Revised",
        sections: cloneBody.profile.sections.map((section) => section.id === "identity" ? { ...section, label: "Identity Revised" } : section)
      }
    });
    assert.equal(patch.statusCode, 200);
    const patchBody = patch.json() as { profile: { name: string; version: number; sections: Array<{ id: string; label: string }> } };
    assert.equal(patchBody.profile.name, "Online Full Migration Revised");
    assert.ok(patchBody.profile.version > 1);
    assert.equal(patchBody.profile.sections.find((section) => section.id === "identity")?.label, "Identity Revised");

    const materializeDefault = await app.inject({
      method: "PATCH",
      url: "/api/admin/capability-standards/full-migration-v1",
      headers: { authorization: `Bearer ${token}` },
      payload: { description: "Materialized default override" }
    });
    assert.equal(materializeDefault.statusCode, 200);
    const defaultBody = materializeDefault.json() as { profile: { status: string; description: string } };
    assert.equal(defaultBody.profile.status, "retired");
    assert.equal(defaultBody.profile.description, "Materialized default override");

    const detail = await app.inject({
      method: "GET",
      url: `/api/admin/capabilities/nginx-web-service/requirements?profileId=${encodeURIComponent(cloneBody.profile.id)}`,
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(detail.statusCode, 200);
    const detailBody = detail.json() as { activeProfile: { id: string; sections: Array<{ label: string }> } };
    assert.equal(detailBody.activeProfile.id, cloneBody.profile.id);
    assert.ok(detailBody.activeProfile.sections.some((section) => section.label === "Identity Revised"));

    const audit = await app.inject({
      method: "GET",
      url: `/api/admin/capability-audit-log?targetId=${encodeURIComponent(cloneBody.profile.id)}`,
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(audit.statusCode, 200);
    const auditBody = audit.json() as { entries: Array<{ action: string; targetId: string }> };
    assert.ok(auditBody.entries.some((entry) => entry.action === "capabilityStandard.clone" && entry.targetId === cloneBody.profile.id));
    assert.ok(auditBody.entries.some((entry) => entry.action === "capabilityStandard.update" && entry.targetId === cloneBody.profile.id));
  } finally {
    await app.close();
  }
});

test("capability standard admin APIs reject non-admin users", async () => {
  const { app } = await bootApp();
  try {
    const { token } = await makeUser("user");
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/capability-standards",
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(res.statusCode, 403);
  } finally {
    await app.close();
  }
});

test("capability requirement draft can be simulated and published", async () => {
  const { app } = await bootApp();
  try {
    const { token } = await makeUser("admin");
    const detail = await app.inject({
      method: "GET",
      url: "/api/admin/capabilities/nginx-web-service/requirements",
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(detail.statusCode, 200);
    const detailBody = detail.json() as {
      activeProfile: { id: string; sections: Array<{ id: string }> };
      projectedSections: Record<string, unknown>;
    };
    assert.equal(detailBody.activeProfile.id, "full-migration-v1");
    assert.equal(Object.keys(detailBody.projectedSections).length, 13);

    const sections = Object.fromEntries(
      detailBody.activeProfile.sections.map((section) => [
        section.id,
        { status: "satisfied", notes: `covered: ${section.id}` }
      ])
    );
    const draft = await app.inject({
      method: "PATCH",
      url: "/api/admin/capabilities/nginx-web-service/requirements/draft",
      headers: { authorization: `Bearer ${token}` },
      payload: { profileId: detailBody.activeProfile.id, sections }
    });
    assert.equal(draft.statusCode, 200);
    const draftBody = draft.json() as { draft: { id: string; draftVersion: number } };
    assert.ok(draftBody.draft.id);
    assert.equal(draftBody.draft.draftVersion, 1);

    const simulate = await app.inject({
      method: "POST",
      url: "/api/admin/capabilities/nginx-web-service/certification/simulate",
      headers: { authorization: `Bearer ${token}` },
      payload: { profileId: detailBody.activeProfile.id, sections }
    });
    assert.equal(simulate.statusCode, 200);
    const simulateBody = simulate.json() as { run: { status: string; missingSections: string[] } };
    assert.equal(simulateBody.run.status, "certified");
    assert.deepEqual(simulateBody.run.missingSections, []);

    const publish = await app.inject({
      method: "POST",
      url: "/api/admin/capabilities/nginx-web-service/requirements/publish",
      headers: { authorization: `Bearer ${token}` },
      payload: { profileId: detailBody.activeProfile.id, draftId: draftBody.draft.id }
    });
    assert.equal(publish.statusCode, 200);
    const publishBody = publish.json() as { version: { id: string; version: number; status: string }; run: { status: string } };
    assert.equal(publishBody.version.version, 1);
    assert.equal(publishBody.version.status, "published");
    assert.equal(publishBody.run.status, "certified");

    const changedSections = {
      ...sections,
      identity: { status: "satisfied", notes: "changed identity evidence" }
    };
    const secondDraft = await app.inject({
      method: "PATCH",
      url: "/api/admin/capabilities/nginx-web-service/requirements/draft",
      headers: { authorization: `Bearer ${token}` },
      payload: { profileId: detailBody.activeProfile.id, sections: changedSections }
    });
    assert.equal(secondDraft.statusCode, 200);
    const secondDraftBody = secondDraft.json() as { draft: { id: string } };

    const secondPublish = await app.inject({
      method: "POST",
      url: "/api/admin/capabilities/nginx-web-service/requirements/publish",
      headers: { authorization: `Bearer ${token}` },
      payload: { profileId: detailBody.activeProfile.id, draftId: secondDraftBody.draft.id }
    });
    assert.equal(secondPublish.statusCode, 200);
    const secondPublishBody = secondPublish.json() as { version: { version: number; status: string }; run: { status: string } };
    assert.equal(secondPublishBody.version.version, 2);
    assert.equal(secondPublishBody.version.status, "published");
    assert.equal(secondPublishBody.run.status, "certified");

    const rollback = await app.inject({
      method: "POST",
      url: "/api/admin/capabilities/nginx-web-service/rollback-version",
      headers: { authorization: `Bearer ${token}` },
      payload: { profileId: detailBody.activeProfile.id, versionId: publishBody.version.id, note: "rollback test" }
    });
    assert.equal(rollback.statusCode, 200);
    const rollbackBody = rollback.json() as { version: { version: number; status: string; rollbackOfVersionId?: string } };
    assert.equal(rollbackBody.version.version, 3);
    assert.equal(rollbackBody.version.status, "published");
    assert.equal(rollbackBody.version.rollbackOfVersionId, publishBody.version.id);

    const runs = await app.inject({
      method: "GET",
      url: `/api/admin/capabilities/nginx-web-service/certification/runs?profileId=${encodeURIComponent(detailBody.activeProfile.id)}`,
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(runs.statusCode, 200);
    const runsBody = runs.json() as { runs: Array<{ status: string }> };
    assert.ok(runsBody.runs.length >= 3);

    const audit = await app.inject({
      method: "GET",
      url: "/api/admin/capability-audit-log?targetId=nginx-web-service",
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(audit.statusCode, 200);
    const auditBody = audit.json() as { entries: Array<{ action: string; feedback: string | null }> };
    assert.ok(auditBody.entries.some((entry) => entry.action === "capabilityRequirementVersion.publish"));
    assert.ok(auditBody.entries.some((entry) => entry.action === "capabilityRequirementVersion.rollback" && entry.feedback === "rollback test"));
  } finally {
    await app.close();
  }
});

test("POST /api/plans (non-admin) refuses not-ready capability ids", async () => {
  const { app } = await bootApp();
  try {
    const { token, userId } = await makeUser("user");
    const connId = await makeConnection(userId);
    const res = await app.inject({
      method: "POST",
      url: "/api/plans",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        type: "rebuild",
        targetConnectionId: connId,
        // certbot-letsencrypt remains a detect-only alias/review card.
        // Selecting it from a user-side flow MUST be refused.
        source: { kind: "capability-selection", capabilityIds: ["certbot-letsencrypt"] }
      }
    });
    assert.equal(res.statusCode, 400);
    const body = res.json() as { error: string; refused: Array<{ id: string; certification: { status: string } }> };
    assert.match(body.error, /not Full Migration Certified/);
    assert.ok(body.refused.some((r) => r.id === "certbot-letsencrypt" && r.certification.status === "not-ready"));
  } finally {
    await app.close();
  }
});

test("POST /api/plans (non-admin) accepts certified capability ids", async () => {
  const { app } = await bootApp();
  try {
    const { token, userId } = await makeUser("user");
    const connId = await makeConnection(userId);
    const res = await app.inject({
      method: "POST",
      url: "/api/plans",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        type: "rebuild",
        targetConnectionId: connId,
        source: { kind: "capability-selection", capabilityIds: ["nginx-web-service"] }
      }
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { plan: { type: string; items: Array<{ id: string }> } };
    assert.equal(body.plan.type, "rebuild");
    assert.ok(body.plan.items.some((it) => it.id === "capability:nginx-web-service"));
  } finally {
    await app.close();
  }
});

test("POST /api/plans (non-admin) accepts promoted certified capability ids", async () => {
  const { app } = await bootApp();
  try {
    const { token, userId } = await makeUser("user");
    const connId = await makeConnection(userId);
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
      const res = await app.inject({
        method: "POST",
        url: "/api/plans",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          type: "rebuild",
          targetConnectionId: connId,
          source: { kind: "capability-selection", capabilityIds: [id] }
        }
      });
      assert.equal(res.statusCode, 200, `${id} should be accepted: ${res.body}`);
      const body = res.json() as { plan: { type: string; items: Array<{ id: string }> } };
      assert.ok(body.plan.items.some((it) => it.id === `capability:${id}`), `${id} missing from plan`);
    }
  } finally {
    await app.close();
  }
});

test("GET /api/build/:targetId/suggestions returns only certified suggestions", async () => {
  const { app } = await bootApp();
  try {
    const { token, userId } = await makeUser("user");
    const connId = await makeConnection(userId);
    const res = await app.inject({
      method: "GET",
      url: `/api/build/${connId}/suggestions`,
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as {
      suggestions: Array<{ capabilityId: string; certified: true; canAddToPlan: boolean }>;
    };
    assert.ok(Array.isArray(body.suggestions));
    // Certified items each become a suggestion (install or reconcile).
    assert.equal(body.suggestions.length, 105);
    const ids = body.suggestions.map((s) => s.capabilityId).sort();
    assert.deepEqual(ids, [
      "adguard-home",
      "ansible-tool",
      "apache-httpd",
      "audiobookshelf",
      "authelia",
      "authentik",
      "bookstack",
      "caddy-server",
      "certbot-ssl",
      "clickhouse",
      "code-server",
      "docker-compose-dev",
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
      "immich",
      "influxdb",
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
      "n8n",
      "navidrome",
      "neovim-editor",
      "netdata-monitoring",
      "nethogs-bandwidth",
      "nextcloud",
      "nfs-server",
      "nginx-web-service",
      "nocodb",
      "node-production-deploy",
      "node-runtime-profile",
      "nodejs-pm2",
      "nodejs-version-mgr",
      "onlyoffice-docs",
      "openjdk-runtime",
      "openresty",
      "openvpn-server",
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
    ].sort());
    for (const s of body.suggestions) {
      assert.equal(s.certified, true);
      assert.equal(s.canAddToPlan, true);
    }
  } finally {
    await app.close();
  }
});

test("GET /api/build/:targetId/suggestions refuses anonymous callers", async () => {
  const { app } = await bootApp();
  try {
    const res = await app.inject({
      method: "GET",
      url: "/api/build/whatever/suggestions"
    });
    assert.equal(res.statusCode, 401);
  } finally {
    await app.close();
  }
});

test("GET /api/build/:targetId/suggestions refuses unknown connection ids", async () => {
  const { app } = await bootApp();
  try {
    const { token } = await makeUser("user");
    const res = await app.inject({
      method: "GET",
      url: "/api/build/does-not-exist/suggestions",
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(res.statusCode, 404);
  } finally {
    await app.close();
  }
});
