import { expect, test, type APIRequestContext, type Page, type Route } from "@playwright/test";

const API_BASE = "http://127.0.0.1:5174";
const PASSWORD = "AssessmentSmoke123!";

function localeFor(project: string): "zh" | "en" {
  return project.includes("-en-") ? "en" : "zh";
}

async function createUser(request: APIRequestContext, project: string): Promise<string> {
  const email = `assessment-review-${Date.now()}-${project}@example.test`;
  const start = await request.post(`${API_BASE}/api/auth/register/start`, { data: { email, name: "Assessment Review", password: PASSWORD } });
  const pending = await start.json() as { pendingId: string; devCode: string };
  const verify = await request.post(`${API_BASE}/api/auth/register/verify`, { data: { pendingId: pending.pendingId, code: pending.devCode } });
  return (await verify.json() as { token: string }).token;
}

function session(currentStep: "source" | "analysis" = "source") {
  return {
    id: "msess-web-assessment", userId: "web-user", connectionId: "source-assessment", status: "analysis-ready",
    currentStep, recommendedStep: "config-data", recommendedStatus: "config-review-required",
    createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z",
    summary: {
      totalCandidates: 1, autoCandidates: 0, reviewCandidates: 1, manualCandidates: 0, ignoredArtifacts: 0,
      selectedCount: 0, skippedCount: 0, recordOnlyCount: 0, pendingReviewCount: 1, blockerCount: 0,
      configRiskCount: 1, secretOrBlockedConfigCount: 0, dataReviewCount: 1, planItemCount: 0, applyBlockerCount: 2
    }
  };
}

const probe = {
  agentId: "assessment-agent", collectedAt: "2026-07-01T00:01:00.000Z",
  collection: { status: "ok", completeness: 1, commands: [], errors: [], timedOut: false },
  collectors: {
    "docker-images": { id: "docker-images", status: "ok", completeness: 1, commands: [{ command: "docker images", exitCode: 0 }], errors: [], collectedAt: "2026-07-01T00:01:00.000Z", data: [] }
  },
  system: { hostname: "legacy-db", platform: "linux", arch: "x86_64", release: "6.8", uptime: 100, osPretty: "Ubuntu 24.04", cpu: { model: "fixture", cores: 2, speedMhz: 2000 }, memory: { totalBytes: 1024, freeBytes: 512, usedBytes: 512, totalGb: "1", freeGb: "0.5" } },
  software: [{ name: "postgresql", version: "16", source: "systemd", status: "running", trust: "user" }],
  configChecklist: [{ id: "open-ports", label: "Open ports: 5432", category: "network", status: "healthy", lastChanged: "2026-07-01" }],
  counts: { apt: 0, rpm: 0, snap: 0, flatpak: 0, npm: 0, pip: 0, gem: 0, cargo: 0, localBin: 0, opt: 0, userBin: 0, nvm: 0, pyenv: 0, docker: 0, enabledServices: 0, runningServices: 1, total: 1 }
};

const requiredDecision = {
  id: "decision:catalog:postgresql:data-strategy", title: "PostgreSQL data migration strategy",
  reason: "This service contains stateful data and cannot be safely migrated by config copy alone.",
  relatedServiceStackIds: ["stack:catalog:postgresql"], defaultSafeChoice: "Record only until backup freshness is confirmed.",
  options: [
    { id: "logical", label: "Use pg_dump/pg_restore", risk: "Recommended logical migration" },
    { id: "physical", label: "Use physical base backup", risk: "Requires consistency review" },
    { id: "record-only", label: "Record only, do not migrate", risk: "Safe default" },
    { id: "manual", label: "Mark as manual", risk: "Human follow-up" }
  ]
};

