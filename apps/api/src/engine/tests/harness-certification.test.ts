/**
 * harness-certification.test.ts — verifies the Live Target
 * Certification orchestrator's invariants:
 *
 *   - The `not-run` summary is the only output when ENVFORGE_HARNESS_*
 *     env vars are missing or wrong. There is no path that emits a
 *     `certified-*` verdict from a dry run.
 *   - The mandatory + optional scenario lists are exactly the
 *     documented sets.
 *   - The orchestrator + npm script wiring still matches the
 *     operator-kit contract.
 *
 * Static-analysis-style assertions (over the script source) are used
 * because the orchestrator is a Node CLI; spawning it from inside
 * `node --test` would require fixtures we do not have.
 */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");
const scriptPath = path.resolve(repoRoot, "scripts/harness/live-ubuntu-certify.mjs");
const pkgPath = path.resolve(repoRoot, "package.json");

async function readSource(): Promise<string> {
  return fs.readFile(scriptPath, "utf8");
}

test("harness-certify: orchestrator exists at scripts/harness/live-ubuntu-certify.mjs", async () => {
  const stat = await fs.stat(scriptPath);
  assert.ok(stat.isFile());
});

test("harness-certify: registered in root package.json as harness:certify", async () => {
  const raw = await fs.readFile(pkgPath, "utf8");
  const pkg = JSON.parse(raw);
  assert.ok(pkg.scripts["harness:certify"], "harness:certify script must exist");
  assert.match(
    pkg.scripts["harness:certify"],
    /live-ubuntu-certify\.mjs/,
    "harness:certify must invoke scripts/harness/live-ubuntu-certify.mjs"
  );
});

test("harness-certify: ships the five mandatory scenarios", async () => {
  const src = await readSource();
  const match = src.match(/const\s+MANDATORY\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(match, "MANDATORY array must exist");
  const list = match![1];
  for (const id of [
    "build-nginx-success",
    "nginx-config-postvalidate-failure-rollback",
    "ssh-hardening-safe-apply",
    "remove-managed-nginx",
    "remove-existing-nginx-blocked"
  ]) {
    assert.match(list, new RegExp(`"${id}"`), `MANDATORY missing ${id}`);
  }
});

test("harness-certify: ships build-docker-success as optional", async () => {
  const src = await readSource();
  const match = src.match(/const\s+OPTIONAL\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(match);
  assert.match(match![1], /"build-docker-success"/);
});

test("harness-certify: preflight checks all four ENVFORGE_HARNESS_* vars", async () => {
  const src = await readSource();
  for (const v of [
    "ENVFORGE_HARNESS_MODE",
    "ENVFORGE_HARNESS_BASE_URL",
    "ENVFORGE_HARNESS_BEARER_TOKEN",
    "ENVFORGE_HARNESS_TARGET"
  ]) {
    assert.match(src, new RegExp(v));
  }
  assert.match(src, /liveMode\s*=\s*env\.ENVFORGE_HARNESS_MODE\s*===\s*"live"/);
});

test("harness-certify: no path emits a certified-* literal in the orchestrator", async () => {
  const src = await readSource();
  const certifiedMatches = src.match(/"certified-[a-z-]+"/g) ?? [];
  assert.equal(
    certifiedMatches.length,
    0,
    `orchestrator must delegate verdict to decideCertificationVerdict; found literals: ${certifiedMatches.join(", ")}`
  );
});

test("harness-certify: writeNotRun branch hard-codes verdict 'not-run'", async () => {
  const src = await readSource();
  const fn = src.indexOf("async function writeNotRun(");
  assert.ok(fn >= 0, "writeNotRun helper must exist");
  const next = src.indexOf("\nasync function ", fn + 10);
  const body = src.slice(fn, next > 0 ? next : fn + 4000);
  assert.match(body, /verdict:\s*"not-run"/);
  assert.doesNotMatch(body, /verdict:\s*"certified-/);
});

test("harness-certify: destructive scenarios refused without ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE", async () => {
  const src = await readSource();
  assert.match(src, /ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE/);
  assert.match(src, /allowDestructive\s*=\s*env\.ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE\s*===\s*"true"/);
});

test("harness-certify: writes summary.json + summary.md into the certification dir", async () => {
  const src = await readSource();
  assert.match(src, /live-ubuntu-certification/);
  assert.match(src, /summary\.json/);
  assert.match(src, /summary\.md/);
});

test("harness-certify: the committed summary.md reports verdict not-run", async () => {
  const summaryPath = path.resolve(
    repoRoot,
    "docs/harness-reports/live-ubuntu-certification/summary.md"
  );
  const raw = await fs.readFile(summaryPath, "utf8");
  assert.match(raw, /Verdict:\s*\*\*not-run\*\*/);
});

test("harness-certify: live evaluation report placeholder explicitly states not-run", async () => {
  const evalPath = path.resolve(
    repoRoot,
    "docs/harness-reports/live-ubuntu-certification/EVALUATION_REPORT.md"
  );
  const raw = await fs.readFile(evalPath, "utf8");
  assert.match(raw, /Status:\s*not-run/i);
});

test("harness-certify: orchestrator delegates verdict to decideCertificationVerdict", async () => {
  const src = await readSource();
  assert.match(src, /decideCertificationVerdict\(/);
});

test("harness-certify: legacy shim forwards to live-ubuntu-certify.mjs", async () => {
  const shimPath = path.resolve(repoRoot, "scripts/run-harness-certification.mjs");
  const raw = await fs.readFile(shimPath, "utf8");
  assert.match(raw, /harness\/live-ubuntu-certify\.mjs/);
});
