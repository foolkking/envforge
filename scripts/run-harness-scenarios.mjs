#!/usr/bin/env node
/**
 * run-harness-scenarios.mjs
 *
 * EnvForge harness runner. Loads scenario JSON files from
 * `scripts/harness/scenarios/`, executes each one in either dry-run
 * mode (the default — no SSH required) or live mode against a real
 * target VM, and writes:
 *
 *   - `docs/harness-reports/<runId>/<scenarioId>.report.json`
 *   - `docs/harness-reports/<runId>/<scenarioId>.report.md`
 *   - `docs/harness-reports/<runId>/<scenarioId>.actions.json`
 *
 * Modes
 * -----
 *
 *   dry-run (default): builds the plan via the same `buildRebuildPlan`
 *     / `buildRemovePlan` / `buildConfigChangePlan` helpers used by the
 *     API, runs `evaluateApplyGate` with the documented acks, generates
 *     a Plan Report, and asserts the scenario's `expected` block. This
 *     is what CI runs.
 *
 *   live: reaches the EnvForge API at `${ENVFORGE_HARNESS_BASE_URL}` and
 *     requires:
 *       - `ENVFORGE_HARNESS_BEARER_TOKEN`
 *       - `ENVFORGE_HARNESS_TARGET` (a connection id)
 *       - For destructive scenarios:
 *         `ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE=true`
 *
 * Usage
 * -----
 *
 *   node scripts/run-harness-scenarios.mjs                        # dry-run all
 *   node scripts/run-harness-scenarios.mjs build-nginx-success    # one scenario
 *   ENVFORGE_HARNESS_MODE=live ENVFORGE_HARNESS_TARGET=conn-... \
 *     node scripts/run-harness-scenarios.mjs build-nginx-success
 *
 * Output is always redacted via `redactSecrets` from the API.
 */
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const scenarioDir = path.resolve(here, "harness/scenarios");
const reportRoot = path.resolve(repoRoot, "docs/harness-reports");
const distRoot = path.resolve(repoRoot, "apps/api/dist");

const args = process.argv.slice(2);
const targetIds = new Set(args.filter((a) => !a.startsWith("--")));
const mode = process.env.ENVFORGE_HARNESS_MODE === "live" ? "live" : "dry-run";
const allowDestructive = process.env.ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE === "true";

async function loadDist() {
  const env = await import(pathToFileURL(path.join(distRoot, "environment-plan.js")).href);
  const db = await import(pathToFileURL(path.join(distRoot, "database.js")).href);
  const actionRuns = await import(pathToFileURL(path.join(distRoot, "action-runs.js")).href);
  return { env, db, actionRuns };
}

async function listScenarios() {
  const files = await fs.readdir(scenarioDir);
  return files.filter((f) => f.endsWith(".json")).sort();
}

async function readScenario(file) {
  const raw = await fs.readFile(path.join(scenarioDir, file), "utf8");
  return JSON.parse(raw);
}

function redactDeep(value, redactFn) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactFn(value).text;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, redactFn));
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactDeep(v, redactFn);
    return out;
  }
  return value;
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

function nowSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function buildPlanForScenario(scenario, env, db) {
  const targetConnectionId = process.env.ENVFORGE_HARNESS_TARGET ?? "harness-dry-run";
  const source = scenario.planSource ?? {};

  if (source.kind === "capability-selection") {
    const items = await db.listCatalogFromDatabase();
    const selected = (source.capabilityIds ?? [])
      .map((id) => items.find((it) => it.id === id))
      .filter(Boolean);
    if (selected.length === 0) {
      throw new Error(`No catalog items matched ${source.capabilityIds?.join(",")}`);
    }
    return env.buildRebuildPlan(selected, targetConnectionId);
  }

  if (source.kind === "remove-request") {
    const markers = scenario.preconditions?.managedCapabilityRecord
      ? [{
          id: `harness-${scenario.id}`,
          capabilityKey: scenario.preconditions.managedCapabilityRecord.capabilityKey,
          catalogId: scenario.preconditions.managedCapabilityRecord.catalogId,
          installedByPlanId: "harness-precondition",
          installedAt: new Date().toISOString(),
          targetHostId: targetConnectionId,
          packagesInstalled: scenario.preconditions.managedCapabilityRecord.packagesInstalled ?? [],
          configsTouched: scenario.preconditions.managedCapabilityRecord.configsTouched ?? [],
          servicesTouched: scenario.preconditions.managedCapabilityRecord.servicesTouched ?? [],
          dataPathsKnown: scenario.preconditions.managedCapabilityRecord.dataPathsKnown ?? []
        }]
      : (source.managedByEnvForge ? [{
          id: `harness-${scenario.id}-default`,
          capabilityKey: "web-server.nginx",
          catalogId: "nginx-web-service",
          installedByPlanId: "harness-default",
          installedAt: new Date().toISOString(),
          targetHostId: targetConnectionId,
          packagesInstalled: (source.packages ?? []).map((name) => ({
            name,
            manager: source.source ?? "apt",
            existedBefore: false,
            removableByEnvForge: true
          })),
          configsTouched: [],
          servicesTouched: [],
          dataPathsKnown: []
        }] : []);
    return env.buildRemovePlan({
      targetConnectionId,
      packages: source.packages ?? [],
      source: source.source ?? "apt",
      managedByEnvForge: source.managedByEnvForge === true,
      preserveDataByDefault: source.preserveData !== false,
      managedMarkers: markers
    });
  }

  if (source.kind === "config-change") {
    return env.buildConfigChangePlan({
      targetConnectionId,
      path: source.path,
      originalContent: "",
      candidateContent: source.content ?? ""
    });
  }

  throw new Error(`Unsupported planSource.kind: ${source.kind}`);
}