const assessment = {
  id: "assessment:msess-web-assessment:2026-07-01", sessionId: "msess-web-assessment", availability: "ready", generatedAt: "2026-07-01T00:02:00.000Z",
  source: { host: "legacy-db.example", os: "Ubuntu 24.04", architecture: "x86_64" },
  snapshot: { capturedAt: "2026-07-01T00:01:00.000Z", completeness: { status: "ok", score: 1, failedCollectorCount: 0, partialCollectorCount: 0, timedOut: false } },
  serviceStacks: [{
    id: "stack:catalog:postgresql", name: "PostgreSQL Database", category: "database",
    summary: "PostgreSQL was identified from service, port, config, and data evidence.",
    evidence: [
      { id: "service", kind: "service", source: "systemd", label: "postgresql.service is active" },
      { id: "port", kind: "port", source: "network", label: "port 5432 is listening" },
      { id: "data", kind: "data-path", source: "snapshot", label: "/var/lib/postgresql exists" },
      { id: "config", kind: "config", source: "snapshot", label: "pg_hba.conf and postgresql.conf found" }
    ],
    evidenceCount: 4, confidence: "high", confidenceReason: "Four independent evidence references support this classification.",
    risk: "high", riskReasons: ["Direct file copy may corrupt data if PostgreSQL is running.", "Version mismatch may break restore.", "Data volume size is unknown.", "Backup freshness is unknown."],
    statefulness: "stateful", migrationReadiness: "requires-decision", requiredDecisions: [requiredDecision],
    recommendedStrategy: "Use pg_dump/pg_restore for logical migration.", relationships: [], capabilityRefs: ["postgresql", "database.postgresql"]
  }],
  riskSummary: { overall: "high", low: 0, medium: 0, high: 1, unknown: 0, reasons: ["Stateful database"] },
  readiness: { status: "apply-requires-decisions", summary: "One migration decision must be resolved before a trusted Plan can be prepared.", blockers: [], warnings: ["PostgreSQL data migration strategy"], nextActions: ["Review the required decision.", "Export the Assessment Report."] },
  requiredDecisions: [requiredDecision],
  evidenceQuality: { overallStatus: "ok", completeness: 1, collectors: [{ name: "docker-images", status: "ok", completeness: 1 }], notes: ["Collector evidence completed successfully."] },
  unsupportedOrManualItems: [], report: { jsonAvailable: true, markdownAvailable: true }, metadata: { envForgeVersion: "0.1.0" },
  redactionNote: "Sensitive values are redacted by default."
};

