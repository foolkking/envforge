#!/usr/bin/env node
/**
 * scripts/harness/provision-multipass-ubuntu.mjs
 *
 * Provision a disposable Ubuntu 24.04 LTS VM via Multipass for the
 * Live Target Certification flow. The VM is named with the
 * `envforge-harness-` prefix so the readiness check recognises it as
 * disposable.
 *
 * The script:
 *   1. Verifies multipass is on PATH; otherwise prints manual fallback
 *      steps and exits non-zero. Never fakes a created VM.
 *   2. Writes a cloud-init file that:
 *        - creates user `envforge` with NOPASSWD sudo,
 *        - injects the operator's SSH public key,
 *        - drops `/etc/envforge-disposable` so the readiness probe can
 *          confirm the disposable contract.
 *   3. `multipass launch 24.04 --name envforge-harness-<runId> ...`
 *   4. Prints the VM's IP, the ssh-spec for the readiness probe, and
 *      the next operator command.
 *
 * Usage:
 *
 *   node scripts/harness/provision-multipass-ubuntu.mjs \
 *     --pubkey ~/.ssh/id_ed25519.pub
 *
 *   # or via npm:
 *   npm run harness:ubuntu:provision -- --pubkey ~/.ssh/id_ed25519.pub
 */

import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

const args = parseArgs(process.argv.slice(2));
const pubkeyPath = args.pubkey ?? path.join(os.homedir(), ".ssh/id_ed25519.pub");
const release = args.release ?? "24.04";
const cpus = args.cpus ?? "2";
const memory = args.memory ?? "2G";
const disk = args.disk ?? "8G";
const runId = `envforge-harness-${Date.now().toString(36)}`;

main().catch((err) => {
  console.error(`[provision] error: ${err?.message ?? err}`);
  printManualFallback();
  process.exit(1);
});

async function main() {
  const multipass = await whichMultipass();
  if (!multipass) {
    console.error("[provision] multipass not found on PATH.");
    printManualFallback();
    process.exit(2);
  }
  const pubkey = await readPubkey(pubkeyPath);
  const cloudInit = renderCloudInit({ pubkey });
  const cloudInitPath = path.join(os.tmpdir(), `envforge-cloud-init-${runId}.yml`);
  await fs.writeFile(cloudInitPath, cloudInit, "utf8");
  console.log(`[provision] cloud-init written to ${cloudInitPath}`);

  await spawnInherit(multipass, [
    "launch", release,
    "--name", runId,
    "--cpus", String(cpus),
    "--memory", String(memory),
    "--disk", String(disk),
    "--cloud-init", cloudInitPath
  ]);

  const info = await spawnText(multipass, ["info", runId, "--format", "json"]);
  let ip = null;
  try {
    const parsed = JSON.parse(info);
    ip = parsed?.info?.[runId]?.ipv4?.[0] ?? null;
  } catch {
    /* swallow */
  }
  if (!ip) {
    console.error("[provision] could not determine VM IP from `multipass info`. Run `multipass list` to check.");
    process.exit(3);
  }

  console.log("");
  console.log("[provision] success");
  console.log(`  vm name : ${runId}`);
  console.log(`  ip      : ${ip}`);
  console.log(`  user    : envforge`);
  console.log(`  ssh spec: envforge@${ip}`);
  console.log("");
  console.log("Next steps:");
  console.log(`  1. node scripts/harness/check-target-readiness.mjs envforge@${ip}`);
  console.log(`  2. Register a connection in EnvForge (see docs/HARNESS_UBUNTU_LIVE_RUN.md).`);
  console.log("  3. Set ENVFORGE_HARNESS_TARGET=<connId> + ENVFORGE_HARNESS_TARGET_SSH=envforge@" + ip);
  console.log("  4. ENVFORGE_HARNESS_ALLOW_DESTRUCTIVE=true npm run harness:certify");
  console.log(`  5. node scripts/harness/destroy-multipass-ubuntu.mjs --name ${runId}`);
}

function renderCloudInit({ pubkey }) {
  return `#cloud-config
hostname: ${runId}
preserve_hostname: false
manage_etc_hosts: true
package_update: true
package_upgrade: false
users:
  - name: envforge
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    ssh_authorized_keys:
      - ${pubkey.trim()}
runcmd:
  - install -m 0644 /dev/null /etc/envforge-disposable
  - echo "EnvForge disposable harness target" > /etc/envforge-disposable
`;
}

async function readPubkey(p) {
  try {
    const raw = await fs.readFile(p, "utf8");
    return raw.trim();
  } catch (err) {
    throw new Error(`failed to read pubkey at ${p}: ${err.message}`);
  }
}

async function whichMultipass() {
  // `command -v` works on POSIX shells; on Windows we rely on the
  // PATHEXT lookup via spawn — if it fails we treat multipass as
  // missing.
  try {
    const out = await spawnText(process.platform === "win32" ? "where" : "which", ["multipass"]);
    const first = out.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
    return first || null;
  } catch {
    return null;
  }
}

function printManualFallback() {
  console.error("");
  console.error("Multipass is unavailable. Manual fallback:");
  console.error("");
  console.error("  Vagrant + VirtualBox:");
  console.error("    cd scripts/harness");
  console.error("    vagrant up        # uses the Vagrantfile snippet from docs/HARNESS_UBUNTU_LIVE_RUN.md");
  console.error("");
  console.error("  Cloud burner:");
  console.error("    Spin up a cloud-init Ubuntu 22.04 / 24.04 instance with the same cloud-init payload");
  console.error("    documented in docs/HARNESS_UBUNTU_LIVE_RUN.md.");
  console.error("");
  console.error("Either way, set the hostname to envforge-harness-* and drop /etc/envforge-disposable");
  console.error("so check-target-readiness.mjs accepts the target.");
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) out[key] = true;
      else { out[key] = next; i++; }
    }
  }
  return out;
}

function spawnInherit(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...opts, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))
    );
  });
}

function spawnText(cmd, args, opts = {}) {
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
