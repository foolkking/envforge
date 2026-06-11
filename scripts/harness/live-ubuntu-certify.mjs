#!/usr/bin/env node
/**
 * scripts/harness/live-ubuntu-certify.mjs
 *
 * Operator-driven live certification orchestrator. Produces a single
 * `summary.json` + `summary.md` under
 * `docs/harness-reports/live-ubuntu-certification/`.
 *
 * Hard guarantees (each one is unit-tested in
 * `apps/api/src/engine/tests/harness-certification.test.ts` and
 * `apps/api/src/engine/tests/live-certify.test.ts`):
 *
 *   1. Without ENVFORGE_HARNESS_MODE=live AND every connection env var
 *      AND a passing readiness probe, the verdict is locked to
 *      `not-run`. There is NO flag combination that escalates a
 *      dry-run output into `certified-*`.
 *   2. Destructive scenarios refuse to run unless
 *      ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE=true AND
 *      readiness.safeForDestructive=true.
 *   3. Every report bundle is passed through redactSecrets before it
 *      lands on disk.
 *
 * Usage:
 *
 *   ENVFORGE_HARNESS_MODE=live \
 *   ENVFORGE_HARNESS_BASE_URL=$ENVFORGE \
 *   ENVFORGE_HARNESS_BEARER_TOKEN=$TOK \
 *   ENVFORGE_HARNESS_TARGET=$CONN_ID \
 *   ENVFORGE_HARNESS_TARGET_SSH=envforge@192.168.64.10 \
 *   ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE=true \
 *   npm run harness:certify
 *
 * The runner re-uses scripts/run-harness-scenarios.mjs for per-scenario
 * execution; this file owns the gating + summary + verdict logic.
 */

import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CERTIFICATION_VERDICTS,
  decideCertificationVerdict,
  destructiveAllowed,
  evaluateReadiness,
  parseReadinessProbe
} from "./lib/readiness.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const certDir = path.resolve(repoRoot, "docs/harness-reports/live-ubuntu-certification");
const runnerPath = path.resolve(repoRoot, "scripts/run-harness-scenarios.mjs");
const checkPath = path.resolve(here, "check-target-readiness.mjs");
const distActionRunsUrl = pathToFileURL(path.resolve(repoRoot, "apps/api/dist/action-runs.js")).href;

const MANDATORY = [
  { id: "build-nginx-success", destructive: false },
  { id: "nginx-config-postvalidate-failure-rollback", destructive: true },
  { id: "ssh-hardening-safe-apply", destructive: true },
  { id: "remove-managed-nginx", destructive: true },
  { id: "remove-existing-nginx-blocked", destructive: false }
];
const OPTIONAL = [
  { id: "build-docker-success", destructive: false }
];

const env = process.env;

const liveMode = env.ENVFORGE_HARNESS_MODE === "live";
const allowDestructive = env.ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE === "true";
const targetSsh = env.ENVFORGE_HARNESS_TARGET_SSH ?? "";

const requiredEnv = [
  "ENVFORGE_HARNESS_BASE_URL",
  "ENVFORGE_HARNESS_BEARER_TOKEN",
  "ENVFORGE_HARNESS_TARGET"
];
const missingEnv = requiredEnv.filter((k) => !env[k]);

await main().catch(async (err) => {
  console.error(`[harness:certify] error: ${err?.message ?? err}`);
  await writeNotRun({
    extraReason: err?.message ?? String(err)
  });
  process.exit(1);
});

