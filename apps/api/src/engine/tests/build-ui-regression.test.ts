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
const migratePipelinePath = path.resolve(repoRoot, "apps/web/src/pages/MigratePipelinePage.tsx");
const assessmentExperiencePath = path.resolve(repoRoot, "apps/web/src/components/AssessmentExperience.tsx");
const webApiPath = path.resolve(repoRoot, "apps/web/src/api.ts");
const stepperPath = path.resolve(repoRoot, "apps/web/src/components/WorkflowStepper.tsx");
const settingsPath = path.resolve(repoRoot, "apps/web/src/pages/SettingsPage.tsx");
const apiRoutesPath = path.resolve(repoRoot, "apps/api/src/routes.ts");
const enLocalePath = path.resolve(repoRoot, "apps/web/src/i18n/locales/en.ts");
const zhLocalePath = path.resolve(repoRoot, "apps/web/src/i18n/locales/zh.ts");

function fileURLToPathSafe(url: string): string {
  // Local helper to avoid importing node:url at top-level twice.
  return new URL(url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
}

// The Capability Admin workbench was split into per-tab components under
// pages/governance/*.tsx; CapabilityRulesAdminPage.tsx now only composes
// them. Admin-content scans therefore read the composer + every tab.
const governanceDir = path.resolve(repoRoot, "apps/web/src/pages/governance");
async function readAdminWorkbenchSource(): Promise<string> {
  const entries = await fs.readdir(governanceDir);
  const tabs = await Promise.all(
    entries.filter((f) => f.endsWith(".tsx")).map((f) => fs.readFile(path.join(governanceDir, f), "utf8"))
  );
  const composer = await fs.readFile(adminPagePath, "utf8");
  return [composer, ...tabs].join("\n");
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
  const en = await fs.readFile(enLocalePath, "utf8");
  assert.match(src, /certification-badge/, "Build page must render the certification badge");
  assert.match(src, /capabilityCatalog\.certified/, "Build page must render the localized Certified label");
  assert.match(en, /certified:\s*"Certified"/);
  assert.match(src, /certification\?\.status/, "Build badge must derive from item.certification.status, not supportLevel");
});

