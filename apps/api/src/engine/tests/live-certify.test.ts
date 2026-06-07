/**
 * live-certify.test.ts — pure-logic tests for the operator kit.
 *
 * Covers:
 *   - parseReadinessProbe / evaluateReadiness (the readiness contract).
 *   - destructiveAllowed (the gate that protects destructive scenarios).
 *   - decideCertificationVerdict (the rule that prevents dry-run from
 *     ever escalating to certified-*).
 *
 * The module under test is plain JS in scripts/harness/lib/readiness.mjs;
 * we import it directly with a relative URL so we don't need a build
 * step for these tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");
const readinessUrl = pathToFileURL(
  path.resolve(repoRoot, "scripts/harness/lib/readiness.mjs")
).href;

// Dynamic import; the module under test is plain JS (.mjs).
const readinessMod = await import(readinessUrl);
const {
  CERTIFICATION_VERDICTS,
  decideCertificationVerdict,
  destructiveAllowed,
  evaluateReadiness,
  parseReadinessProbe
} = readinessMod;

// ───────────────────────────────────────────────────────────────────
// parseReadinessProbe
// ───────────────────────────────────────────────────────────────────

const goodProbe = {
  target: "envforge@192.168.64.10",
  os: "Ubuntu 24.04 LTS",
  kernel: "6.8.0-31-generic",
  hostname: "envforge-harness-cert-1",
  systemd: true,
  ssh: true,
  sudo: true,
  apt: true,
  aptLocked: false,
  sshServiceName: "ssh.service",
  nginxServiceName: "none",
  dockerServiceName: "none",
  firewallStack: "ufw:inactive",
  productionMarkers: [],
  disposableMarkers: ["hostname-disposable", "disposable-file"]
};

test("parseReadinessProbe accepts a well-formed payload", () => {
  const result = parseReadinessProbe(goodProbe);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.raw.os, "Ubuntu 24.04 LTS");
  assert.equal(result.raw.disposableMarkers.length, 2);
});

test("parseReadinessProbe rejects non-object payloads", () => {
  for (const bad of [null, undefined, "string", 42, []]) {
    const result = parseReadinessProbe(bad as unknown);
    assert.equal(result.ok, false, `expected reject for ${JSON.stringify(bad)}`);
  }
});

test("parseReadinessProbe rejects payloads missing required fields", () => {
  const { os, ...rest } = goodProbe;
  const result = parseReadinessProbe(rest);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /os/);
});

// ───────────────────────────────────────────────────────────────────
// evaluateReadiness
// ───────────────────────────────────────────────────────────────────

test("evaluateReadiness: clean Ubuntu 24.04 disposable target → ready", () => {
  const r = evaluateReadiness(goodProbe);
  assert.equal(r.verdict, "ready");
  assert.equal(r.disposable, true);
  assert.equal(r.safeForDestructive, true);
  assert.deepEqual(r.reasons, []);
});

test("evaluateReadiness: Ubuntu 22.04 also accepted", () => {
  const r = evaluateReadiness({ ...goodProbe, os: "Ubuntu 22.04.4 LTS" });
  assert.equal(r.verdict, "ready");
});

test("evaluateReadiness: rejects non-Ubuntu targets", () => {
  const r = evaluateReadiness({ ...goodProbe, os: "Anolis OS 9.4" });
  assert.equal(r.verdict, "not-ready");
  assert.match(r.reasons.join(" "), /not Ubuntu 22\/24 LTS/);
});

test("evaluateReadiness: rejects when systemd missing", () => {
  const r = evaluateReadiness({ ...goodProbe, systemd: false });
  assert.equal(r.verdict, "not-ready");
  assert.match(r.reasons.join(" "), /systemd not available/);
});

test("evaluateReadiness: rejects when sudo not passwordless", () => {
  const r = evaluateReadiness({ ...goodProbe, sudo: false });
  assert.equal(r.verdict, "not-ready");
  assert.match(r.reasons.join(" "), /sudo not available/);
});

test("evaluateReadiness: refuses while apt is locked", () => {
  const r = evaluateReadiness({ ...goodProbe, aptLocked: true });
  assert.equal(r.verdict, "not-ready");
  assert.match(r.reasons.join(" "), /apt\/dpkg lock/);
});

test("evaluateReadiness: hostname containing 'production' → not disposable, not safe for destructive", () => {
  const r = evaluateReadiness({
    ...goodProbe,
    hostname: "production-web-01",
    disposableMarkers: []
  });
  assert.equal(r.disposable, false);
  assert.equal(r.safeForDestructive, false);
  assert.match(r.reasons.join(" "), /production host/);
});

test("evaluateReadiness: explicit production markers override disposable hostname", () => {
  const r = evaluateReadiness({
    ...goodProbe,
    productionMarkers: ["production-file"]
  });
  assert.equal(r.disposable, false);
  assert.match(r.reasons.join(" "), /production markers/);
});

test("evaluateReadiness: missing disposable marker (no hostname hint, no file) → not safe for destructive", () => {
  const r = evaluateReadiness({
    ...goodProbe,
    hostname: "vm-12345",
    disposableMarkers: []
  });
  assert.equal(r.disposable, false);
  assert.equal(r.safeForDestructive, false);
  assert.match(r.reasons.join(" "), /no disposable marker/);
});

test("evaluateReadiness: hostname starting with envforge-cert- is accepted as disposable", () => {
  const r = evaluateReadiness({
    ...goodProbe,
    hostname: "envforge-cert-runner",
    disposableMarkers: []
  });
  assert.equal(r.verdict, "ready");
  assert.equal(r.disposable, true);
});

// ───────────────────────────────────────────────────────────────────
// destructiveAllowed
// ───────────────────────────────────────────────────────────────────

test("destructiveAllowed: non-destructive scenario is always allowed", () => {
  const r = destructiveAllowed({
    readiness: null,
    allowDestructive: false,
    destructive: false
  });
  assert.equal(r.allowed, true);
});

test("destructiveAllowed: refuses without ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE", () => {
  const readiness = evaluateReadiness(goodProbe);
  const r = destructiveAllowed({
    readiness,
    allowDestructive: false,
    destructive: true
  });
  assert.equal(r.allowed, false);
  assert.match(r.reason, /ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE/);
});

test("destructiveAllowed: refuses when no readiness probe ran", () => {
  const r = destructiveAllowed({
    readiness: null,
    allowDestructive: true,
    destructive: true
  });
  assert.equal(r.allowed, false);
  assert.match(r.reason, /readiness probe was not run/);
});

test("destructiveAllowed: refuses when readiness verdict not ready", () => {
  const readiness = evaluateReadiness({ ...goodProbe, sudo: false });
  const r = destructiveAllowed({
    readiness,
    allowDestructive: true,
    destructive: true
  });
  assert.equal(r.allowed, false);
  assert.match(r.reason, /not-ready/);
});

test("destructiveAllowed: refuses when target not disposable even though ack present", () => {
  const readiness = evaluateReadiness({
    ...goodProbe,
    hostname: "production-host",
    disposableMarkers: []
  });
  const r = destructiveAllowed({
    readiness,
    allowDestructive: true,
    destructive: true
  });
  assert.equal(r.allowed, false);
});

test("destructiveAllowed: allows destructive when readiness=ready, disposable, ack=true", () => {
  const readiness = evaluateReadiness(goodProbe);
  const r = destructiveAllowed({
    readiness,
    allowDestructive: true,
    destructive: true
  });
  assert.equal(r.allowed, true);
});

// ───────────────────────────────────────────────────────────────────
// decideCertificationVerdict
// ───────────────────────────────────────────────────────────────────

test("decideCertificationVerdict: liveExecuted=false ALWAYS returns not-run", () => {
  const r = decideCertificationVerdict({
    liveExecuted: false,
    mandatory: [
      { id: "build-nginx-success", verdict: "pass" },
      { id: "remove-existing-nginx-blocked", verdict: "pass" }
    ],
    optional: [{ id: "build-docker-success", verdict: "pass" }]
  });
  assert.equal(r.verdict, "not-run");
});

test("decideCertificationVerdict: any failed mandatory → failed", () => {
  const r = decideCertificationVerdict({
    liveExecuted: true,
    mandatory: [
      { id: "build-nginx-success", verdict: "pass" },
      { id: "ssh-hardening-safe-apply", verdict: "fail" }
    ]
  });
  assert.equal(r.verdict, "failed");
  assert.match(r.reasons.join(" "), /ssh-hardening-safe-apply/);
});

test("decideCertificationVerdict: all mandatory pass + all optional pass → certified-basic", () => {
  const r = decideCertificationVerdict({
    liveExecuted: true,
    mandatory: [
      { id: "build-nginx-success", verdict: "pass" },
      { id: "nginx-config-postvalidate-failure-rollback", verdict: "pass" },
      { id: "ssh-hardening-safe-apply", verdict: "pass" },
      { id: "remove-managed-nginx", verdict: "pass" },
      { id: "remove-existing-nginx-blocked", verdict: "pass" }
    ],
    optional: [{ id: "build-docker-success", verdict: "pass" }]
  });
  assert.equal(r.verdict, "certified-basic");
});

test("decideCertificationVerdict: all mandatory pass + optional skipped → certified-with-warnings", () => {
  const r = decideCertificationVerdict({
    liveExecuted: true,
    mandatory: [
      { id: "build-nginx-success", verdict: "pass" },
      { id: "nginx-config-postvalidate-failure-rollback", verdict: "pass" },
      { id: "ssh-hardening-safe-apply", verdict: "pass" },
      { id: "remove-managed-nginx", verdict: "pass" },
      { id: "remove-existing-nginx-blocked", verdict: "pass" }
    ],
    optional: [{ id: "build-docker-success", verdict: "skipped" }]
  });
  assert.equal(r.verdict, "certified-with-warnings");
});

test("decideCertificationVerdict: all pass but warnings present → certified-with-warnings", () => {
  const r = decideCertificationVerdict({
    liveExecuted: true,
    mandatory: [
      { id: "build-nginx-success", verdict: "pass" },
      { id: "nginx-config-postvalidate-failure-rollback", verdict: "pass" },
      { id: "ssh-hardening-safe-apply", verdict: "pass" },
      { id: "remove-managed-nginx", verdict: "pass" },
      { id: "remove-existing-nginx-blocked", verdict: "pass" }
    ],
    optional: [{ id: "build-docker-success", verdict: "pass" }],
    warnings: ["target had stale snapshot"]
  });
  assert.equal(r.verdict, "certified-with-warnings");
});

test("CERTIFICATION_VERDICTS contains exactly the four documented labels", () => {
  assert.deepEqual([...CERTIFICATION_VERDICTS], [
    "not-run",
    "failed",
    "certified-with-warnings",
    "certified-basic"
  ]);
});

// ───────────────────────────────────────────────────────────────────
// Operator kit cross-checks
// ───────────────────────────────────────────────────────────────────

test("package.json wires every harness:* npm script", async () => {
  const raw = await fs.readFile(path.resolve(repoRoot, "package.json"), "utf8");
  const pkg = JSON.parse(raw);
  const expected = [
    "harness:scenarios",
    "harness:scenario",
    "harness:certify",
    "harness:certify:dry-run",
    "harness:target:check",
    "harness:ubuntu:provision",
    "harness:ubuntu:destroy",
    "harness:register"
  ];
  for (const name of expected) {
    assert.ok(pkg.scripts[name], `missing npm script "${name}"`);
  }
});

test("operator-kit scripts exist on disk", async () => {
  for (const rel of [
    "scripts/harness/lib/readiness.mjs",
    "scripts/harness/check-target-readiness.mjs",
    "scripts/harness/provision-multipass-ubuntu.mjs",
    "scripts/harness/destroy-multipass-ubuntu.mjs",
    "scripts/harness/register-connection.mjs",
    "scripts/harness/live-ubuntu-certify.mjs"
  ]) {
    const stat = await fs.stat(path.resolve(repoRoot, rel));
    assert.ok(stat.isFile(), `missing ${rel}`);
  }
});

test("destroy script refuses VM names that don't carry the harness prefix", async () => {
  const src = await fs.readFile(
    path.resolve(repoRoot, "scripts/harness/destroy-multipass-ubuntu.mjs"),
    "utf8"
  );
  assert.match(src, /\^envforge-harness-/);
  assert.match(src, /refusing to delete VM/);
});

test("live-ubuntu-certify orchestrator never escalates not-run to certified-* (source-level guard)", async () => {
  const src = await fs.readFile(
    path.resolve(repoRoot, "scripts/harness/live-ubuntu-certify.mjs"),
    "utf8"
  );
  // The orchestrator MUST hand the verdict decision to
  // decideCertificationVerdict; it must not synthesise any
  // certified-* literal anywhere else.
  const certifiedMatches = src.match(/"certified-[a-z-]+"/g) ?? [];
  assert.equal(
    certifiedMatches.length,
    0,
    `orchestrator must not emit certified-* literals; found: ${certifiedMatches.join(", ")}`
  );
  assert.match(src, /decideCertificationVerdict\(/);
  assert.match(src, /redactSecrets/);
});

test("redaction is applied to live summary writes", async () => {
  const src = await fs.readFile(
    path.resolve(repoRoot, "scripts/harness/live-ubuntu-certify.mjs"),
    "utf8"
  );
  // The writeSummary function calls redactDeep BEFORE writing to disk.
  const writeSummary = src.indexOf("async function writeSummary(");
  const writeFile = src.indexOf("fs.writeFile(", writeSummary);
  const between = src.slice(writeSummary, writeFile);
  assert.match(between, /redactDeep\(/);
});
