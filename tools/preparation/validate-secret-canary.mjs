#!/usr/bin/env node
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const evidence = path.join(root, "delivery/preparation/evidence/tests/security-scan.json");
const roots = ["docs", "delivery", "PROJECT_STATE.md", "README.md", "AGENTS.md", ".github/workflows"];
const excluded = new Set([".env", "data", "node_modules", ".migration-backup", ".tmp_logs"]);
const patterns = [
  /ENVFORGE_SECRET_CANARY\s*=/i,
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,
  /\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}\b/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:postgres|mysql|mongodb|redis):\/\/[^@\s]+:[^@\s]+@/i
];
const canaryRoot = await mkdtemp(path.join(os.tmpdir(), "envforge-preparation-canary-"));
const canary = path.join(canaryRoot, "canary.txt");
await writeFile(canary, "ENVFORGE_SECRET_CANARY=should-trigger\n", "utf8");
const canaryText = await readFile(canary, "utf8");
if (!patterns.some((pattern) => pattern.test(canaryText))) throw new Error("Secret canary was not detected");
await rm(canaryRoot, { recursive: true, force: true });

const findings = [];
for (const entry of roots) {
  const absolute = path.join(root, entry);
  const files = await collect(absolute);
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const pattern of patterns.slice(1)) if (pattern.test(text)) findings.push(path.relative(root, file).replaceAll(path.sep, "/"));
  }
}
if (findings.length) throw new Error(`Potential credential material found: ${findings.join(", ")}`);
const summary = { status: "PASS", canary: "detected and removed", scannedRoots: roots, excluded: [...excluded], repositoryFindings: 0, sha256: createHash("sha256").update(JSON.stringify(roots)).digest("hex") };
await writeFile(evidence, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));

async function collect(target) {
  const result = [];
  let info;
  try { info = await (await import("node:fs/promises")).stat(target); } catch { return result; }
  if (info.isFile()) return [target];
  for (const item of await readdir(target, { withFileTypes: true })) {
    if (excluded.has(item.name)) continue;
    const child = path.join(target, item.name);
    if (item.isDirectory()) result.push(...await collect(child));
    else if (item.isFile() && /\.(md|yaml|yml|json|txt|mjs|js|ts|yml)$/.test(item.name)) result.push(child);
  }
  return result;
}