test("Build page source shows the certified-only empty-state copy", async () => {
  const src = await fs.readFile(buildPagePath, "utf8");
  const en = await fs.readFile(enLocalePath, "utf8");
  // The empty-state copy required by the design (zh + en).
  assert.match(src, /capabilityCatalog\.certifiedOnly/);
  assert.ok(
    src.includes("当前仅展示已认证能力。更多能力正在管理员规则库中完善。") ||
      en.includes("being upgraded in the admin Capability Rules registry"),
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
  assert.match(src, /migratePipeline\.selection\.title/, "Selection step must use the capability-level localized title");
  assert.match(src, /candidate\.catalogRuleName \?\? candidate\.name/, "Cards must name the capability when a catalog rule exists");
  assert.match(src, /candidateIds/, "Bulk decisions must submit candidateIds");
  assert.match(src, /selectedGroup && selectedGroup !== group/, "Bulk selection must stay within one candidate group");
  assert.match(src, /EvidenceDrawer/, "Raw evidence must live behind an evidence drawer");
  assert.match(src, /candidate\.rawEvidence/, "Evidence drawer must expose raw evidence");
  assert.match(src, /candidate\.normalizedArtifacts/, "Evidence drawer must expose normalized artifacts");
});

test("Migrate source snapshot exposes collector quality and partial evidence gates", async () => {
  const src = await fs.readFile(migratePipelinePath, "utf8");
  const api = await fs.readFile(webApiPath, "utf8");
  for (const evidenceField of ["collection", "collectors", "completeness", "commands", "stderr", "timedOut"]) {
    assert.match(api, new RegExp(`\\b${evidenceField}\\b`), `Web snapshot type must expose ${evidenceField}`);
  }
  assert.match(src, /probe\?\.collection/, "Migrate source must render overall collector status");
  assert.match(src, /probe\?\.collectors/, "Migrate source must render per-section command evidence");
  assert.match(src, /partial-snapshot-confirm/, "Incomplete source evidence must show its required approval gate");
  assert.match(src, /section\.commands/, "Failed and timed-out collector commands must remain inspectable");
  assert.match(src, /section\.stderr/, "Collector stderr summary must remain inspectable");
});

test("Migrate first-run Assessment is primary and consumes the backend view model", async () => {
  const page = await fs.readFile(migratePipelinePath, "utf8");
  const component = await fs.readFile(assessmentExperiencePath, "utf8");
  const api = await fs.readFile(webApiPath, "utf8");
  assert.match(page, /AssessmentLandingPanel/, "Migrate must expose the read-only first-run landing");
  assert.match(page, /AssessmentExperience/, "Analysis must render the Assessment product view");
  assert.match(component, /variant="primary"[\s\S]*migratePipeline\.assessment\.assessServer/, "Assess a server must be the primary CTA");
  assert.match(component, /disabled[\s\S]*applyApprovedPlan/, "Apply must not be an active first-run CTA");
  assert.match(component, /whatReads/);
  assert.match(component, /whatDoesNotRead/);
  assert.match(api, /getMigrationSessionAssessment/);
  assert.match(api, /\/assessment\/report\?format=/, "Report export must call the backend report route");
  assert.doesNotMatch(component, /buildMigrationCandidateReport|riskScoreForLevel|classifyDecision/, "Web must not recompute Assessment decisions");
});

test("Assessment service stacks and collector states remain explainable", async () => {
  const component = await fs.readFile(assessmentExperiencePath, "utf8");
  for (const field of ["confidenceReason", "riskReasons", "evidenceCount", "statefulness", "migrationReadiness", "requiredDecisions", "recommendedStrategy", "relationships", "capabilityRefs"]) {
    assert.match(component, new RegExp(`stack\\.${field}`), `Service Stack cards must display ${field}`);
  }
  assert.match(component, /dockerCollector\.status === "ok" && !dockerStackFound/, "Docker absence requires a successful collector and no Docker stack");
  assert.match(component, /dockerCollector\.status === "failed"/, "Docker collector failure must stay distinct from absence");
  for (const field of ["failedCommands", "timedOutCommands", "stderrSummary", "errors"]) {
    assert.match(component, new RegExp(`collector\\.${field}`), `Collector UI must expose ${field}`);
  }
});

test("Review Inbox actions affect session decisions without approving or applying a Plan", async () => {
  const page = await fs.readFile(migratePipelinePath, "utf8");
  const component = await fs.readFile(assessmentExperiencePath, "utf8");
  const api = await fs.readFile(webApiPath, "utf8");
  assert.match(page, /saveMigrationSessionDataDecision/, "Database recommendations must persist a session data strategy");
  assert.match(page, /decision:\s*"record-only"/, "Record-only action must persist its real migration decision");
  assert.match(page, /decision:\s*"needs-manual-instruction"/, "Mark manual must persist its real migration decision");
  assert.match(page, /input\.action === "defer"[\s\S]*status:\s*"deferred"/, "Defer must keep an explicit non-final Inbox state");
  assert.match(page, /resolveReviewInboxItem/, "Review status must use the Decision Engine API");
  assert.match(page, /item\.snapshotId === snapshotId/, "Review items must be bound to the exact Assessment snapshot");
  assert.doesNotMatch(page, /!item\.snapshotId/, "Review items without snapshot identity must fail closed");
  assert.match(page, /allowedOptions\.has\(selectedOption\)/, "Unknown decision options must fail closed");
  assert.match(page, /getDecisionHistory[\s\S]*?\.catch\(\(\) => \[\]\)/, "Unavailable history must not hide the Review Inbox");
  assert.match(component, /Review completion does not approve|securityBoundary/, "Review UI must state its safety boundary");
  assert.match(component, /defaultSafeChoice/);
  assert.match(component, /impactUnresolved/);
  assert.match(component, /rememberBoundary/);
  assert.match(api, /\/api\/decision-engine\/review-inbox/);
  assert.match(api, /\/api\/decision-engine\/history/);
  const handler = page.match(/async function handleReviewDecision[\s\S]*?\n  }\n\n  async function exportAssessmentReport/);
  assert.ok(handler, "Review action handler must remain explicit and inspectable");
  assert.doesNotMatch(handler[0], /approveEnvironmentPlan|applyEnvironmentPlan|\/apply/, "Review actions must never approve or apply a Plan");
  assert.match(page, /actionErrorItemId=\{reviewActionErrorItemId\}/, "Decision action failure must remain bound to the failed Inbox item");
  assert.match(component, /actionErrorItemId === item\.id \? actionError/, "Failed action text must remain visible after the busy state clears");
  assert.match(component, /assessmentError \|\| !assessment/, "Assessment unavailable state must not render a false success");
  assert.match(component, /!items\.length[\s\S]*emptyTitle/, "Review Inbox must render an explicit empty state");
  assert.match(component, /item\.status === "open" \|\| item\.status === "deferred"/, "Deferred decisions must remain counted as unresolved");
});

