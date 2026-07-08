/**
 * collectors/__tests__/snapshot-completeness.test.ts — Phase 2
 *
 * Tests backward-compatibility of snapshot completeness integration with
 * existing probe/snapshot shapes and the partial-snapshot-confirm gate.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { isSnapshotPartial, getSnapshotCompleteness, getCollectorStatus, PARTIAL_SNAPSHOT_THRESHOLD } from "../../collectors/types.js";

// ══ Old snapshot shape (no collection.collectors) ═════════════════════

test("old StoredProbeSnapshot without collection survives isSnapshotPartial", () => {
  // Deliberately empty
  const oldSnap = {};
  assert.equal(isSnapshotPartial(oldSnap), false, "empty snapshot should not be partial");
});

test("old StoredProbeSnapshot without collection → getSnapshotCompleteness returns 1.0", () => {
  const oldSnap = {};
  assert.equal(getSnapshotCompleteness(oldSnap), 1.0);
});

test("old StoredProbeSnapshot without collectors → getCollectorStatus returns undefined", () => {
  const oldSnap = {};
  assert.equal(getCollectorStatus(oldSnap, "os"), undefined);
});

test("old StoredProbeSnapshot with collection but no collectors → no crash", () => {
  const snap = { collection: { completeness: 0.9, status: "partial" as const, commands: [], errors: [], timedOut: false } };
  assert.equal(isSnapshotPartial(snap), true);
  assert.equal(getSnapshotCompleteness(snap), 0.9);
  assert.equal(getCollectorStatus({ collectors: {} }, "os"), undefined);
});

// ══ Partial snapshot gate threshold ═══════════════════════════════════

test("snapshot completeness below PARTIAL_SNAPSHOT_THRESHOLD should trigger gate", () => {
  const snap = { collection: { completeness: 0.5 } };
  const shouldGate = getSnapshotCompleteness(snap) < PARTIAL_SNAPSHOT_THRESHOLD;
  assert.equal(shouldGate, true, "snapshot at 0.5 should trigger partial-snapshot-confirm");
});

test("snapshot completeness at 1.0 should NOT trigger gate", () => {
  const snap = { collection: { completeness: 1.0 } };
  const shouldGate = getSnapshotCompleteness(snap) < PARTIAL_SNAPSHOT_THRESHOLD;
  assert.equal(shouldGate, false);
});

// ══ New collector status lookup ══════════════════════════════════════

test("individual collector status can be looked up from collectors record", () => {
  const snap = {
    collection: { completeness: 0.8, status: "partial" as const, commands: [], errors: [], timedOut: false },
    collectors: {
      os: { id: "os", status: "ok" as const, completeness: 1, commands: [], errors: [], collectedAt: "", data: ["line"] },
      packages: { id: "packages", status: "partial" as const, completeness: 0.5, commands: [], errors: ["some error"], collectedAt: "", data: [] },
      config: { id: "config", status: "failed" as const, completeness: 0, commands: [], errors: ["fail"], collectedAt: "", data: [] },
      compose: { id: "compose", status: "skipped" as const, completeness: 1, commands: [], errors: [], collectedAt: "", data: [] }
    }
  };
  assert.equal(getCollectorStatus(snap, "os"), "ok");
  assert.equal(getCollectorStatus(snap, "packages"), "partial");
  assert.equal(getCollectorStatus(snap, "config"), "failed");
  assert.equal(getCollectorStatus(snap, "compose"), "skipped");
  assert.equal(getCollectorStatus(snap, "nonexistent"), undefined);
});