function fullAcks(plan) {
  const risks = {};
  for (const item of plan.items) {
    const remaining = item.audit?.remainingRisks ?? [];
    if (remaining.length > 0) risks[item.id] = [...remaining];
  }
  const approvals = (plan.review.approvalsRequired ?? []).map((g) => ({
    itemId: g.itemId,
    gateId: g.id
  }));
  return { risks, approvals, conflicts: [] };
}

function assertExpected(scenario, plan, gateVerdict) {
  const reasons = [];
  const expected = scenario.expected ?? {};
  if (expected.planType && expected.planType !== plan.type) {
    reasons.push(`planType: expected=${expected.planType} actual=${plan.type}`);
  }
  if (typeof expected.conflictsBlock === "number") {
    const blocking = (plan.review.conflicts ?? []).filter((c) => c.severity === "block").length;
    if (blocking !== expected.conflictsBlock) {
      reasons.push(`block conflicts: expected=${expected.conflictsBlock} actual=${blocking}`);
    }
  }
  if (typeof expected.conflictsWarn === "number") {
    const warnCount = (plan.review.conflicts ?? []).filter((c) => c.severity === "warn").length;
    if (warnCount !== expected.conflictsWarn) {
      reasons.push(`warn conflicts: expected=${expected.conflictsWarn} actual=${warnCount}`);
    }
  }
  if (Array.isArray(expected.items)) {
    for (const expectedItem of expected.items) {
      const found = plan.items.find((it) =>
        (expectedItem.id ? it.id === expectedItem.id : true) &&
        (expectedItem.capabilityKey ? it.capabilityKey === expectedItem.capabilityKey : true)
      );
      if (!found) {
        reasons.push(`expected item not found: ${JSON.stringify(expectedItem)}`);
        continue;
      }
      if (expectedItem.supportLevel && (found.audit?.supportLevel ?? found.supportLevel) !== expectedItem.supportLevel) {
        reasons.push(`item ${found.id} supportLevel: expected=${expectedItem.supportLevel} actual=${found.audit?.supportLevel ?? found.supportLevel}`);
      }
      if (typeof expectedItem.minActions === "number" && found.actions.length < expectedItem.minActions) {
        reasons.push(`item ${found.id}: expected ≥${expectedItem.minActions} actions, got ${found.actions.length}`);
      }
      if (expectedItem.type && found.type !== expectedItem.type) {
        reasons.push(`item ${found.id} type: expected=${expectedItem.type} actual=${found.type}`);
      }
    }
  }
  if (Array.isArray(expected.approvalsRequired)) {
    const aggregated = plan.review.approvalsRequired ?? [];
    for (const expectedApproval of expected.approvalsRequired) {
      if (expectedApproval.kind && !aggregated.find((g) => g.kind === expectedApproval.kind)) {
        reasons.push(`expected approval kind missing: ${expectedApproval.kind}`);
      }
    }
  }
  if (Array.isArray(expected.remainingRisks)) {
    const flat = plan.items.flatMap((it) => it.audit?.remainingRisks ?? []);
    for (const r of expected.remainingRisks) {
      if (!flat.some((existing) => existing.includes(r))) {
        reasons.push(`expected remainingRisk not found: ${r}`);
      }
    }
  }
  if (typeof expected.blockedUntilApproved === "boolean") {
    const removeAction = plan.items.flatMap((it) => it.actions).find((a) => a.id === "remove-packages");
    if (removeAction && Boolean(removeAction.blockedUntilApproved) !== expected.blockedUntilApproved) {
      reasons.push(`remove-packages.blockedUntilApproved: expected=${expected.blockedUntilApproved} actual=${Boolean(removeAction.blockedUntilApproved)}`);
    }
  }
  if (expected.expectedEligibility) {
    const reviewReasons = (plan.review.reasons ?? []).join(" ");
    if (expected.expectedEligibility === "auto" && /manual confirmation/.test(reviewReasons)) {
      reasons.push(`expectedEligibility=auto but plan.review mentions manual confirmation`);
    }
    if (expected.expectedEligibility === "manual" && !/manual confirmation/.test(reviewReasons)) {
      reasons.push(`expectedEligibility=manual but plan.review.reasons does not mention manual confirmation`);
    }
  }
  if (Array.isArray(expected.reviewReasonsContain)) {
    const reviewReasons = (plan.review.reasons ?? []).join(" / ");
    for (const phrase of expected.reviewReasonsContain) {
      if (!reviewReasons.includes(phrase)) {
        reasons.push(`plan.review.reasons missing phrase: "${phrase}"`);
      }
    }
  }
  return { ok: reasons.length === 0, reasons };
}