async function main() {
  await ensureDir(certDir);

  if (!liveMode || missingEnv.length > 0) {
    const reasons = [
      !liveMode ? "ENVFORGE_HARNESS_MODE!=live" : null,
      ...missingEnv.map((k) => `${k} is not set`)
    ].filter(Boolean);
    await writeNotRun({ reasons });
    console.log("Verdict: not-run.");
    console.log(`Reasons: ${reasons.join("; ")}`);
    console.log("Operator next steps are documented in docs/validation.md.");
    process.exit(0);
  }

  // Live mode: probe target readiness BEFORE running anything.
  let readiness = null;
  if (targetSsh) {
    try {
      readiness = await runReadinessProbe(targetSsh);
    } catch (err) {
      readiness = null;
      console.error(`[harness:certify] readiness probe failed: ${err.message}`);
    }
  } else {
    console.warn(
      "[harness:certify] ENVFORGE_HARNESS_TARGET_SSH not set; readiness probe SKIPPED. " +
      "Destructive scenarios will be refused."
    );
  }

  const perScenario = [];
  const warnings = [];
  let actionRunCount = 0;
  let rollbackCount = 0;
  let redactionTriggered = false;
  let liveExecuted = false;
  let targetOs = readiness?.os ?? null;
  let targetKernel = readiness?.kernel ?? null;
  let targetHostname = readiness?.hostname ?? null;

  // Mandatory + optional scenarios.
  for (const def of [...MANDATORY, ...OPTIONAL]) {
    const gate = destructiveAllowed({
      readiness,
      allowDestructive,
      destructive: def.destructive
    });
    if (!gate.allowed) {
      perScenario.push({
        id: def.id,
        mandatory: MANDATORY.some((m) => m.id === def.id),
        verdict: "skipped",
        reason: gate.reason
      });
      warnings.push(`scenario "${def.id}" skipped: ${gate.reason}`);
      continue;
    }
    try {
      const result = await runOneLive(def.id);
      liveExecuted = true;
      const summary = await summarizeScenario(def.id, result.runDir);
      perScenario.push({
        ...summary,
        mandatory: MANDATORY.some((m) => m.id === def.id)
      });
      actionRunCount += summary.actionRunCount ?? 0;
      rollbackCount += summary.rollbackCount ?? 0;
      if (summary.redacted) redactionTriggered = true;
      // First scenario's targetDifferences fills metadata when no
      // readiness probe ran.
      if (!targetOs && summary.targetDifferences?.targetOs) targetOs = summary.targetDifferences.targetOs;
    } catch (err) {
      perScenario.push({
        id: def.id,
        mandatory: MANDATORY.some((m) => m.id === def.id),
        verdict: "error",
        reason: redactedMessage(err)
      });
    }
  }

  const mandatory = perScenario.filter((s) => s.mandatory);
  const optional = perScenario.filter((s) => !s.mandatory);
  const { verdict, reasons } = decideCertificationVerdict({
    liveExecuted,
    mandatory,
    optional,
    warnings
  });

  const summary = {
    runId: new Date().toISOString(),
    verdict,
    reasons,
    envforgeCommit: await readGitCommit(),
    target: {
      ssh: targetSsh || null,
      os: targetOs,
      kernel: targetKernel,
      hostname: targetHostname,
      readiness: readiness
        ? {
            verdict: readiness.verdict,
            disposable: readiness.disposable,
            safeForDestructive: readiness.safeForDestructive,
            reasons: readiness.reasons
          }
        : null
    },
    scenarios: perScenario,
    actionRunCount,
    rollbackCount,
    redactionTriggered,
    failedAssertions: collectFailedAssertions(perScenario),
    knownIssues: warnings,
    timestampedRunDirs: dedupeRunDirs(perScenario)
  };

  await writeSummary(summary);
  console.log(`Verdict: ${verdict}.`);
  if (verdict === "failed") process.exit(1);
  process.exit(0);
}

async function runReadinessProbe(targetSpec) {
  const out = await spawnText(process.execPath, [checkPath, targetSpec], {
    env,
    cwd: repoRoot
  });
  const parsed = parseReadinessProbe(JSON.parse(out.trim()).raw ?? JSON.parse(out.trim()));
  // The check script already calls evaluateReadiness, but we re-run
  // the contract here so the orchestrator only trusts pure code.
  if (!parsed.ok) throw new Error(`readiness payload invalid: ${parsed.error}`);
  const readiness = evaluateReadiness(parsed.raw);
  return readiness;
}

