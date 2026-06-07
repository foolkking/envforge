/**
 * build-ui-regression.test.ts — guards the Certified Build UX contract.
 *
 * The web app ships no jsdom / react-test-renderer / vitest, so a full
 * DOM render test is not possible without adding a framework (which this
 * phase explicitly must not do). Instead we cover the contract at two
 * layers that DO run in CI:
 *
 *   1. Route-level (live Fastify inject): the data the Build page
 *      consumes never contains not-ready items, and the admin registry
 *      does. Covered here + in catalog-certification-routes.test.ts.
 *
 *   2. Source-level: scan the user-facing Build page source to assert it
 *      no longer renders the four supportLevel labels, no longer calls a
 *      supportLevelLabel helper, and DOES render the Certified badge.
 *
 * Limitation: source-level scans catch "the label string / className was
 * removed" but cannot prove pixel-level rendering. They are a pragmatic
 * regression net given the no-web-test-framework constraint.
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
const buildPagePath = path.resolve(repoRoot, "apps/web/src/pages/CapabilityCatalogPage.tsx");
const adminPagePath = path.resolve(repoRoot, "apps/web/src/pages/CapabilityRulesAdminPage.tsx");
const mainPagePath = path.resolve(repoRoot, "apps/web/src/main.tsx");
const navTypesPath = path.resolve(repoRoot, "apps/web/src/lib/types.ts");
const dashboardPagePath = path.resolve(repoRoot, "apps/web/src/pages/DashboardPage.tsx");
const plansPagePath = path.resolve(repoRoot, "apps/web/src/pages/PlanRecipesPage.tsx");
const machinePagePath = path.resolve(repoRoot, "apps/web/src/pages/MachinePage.tsx");
const migratePipelinePath = path.resolve(repoRoot, "apps/web/src/components/MigratePipelinePage.tsx");
const webApiPath = path.resolve(repoRoot, "apps/web/src/api.ts");
const stepperPath = path.resolve(repoRoot, "apps/web/src/components/WorkflowStepper.tsx");
const settingsPath = path.resolve(repoRoot, "apps/web/src/pages/SettingsPage.tsx");
const apiRoutesPath = path.resolve(repoRoot, "apps/api/src/routes.ts");

function fileURLToPathSafe(url: string): string {
  // Local helper to avoid importing node:url at top-level twice.
  return new URL(url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
}

// ── source-level scans ──────────────────────────────────────────────

test("Build page source does NOT render the four supportLevel labels", async () => {
  const src = await fs.readFile(buildPagePath, "utf8");
  // The user-facing labels that must not appear as rendered strings.
  const forbidden = ["Detect only", "Basic rebuild", "Managed config", "Full migration", "仅识别", "基础重建", "托管配置"];
  for (const label of forbidden) {
    assert.ok(
      !src.includes(label),
      `Build page must not render supportLevel label "${label}"`
    );
  }
});

test("Build page source no longer defines or calls supportLevelLabel", async () => {
  const src = await fs.readFile(buildPagePath, "utf8");
  assert.ok(!src.includes("supportLevelLabel"), "supportLevelLabel helper must be removed from the Build page");
  assert.ok(!src.includes("supportLevelFilter"), "supportLevel filter state must be removed from the Build page");
  // The legacy support-level className must not be applied to cards.
  assert.ok(!/support-level support-/.test(src), "Build page must not apply the support-level-* className to cards");
});

test("Build page source renders a Certified badge", async () => {
  const src = await fs.readFile(buildPagePath, "utf8");
  assert.match(src, /certification-badge/, "Build page must render the certification badge");
  assert.match(src, /Certified/, "Build page must render the Certified label");
  assert.match(src, /certification\?\.status/, "Build badge must derive from item.certification.status, not supportLevel");
});

test("Build page source shows the certified-only empty-state copy", async () => {
  const src = await fs.readFile(buildPagePath, "utf8");
  // The empty-state copy required by the design (zh + en).
  assert.match(src, /Full Migration Certified/);
  assert.ok(
    src.includes("当前仅展示已认证能力。更多能力正在管理员规则库中完善。") ||
      src.includes("being upgraded in the admin Capability Rules registry"),
    "Build page must show the certified-only empty-state copy"
  );
});

test("Migrate page source renders the pipeline shell instead of legacy stacked panels", async () => {
  const src = await fs.readFile(machinePagePath, "utf8");
  assert.match(src, /MigratePipelinePage/, "Migrate page must mount the pipeline shell");
  for (const forbidden of [
    "EnvironmentInventoryPanel",
    "ReviewQueuePanel",
    "ConfigGovernancePanel",
    "MigrationPlanPanel",
    "migrate-workbench-grid",
    "current-host-summary-card"
  ]) {
    assert.ok(!src.includes(forbidden), `Migrate page must not render legacy stacked workbench artifact: ${forbidden}`);
  }
});

test("Migrate pipeline source keeps capability-level selection and evidence drawer contract", async () => {
  const src = await fs.readFile(migratePipelinePath, "utf8");
  assert.match(src, /StagedPlanBar/, "Pipeline must keep the staged plan bar");
  assert.match(src, /Select capabilities, not packages|按能力选择，不按包选择/, "Selection step must be capability-level, not package-level");
  assert.match(src, /candidate\.catalogRuleName \?\? candidate\.name/, "Cards must name the capability when a catalog rule exists");
  assert.match(src, /candidateIds/, "Bulk decisions must submit candidateIds");
  assert.match(src, /selectedGroup && selectedGroup !== group/, "Bulk selection must stay within one candidate group");
  assert.match(src, /EvidenceDrawer/, "Raw evidence must live behind an evidence drawer");
  assert.match(src, /candidate\.rawEvidence/, "Evidence drawer must expose raw evidence");
  assert.match(src, /candidate\.normalizedArtifacts/, "Evidence drawer must expose normalized artifacts");
});

test("Migrate pipeline source implements config/data review decisions", async () => {
  const src = await fs.readFile(migratePipelinePath, "utf8");
  const api = await fs.readFile(webApiPath, "utf8");
  assert.match(src, /ConfigBundleDrawer/, "ConfigBundle raw/diff details must live behind a drawer");
  assert.match(src, /saveMigrationSessionConfigDecision/, "ConfigBundle decisions must call the session API");
  assert.match(src, /saveMigrationSessionDataDecision/, "Data strategy decisions must call the session API");
  assert.match(src, /secret-out-of-band/, "Secret config must be an explicit out-of-band decision");
  assert.match(src, /data strategy|数据策略/, "Data strategy confirmation must remain visible in the UI");
  assert.match(api, /config-decisions/, "Web API must expose session config decision endpoint");
  assert.match(api, /data-decisions/, "Web API must expose session data decision endpoint");
});

test("Migrate pipeline source implements apply verify report closed loop", async () => {
  const src = await fs.readFile(migratePipelinePath, "utf8");
  const api = await fs.readFile(webApiPath, "utf8");
  for (const token of [
    "fetchMigrationSessionApplyReadiness",
    "applyMigrationSession",
    "verifyMigrationSession",
    "fetchMigrationSessionReport"
  ]) {
    assert.match(src, new RegExp(token), `Migrate pipeline must use ${token}`);
    assert.match(api, new RegExp(token), `Web API must export ${token}`);
  }
  assert.match(src, /RunSummaryCard/, "Apply/verify/report results must be summarized in the UI");
  assert.match(src, /rollback/i, "Rollback visibility must remain part of the apply/report UI");
  assert.match(api, /apply-readiness/, "Web API must expose session apply readiness endpoint");
  assert.match(api, /\/apply/, "Web API must expose session apply endpoint");
  assert.match(api, /\/verify/, "Web API must expose session verify endpoint");
  assert.match(api, /\/report/, "Web API must expose session report endpoint");
});

test("Migrate session routes enforce phase 8 apply gates", async () => {
  const routes = await fs.readFile(apiRoutesPath, "utf8");
  for (const endpoint of [
    "/api/migration/sessions/:sessionId/config-decisions",
    "/api/migration/sessions/:sessionId/data-decisions",
    "/api/migration/sessions/:sessionId/apply-readiness",
    "/api/migration/sessions/:sessionId/apply",
    "/api/migration/sessions/:sessionId/verify",
    "/api/migration/sessions/:sessionId/report"
  ]) {
    assert.ok(routes.includes(endpoint), `routes.ts missing ${endpoint}`);
  }
  assert.match(routes, /Pending review remains/, "Apply readiness must block pending review");
  assert.match(routes, /Latest dry-run did not pass|Dry-run must pass before apply/, "Apply readiness must block failed or missing dry-run");
  assert.match(routes, /Secret or blocked config requires explicit out-of-band decision/, "Secret config must be an explicit blocker");
  assert.match(routes, /Data movement strategy must be confirmed/, "Data strategy must block apply until confirmed");
  assert.match(routes, /A successful apply run is required before verification/, "Verify must be tied to successful apply");
});

test("Admin registry page renders missing requirements + not-ready status", async () => {
  const src = await fs.readFile(adminPagePath, "utf8");
  assert.match(src, /Not Ready|not-ready/);
  assert.match(src, /reasons/, "admin page must render certification reasons (missing requirements)");
  assert.match(src, /Full Migration Checklist|Full Migration 检查项/, "admin page must render the Full Migration Checklist");
});

// ── route-level: data the Build page consumes ───────────────────────

test("main navigation hides Catalog, Maintain, and Account for non-admins", async () => {
  const nav = await fs.readFile(navTypesPath, "utf8");
  // The Page union no longer carries "settings" / "me" — the entries
  // were removed from navItems entirely. The role filter only needs to
  // block adminOnly items for non-admins; admin-only Catalog stays.
  assert.ok(!/id:\s*"settings"/.test(nav), "Maintain navItem must be removed");
  assert.ok(!/id:\s*"me"/.test(nav), "Account navItem must be removed");
  assert.match(nav, /role === "admin" \|\| !item\.adminOnly/, "Capability Admin must be admin-only");
  // The Page type union itself must not list settings/me anymore.
  assert.ok(!/Page\s*=\s*[^;]*"settings"/.test(nav));
  assert.ok(!/Page\s*=\s*[^;]*"me"/.test(nav));
});

test("admin navigation exposes Capability Admin", async () => {
  const nav = await fs.readFile(navTypesPath, "utf8");
  assert.match(nav, /id: "catalog"[\s\S]*adminOnly: true/, "Catalog route must be admin-only");
  assert.match(nav, /Capability Admin/);
});

test("non-admin catalog route redirects to Build", async () => {
  const main = await fs.readFile(mainPagePath, "utf8");
  assert.match(main, /page === "catalog" && authUser\?\.role !== "admin"/);
  assert.match(main, /setPage\("market"\)/);
});

test("Build page keeps only category filters and no market controls", async () => {
  const src = await fs.readFile(buildPagePath, "utf8");
  for (const label of ["All", "Runtime", "Database", "Security", "Network", "Container", "Dev", "Service"]) {
    assert.ok(src.includes(label), `Build category filter ${label} should remain`);
  }
  for (const forbidden of ["market-switch", "CatalogSuggestionCenter", "Rating ", "Profiles", "Suggest"]) {
    assert.ok(!src.includes(forbidden), `Build must not render ${forbidden}`);
  }
});

test("Build stepper no longer says Capability Catalog or detect-only", async () => {
  const stepper = await fs.readFile(stepperPath, "utf8");
  assert.ok(!stepper.includes("Capability Catalog"));
  assert.ok(!stepper.includes("detect-only"));
  assert.match(stepper, /Certified Capabilities|Select Capabilities/);
});

test("Dashboard keeps the resource console layout", async () => {
  const src = await fs.readFile(dashboardPagePath, "utf8");
  for (const label of ["Resource console", "Operations pipeline", "Runtime queue", "Recent plan activity", "Workspace context", "Snapshots and reports"]) {
    assert.ok(src.includes(label), `Dashboard missing ${label}`);
  }
});

test("Account migration-method content is removed from the user-side surface", async () => {
  // MePage.tsx was deleted — Account merged into Dashboard. The test
  // asserts the migration-method residue is gone from every place that
  // could plausibly host it (Dashboard, AccountPanel, SettingsPage
  // module, CapabilityCatalogPage). The forbidden phrases are
  // "完整迁移方法", "Full migration methods", "skip / replace".
  const dashboard = await fs.readFile(dashboardPagePath, "utf8");
  const settings = await fs.readFile(settingsPath, "utf8");
  const build = await fs.readFile(buildPagePath, "utf8");
  for (const src of [dashboard, settings, build]) {
    assert.ok(!src.includes("完整迁移方法"));
    assert.ok(!src.includes("Full migration methods"));
    assert.ok(!src.includes("skip / replace"));
  }
});

test("Plans page owns Schedules, Drift, and Webhooks tabs", async () => {
  const src = await fs.readFile(plansPagePath, "utf8");
  for (const label of ["Plans", "Runs", "Schedules", "Drift", "Webhooks", "Reports"]) {
    assert.ok(src.includes(label), `Plans tab ${label} should render`);
  }
  assert.match(src, /SchedulesPanel/);
  assert.match(src, /DriftPanel/);
  assert.match(src, /WebhooksPanel/);
});

test("Capability Admin renders five governance tabs", async () => {
  const src = await fs.readFile(adminPagePath, "utf8");
  for (const label of ["Overview", "Rule Registry", "Suggestion Inbox", "Package Integrations", "Users & Queues"]) {
    assert.ok(src.includes(label), `Capability Admin missing ${label}`);
  }
});

test("Package Integrations is not an install/uninstall host package manager", async () => {
  const src = await fs.readFile(adminPagePath, "utf8");
  assert.ok(!/<button[^>]*>\s*Install\s*<\/button>/i.test(src));
  assert.ok(!/<button[^>]*>\s*Uninstall\s*<\/button>/i.test(src));
  assert.match(src, /NOT a host-level package manager|not a host-level package manager/i);
});

test("Suggestion Inbox and Users & Queues render workflow assignment language", async () => {
  const src = await fs.readFile(adminPagePath, "utf8");
  assert.match(src, /SuggestionStatusBadge/);
  assert.match(src, /Users \/ Maintainers/);
  assert.match(src, /reviewer|maintainer/);
  assert.match(src, /Assigned Capabilities|Open Backlog Items|Queue/);
  assert.ok(!src.includes("Linux user management"));
});

async function bootApp() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "envforge-build-ui-"));
  const dbPath = path.join(tmpDir, "runtime.json");
  await fs.writeFile(
    dbPath,
    JSON.stringify({
      schemaVersion: "0.3.0",
      users: [],
      sessions: [],
      connections: [],
      userProfiles: [],
      tasks: [],
      playbooks: []
    })
  );
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
  return app;
}

async function makeUser(role: "admin" | "user"): Promise<string> {
  const userId = `u-${role}-${Math.random().toString(36).slice(2, 8)}`;
  const token = `t-${role}-${Math.random().toString(36).slice(2, 8)}`;
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
      token,
      userId,
      kind: "regular",
      ip: "127.0.0.1",
      userAgent: "test",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600_000).toISOString()
    });
  });
  return token;
}

test("Build-consumed catalog data contains only certified items (no not-ready leaks)", async () => {
  const app = await bootApp();
  try {
    const res = await app.inject({ method: "GET", url: "/api/catalog" });
    assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}: ${res.body.slice(0, 200)}`);
    const body = res.json() as { items?: Array<{ id: string; certification?: { status: string } }> };
    assert.ok(body.items, `expected items array, got ${JSON.stringify(body).slice(0, 200)}`);
    assert.ok(body.items.length > 0, "expected at least one certified item");
    for (const item of body.items) {
      assert.equal(item.certification?.status, "certified", `not-ready item ${item.id} leaked into Build data`);
    }
  } finally {
    await app.close();
  }
});

test("non-admin include=all still cannot retrieve not-ready items", async () => {
  const app = await bootApp();
  try {
    const token = await makeUser("user");
    const res = await app.inject({
      method: "GET",
      url: "/api/catalog?include=all",
      headers: { authorization: `Bearer ${token}` }
    });
    const body = res.json() as { items: Array<{ certification?: { status: string } }>; meta?: { viewer: string } };
    assert.equal(body.meta?.viewer, "user-certified-only");
    assert.ok(body.items.every((i) => i.certification?.status === "certified"));
  } finally {
    await app.close();
  }
});

test("admin registry data includes not-ready items with missingRequirements", async () => {
  const app = await bootApp();
  try {
    const token = await makeUser("admin");
    const res = await app.inject({
      method: "GET",
      url: "/api/catalog/certification",
      headers: { authorization: `Bearer ${token}` }
    });
    const body = res.json() as {
      items: Array<{ id: string; certification: { status: string; reasons: string[] } }>;
      meta: { notReady: number };
    };
    assert.ok(body.meta.notReady > 0);
    const notReady = body.items.filter((i) => i.certification.status === "not-ready");
    assert.ok(notReady.length > 0);
    // Every not-ready item carries at least one reason (missing requirement).
    for (const item of notReady.slice(0, 10)) {
      assert.ok(item.certification.reasons.length > 0, `${item.id} not-ready without reasons`);
    }
  } finally {
    await app.close();
  }
});

test("admin capability workflow APIs reject non-admin users", async () => {
  const app = await bootApp();
  try {
    const token = await makeUser("user");
    for (const url of [
      "/api/admin/package-integrations",
      "/api/admin/suggestions",
      "/api/admin/capability-users",
      "/api/admin/capability-queues"
    ]) {
      const res = await app.inject({ method: "GET", url, headers: { authorization: `Bearer ${token}` } });
      assert.equal(res.statusCode, 403, `${url} should reject non-admin users`);
    }
  } finally {
    await app.close();
  }
});

test("admin capability workflow APIs allow admin users", async () => {
  const app = await bootApp();
  try {
    const token = await makeUser("admin");
    for (const url of [
      "/api/admin/package-integrations",
      "/api/admin/suggestions",
      "/api/admin/capability-users",
      "/api/admin/capability-queues"
    ]) {
      const res = await app.inject({ method: "GET", url, headers: { authorization: `Bearer ${token}` } });
      assert.equal(res.statusCode, 200, `${url} should allow admin users`);
    }
  } finally {
    await app.close();
  }
});
