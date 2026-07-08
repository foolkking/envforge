/**
 * collectors/__tests__/collector-runner.test.ts — Phase 2
 *
 * Tests for computeOverallCompleteness, isSnapshotPartial, getSnapshotCompleteness,
 * getCollectorStatus, and the collector runner's error-handling contract.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { computeOverallCompleteness, isSnapshotPartial, getSnapshotCompleteness, getCollectorStatus, isRequiredCollector, isOptionalCollector, PARTIAL_SNAPSHOT_THRESHOLD, type CollectorSummary } from "../../collectors/types.js";
import { runCollectors, registerCollector, unregisterCollector, listRegisteredCollectors, type CollectorExecutor, type CollectorModule } from "../../collectors/runner.js";
import { osCollector } from "../../collectors/os.js";

// ══ helpers ═══════════════════════════════════════════════════════════

function okSummary(id: string, data: string[] = ["line1", "line2"]): CollectorSummary {
  return { id, status: "ok", completeness: 1, commands: [{ command: `${id}-cmd`, exitCode: 0 }], errors: [], collectedAt: new Date().toISOString(), data };
}

function failedSummary(id: string): CollectorSummary {
  return { id, status: "failed", completeness: 0, commands: [{ command: `${id}-cmd`, exitCode: 1 }], errors: [`${id} failed`], collectedAt: new Date().toISOString(), data: [] };
}

function partialSummary(id: string, completeness = 0.5): CollectorSummary {
  return { id, status: "partial", completeness, commands: [{ command: `${id}-cmd`, exitCode: 1 }], errors: [`${id} partial`], collectedAt: new Date().toISOString(), data: ["partial-line"] };
}

function skippedSummary(id: string): CollectorSummary {
  return { id, status: "skipped", completeness: 1, commands: [], errors: [], collectedAt: new Date().toISOString(), data: [] };
}

// ══ completeness computation ═══════════════════════════════════════════

test("computeOverallCompleteness: all required ok → overall 1.0, status ok", () => {
  const results = [okSummary("os"), okSummary("packages"), okSummary("systemd"), okSummary("network"), okSummary("docker")];
  const out = computeOverallCompleteness(results);
  assert.equal(out.completeness, 1);
  assert.equal(out.status, "ok");
});

test("computeOverallCompleteness: one required failed → completeness < 1, status partial", () => {
  const results = [okSummary("os"), failedSummary("packages"), okSummary("systemd"), okSummary("network"), okSummary("docker")];
  const out = computeOverallCompleteness(results);
  assert.ok(out.completeness < 1, `expected <1 got ${out.completeness}`);
  assert.ok(out.status === "partial" || out.status === "failed", `expected partial/failed got ${out.status}`);
});

test("computeOverallCompleteness: one required partial → completeness < 1, status partial", () => {
  const results = [okSummary("os"), okSummary("packages"), partialSummary("systemd", 0.5), okSummary("network"), okSummary("docker")];
  const out = computeOverallCompleteness(results);
  assert.ok(out.completeness < 1, `expected <1 got ${out.completeness}`);
  assert.ok(out.status === "partial" || out.status === "failed", `expected partial/failed got ${out.status}`);
});

test("computeOverallCompleteness: optional skipped → does not cause failed", () => {
  const results = [okSummary("os"), okSummary("packages"), okSummary("systemd"), okSummary("network"), okSummary("docker"), skippedSummary("compose"), skippedSummary("config"), skippedSummary("data")];
  const out = computeOverallCompleteness(results);
  assert.equal(out.completeness, 1);
  assert.equal(out.status, "ok");
});

test("computeOverallCompleteness: optional failed → completeness lowered but not fatal", () => {
  const results = [okSummary("os"), okSummary("packages"), okSummary("systemd"), okSummary("network"), okSummary("docker"), failedSummary("compose")];
  const out = computeOverallCompleteness(results);
  // compose is optional so failed doesn't make overall "failed"
  assert.ok(out.completeness <= 0.95, `expected <=0.95 got ${out.completeness}`);
});

test("computeOverallCompleteness: all failed → status failed", () => {
  const results = [failedSummary("os"), failedSummary("packages"), failedSummary("systemd"), failedSummary("network"), failedSummary("docker")];
  const out = computeOverallCompleteness(results);
  assert.equal(out.completeness, 0);
  assert.equal(out.status, "failed");
});

test("required collectors include os, packages, systemd, network, docker", () => {
  assert.equal(isRequiredCollector("os"), true);
  assert.equal(isRequiredCollector("packages"), true);
  assert.equal(isRequiredCollector("systemd"), true);
  assert.equal(isRequiredCollector("network"), true);
  assert.equal(isRequiredCollector("docker"), true);
});

test("optional collectors include compose, config, data, security, users, certificates, cron-timers, runtime-processes", () => {
  for (const id of ["compose", "config", "data", "security", "users", "certificates", "cron-timers", "runtime-processes"]) {
    assert.equal(isOptionalCollector(id), true);
  }
});

// ══ snapshot helpers ═══════════════════════════════════════════════════

test("isSnapshotPartial: old snapshot without collection → false", () => {
  assert.equal(isSnapshotPartial({}), false);
});

test("isSnapshotPartial: completeness < 1 → true", () => {
  assert.equal(isSnapshotPartial({ collection: { completeness: 0.8 } }), true);
});

test("isSnapshotPartial: completeness = 1 → false", () => {
  assert.equal(isSnapshotPartial({ collection: { completeness: 1 } }), false);
});

test("getSnapshotCompleteness: old snapshot → 1.0 fallback", () => {
  assert.equal(getSnapshotCompleteness({}), 1.0);
});

test("getSnapshotCompleteness: new snapshot → actual value", () => {
  assert.equal(getSnapshotCompleteness({ collection: { completeness: 0.85 } }), 0.85);
});

test("getCollectorStatus: old snapshot → undefined", () => {
  assert.equal(getCollectorStatus({}, "os"), undefined);
});

test("getCollectorStatus: new snapshot → collector status", () => {
  const snap = { collectors: { os: okSummary("os") } };
  assert.equal(getCollectorStatus(snap, "os"), "ok");
});

// ══ runner error handling ═══════════════════════════════════════════════

test("runner: collector throw → marked failed, runner continues", async () => {
  // Clear registry and re-register one known-good + one throw
  for (const id of listRegisteredCollectors()) unregisterCollector(id);

  const throwingCollector: CollectorModule = {
    canRun: () => true,
    run: async () => { throw new Error("boom"); }
  };
  const silentCollector: CollectorModule = {
    canRun: () => true,
    run: async (_h, _e) => ({ id: "test-silent", status: "ok", completeness: 1, commands: [], errors: [], collectedAt: new Date().toISOString(), data: [] })
  };

  registerCollector("test-throw", throwingCollector);
  registerCollector("test-silent", silentCollector);

  const exec: CollectorExecutor = {
    exec: async (_cmd: string) => ({ stdout: "", stderr: "", exitCode: 0, timedOut: false })
  };

  const envelope = await runCollectors("test-host", exec);
  assert.equal(envelope.collectors["test-throw"].status, "failed");
  assert.equal(envelope.collectors["test-throw"].errors[0], "boom");
  assert.equal(envelope.collectors["test-silent"].status, "ok");

  // cleanup
  for (const id of listRegisteredCollectors()) unregisterCollector(id);
});

test("runner: canRun=false → skipped", async () => {
  for (const id of listRegisteredCollectors()) unregisterCollector(id);

  const neverRun: CollectorModule = {
    canRun: () => false,
    run: async () => ({ id: "never", status: "ok", completeness: 1, commands: [], errors: [], collectedAt: "", data: [] })
  };
  registerCollector("never", neverRun);

  const exec: CollectorExecutor = {
    exec: async (_cmd: string) => ({ stdout: "", stderr: "", exitCode: 0, timedOut: false })
  };

  const envelope = await runCollectors("test-host", exec);
  assert.equal(envelope.collectors["never"].status, "skipped");

  for (const id of listRegisteredCollectors()) unregisterCollector(id);
});

test("runner: filterIds only runs specified collectors", async () => {
  for (const id of listRegisteredCollectors()) unregisterCollector(id);

  registerCollector("test-a", {
    canRun: () => true,
    run: async (_h, _e) => ({ id: "test-a", status: "ok", completeness: 1, commands: [], errors: [], collectedAt: new Date().toISOString(), data: ["a"] })
  });
  registerCollector("test-b", {
    canRun: () => true,
    run: async () => { throw new Error("should not run"); }
  });

  const exec: CollectorExecutor = {
    exec: async (_cmd: string) => ({ stdout: "", stderr: "", exitCode: 0, timedOut: false })
  };

  const envelope = await runCollectors("test-host", exec, { filterIds: ["test-a"] });
  assert.ok(Object.keys(envelope.collectors).includes("test-a"));
  assert.ok(!Object.keys(envelope.collectors).includes("test-b"));

  for (const id of listRegisteredCollectors()) unregisterCollector(id);
});

test("PARTIAL_SNAPSHOT_THRESHOLD is 0.85", () => {
  assert.equal(PARTIAL_SNAPSHOT_THRESHOLD, 0.85);
});
