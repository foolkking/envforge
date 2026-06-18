import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

test("ssh connect timeout is cleared once the handshake succeeds", async () => {
  const src = await fs.readFile(sshPath, "utf8");
  const readyHandlers = [...src.matchAll(/conn\.on\("ready", \(\) => \{([\s\S]*?)collectRemoteSnapshot/g)];

  assert.equal(readyHandlers.length, 2, "both SSH auth paths should collect after ready");
  for (const match of readyHandlers) {
    assert.match(match[1], /clearConnectTimer\(\);/, "ready handler should clear the handshake timeout before collection");
  }
});

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
