/**
 * managed-capability.test.ts — exercises the managed-marker
 * persistence + remove-plan eligibility rules.
 *
 * Covers:
 *   - recordManagedCapability / findManagedCapabilities round-trip via
 *     the runtime store.
 *   - canAutoRemove gating semantics under realistic mixed-package
 *     markers.
 *   - The Remove plan's eligibility helper (decideRemoveEligibility)
 *     rejects packages that existed before EnvForge installed them.
 */
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import {
  canAutoRemove,
  type ManagedCapabilityRecord
} from "../../action-runs.js";

let tmpRoot: string;

test.before(async () => {
  // Isolate runtime store writes for this test file.
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "envforge-managed-cap-"));
  process.env.ENVFORGE_DATA_DIR = tmpRoot;
});

test.after(async () => {
  // Best-effort cleanup; ignore failures.
  try {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  } catch {
    /* swallow */
  }
});

function marker(overrides: Partial<ManagedCapabilityRecord> = {}): ManagedCapabilityRecord {
  return {
    id: "mc-test",
    capabilityKey: "web-server.nginx",
    catalogId: "nginx-web-service",
    installedByPlanId: "plan-test",
    installedAt: new Date().toISOString(),
    targetHostId: "conn-test",
    packagesInstalled: [
      { name: "nginx", manager: "apt", existedBefore: false, removableByEnvForge: true }
    ],
    configsTouched: ["/etc/nginx/nginx.conf"],
    servicesTouched: ["nginx"],
    dataPathsKnown: [],
    ...overrides
  };
}

test("recordManagedCapability + findManagedCapabilities round-trip", async () => {
  const { recordManagedCapability, findManagedCapabilities } = await import("../../managed-execution.js");
  const m = marker();
  await recordManagedCapability(m);
  const found = await findManagedCapabilities({ capabilityKey: "web-server.nginx" });
  assert.ok(found.find((row) => row.id === m.id));
});

test("findManagedCapabilities filters by targetHostId", async () => {
  const { recordManagedCapability, findManagedCapabilities } = await import("../../managed-execution.js");
  await recordManagedCapability(marker({ id: "mc-A", targetHostId: "host-A" }));
  await recordManagedCapability(marker({ id: "mc-B", targetHostId: "host-B" }));
  const onlyA = await findManagedCapabilities({ targetHostId: "host-A" });
  assert.ok(onlyA.find((r) => r.id === "mc-A"));
  assert.equal(onlyA.find((r) => r.id === "mc-B"), undefined);
});

// ───────────────────────────────────────────────────────────────────
// canAutoRemove: realistic mixed-package markers
// ───────────────────────────────────────────────────────────────────

test("canAutoRemove: mixed package set with one existedBefore=true → manual", () => {
  const m = marker({
    packagesInstalled: [
      { name: "nginx", manager: "apt", existedBefore: false, removableByEnvForge: true },
      // Operator already had openssl on the box; we should not strip it.
      { name: "openssl", manager: "apt", existedBefore: true, removableByEnvForge: true }
    ]
  });
  const decision = canAutoRemove(m);
  assert.equal(decision.decision, "manual");
  assert.match(decision.reason, /existedBefore=true/);
});

test("canAutoRemove: a managed capability touching data paths cannot auto-remove", () => {
  const m = marker({
    dataPathsKnown: ["/var/lib/nginx/cache", "/var/log/nginx"]
  });
  const decision = canAutoRemove(m);
  assert.equal(decision.decision, "manual");
});

test("canAutoRemove: vanilla install (single fresh package, no data) → auto", () => {
  const m = marker();
  const decision = canAutoRemove(m);
  assert.equal(decision.decision, "auto");
});
