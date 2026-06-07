#!/usr/bin/env node
/**
 * scripts/harness/destroy-multipass-ubuntu.mjs
 *
 * Destroy the disposable Ubuntu VM provisioned by
 * provision-multipass-ubuntu.mjs.
 *
 *   node scripts/harness/destroy-multipass-ubuntu.mjs --name envforge-harness-…
 *
 * Refuses to operate on names that do not start with the
 * `envforge-harness-` prefix so an operator typo does not delete an
 * unrelated VM.
 */
import { spawn } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
const name = args.name;
if (!name) {
  console.error("usage: destroy-multipass-ubuntu.mjs --name <vm-name>");
  process.exit(2);
}
if (!/^envforge-harness-/.test(name)) {
  console.error(
    `[destroy] refusing to delete VM "${name}": name does not start with envforge-harness-. ` +
    "Pass the name produced by provision-multipass-ubuntu.mjs."
  );
  process.exit(3);
}

main().catch((err) => {
  console.error(`[destroy] error: ${err?.message ?? err}`);
  process.exit(1);
});

async function main() {
  await spawnInherit("multipass", ["delete", name, "--purge"]);
  console.log(`[destroy] purged ${name}`);
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

function spawnInherit(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))
    );
  });
}
