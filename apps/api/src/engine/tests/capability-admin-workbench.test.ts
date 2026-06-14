/**
 * capability-admin-workbench.test.ts
 *
 * Guards the Capability Admin (Catalog) workbench refactor:
 *
 *   1. Non-admin nav: navItemsForRole("user") MUST drop the catalog
 *      entry; admins keep it.
 *   2. Catalog redirect: main.tsx MUST redirect non-admin viewers off
 *      the catalog page (useEffect that switches to "market" / Build).
 *   3. Admin workbench tabs: CapabilityRulesAdminPage source MUST
 *      render the five tabs (Overview / Rule Registry / Suggestion
 *      Inbox / Package Integrations / Users & Queues) and MUST use
 *      a table for the registry, not the legacy market-card grid.
 *   4. Suggestion Inbox: source MUST surface suggestion status in the
 *      table.
 *   5. Package Integrations: source MUST render package map / service
 *      map / config path map fields.
 *   6. New admin endpoints: GET /api/admin/package-integrations and
 *      its detail variant are admin-gated (403 for non-admins) and
 *      return rule-level structured data for admins.
 *   7. Admin Suggestion Inbox endpoint: GET /api/admin/suggestions is
 *      admin-gated.
 *   8. Maintain page MUST NOT contain the legacy CatalogAdminPanel
 *      tab anymore — rule governance moved to Capability Admin.
 *
 * The web app has no jsdom / vitest, so these tests verify contracts
 * via source-level scans + Fastify-inject route checks. Pure UI render
 * coverage requires installing a test framework, which is explicitly
 * out of scope for this phase.
 */
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import Fastify from "fastify";
import { _resetStoreForTests, updateRuntimeDatabase } from "../../runtime-store.js";
import { registerRoutes } from "../../routes.js";

const here = path.dirname(fileURLToPathSafe(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");
const adminPagePath = path.resolve(repoRoot, "apps/web/src/pages/CapabilityRulesAdminPage.tsx");
const mainPath = path.resolve(repoRoot, "apps/web/src/main.tsx");
const typesPath = path.resolve(repoRoot, "apps/web/src/lib/types.ts");
const settingsPath = path.resolve(repoRoot, "apps/web/src/pages/SettingsPage.tsx");
const buildPagePath = path.resolve(repoRoot, "apps/web/src/pages/CapabilityCatalogPage.tsx");
const apiTsPath = path.resolve(repoRoot, "apps/web/src/api.ts");

function fileURLToPathSafe(url: string): string {
  return new URL(url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
}

// CapabilityRulesAdminPage.tsx now composes per-tab components under
// pages/governance/*.tsx; admin-content scans read the composer + tabs.
const governanceDir = path.resolve(repoRoot, "apps/web/src/pages/governance");
async function readAdminWorkbenchSource(): Promise<string> {
  const entries = await fs.readdir(governanceDir);
  const tabs = await Promise.all(
    entries.filter((f) => f.endsWith(".tsx")).map((f) => fs.readFile(path.join(governanceDir, f), "utf8"))
  );
  const composer = await fs.readFile(adminPagePath, "utf8");
  return [composer, ...tabs].join("\n");
}

async function bootApp() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "envforge-cap-admin-"));
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
  return { app };
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

// ── source-level: navigation gating ──────────────────────────────────

test("navItemsForRole drops the admin-only catalog entry for non-admins", async () => {
  const src = await fs.readFile(typesPath, "utf8");
  // navItems must mark catalog as adminOnly
  assert.match(src, /id:\s*"catalog"[^}]*adminOnly:\s*true/s,
    "catalog navItem must have adminOnly: true");
  // navItemsForRole must filter out adminOnly items for non-admin roles.
  // The filter expression is "role === 'admin' || !item.adminOnly" — anyone
  // who is not admin gets the !adminOnly subset only.
  assert.match(src, /export function navItemsForRole/);
  assert.match(src, /role === "admin" \|\| !item\.adminOnly/);
  // Catalog label is renamed to "Capability Admin"
  assert.match(src, /catalog:\s*"Capability Admin"/);
});

test("main.tsx renders the nav with navItemsForRole(authUser?.role)", async () => {
  const src = await fs.readFile(mainPath, "utf8");
  // The sidebar now renders role-filtered, grouped navigation via
  // navGroupsForRole (which internally applies navItemsForRole).
  assert.match(src, /navGroupsForRole\(authUser\?\.role\)\.map/,
    "main.tsx must render the nav via navGroupsForRole(authUser?.role).map");
});