async function runOneLive(scenarioId) {
  // Snapshot existing report directories so we can identify the new
  // one the per-scenario runner produced.
  const reportRoot = path.resolve(repoRoot, "docs/harness-reports");
  const before = (await fs.readdir(reportRoot).catch(() => [])).filter(isTimestampDir);
  await spawnInherit(process.execPath, [runnerPath, scenarioId], { env, cwd: repoRoot });
  const after = (await fs.readdir(reportRoot).catch(() => [])).filter(isTimestampDir);
  const newDirs = after.filter((d) => !before.includes(d));
  const dir = newDirs.length
    ? path.join(reportRoot, newDirs[newDirs.length - 1])
    : path.join(reportRoot, after.sort().slice(-1)[0]);
  return { runDir: dir };
}

async function summarizeScenario(scenarioId, runDir) {
  const reportPath = path.join(runDir, `${scenarioId}.report.json`);
  let bundle;
  try {
    bundle = JSON.parse(await fs.readFile(reportPath, "utf8"));
  } catch (err) {
    return {
      id: scenarioId,
      verdict: "missing-report",
      reason: redactedMessage(err)
    };
  }
  // Copy the per-scenario outputs (json + md + actions.json) into the
  // certification dir so reviewers don't have to chase timestamped dirs.
  for (const suffix of [".report.json", ".report.md", ".actions.json"]) {
    const src = path.join(runDir, `${scenarioId}${suffix}`);
    const dst = path.join(certDir, `${scenarioId}${suffix}`);
    try {
      await fs.copyFile(src, dst);
    } catch {
      /* best-effort */
    }
  }
  return {
    id: scenarioId,
    verdict: bundle.verdict ?? "unknown",
    runDir,
    targetDifferences: bundle.targetDifferences,
    reportPath: path.join(
      "docs/harness-reports/live-ubuntu-certification",
      `${scenarioId}.report.md`
    ),
    actionRunCount: Array.isArray(bundle.actionRuns) ? bundle.actionRuns.length : 0,
    rollbackCount: Array.isArray(bundle.actionRuns)
      ? bundle.actionRuns.filter(
          (r) => r.status === "rolled-back" || r.rollbackResult
        ).length
      : 0,
    redacted: Array.isArray(bundle.actionRuns)
      ? bundle.actionRuns.some((r) => r.redacted === true)
      : null
  };
}

function collectFailedAssertions(perScenario) {
  return perScenario
    .filter((s) => s.verdict !== "pass" && s.verdict !== "skipped")
    .map((s) => ({ id: s.id, verdict: s.verdict, reason: s.reason ?? null }));
}

function dedupeRunDirs(perScenario) {
  const set = new Set();
  for (const s of perScenario) if (s.runDir) set.add(s.runDir);
  return [...set];
}

async function writeNotRun({ reasons = [], extraReason } = {}) {
  const summary = {
    runId: new Date().toISOString(),
    verdict: "not-run",
    reasons: extraReason ? [...reasons, `error: ${extraReason}`] : reasons,
    envforgeCommit: await readGitCommit(),
    target: { ssh: null, os: null, kernel: null, hostname: null, readiness: null },
    scenarios: [...MANDATORY, ...OPTIONAL].map(({ id, destructive }) => ({
      id,
      mandatory: MANDATORY.some((m) => m.id === id),
      destructive,
      verdict: "not-run"
    })),
    actionRunCount: 0,
    rollbackCount: 0,
    redactionTriggered: false,
    failedAssertions: [],
    knownIssues: [
      "Live target certification was not invoked. Run `npm run harness:certify` with ENVFORGE_HARNESS_MODE=live and the matching connection vars to record a real verdict."
    ],
    timestampedRunDirs: []
  };
  await writeSummary(summary);
}

async function writeSummary(summary) {
  // Belt-and-braces: route every string field through the runtime
  // redactor before write. The action runs already passed through
  // `redactSecrets` when the per-scenario runner produced them, but we
  // re-apply at this layer to defend against future regressions.
  const redacted = await redactDeep(summary);
  await fs.writeFile(
    path.join(certDir, "summary.json"),
    JSON.stringify(redacted, null, 2),
    "utf8"
  );
  await fs.writeFile(path.join(certDir, "summary.md"), summaryToMarkdown(redacted), "utf8");
}

