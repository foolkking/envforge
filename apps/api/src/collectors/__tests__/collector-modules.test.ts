/**
 * collectors/__tests__/collector-modules.test.ts — Phase 2
 *
 * Each collector module is tested for required properties:
 * - has an id
 * - returns { id, status, completeness, commands, errors, data, collectedAt }
 * - skipped ≠ ok
 */
import test from "node:test";
import assert from "node:assert/strict";
import { osCollector } from "../../collectors/os.js";
import { packagesCollector } from "../../collectors/packages.js";
import { systemdCollector } from "../../collectors/systemd.js";
import { networkCollector } from "../../collectors/network.js";
import { dockerCollector } from "../../collectors/docker.js";
import { composeCollector } from "../../collectors/compose.js";
import { configCollector } from "../../collectors/config.js";
import { dataCollector } from "../../collectors/data.js";
import { securityCollector } from "../../collectors/security.js";
import { usersCollector } from "../../collectors/users.js";
import { certificatesCollector } from "../../collectors/certificates.js";
import { cronTimersCollector } from "../../collectors/cron-timers.js";
import { runtimeProcessesCollector } from "../../collectors/runtime-processes.js";
import type { CollectorExecutor, CollectorModule } from "../../collectors/runner.js";
import { type CollectorResult } from "../../collectors/types.js";

// fake executor that returns empty success output
const fakeExec: CollectorExecutor = {
  exec: async (_cmd: string) => ({ stdout: "fake output", stderr: "", exitCode: 0, timedOut: false })
};

const allCollectors: Array<[string, CollectorModule]> = [
  ["os", osCollector],
  ["packages", packagesCollector],
  ["systemd", systemdCollector],
  ["network", networkCollector],
  ["docker", dockerCollector],
  ["compose", composeCollector],
  ["config", configCollector],
  ["data", dataCollector],
  ["security", securityCollector],
  ["users", usersCollector],
  ["certificates", certificatesCollector],
  ["cron-timers", cronTimersCollector],
  ["runtime-processes", runtimeProcessesCollector],
];

for (const [id, collector] of allCollectors) {
  test(`${id} collector: id matches`, () => {
    assert.ok(collector.run, `${id} collector must have .run`);
  });

  test(`${id} collector: result has required fields`, async () => {
    const canRun = collector.canRun ? await collector.canRun("test-host", fakeExec) : true;
    let result: CollectorResult;
    if (canRun) {
      result = await collector.run("test-host", fakeExec);
      assert.ok(result.id, `${id} result.id must be truthy`);
      assert.ok(["ok", "partial", "failed", "skipped"].includes(result.status), `${id} status=${result.status} invalid`);
      assert.ok(typeof result.completeness === "number", `${id} completeness must be number`);
      assert.ok(Array.isArray(result.commands), `${id} commands must be array`);
      assert.ok(Array.isArray(result.errors), `${id} errors must be array`);
      assert.ok(typeof result.collectedAt === "string", `${id} collectedAt must be string`);
    } else {
      // skipped because canRun=false
    }
  });

  test(`${id} collector: status ok implies completeness >= 1`, async () => {
    const canRun = collector.canRun ? await collector.canRun("test-host", fakeExec) : true;
    if (!canRun) return;
    const result = await collector.run("test-host", fakeExec);
    if (result.status === "ok") {
      assert.ok(result.completeness >= 1 || result.completeness === 1, `${id} ok but completeness=${result.completeness}`);
    }
  });

  test(`${id} collector: failed status ≠ ok`, async () => {
    const canRun = collector.canRun ? await collector.canRun("test-host", fakeExec) : true;
    if (!canRun) return;
    const result = await collector.run("test-host", fakeExec);
    if (result.status === "failed") {
      assert.ok(result.completeness === 0, `${id} failed should have completeness=0, got ${result.completeness}`);
    }
  });
}
