#!/usr/bin/env node
/**
 * scripts/run-harness-certification.mjs (compatibility shim)
 *
 * The active live certification orchestrator lives at
 * `scripts/harness/live-ubuntu-certify.mjs`. This file is kept so
 * older docs / runbooks that point at the prior path keep working.
 * It simply re-exports the orchestrator entry point as a child
 * process so behaviour is identical to running the new path
 * directly.
 */
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, "harness/live-ubuntu-certify.mjs");

const child = spawn(process.execPath, [target, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env
});
child.on("close", (code) => process.exit(code ?? 0));