test("Assessment and Review Inbox copy is localized in English and Chinese", async () => {
  const [en, zh] = await Promise.all([fs.readFile(enLocalePath, "utf8"), fs.readFile(zhLocalePath, "utf8")]);
  for (const source of [en, zh]) {
    assert.match(source, /assessment:\s*\{/);
    assert.match(source, /reviewInbox:\s*\{/);
    for (const key of ["readOnlyBadge", "whatReads", "whatDoesNotRead", "serviceStacks", "evidenceQuality", "readinessTitle", "downloadMarkdown", "defaultSafeChoice", "impactUnresolved", "rememberBoundary"]) {
      assert.match(source, new RegExp(`\\b${key}:`), `locale must define ${key}`);
    }
  }
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

test("Migrate pipeline hands apply off to immutable Environment Plan flow", async () => {
  const src = await fs.readFile(migratePipelinePath, "utf8");
  const api = await fs.readFile(webApiPath, "utf8");
  for (const token of [
    "fetchMigrationSessionApplyReadiness",
    "verifyMigrationSession",
    "fetchMigrationSessionReport"
  ]) {
    assert.match(src, new RegExp(token), `Migrate pipeline must use ${token}`);
    assert.match(api, new RegExp(token), `Web API must export ${token}`);
  }
  assert.match(src, /createPlanFromMigrationSession/, "Migrate must create a stored Environment Plan before apply");
  assert.match(src, /onPlanCreated\?\.\(plan\.id\)/, "Migrate must hand the stored Plan id to the Plan center");
  assert.doesNotMatch(src, /applyMigrationSession/, "Migrate UI must not directly apply a migration session");
  assert.doesNotMatch(api, /export async function applyMigrationSession/, "Web API must not expose the legacy direct apply helper");
  assert.match(src, /RunSummaryCard/, "Apply/verify/report results must be summarized in the UI");
  assert.match(src, /rollback/i, "Rollback visibility must remain part of the apply/report UI");
  assert.match(api, /apply-readiness/, "Web API must expose session apply readiness endpoint");
  assert.match(api, /kind:\s*"migration-session"/, "Web API must promote sessions through POST /api/plans");
  assert.match(api, /\/verify/, "Web API must expose session verify endpoint");
  assert.match(api, /\/report/, "Web API must expose session report endpoint");
});

test("Web apply helper sends only the immutable Plan apply allowlist", async () => {
  const api = await fs.readFile(webApiPath, "utf8");
  const match = api.match(/export async function applyEnvironmentPlan[\s\S]*?return readJsonOrThrow\(response, "Apply Environment Plan failed"\);/);
  assert.ok(match, "applyEnvironmentPlan helper must exist");
  const helper = match[0]!;
  const payloadMatch = helper.match(/Object\.entries\(\{[\s\S]*?\}\)\.filter/);
  assert.ok(payloadMatch, "apply helper must construct an explicit payload object");
  const payloadBlock = payloadMatch[0]!;
  for (const allowed of ["dryRun", "targetConnectionId", "idempotencyKey"]) {
    assert.match(payloadBlock, new RegExp(`\\b${allowed}\\s*:`), `apply helper must allow ${allowed}`);
  }
  assert.match(helper, /JSON\.stringify\(payload\)/, "apply helper must serialize the allowlisted payload object");
  for (const forbidden of ["plan", "path", "content", "yaml", "actions", "export", "acknowledged", "gateAcknowledgements"]) {
    assert.doesNotMatch(payloadBlock, new RegExp(`\\b${forbidden}\\s*:`), `apply helper must not send ${forbidden}`);
    assert.doesNotMatch(payloadBlock, new RegExp(`["']${forbidden}["']\\s*:`), `apply helper must not send ${forbidden}`);
  }
});

test("Web verification report helper explicitly requests the Markdown representation", async () => {
  const api = await fs.readFile(webApiPath, "utf8");
  const match = api.match(/export async function fetchEnvironmentPlanReport[\s\S]*?return body\.report;/);
  assert.ok(match, "fetchEnvironmentPlanReport helper must exist");
  assert.match(match[0], /\/report\?format=markdown/);
});

test("legacy mutation route handlers fail closed in their own bodies", async () => {
  const routes = await fs.readFile(apiRoutesPath, "utf8");
  const handlers = [
    { method: "post", path: "/api/rebuild-plan/apply" },
    { method: "post", path: "/api/connections/:id/apply-remove-plan" },
    { method: "post", path: "/api/connections/:id/configs/apply-change-plan" },
    { method: "post", path: "/api/connections/:id/configs/rollback" },
    { method: "post", path: "/api/profiles/:id/deploy-stage" },
    { method: "post", path: "/api/migration/sessions/:sessionId/apply" },
    { method: "post", path: "/api/connections/:id/migration-plan/apply" },
    { method: "post", path: "/api/schedules" },
    { method: "patch", path: "/api/schedules/:id" }
  ];
  for (const handler of handlers) {
    const escapedPath = handler.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = routes.match(new RegExp(`app\\.${handler.method}\\("${escapedPath}"[\\s\\S]*?\\n  \\}\\);`));
    assert.ok(match, `routes.ts missing ${handler.method.toUpperCase()} ${handler.path}`);
    const body = match[0]!;
    assert.match(body, /legacyMutationGone\(reply\)|reply\.code\(410\)/, `${handler.path} must return 410 in the handler body`);
    for (const forbidden of ["executePlaybook", "writeConfigFile", "restoreConfigFileFromBackup", "runMigrationApplyPlan", "executeTask", "buildSnapshotDeployTask"]) {
      assert.doesNotMatch(body, new RegExp(`\\b${forbidden}\\b`), `${handler.path} must not retain ${forbidden}`);
    }
  }
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
  const src = await readAdminWorkbenchSource();
  const en = await fs.readFile(enLocalePath, "utf8");
  assert.match(src, /Not Ready|not-ready/);
  assert.match(src, /reasons/, "admin page must render certification reasons (missing requirements)");
  assert.match(src, /governance\.registry\.checklistTitle/, "admin page must render the localized checklist title");
  assert.match(en, /checklistTitle:\s*"Full Migration Checklist"/);
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
  const en = await fs.readFile(enLocalePath, "utf8");
  assert.match(nav, /id: "catalog"[\s\S]*adminOnly: true/, "Catalog route must be admin-only");
  assert.match(en, /catalog:\s*"Capability Admin"/);
});

test("non-admin catalog route redirects to Build", async () => {
  const main = await fs.readFile(mainPagePath, "utf8");
  assert.match(main, /page === "catalog" && authUser\?\.role !== "admin"/);
  assert.match(main, /setPage\("build"\)/);
});

test("Build page keeps only category filters and no market controls", async () => {
  const src = await fs.readFile(buildPagePath, "utf8");
  for (const key of ["all", "runtime", "database", "security", "network", "container", "developer", "service"]) {
    assert.ok(src.includes(`capabilityCatalog.categories.${key}`), `Build category filter ${key} should remain`);
  }
  for (const forbidden of ["market-switch", "CatalogSuggestionCenter", "Rating ", "Profiles", "Suggest"]) {
    assert.ok(!src.includes(forbidden), `Build must not render ${forbidden}`);
  }
});

test("Build stepper no longer says Capability Catalog or detect-only", async () => {
  const stepper = await fs.readFile(stepperPath, "utf8");
  assert.ok(!stepper.includes("Capability Catalog"));
  assert.ok(!stepper.includes("detect-only"));
  assert.match(stepper, /workflow\.build\.catalog/);
});

test("Dashboard keeps the resource console layout", async () => {
  const src = await fs.readFile(dashboardPagePath, "utf8");
  for (const key of ["dashboard.header.eyebrow", "dashboard.pipeline.title", "dashboard.panels.runtimeQueue", "dashboard.panels.recentPlans", "dashboard.panels.workspaceContext", "dashboard.panels.snapshotsReports"]) {
    assert.ok(src.includes(key), `Dashboard missing localized key ${key}`);
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
  const src = await readAdminWorkbenchSource();
  const en = await fs.readFile(enLocalePath, "utf8");
  assert.ok(!/<button[^>]*>\s*Install\s*<\/button>/i.test(src));
  assert.ok(!/<button[^>]*>\s*Uninstall\s*<\/button>/i.test(src));
  assert.match(src, /governance\.integrations\.intro/);
  assert.match(en, /NOT a host-level package manager/);
});

test("Suggestion Inbox and Users & Queues render workflow assignment language", async () => {
  const src = await readAdminWorkbenchSource();
  const en = await fs.readFile(enLocalePath, "utf8");
  assert.match(src, /SuggestionStatusBadge/);
  assert.match(src, /governance\.usersQueues\.usersTitle/);
  assert.match(en, /usersTitle:\s*"Users \/ Maintainers"/);
  assert.match(en, /reviewer|maintainer/);
  assert.match(en, /Assigned Capabilities|Open Backlog Items|Queue/);
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
