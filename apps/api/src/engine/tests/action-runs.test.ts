/**
 * action-runs.test.ts — ActionRunRecord state machine + secret
 * redaction tests.
 *
 * Covers:
 *  - State transitions (illegal transitions throw).
 *  - redactSecrets covers every required pattern.
 *  - safePreview redacts AND truncates.
 *  - canAutoRemove enforces the existedBefore=false + removable rule.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  ActionRunStateError,
  canAutoRemove,
  newActionRunRecord,
  redactSecrets,
  safePreview,
  TERMINAL_STATES,
  transition,
  truncatePreview,
  type ManagedCapabilityRecord
} from "../../action-runs.js";

test("action-runs: newActionRunRecord starts in pending state", () => {
  const r = newActionRunRecord({ planId: "p1", itemId: "capability:nginx", actionId: "install" });
  assert.equal(r.status, "pending");
  assert.equal(r.redacted, false);
  assert.ok(r.id.includes("p1"));
  assert.ok(r.id.includes("capability:nginx"));
});

test("action-runs: legal transitions follow the documented machine", () => {
  let r = newActionRunRecord({ planId: "p1", itemId: "i1", actionId: "a1" });
  r = transition(r, "snapshotting");
  assert.equal(r.status, "snapshotting");
  r = transition(r, "applying");
  r = transition(r, "verifying");
  r = transition(r, "succeeded");
  assert.equal(r.status, "succeeded");
  assert.ok(r.endedAt, "endedAt set when reaching a terminal state");
});

test("action-runs: rolling-back path captures rolled-back / rollback-failed", () => {
  let r = newActionRunRecord({ planId: "p1", itemId: "i1", actionId: "a1" });
  r = transition(r, "snapshotting");
  r = transition(r, "applying");
  r = transition(r, "verifying");
  r = transition(transition(r, "failed"), "rolling-back");
  r = transition(r, "rolled-back");
  assert.equal(r.status, "rolled-back");
});

test("action-runs: illegal transitions throw ActionRunStateError", () => {
  const r = newActionRunRecord({ planId: "p1", itemId: "i1", actionId: "a1" });
  assert.throws(() => transition(r, "succeeded"), ActionRunStateError);
  assert.throws(() => transition(r, "rolled-back"), ActionRunStateError);
});

test("action-runs: TERMINAL_STATES contains the documented terminal set", () => {
  assert.ok(TERMINAL_STATES.has("succeeded"));
  assert.ok(TERMINAL_STATES.has("failed"));
  assert.ok(TERMINAL_STATES.has("rolled-back"));
  assert.ok(TERMINAL_STATES.has("rollback-failed"));
  assert.ok(TERMINAL_STATES.has("skipped"));
  assert.ok(TERMINAL_STATES.has("manual-required"));
});

// ───────────────────────────────────────────────────────────────────
// Secret redaction
// ───────────────────────────────────────────────────────────────────

test("redactSecrets: PEM private key block", () => {
  const pem = `before
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
-----END RSA PRIVATE KEY-----
after`;
  const r = redactSecrets(pem);
  assert.equal(r.redacted, true);
  assert.match(r.text, /REDACTED-RSA-PRIVATE-KEY/);
  assert.doesNotMatch(r.text, /MIIEowIBAAK/);
});

test("redactSecrets: OpenSSH private key", () => {
  const pem = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAA
-----END OPENSSH PRIVATE KEY-----`;
  const r = redactSecrets(pem);
  assert.match(r.text, /REDACTED-OPENSSH-PRIVATE-KEY/);
  assert.doesNotMatch(r.text, /b3BlbnNz/);
});

test("redactSecrets: Authorization Bearer header", () => {
  const r = redactSecrets("Authorization: Bearer abc123def456ghi789");
  assert.match(r.text, /REDACTED-AUTH/);
  assert.doesNotMatch(r.text, /abc123def456/);
});

test("redactSecrets: DATABASE_URL with embedded password", () => {
  const r = redactSecrets("DATABASE_URL=postgresql://envforge:s3kr3tpw@db.example/envforge");
  assert.match(r.text, /REDACTED-DB-URL-PASSWORD/);
  assert.doesNotMatch(r.text, /s3kr3tpw/);
});

test("redactSecrets: env-style API_KEY", () => {
  const r = redactSecrets(`API_KEY=sk_live_abcdef0123456789xx
TOKEN=hunter2longerthansix
PASSWORD="MyL0ngerPass"
`);
  assert.match(r.text, /REDACTED-ENV-SECRET/);
  assert.doesNotMatch(r.text, /sk_live_abcdef/);
  assert.doesNotMatch(r.text, /hunter2longer/);
  assert.doesNotMatch(r.text, /MyL0ngerPass/);
});

test("redactSecrets: AWS_SECRET_ACCESS_KEY env var", () => {
  const r = redactSecrets("AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
  assert.match(r.text, /REDACTED/);
  assert.doesNotMatch(r.text, /wJalrXUtnFEMI/);
});

test("redactSecrets: GitHub PAT and OpenAI key", () => {
  const r = redactSecrets("ghp_abcdefghijklmnopqrstuvwxyz0123456789 sk-abcdef0123456789hello");
  assert.match(r.text, /REDACTED-GH-TOKEN/);
  assert.match(r.text, /REDACTED-API-KEY/);
});

test("redactSecrets: no secrets → unchanged", () => {
  const r = redactSecrets("nginx -t\nbind 127.0.0.1\n");
  assert.equal(r.redacted, false);
  assert.equal(r.text, "nginx -t\nbind 127.0.0.1\n");
});

test("redactSecrets: empty / undefined input returns empty", () => {
  assert.deepEqual(redactSecrets(undefined), { text: "", redacted: false, hits: [] });
  assert.deepEqual(redactSecrets(null), { text: "", redacted: false, hits: [] });
  assert.deepEqual(redactSecrets("").redacted, false);
});

// ───────────────────────────────────────────────────────────────────
// truncatePreview + safePreview
// ───────────────────────────────────────────────────────────────────

test("truncatePreview: appends marker when over limit", () => {
  const big = "x".repeat(5000);
  const out = truncatePreview(big, 4096);
  assert.match(out, /truncated 904 bytes/);
});

test("safePreview: redacts AND truncates", () => {
  const buf = `${"x".repeat(4500)}\nAuthorization: Bearer toplongtokenstring`;
  const out = safePreview(buf, 4096);
  assert.equal(out.redacted, true);
  assert.match(out.text, /truncated/);
});

// ───────────────────────────────────────────────────────────────────
// canAutoRemove
// ───────────────────────────────────────────────────────────────────

function marker(overrides: Partial<ManagedCapabilityRecord> = {}): ManagedCapabilityRecord {
  return {
    id: "mc-1",
    capabilityKey: "web-server.nginx",
    catalogId: "nginx-web-service",
    installedByPlanId: "plan-1",
    installedAt: new Date().toISOString(),
    targetHostId: "conn-1",
    packagesInstalled: [{ name: "nginx", manager: "apt", existedBefore: false, removableByEnvForge: true }],
    configsTouched: [],
    servicesTouched: [],
    dataPathsKnown: [],
    ...overrides
  };
}

test("canAutoRemove: managed + fresh → auto", () => {
  assert.equal(canAutoRemove(marker()).decision, "auto");
});

test("canAutoRemove: existedBefore=true → manual", () => {
  const m = marker({
    packagesInstalled: [{ name: "nginx", manager: "apt", existedBefore: true, removableByEnvForge: true }]
  });
  const r = canAutoRemove(m);
  assert.equal(r.decision, "manual");
  assert.match(r.reason, /existedBefore=true/);
});

test("canAutoRemove: removableByEnvForge=false → manual", () => {
  const m = marker({
    packagesInstalled: [{ name: "nginx", manager: "apt", existedBefore: false, removableByEnvForge: false }]
  });
  assert.equal(canAutoRemove(m).decision, "manual");
});

test("canAutoRemove: known data paths → manual", () => {
  const m = marker({ dataPathsKnown: ["/var/lib/nginx/cache"] });
  const r = canAutoRemove(m);
  assert.equal(r.decision, "manual");
  assert.match(r.reason, /data path/);
});