test("main.tsx redirects non-admin viewers away from the catalog page", async () => {
  const src = await fs.readFile(mainPath, "utf8");
  // Look for the redirect useEffect that switches non-admin off "catalog"
  assert.ok(
    src.includes(`page === "catalog" && authUser?.role !== "admin"`),
    "main.tsx must include a useEffect that redirects non-admins off the catalog page"
  );
  assert.ok(
    src.includes(`setPage("build")`),
    "main.tsx must redirect non-admins to the Build page"
  );
});

test("main.tsx shows a Go-to-Build notice when a non-admin lands on /catalog", async () => {
  const src = await fs.readFile(mainPath, "utf8");
  assert.ok(
    src.includes("Go to Build") || src.includes("去 Build"),
    "main.tsx must surface a Go-to-Build notice for non-admin viewers on the catalog page"
  );
});

// ── source-level: workbench tabs ─────────────────────────────────────

test("Capability Admin page renders the five-tab workbench", async () => {
  const src = await fs.readFile(adminPagePath, "utf8");
  assert.match(src, /capability-admin-workbench/);
  assert.match(src, /capability-admin-tabs/);
  assert.match(src, /tab-overview/);
  assert.match(src, /tab-registry/);
  assert.match(src, /tab-suggestions/);
  assert.match(src, /tab-integrations/);
  assert.match(src, /tab-users-queues/);
  // The five tab labels in EN
  assert.match(src, /Overview/);
  assert.match(src, /Rule Registry/);
  assert.match(src, /Suggestion Inbox/);
  assert.match(src, /Package Integrations/);
  assert.match(src, /Users & Queues/);
});

test("Rule Registry uses a table, not the legacy market-card grid", async () => {
  const src = await readAdminWorkbenchSource();
  assert.match(src, /data-testid="rules-table"/);
  // The legacy market grid uses className "catalog-grid" with cards.
  assert.ok(
    !src.includes('className="catalog-grid"'),
    "registry must not use the legacy market-card grid"
  );
});

test("Suggestion Inbox surfaces suggestion status", async () => {
  const src = await readAdminWorkbenchSource();
  assert.match(src, /SuggestionStatusBadge/);
  assert.match(src, /suggestion-status-/);
  // Status flow values
  assert.match(src, /pending/);
  assert.match(src, /accepted/);
  assert.match(src, /rejected/);
});

test("Package Integrations panel renders package map + service map + config paths", async () => {
  const src = await readAdminWorkbenchSource();
  // Section testIds (rendered via data-testid={testId}).
  assert.match(src, /testId="package-map"/);
  assert.match(src, /testId="service-map"/);
  assert.match(src, /testId="config-paths"/);
  assert.match(src, /Cross-distro package map/);
  assert.match(src, /Service map/);
  // Detail-panel hooks: validate + rollback strategy
  assert.match(src, /validate/i);
  assert.match(src, /restartServices/);
  assert.match(src, /dataStrategy/);
});

test("api.ts exposes the new admin workbench helpers", async () => {
  const src = await fs.readFile(apiTsPath, "utf8");
  assert.match(src, /export async function fetchAdminSuggestions/);
  assert.match(src, /export async function processAdminSuggestion/);
  assert.match(src, /export async function fetchPackageIntegrations/);
  assert.match(src, /export async function fetchPackageIntegrationDetail/);
});

// ── source-level: Maintain de-scoped ─────────────────────────────────

test("Maintain (SettingsPage) no longer ships the legacy CatalogAdminPanel tab", async () => {
  const src = await fs.readFile(settingsPath, "utf8");
  assert.ok(
    !src.includes("CatalogAdminPanel"),
    "SettingsPage must not import or render CatalogAdminPanel; rule governance lives in Capability Admin"
  );
  assert.ok(
    !/能力规则库（管理员）|Capability Catalog \(admin\)/.test(src),
    "SettingsPage must not surface the legacy 'Capability Catalog (admin)' tab label"
  );
});

// ── source-level: Build page residual checks ─────────────────────────

test("Build page only renders the capability-type filter (no supportLevel pills)", async () => {
  const src = await fs.readFile(buildPagePath, "utf8");
  // No supportLevelFilter state / helper — this is the real contract for
  // "no supportLevel pills" (the pills were driven by that state).
  assert.ok(!src.includes("supportLevelFilter"));
  assert.ok(!src.includes("supportLevelLabel"));
  // The old English supportLevel pill labels must not appear. (We do NOT
  // forbid the Chinese terms here: the redesigned page legitimately shows
  // certification copy like "完整迁移认证", which contains "完整迁移".)
  for (const lbl of ["Full migration", "Managed config", "Basic rebuild", "Detect only"]) {
    assert.ok(!src.includes(lbl), `Build page must not render supportLevel label ${lbl}`);
  }
  // The capability-type filter pills exist.
  assert.match(src, /market-category-filters/);
  assert.match(src, /Runtime/);
  assert.match(src, /Database/);
  assert.match(src, /Security/);
  assert.match(src, /Network/);
  assert.match(src, /Container/);
});