function inbox(status: "open" | "accepted" = "open") {
  return [{
    id: "inbox-postgresql", candidateId: "catalog:postgresql", snapshotId: "source-assessment:2026-07-01T00:01:00.000Z",
    title: "PostgreSQL", reason: requiredDecision.reason, outcome: "required-decision", status,
    scores: { intentConfidence: .95, evidenceStrength: .95, migrationReadiness: .5, riskScore: .8, automationConfidence: .3, businessCriticality: .8, reviewCost: .6, userPreferenceConfidence: .5, collectorCompleteness: 1 },
    requiredGates: ["data-strategy-confirm"], createdAt: "2026-07-01T00:02:00.000Z", updatedAt: "2026-07-01T00:02:00.000Z"
  }];
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

test("first-run Assessment and Review Inbox expose value without approval or apply", async ({ page, request }, testInfo) => {
  const locale = localeFor(testInfo.project.name);
  await page.addInitScript((language) => localStorage.setItem("envforge_locale", language), locale);
  const token = await createUser(request, testInfo.project.name);
  let currentStep: "source" | "analysis" = "source";
  let inboxStatus: "open" | "accepted" = "open";
  let inboxPatchAttempts = 0;
  const mutations: string[] = [];

  await page.route("**/api/connections", (route) => json(route, { connections: [{
    id: "source-assessment", userId: "web-user", method: "ssh-key", label: "Legacy database", status: "probed",
    fields: { host: "legacy-db.example", port: "22", username: "root" }, maskedSecrets: [], realConnection: false,
    probeSnapshot: probe, createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z"
  }] }));
  await page.route("**/api/migration/sessions", async (route) => {
    if (route.request().method() === "POST") return json(route, { session: session(currentStep) });
    return route.continue();
  });
  await page.route("**/api/migration/sessions/msess-web-assessment", async (route) => {
    if (route.request().method() === "PATCH") {
      const payload = route.request().postDataJSON() as { currentStep?: "source" | "analysis" };
      currentStep = payload.currentStep ?? currentStep;
      return json(route, { session: session(currentStep) });
    }
    return json(route, { session: session(currentStep) });
  });
  await page.route("**/api/migration/sessions/msess-web-assessment/analysis", (route) => json(route, {
    session: session(currentStep), report: { sourceHost: "legacy-db", generatedAt: "2026-07-01", summary: { high: 1, medium: 0, low: 0, ignore: 0, total: 1 }, normalizedArtifacts: [], configBundles: [], candidates: [] }, reviewQueue: [], decisions: []
  }));
  await page.route("**/api/migration/sessions/msess-web-assessment/assessment", (route) => json(route, { assessment }));
  await page.route("**/api/migration/sessions/msess-web-assessment/assessment/report?format=markdown", (route) => route.fulfill({ status: 200, contentType: "text/markdown", body: "# Read-only Assessment\nNo apply run was created." }));
  await page.route("**/api/decision-engine/review-inbox?*", (route) => json(route, { items: inbox(inboxStatus) }));
  await page.route("**/api/decision-engine/history?*", (route) => json(route, { history: [{ id: "history-1", subjectId: "catalog:postgresql", subjectType: "migration-candidate", outcome: "required-decision", scores: inbox()[0].scores, reasons: [requiredDecision.reason], requiredGates: ["data-strategy-confirm"], profileId: "balanced", createdAt: "2026-07-01T00:02:00.000Z" }] }));
  await page.route("**/api/migration/sessions/msess-web-assessment/data-decisions", async (route) => { mutations.push(route.request().url()); return json(route, { session: session("analysis"), configDecisions: [], dataDecisions: [] }); });
  await page.route("**/api/decision-engine/review-inbox/inbox-postgresql", async (route) => {
    mutations.push(route.request().url());
    inboxPatchAttempts += 1;
    if (inboxPatchAttempts === 1) return json(route, { error: "Inbox write failed" }, 500);
    inboxStatus = "accepted";
    return json(route, { item: { ...inbox("accepted")[0], resolutionNote: "accepted" }, preference: { id: "pref-1", scope: "connection", scopeId: "source-assessment", pattern: "postgresql database", preferredOutcome: "suggested-decision", confidence: .7, observations: 1, createdAt: "2026-07-01", updatedAt: "2026-07-01" } });
  });

  page.on("request", (req) => { if (req.method() !== "GET") mutations.push(req.url()); });
  await page.goto(`/#token=${encodeURIComponent(token)}`);
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await page.goto("/app/migrate");

  const landing = page.getByTestId("assessment-landing");
  await expect(landing).toBeVisible();
  const assessButton = landing.getByRole("button", { name: locale === "zh" ? "评估服务器" : "Assess a server" });
  await expect(assessButton).toHaveClass(/primary-action/);
  await expect(landing.getByRole("button", { name: locale === "zh" ? "应用已批准计划" : "Apply an approved plan" })).toBeDisabled();
  await expect(landing).toContainText(locale === "zh" ? "私钥" : "Private keys");
  await expect(landing).toContainText(locale === "zh" ? "数据库表内容" : "Database table contents");

  await landing.getByRole("button", { name: locale === "zh" ? "生成迁移计划" : "Generate a migration plan" }).click();
  await expect(page.getByTestId("assessment-experience")).toBeVisible();
  await expect(page.getByTestId("service-stack-database")).toContainText("PostgreSQL Database");
  await expect(page.getByTestId("service-stack-database")).toContainText("pg_dump/pg_restore");
  await expect(page.getByTestId("docker-evidence-status")).toContainText(locale === "zh" ? "未识别到 Docker" : "no Docker service stack");
  await expect(page.getByTestId("review-inbox-panel")).toContainText("PostgreSQL data migration strategy");
  await expect(page.getByTestId("review-item-required-decision")).toContainText("Record only until backup freshness is confirmed.");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: locale === "zh" ? "下载 Markdown" : "Download Markdown" }).click();
  expect((await download).suggestedFilename()).toMatch(/envforge-assessment.*\.md$/);

  await page.getByLabel(locale === "zh" ? "记住此建议偏好" : "Remember this advisory preference").check();
  await page.getByRole("button", { name: locale === "zh" ? "接受推荐" : "Accept recommendation" }).click();
  await expect(page.getByTestId("review-item-required-decision")).toContainText(locale === "zh" ? "Inbox 状态更新失败" : "Inbox status update failed");
  expect(mutations.some((url) => /\/api\/plans\/[^/]+\/(review|apply)/.test(url))).toBeFalsy();
  await page.getByRole("button", { name: locale === "zh" ? "接受推荐" : "Accept recommendation" }).click();
  await expect(page.getByTestId("review-item-required-decision")).toContainText(locale === "zh" ? "已接受" : "Accepted");
  expect(mutations.some((url) => url.includes("/data-decisions"))).toBeTruthy();
  expect(mutations.some((url) => url.includes("/decision-engine/review-inbox/"))).toBeTruthy();
  expect(mutations.some((url) => /\/api\/plans\/[^/]+\/(review|apply)/.test(url))).toBeFalsy();
});
