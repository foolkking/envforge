#!/usr/bin/env node
/**
 * scripts/harness/check-target-readiness.mjs
 *
 * Run a readiness probe against a target reachable via SSH and emit
 * the structured contract documented in
 * `docs/HARNESS_TARGET_READINESS.md`.
 *
 * Usage:
 *   node scripts/harness/check-target-readiness.mjs <user@host:port>
 *
 *   ENVFORGE_HARNESS_SSH_KEY=~/.ssh/id_ed25519 \
 *   node scripts/harness/check-target-readiness.mjs envforge@192.168.64.10
 *
 * The script writes the probe payload to stdout and exits 0 on
 * verdict="ready", non-zero otherwise. It does NOT mutate the target
 * — every command is read-only.
 *
 * The script is intentionally `ssh`-shell-based rather than going
 * through ssh2 + EnvForge runtime so the operator can run it
 * standalone before the API even sees the target.
 */

import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { evaluateReadiness, parseReadinessProbe } from "./lib/readiness.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv[2];
if (!target) {
  console.error("usage: check-target-readiness.mjs <user@host[:port]>");
  process.exit(2);
}

const { user, host, port } = parseTarget(target);
const sshKey = process.env.ENVFORGE_HARNESS_SSH_KEY;
const sshArgs = [
  "-o", "BatchMode=yes",
  "-o", "StrictHostKeyChecking=no",
  "-o", "UserKnownHostsFile=/dev/null",
  "-o", "ConnectTimeout=10",
  "-p", String(port)
];
if (sshKey) {
  sshArgs.push("-i", sshKey);
}
sshArgs.push(`${user}@${host}`);

const PROBE_SCRIPT = `
set +e
emit() { echo "$1=$2"; }

emit os "$(grep PRETTY_NAME /etc/os-release 2>/dev/null | sed 's/PRETTY_NAME=\\"\\(.*\\)\\"/\\1/' | head -1)"
emit kernel "$(uname -r 2>/dev/null)"
emit hostname "$(hostname 2>/dev/null)"

emit systemd "$(command -v systemctl >/dev/null 2>&1 && echo true || echo false)"
emit ssh "true"
emit sudo "$(sudo -n true 2>/dev/null && echo true || echo false)"
emit apt "$(command -v apt-get >/dev/null 2>&1 && echo true || echo false)"
emit aptLocked "$(lsof /var/lib/dpkg/lock-frontend >/dev/null 2>&1 && echo true || echo false)"

emit sshServiceName "$( (systemctl list-unit-files 2>/dev/null | awk '/^(ssh|sshd)\\.service/ { print $1; exit }') || echo unknown )"
emit nginxServiceName "$( (systemctl list-unit-files 2>/dev/null | awk '/^nginx\\.service/ { print $1; exit }') || echo none )"
emit dockerServiceName "$( (systemctl list-unit-files 2>/dev/null | awk '/^docker\\.service/ { print $1; exit }') || echo none )"

if command -v ufw >/dev/null 2>&1; then emit firewallStack "ufw:$(ufw status 2>/dev/null | head -1 | awk -F': ' '{print $2}')"
elif command -v firewall-cmd >/dev/null 2>&1; then emit firewallStack "firewalld:$(firewall-cmd --state 2>/dev/null)"
elif command -v nft >/dev/null 2>&1; then emit firewallStack "nft:$(nft list ruleset 2>/dev/null | head -1)"
else emit firewallStack "none"
fi

# Production / disposable markers.
markers=""
[ -f /etc/envforge-production ] && markers="$markers production-file"
[ "$(hostname 2>/dev/null)" = "production" ] && markers="$markers hostname-production"
[ -f /etc/envforge-disposable ] && disposable_marker="disposable-file"
case "$(hostname 2>/dev/null)" in
  envforge-harness*|envforge-cert*|envforge-disposable*|envforge-test*) disposable_marker="hostname-disposable" ;;
esac
emit productionMarkers "$markers"
emit disposableMarkers "${disposable_marker:-}"
`;

run().catch((err) => {
  console.error(JSON.stringify({ verdict: "not-ready", error: err?.message ?? String(err) }, null, 2));
  process.exit(1);
});

async function run() {
  const probeOut = await sshExec(PROBE_SCRIPT);
  const fields = {};
  for (const line of probeOut.split(/\r?\n/)) {
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    fields[line.slice(0, idx)] = line.slice(idx + 1).trim();
  }
  const payload = {
    target,
    os: fields.os ?? "",
    kernel: fields.kernel ?? "",
    hostname: fields.hostname ?? "",
    systemd: fields.systemd === "true",
    ssh: fields.ssh === "true",
    sudo: fields.sudo === "true",
    apt: fields.apt === "true",
    aptLocked: fields.aptLocked === "true",
    sshServiceName: fields.sshServiceName ?? "unknown",
    nginxServiceName: fields.nginxServiceName ?? null,
    dockerServiceName: fields.dockerServiceName ?? null,
    firewallStack: fields.firewallStack ?? "unknown",
    productionMarkers: (fields.productionMarkers ?? "").split(/\s+/).filter(Boolean),
    disposableMarkers: (fields.disposableMarkers ?? "").split(/\s+/).filter(Boolean)
  };
  const parsed = parseReadinessProbe(payload);
  if (!parsed.ok) {
    console.error(JSON.stringify({ verdict: "not-ready", error: parsed.error }, null, 2));
    process.exit(1);
  }
  const readiness = evaluateReadiness(parsed.raw);
  console.log(JSON.stringify(readiness, null, 2));
  process.exit(readiness.verdict === "ready" ? 0 : 1);
}

function parseTarget(value) {
  const m = value.match(/^(?:([^@]+)@)?([^:]+)(?::(\d+))?$/);
  if (!m) throw new Error(`unrecognised target ${value}; expected user@host[:port]`);
  return { user: m[1] ?? "envforge", host: m[2], port: m[3] ? Number(m[3]) : 22 };
}

function sshExec(script) {
  return new Promise((resolve, reject) => {
    const child = spawn("ssh", sshArgs, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => (stdout += c.toString("utf8")));
    child.stderr.on("data", (c) => (stderr += c.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`ssh exited ${code}: ${stderr.trim()}`));
    });
    child.stdin.end(script);
  });
}