// ── route-level: package-integrations endpoint ───────────────────────

test("GET /api/admin/package-integrations refuses non-admin tokens", async () => {
  const { app } = await bootApp();
  try {
    const { token } = await makeUser("user");
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/package-integrations",
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(res.statusCode, 403);
  } finally {
    await app.close();
  }
});

test("GET /api/admin/package-integrations returns rule-level data for admins", async () => {
  const { app } = await bootApp();
  try {
    const { token } = await makeUser("admin");
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/package-integrations",
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as {
      items: Array<{
        id: string;
        hasRule: boolean;
        ruleSummary: null | {
          packageMap: Record<string, string[] | undefined>;
          serviceMap: Record<string, string[] | undefined>;
          binaries: string[];
          systemd: string[];
          ports: number[];
          configFiles: string[];
          configGlobs: string[];
          secretPatterns: string[];
          dataPaths: string[];
          validate: string[];
          restartServices: string[];
          dataStrategy: string;
        };
      }>;
      meta: { total: number; withRule: number; withoutRule: number };
    };
    assert.ok(body.items.length > 0, "package integrations must return at least one item");
    assert.ok(body.meta.total > 0);
    // nginx-web-service is one of the certified catalog items and MUST
    // surface a rule summary (resolved via the curated alias to the
    // underlying `nginx` CatalogDetectionRule).
    const nginx = body.items.find((i) => i.id === "nginx-web-service");
    assert.ok(nginx, "nginx-web-service capability must be in the registry");
    assert.equal(nginx!.hasRule, true);
    assert.ok(nginx!.ruleSummary);
    assert.deepEqual(nginx!.ruleSummary!.packageMap.apt, ["nginx"]);
    assert.ok(nginx!.ruleSummary!.serviceMap.debian?.includes("nginx"));
    assert.ok(nginx!.ruleSummary!.binaries.includes("nginx"));
    assert.ok(nginx!.ruleSummary!.ports.includes(80));
    assert.ok(nginx!.ruleSummary!.validate.includes("nginx -t"));
    // meta accounting must add up.
    assert.equal(body.meta.total, body.meta.withRule + body.meta.withoutRule);
  } finally {
    await app.close();
  }
});

test("GET /api/admin/package-integrations/:id returns the underlying rule for admins", async () => {
  const { app } = await bootApp();
  try {
    const { token } = await makeUser("admin");
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/package-integrations/nginx-web-service",
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as {
      id: string;
      rule: null | { id: string; capabilityKey: string; crossDistro?: { packageMap: Record<string, string[] | undefined> } };
    };
    assert.equal(body.id, "nginx-web-service");
    assert.ok(body.rule);
    assert.equal(body.rule!.id, "nginx");
    assert.equal(body.rule!.capabilityKey, "web-server.nginx");
  } finally {
    await app.close();
  }
});

test("GET /api/admin/package-integrations/:id refuses non-admin tokens", async () => {
  const { app } = await bootApp();
  try {
    const { token } = await makeUser("user");
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/package-integrations/nginx-web-service",
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(res.statusCode, 403);
  } finally {
    await app.close();
  }
});

test("GET /api/admin/package-integrations/:id returns 404 for unknown capabilities", async () => {
  const { app } = await bootApp();
  try {
    const { token } = await makeUser("admin");
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/package-integrations/does-not-exist-zzz",
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(res.statusCode, 404);
  } finally {
    await app.close();
  }
});

// ── route-level: Suggestion Inbox endpoint is admin-gated ────────────

test("GET /api/admin/suggestions refuses non-admin tokens", async () => {
  const { app } = await bootApp();
  try {
    const { token } = await makeUser("user");
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/suggestions",
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(res.statusCode, 403);
  } finally {
    await app.close();
  }
});

test("GET /api/admin/suggestions returns the inbox shape for admins", async () => {
  const { app } = await bootApp();
  try {
    const { token } = await makeUser("admin");
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/suggestions",
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { suggestions: Array<unknown> };
    assert.ok(Array.isArray(body.suggestions));
  } finally {
    await app.close();
  }
});
