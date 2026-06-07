#!/usr/bin/env node
/**
 * scripts/harness/register-connection.mjs
 *
 * Register a target VM as an EnvForge StoredConnection by calling
 * `POST /api/connections/connect`. The script does NOT mock or fake
 * the API; if the call fails the operator is shown the redacted error
 * and must fix it before continuing.
 *
 * Required env vars:
 *   ENVFORGE_HARNESS_BASE_URL
 *   ENVFORGE_HARNESS_BEARER_TOKEN
 *
 * Required CLI flags:
 *   --host        target IP or hostname
 *   --user        SSH user (default: envforge)
 *   --port        SSH port (default: 22)
 *   --keyFile     path to a PRIVATE SSH key the API can use to reach
 *                 the target. The script reads the file, transmits it
 *                 over the EnvForge HTTPS endpoint, and never logs it.
 *
 * On success prints the new connection id to stdout (one line). The
 * orchestrator captures it via shell substitution.
 */

import path from "node:path";
import fs from "node:fs/promises";

const args = parseArgs(process.argv.slice(2));
const host = args.host;
const user = args.user ?? "envforge";
const port = args.port ?? "22";
const keyFile = args.keyFile;

if (!host || !keyFile) {
  console.error("usage: register-connection.mjs --host <ip> --keyFile <private key path> [--user envforge] [--port 22]");
  process.exit(2);
}
const baseUrl = process.env.ENVFORGE_HARNESS_BASE_URL;
const token = process.env.ENVFORGE_HARNESS_BEARER_TOKEN;
if (!baseUrl || !token) {
  console.error("ENVFORGE_HARNESS_BASE_URL and ENVFORGE_HARNESS_BEARER_TOKEN must be set.");
  process.exit(2);
}

main().catch((err) => {
  console.error(`[register] error: ${redactedMessage(err)}`);
  process.exit(1);
});

async function main() {
  const keyMaterial = await fs.readFile(keyFile, "utf8");
  const body = {
    method: "ssh-key",
    fields: { host, port: String(port), username: user },
    keyMaterial
  };
  const res = await fetch(`${baseUrl}/api/connections/connect`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST /api/connections/connect failed: ${res.status} ${redactedMessage(text)}`);
  }
  const payload = await res.json();
  const connId = payload?.connection?.id;
  if (!connId) {
    throw new Error(`unexpected response shape: ${JSON.stringify(payload).slice(0, 256)}`);
  }
  // Trigger an immediate probe so the planner has a Target Snapshot.
  const reprobe = await fetch(`${baseUrl}/api/connections/${connId}/reprobe`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` }
  }).catch(() => null);
  if (!reprobe || !reprobe.ok) {
    console.error(`[register] reprobe failed (status=${reprobe?.status ?? "unknown"}); the connection was created but may not have a probeSnapshot yet.`);
  }
  // The orchestrator captures stdout; stderr carries logs.
  process.stdout.write(`${connId}\n`);
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

function redactedMessage(value) {
  // Cheap pre-redaction; the certification orchestrator re-redacts the
  // final summary using the runtime's full pattern set.
  const text = typeof value === "string" ? value : value?.message ?? String(value);
  return text
    .replace(/(Bearer|Authorization:|password=|token=|secret=|api_key=)\s*\S+/gi, "$1 <REDACTED>")
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "<REDACTED-PRIVATE-KEY>");
}