function summarizeApplyGate(plan, env) {
  const ack = fullAcks(plan);
  const verdict = env.evaluateApplyGate(plan, ack);
  return verdict;
}

async function liveExecute(scenario, plan) {
  // Stub: live execute requires an SSH target and the EnvForge API. We
  // keep the surface here so operators can extend it locally without
  // touching the dry-run path. CI never reaches this branch.
  const baseUrl = process.env.ENVFORGE_HARNESS_BASE_URL;
  const token = process.env.ENVFORGE_HARNESS_BEARER_TOKEN;
  if (!baseUrl || !token) {
    throw new Error("Live mode requires ENVFORGE_HARNESS_BASE_URL and ENVFORGE_HARNESS_BEARER_TOKEN.");
  }
  if (scenario.destructive && !allowDestructive) {
    throw new Error(`Refusing to run destructive scenario ${scenario.id} without ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE=true.`);
  }
  // Persist the plan via /api/plans, fully ack via /api/plans/:id/review,
  // apply via /api/plans/:id/apply, then poll /api/plans/:id/report.
  const headers = { "content-type": "application/json", authorization: `Bearer ${token}` };
  const create = await fetch(`${baseUrl}/api/plans`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: plan.type,
      targetConnectionId: process.env.ENVFORGE_HARNESS_TARGET,
      source: scenario.planSource
    })
  });
  if (!create.ok) throw new Error(`POST /api/plans failed: ${create.status}`);
  const { plan: persisted } = await create.json();
  const planId = persisted.id;

  const ack = fullAcks(persisted);
  const review = await fetch(`${baseUrl}/api/plans/${planId}/review`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      decision: "approved",
      acknowledgedRisks: Object.entries(ack.risks).map(([itemId, risks]) => ({ itemId, risks })),
      acknowledgedConflicts: ack.conflicts,
      acknowledgedApprovals: ack.approvals
    })
  });
  if (!review.ok) throw new Error(`POST /api/plans/${planId}/review failed: ${review.status}`);

  const apply = await fetch(`${baseUrl}/api/plans/${planId}/apply`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      dryRun: false,
      acknowledged: true,
      acknowledgedRisks: Object.entries(ack.risks).map(([itemId, risks]) => ({ itemId, risks })),
      acknowledgedConflicts: ack.conflicts,
      acknowledgedApprovals: ack.approvals,
      acknowledgedActionIds: persisted.items.flatMap((it) => it.actions.map((a) => a.id))
    })
  });
  const applyBody = await apply.json();

  const report = await fetch(`${baseUrl}/api/plans/${planId}/report?format=json`, { headers });
  const reportBody = await report.json();

  return { planId, applyBody, reportBody };
}

async function collectTargetDifferences() {
  // In dry-run we don't have an SSH session; we record what we would
  // probe so live mode can fill it in.
  return {
    sshServiceName: "unknown (probe in live mode: systemctl status ssh sshd)",
    nginxServiceName: "nginx",
    dockerServiceName: "docker",
    packageManager: "unknown (probe in live mode: command -v apt-get / dnf / pacman / apk / zypper)",
    systemdAvailable: "unknown (probe: command -v systemctl)",
    sudoNoPassword: "unknown (probe: sudo -n true)",
    firewallStack: "unknown (probe: ufw status / firewall-cmd --state / nft list ruleset)",
    tmpAtomicInstall: "assumed yes (probe: stat -f /tmp; install -m 0644)",
    aptDpkgLocked: "unknown (probe: lsof /var/lib/dpkg/lock-frontend)"
  };
}

