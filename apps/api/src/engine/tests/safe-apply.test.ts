/**
 * safe-apply.test.ts — tests for the four high-risk safe-apply
 * surfaces. Where a test cannot reasonably establish a live SSH session
 * we assert against the implementation source so the test still
 * catches regressions like "someone replaced reload with restart".
 *
 *   1. safeFirewallApply preflight refuses when the candidate would
 *      block tcp/<sshPort>.
 *   2. safeSshdConfigApply does NOT issue `systemctl restart sshd`.
 *   3. safeSudoersApply runs `visudo -cf` against the candidate before
 *      and after replacing the live file.
 *   4. safeSystemdUnitApply runs `daemon-reload` after the write.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { preflightFirewallContentKeepsSsh } from "../../config-files.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = path.resolve(here, "../../../src/config-files.ts");

async function readSource(): Promise<string> {
  return fs.readFile(SOURCE_PATH, "utf8");
}

// ───────────────────────────────────────────────────────────────────
// Firewall preflight
// ───────────────────────────────────────────────────────────────────

test("safeFirewallApply preflight: empty content is allowed (default policy stays accept)", () => {
  const result = preflightFirewallContentKeepsSsh("", 22);
  assert.equal(result.ok, true);
});

test("safeFirewallApply preflight: UFW DROP for ssh port refused", () => {
  const content = `*filter
:ufw-user-input - [0:0]
-A ufw-user-input -p tcp --dport 22 -j DROP
COMMIT`;
  const result = preflightFirewallContentKeepsSsh(content, 22);
  assert.equal(result.ok, false);
  assert.match(result.reason, /UFW rule denies tcp\/22/);
});

test("safeFirewallApply preflight: iptables DROP for ssh port refused", () => {
  const content = `*filter
-A INPUT -p tcp --dport 22 -j DROP
COMMIT`;
  const result = preflightFirewallContentKeepsSsh(content, 22);
  assert.equal(result.ok, false);
  assert.match(result.reason, /iptables/);
});

test("safeFirewallApply preflight: nftables drop for ssh port refused", () => {
  const content = `table inet filter {
  chain input {
    tcp dport 22 drop
  }
}`;
  const result = preflightFirewallContentKeepsSsh(content, 22);
  assert.equal(result.ok, false);
});

test("safeFirewallApply preflight: default-policy DROP without explicit allow is refused", () => {
  const content = `DEFAULT_INPUT_POLICY="DROP"
DEFAULT_OUTPUT_POLICY="ACCEPT"
DEFAULT_FORWARD_POLICY="DROP"`;
  const result = preflightFirewallContentKeepsSsh(content, 22);
  assert.equal(result.ok, false);
  assert.match(result.reason, /default INPUT=DROP/);
});

test("safeFirewallApply preflight: default DROP with explicit ACCEPT for ssh is allowed", () => {
  const content = `DEFAULT_INPUT_POLICY="DROP"
-A INPUT -p tcp --dport 22 -j ACCEPT`;
  const result = preflightFirewallContentKeepsSsh(content, 22);
  assert.equal(result.ok, true);
});

test("safeFirewallApply preflight: respects custom ssh port", () => {
  const blocked = preflightFirewallContentKeepsSsh(
    "-A ufw-user-input -p tcp --dport 2222 -j DROP",
    2222
  );
  assert.equal(blocked.ok, false);
  const ok = preflightFirewallContentKeepsSsh(
    "-A ufw-user-input -p tcp --dport 2222 -j DROP",
    22 // we care about port 22 here, not 2222
  );
  assert.equal(ok.ok, true);
});

// ───────────────────────────────────────────────────────────────────
// safeSshdConfigApply: never restart, only reload
// ───────────────────────────────────────────────────────────────────

test("safeSshdConfigApply: source uses `systemctl reload`, never `systemctl restart`", async () => {
  const src = await readSource();
  const start = src.indexOf("export async function safeSshdConfigApply");
  const end = src.indexOf("export async function ", start + 50);
  assert.ok(start >= 0, "safeSshdConfigApply must exist");
  const body = src.slice(start, end > 0 ? end : undefined);
  assert.match(body, /systemctl reload (?:ssh|sshd)/, "must reload sshd");
  assert.doesNotMatch(body, /systemctl restart sshd/, "must NOT restart sshd");
  assert.doesNotMatch(body, /systemctl restart ssh\b/, "must NOT restart ssh");
});

test("safeSshdConfigApply: source runs `sshd -t` before AND after the write", async () => {
  const src = await readSource();
  const start = src.indexOf("export async function safeSshdConfigApply");
  const end = src.indexOf("export async function ", start + 50);
  const body = src.slice(start, end > 0 ? end : undefined);
  // Pre-validate via validateConfigFile (which dispatches sshd -t for /etc/ssh/sshd_config).
  assert.match(body, /validateConfigFile\(connection,\s*filePath\)/);
  // Post-validate by re-running the same call (`after` variable).
  const postValidateMatches = body.match(/validateConfigFile\(connection,\s*filePath\)/g) ?? [];
  assert.ok(postValidateMatches.length >= 2, `expected pre+post validate, got ${postValidateMatches.length}`);
});

test("safeSshdConfigApply: source includes a fresh-SSH-session reachability probe", async () => {
  const src = await readSource();
  const start = src.indexOf("export async function safeSshdConfigApply");
  const end = src.indexOf("export async function ", start + 50);
  const body = src.slice(start, end > 0 ? end : undefined);
  assert.match(body, /ssh -o BatchMode=yes/);
});

test("safeSshdConfigApply: source rolls back to the EnvForge backup when the probe fails", async () => {
  const src = await readSource();
  const start = src.indexOf("export async function safeSshdConfigApply");
  const end = src.indexOf("export async function ", start + 50);
  const body = src.slice(start, end > 0 ? end : undefined);
  assert.match(body, /restoreConfigFileFromBackup/);
});

// ───────────────────────────────────────────────────────────────────
// safeSudoersApply: always runs visudo -cf
// ───────────────────────────────────────────────────────────────────

test("safeSudoersApply: source runs `visudo -cf` against the candidate before replacing the live file", async () => {
  const src = await readSource();
  const start = src.indexOf("export async function safeSudoersApply");
  const end = src.indexOf("export async function ", start + 50);
  const body = src.slice(start, end > 0 ? end : undefined);
  assert.match(body, /visudo -cf/);
  // Final defense: visudo -cf is also run against the live file.
  const visudoMatches = body.match(/visudo -cf/g) ?? [];
  assert.ok(visudoMatches.length >= 2, `expected visudo -cf at least twice (candidate + live), got ${visudoMatches.length}`);
});

test("safeSudoersApply: source rolls back when visudo rejects the live file", async () => {
  const src = await readSource();
  const start = src.indexOf("export async function safeSudoersApply");
  const end = src.indexOf("export async function ", start + 50);
  const body = src.slice(start, end > 0 ? end : undefined);
  assert.match(body, /restoreConfigFileFromBackup/);
});

// ───────────────────────────────────────────────────────────────────
// safeSystemdUnitApply: daemon-reload + status check
// ───────────────────────────────────────────────────────────────────

test("safeSystemdUnitApply: source runs `systemctl daemon-reload` after writing the unit", async () => {
  const src = await readSource();
  const start = src.indexOf("export async function safeSystemdUnitApply");
  const end = src.indexOf("export async function ", start + 50);
  const body = src.slice(start, end > 0 ? end : undefined);
  assert.match(body, /systemctl daemon-reload/);
});

test("safeSystemdUnitApply: source checks `is-active` after daemon-reload", async () => {
  const src = await readSource();
  const start = src.indexOf("export async function safeSystemdUnitApply");
  const end = src.indexOf("export async function ", start + 50);
  const body = src.slice(start, end > 0 ? end : undefined);
  assert.match(body, /systemctl is-active/);
});

test("safeSystemdUnitApply: source rolls back the unit on daemon-reload failure", async () => {
  const src = await readSource();
  const start = src.indexOf("export async function safeSystemdUnitApply");
  const end = src.indexOf("export async function ", start + 50);
  const body = src.slice(start, end > 0 ? end : undefined);
  assert.match(body, /restoreConfigFileFromBackup/);
});

// ───────────────────────────────────────────────────────────────────
// Generic safeWriteConfigFile preserves owner/mode + post-validates
// ───────────────────────────────────────────────────────────────────

test("safeWriteConfigFile: source captures owner/mode before atomic install", async () => {
  const src = await readSource();
  const start = src.indexOf("export async function safeWriteConfigFile");
  const end = src.indexOf("export async function ", start + 50);
  const body = src.slice(start, end > 0 ? end : undefined);
  assert.match(body, /stat -c '%a:%U:%G'/, "must stat existing mode/owner");
  assert.match(body, /sudo install \$\{modeArg\} \$\{ownerArg\}/, "must reapply mode + owner during atomic install");
});

test("safeWriteConfigFile: source pre-validates AND post-validates the live file", async () => {
  const src = await readSource();
  const start = src.indexOf("export async function safeWriteConfigFile");
  const end = src.indexOf("export async function ", start + 50);
  const body = src.slice(start, end > 0 ? end : undefined);
  // Two distinct calls — pre and post — bracket the atomic install.
  const calls = body.match(/validateConfigFile\(connection,\s*filePath\)/g) ?? [];
  assert.ok(calls.length >= 2, `expected ≥2 validateConfigFile calls (pre+post), got ${calls.length}`);
});

test("safeWriteConfigFile: post-validate failure restores the backup", async () => {
  const src = await readSource();
  const start = src.indexOf("export async function safeWriteConfigFile");
  const end = src.indexOf("export async function ", start + 50);
  const body = src.slice(start, end > 0 ? end : undefined);
  assert.match(body, /Post-validate failed/);
  assert.match(body, /restoreConfigFileFromBackup/);
});