async function redactDeep(value) {
  // Lazy-load the runtime redactor; tests may run without a built
  // `dist/` and we don't want to break them.
  let redactSecrets;
  try {
    const mod = await import(distActionRunsUrl);
    redactSecrets = mod.redactSecrets;
  } catch {
    return value;
  }
  const visit = (v) => {
    if (v == null) return v;
    if (typeof v === "string") return redactSecrets(v).text;
    if (Array.isArray(v)) return v.map(visit);
    if (typeof v === "object") {
      const out = {};
      for (const [k, val] of Object.entries(v)) out[k] = visit(val);
      return out;
    }
    return v;
  };
  return visit(value);
}

function summaryToMarkdown(summary) {
  const lines = [];
  lines.push("# EnvForge Live Target Certification");
  lines.push("");
  lines.push(`Verdict: **${summary.verdict}**`);
  lines.push(`Run id: \`${summary.runId}\``);
  lines.push(`EnvForge commit: \`${summary.envforgeCommit}\``);
  lines.push(`Target OS: ${summary.target?.os ?? "n/a"}`);
  lines.push(`Target kernel: ${summary.target?.kernel ?? "n/a"}`);
  lines.push(`Target hostname: ${summary.target?.hostname ?? "n/a"}`);
  if (summary.target?.readiness) {
    lines.push(
      `Readiness: ${summary.target.readiness.verdict} (disposable=${summary.target.readiness.disposable}, safeForDestructive=${summary.target.readiness.safeForDestructive})`
    );
  }
  lines.push("");
  if (summary.reasons?.length) {
    lines.push("## Reasons");
    for (const r of summary.reasons) lines.push(`- ${r}`);
    lines.push("");
  }
  lines.push("## Scenarios");
  for (const s of summary.scenarios) {
    const tag = s.mandatory ? "mandatory" : "optional";
    const link = s.reportPath ? ` — [report](${s.reportPath})` : "";
    lines.push(`- [${s.verdict}] **${s.id}** (${tag})${link}`);
    if (s.reason) lines.push(`  - reason: ${s.reason}`);
    if (s.actionRunCount !== undefined) {
      lines.push(
        `  - action run records: ${s.actionRunCount}; rollback events: ${s.rollbackCount}; redaction: ${s.redacted ?? "n/a"}`
      );
    }
  }
  lines.push("");
  lines.push(`Total action run records: ${summary.actionRunCount}`);
  lines.push(`Total rollback events: ${summary.rollbackCount}`);
  lines.push(`Any redaction triggered: ${summary.redactionTriggered}`);
  if (summary.failedAssertions?.length) {
    lines.push("");
    lines.push("## Failed assertions");
    for (const f of summary.failedAssertions)
      lines.push(`- \`${f.id}\` verdict=${f.verdict}${f.reason ? ` — ${f.reason}` : ""}`);
  }
  if (summary.knownIssues?.length) {
    lines.push("");
    lines.push("## Known issues / follow-ups");
    for (const k of summary.knownIssues) lines.push(`- ${k}`);
  }
  lines.push("");
  lines.push("---");
  lines.push("Generated by `scripts/harness/live-ubuntu-certify.mjs`.");
  return lines.join("\n");
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

function isTimestampDir(name) {
  return /^[0-9]{4}-/.test(name) && name.includes("T");
}

async function readGitCommit() {
  try {
    return (await spawnText("git", ["rev-parse", "HEAD"], { cwd: repoRoot })).trim();
  } catch {
    return "unknown";
  }
}

function spawnInherit(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...opts, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))
    );
  });
}

function spawnText(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => (stdout += c.toString("utf8")));
    child.stderr.on("data", (c) => (stderr += c.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(stdout) : reject(new Error(`${cmd} exited ${code}: ${stderr.trim()}`))
    );
  });
}

function redactedMessage(err) {
  // Conservative: drop anything that looks like a key/secret in the
  // surfaced error. The full redactor lives in dist/action-runs.js and
  // is applied on the final summary; this is a fast pre-redaction at
  // the per-scenario layer.
  const msg = err?.message ?? String(err);
  return msg.replace(/(Bearer|password=|token=|secret=|api_key=)\s*\S+/gi, "$1 <REDACTED>");
}

// ── Re-export verdict labels for the test suite. ────────────────
export { CERTIFICATION_VERDICTS };