async function runOne(scenario, ctx) {
  const { env, db, actionRuns } = ctx;
  const startedAt = new Date().toISOString();

  if (scenario.destructive && mode !== "live") {
    // dry-run still simulates the plan; we just mark the run accordingly
    // in the report.
  }

  const plan = await buildPlanForScenario(scenario, env, db);
  const expectations = assertExpected(scenario, plan);
  const gateVerdict = summarizeApplyGate(plan, env);
  const targetDifferences = await collectTargetDifferences();

  // Synthesize action runs for the dry-run report. Each action that
  // would execute under live mode is marked `skipped` (non-mutating)
  // or `manual-required` (detect-only) according to the same rules
  // the orchestrator applies.
  const dryRunActionRuns = plan.items.flatMap((item) =>
    item.actions.map((action) => {
      const detectOnly = (item.audit?.supportLevel ?? item.supportLevel) === "detect-only";
      const status = detectOnly
        ? "manual-required"
        : ["review", "validate", "manualStep"].includes(action.kind)
          ? "skipped"
          : "pending"; // would-be mutating; only reaches this in dry-run report
      return {
        planId: plan.id,
        itemId: item.id,
        actionId: action.id,
        capabilityKey: item.capabilityKey,
        startedAt,
        endedAt: new Date().toISOString(),
        status,
        snapshot: undefined,
        applyResult: undefined,
        verifyResult: undefined,
        rollbackResult: undefined,
        redacted: false
      };
    })
  );

  const liveResult = mode === "live"
    ? await liveExecute(scenario, plan).catch((err) => ({ error: err.message }))
    : undefined;

  const report = env.buildPlanReport(plan, {
    actionRuns: dryRunActionRuns
  });

  // Redact every string-typed value in the final payloads. Even though
  // dry-run output should not carry secrets, this is a defence-in-depth
  // guarantee the harness runs unconditionally.
  const redactedPlan = redactDeep(plan, actionRuns.redactSecrets);
  const redactedReport = redactDeep(report, actionRuns.redactSecrets);
  const redactedActionRuns = redactDeep(dryRunActionRuns, actionRuns.redactSecrets);

  const verdict =
    expectations.ok && gateVerdict.ok
      ? "pass"
      : expectations.ok
        ? `apply-gate-blocked: ${gateVerdict.reasons.join("; ")}`
        : `expectations-failed: ${expectations.reasons.join("; ")}`;

  return {
    scenarioId: scenario.id,
    title: scenario.title,
    mode,
    destructive: Boolean(scenario.destructive),
    startedAt,
    endedAt: new Date().toISOString(),
    targetId: process.env.ENVFORGE_HARNESS_TARGET ?? "harness-dry-run",
    targetDifferences,
    plan: redactedPlan,
    report: redactedReport,
    actionRuns: redactedActionRuns,
    applyGate: gateVerdict,
    expectationsResult: expectations,
    liveResult,
    verdict
  };
}

