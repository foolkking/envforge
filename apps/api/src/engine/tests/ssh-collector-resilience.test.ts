import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseRemoteCollectorOutput } from "../../collectors/remote-collector.js";
import { fullSnapshotToStored } from "../../ssh.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");
const collectorPath = path.resolve(repoRoot, "apps/api/src/collectors/remote-collector.ts");
const sshPath = path.resolve(repoRoot, "apps/api/src/ssh.ts");

test("remote collector uses bounded non-interactive commands", async () => {
  const src = await fs.readFile(collectorPath, "utf8");

  assert.match(src, /run_limited\(\)/, "collector should define a command timeout wrapper");
  assert.match(src, /run_limited 5s sudo -n ufw status/, "ufw audit must not wait for sudo password input");
  assert.ok(!src.includes("sudo ufw status"), "collector must not run interactive sudo ufw status");

  for (const command of ["rpm -qa", "npm list -g", "pip3 list", "pip list", "gem list", "docker images", "systemctl list-unit-files", "systemctl list-units"]) {
    assert.match(src, new RegExp(`run_limited [58]s ${escapeRegex(command)}`), `${command} should be bounded`);
  }
});

test("apt collection avoids per-package dpkg-query loops", async () => {
  const src = await fs.readFile(collectorPath, "utf8");

  assert.match(src, /dpkg-query -W -f='\\\$\{Package\}\|\\\$\{Version\}\\n'/, "apt collection should batch-read dpkg package versions");
  assert.match(src, /awk -F'\|' 'NR==FNR \{ manual\[\$1\]=1; next \} manual\[\$1\] \{ print \}'/, "apt collection should join manual packages in one pass");
  assert.ok(!/while IFS= read -r pkg;[\s\S]+dpkg-query -W -f='\\\$\{Version\}' "\$pkg"/.test(src), "apt collection must not spawn dpkg-query per package");
});

test("every remote collector section emits command status and preserves command stderr", async () => {
  const src = await fs.readFile(collectorPath, "utf8");
  const sections = [...src.matchAll(/===SECTION:([a-z-]+)===/g)].map((match) => match[1]);
  const statusIds = new Set([...src.matchAll(/emit_status ([a-z-]+)/g)].map((match) => match[1]));
  for (const section of sections) assert.ok(statusIds.has(section), `collector section ${section} must emit an exit status`);
  assert.match(src, /2>>"\$COLLECT_ERR"/, "collector commands must retain stderr evidence");
  assert.match(src, /cat "\$COLLECT_ERR" >&2/, "captured command stderr must be returned over SSH stderr");
});

test("ssh connect timeout is cleared once the handshake succeeds", async () => {
  const src = await fs.readFile(sshPath, "utf8");
  const readyHandlers = [...src.matchAll(/conn\.on\("ready", \(\) => \{([\s\S]*?)collectRemoteSnapshot/g)];

  assert.equal(readyHandlers.length, 2, "both SSH auth paths should collect after ready");
  for (const match of readyHandlers) {
    assert.match(match[1], /clearConnectTimer\(\);/, "ready handler should clear the handshake timeout before collection");
  }
});

test("collector envelopes preserve failed command evidence and stderr", () => {
  const snapshot = parseRemoteCollectorOutput([
    "===SECTION:hostname===", "host-a",
    "===STATUS:hostname:0===",
    "===SECTION:docker-images===",
    "===STATUS:docker-images:127===",
    "===SECTION:end===",
    "===STATUS:end:0==="
  ].join("\n"), "host-a", { stderr: "docker: command not found", exitCode: 0 });

  assert.equal(snapshot.collectors?.["docker-images"]?.status, "failed");
  assert.equal(snapshot.collectors?.["docker-images"]?.commands[0]?.exitCode, 127);
  assert.match(snapshot.collectors?.["docker-images"]?.stderr ?? "", /command not found/);
  assert.ok((snapshot.collection?.completeness ?? 1) < 1);
  assert.notEqual(snapshot.collection?.status, "ok");
});

test("collector timeout is explicit partial evidence rather than empty success", () => {
  const snapshot = parseRemoteCollectorOutput([
    "===SECTION:hostname===", "host-timeout",
    "===STATUS:hostname:0===",
    "===SECTION:uname===", "Linux"
  ].join("\n"), "host-timeout", { stderr: "timeout after 60 seconds", timedOut: true });

  assert.equal(snapshot.collection?.timedOut, true);
  assert.equal(snapshot.collection?.status, "partial");
  assert.match(snapshot.collection?.stderr ?? "", /timeout/);
  assert.equal(snapshot.collectors?.uname?.status, "partial");
  assert.equal(snapshot.collectors?.uname?.commands[0]?.timedOut, true);
  assert.ok((snapshot.collectors?.uname?.completeness ?? 1) < 1);
});

test("bounded section timeout is retained as timed-out command evidence", () => {
  const snapshot = parseRemoteCollectorOutput([
    "===SECTION:hostname===", "host-section-timeout",
    "===STATUS:hostname:0===",
    "===SECTION:npm===",
    "===STATUS:npm:124===",
    "===SECTION:end===",
    "===STATUS:end:0==="
  ].join("\n"), "host-section-timeout");

  assert.equal(snapshot.collectors?.npm?.status, "failed");
  assert.equal(snapshot.collectors?.npm?.commands[0]?.timedOut, true);
  assert.match(snapshot.collectors?.npm?.errors[0] ?? "", /timed out/);
});

test("SSH snapshot persistence retains collection and per-section evidence envelopes", () => {
  const snapshot = parseRemoteCollectorOutput([
    "===SECTION:hostname===", "host-persisted",
    "===STATUS:hostname:0===",
    "===SECTION:docker-images===",
    "===STATUS:docker-images:127===",
    "===SECTION:end===",
    "===STATUS:end:0==="
  ].join("\n"), "host-persisted", { stderr: "docker unavailable", exitCode: 0 });

  const stored = fullSnapshotToStored(snapshot);
  assert.equal(stored.collection?.status, "partial");
  assert.ok((stored.collection?.completeness ?? 1) < 1);
  assert.equal(stored.collectors?.["docker-images"]?.status, "failed");
  assert.equal(stored.collectors?.["docker-images"]?.commands[0]?.exitCode, 127);
  assert.match(stored.collectors?.["docker-images"]?.stderr ?? "", /docker unavailable/);
});

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