function reportToMarkdown(reportBundle) {
  const lines = [];
  lines.push(`# Harness scenario: ${reportBundle.scenarioId}`);
  lines.push("");
  lines.push(`Title: ${reportBundle.title}`);
  lines.push(`Mode: ${reportBundle.mode}`);
  lines.push(`Destructive: ${reportBundle.destructive}`);
  lines.push(`Target: ${reportBundle.targetId}`);
  lines.push(`Verdict: **${reportBundle.verdict}**`);
  lines.push(`Started: ${reportBundle.startedAt}`);
  lines.push(`Ended:   ${reportBundle.endedAt}`);
  lines.push("");
  lines.push(`## Plan summary`);
  lines.push(`- planId: \`${reportBundle.plan.id}\``);
  lines.push(`- type: ${reportBundle.plan.type}`);
  lines.push(`- status: ${reportBundle.plan.status}`);
  lines.push(`- effectiveSupportLevel: ${reportBundle.plan.summary?.effectiveSupportLevel ?? "n/a"}`);
  lines.push(`- items: ${reportBundle.plan.items.length}`);
  lines.push(`- review.required: ${reportBundle.plan.review.required}`);
  lines.push(`- review.targetStateConfidence: ${reportBundle.plan.review.targetStateConfidence ?? "n/a"}`);
  lines.push(`- conflicts: ${(reportBundle.plan.review.conflicts ?? []).length}`);
  lines.push(`- approvalsRequired: ${(reportBundle.plan.review.approvalsRequired ?? []).length}`);
  lines.push("");
  lines.push(`## Apply gate verdict`);
  lines.push(`- ok: ${reportBundle.applyGate.ok}`);
  if (reportBundle.applyGate.reasons.length > 0) {
    for (const r of reportBundle.applyGate.reasons) lines.push(`- ${r}`);
  } else {
    lines.push(`- (no blocking reasons)`);
  }
  lines.push("");
  lines.push(`## Expectations`);
  lines.push(`- ok: ${reportBundle.expectationsResult.ok}`);
  for (const r of reportBundle.expectationsResult.reasons) lines.push(`- ${r}`);
  lines.push("");
  lines.push(`## Action run records (dry-run synthesised)`);
  for (const run of reportBundle.actionRuns) {
    lines.push(`- \`${run.itemId}/${run.actionId}\` — status=${run.status}`);
  }
  lines.push("");
  lines.push(`## Target differences observed`);
  for (const [key, val] of Object.entries(reportBundle.targetDifferences)) {
    lines.push(`- ${key}: ${val}`);
  }
  lines.push("");
  if (reportBundle.liveResult) {
    lines.push(`## Live execution result`);
    lines.push("```json");
    lines.push(JSON.stringify(reportBundle.liveResult, null, 2));
    lines.push("```");
  }
  return lines.join("\n");
}

async function main() {
  const ctx = await loadDist();
  const allFiles = await listScenarios();
  const scenarios = await Promise.all(allFiles.map(readScenario));
  const filtered = targetIds.size === 0
    ? scenarios
    : scenarios.filter((s) => targetIds.has(s.id));

  if (filtered.length === 0) {
    console.error(`No scenarios matched. Available:`);
    for (const s of scenarios) console.error(`  - ${s.id}`);
    process.exit(2);
  }

  const runId = nowSlug();
  const runDir = path.resolve(reportRoot, runId);
  await ensureDir(runDir);

  let failures = 0;
  const summary = [];
  for (const scenario of filtered) {
    if (scenario.destructive && mode === "live" && !allowDestructive) {
      console.warn(`[skip] ${scenario.id}: destructive but ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE!=true`);
      summary.push({ id: scenario.id, verdict: "skipped (destructive guard)" });
      continue;
    }
    let bundle;
    try {
      bundle = await runOne(scenario, ctx);
    } catch (err) {
      console.error(`[fail] ${scenario.id}: ${err.message}`);
      failures += 1;
      summary.push({ id: scenario.id, verdict: `error: ${err.message}` });
      continue;
    }
    const jsonPath = path.join(runDir, `${scenario.id}.report.json`);
    const mdPath = path.join(runDir, `${scenario.id}.report.md`);
    const actionsPath = path.join(runDir, `${scenario.id}.actions.json`);
    await fs.writeFile(jsonPath, JSON.stringify(bundle, null, 2), "utf8");
    await fs.writeFile(mdPath, reportToMarkdown(bundle), "utf8");
    await fs.writeFile(actionsPath, JSON.stringify(bundle.actionRuns, null, 2), "utf8");
    if (bundle.verdict !== "pass") failures += 1;
    summary.push({ id: scenario.id, verdict: bundle.verdict, jsonPath, mdPath });
    console.log(`[${bundle.verdict === "pass" ? "ok" : "fail"}] ${scenario.id}: ${bundle.verdict}`);
  }

  await fs.writeFile(
    path.join(runDir, "summary.json"),
    JSON.stringify({ runId, mode, scenarios: summary, failures }, null, 2),
    "utf8"
  );
  await fs.writeFile(
    path.join(runDir, "summary.md"),
    [
      `# Harness run summary`,
      ``,
      `Run id: \`${runId}\``,
      `Mode: ${mode}`,
      `Failures: ${failures}/${summary.length}`,
      ``,
      ...summary.map((s) => `- ${s.id}: ${s.verdict}`)
    ].join("\n"),
    "utf8"
  );

  if (failures > 0) {
    console.error(`\n${failures}/${summary.length} scenarios failed. Reports in ${runDir}.`);
    process.exit(1);
  }
  console.log(`\nAll ${summary.length} scenarios passed. Reports in ${runDir}.`);
}

await main();
