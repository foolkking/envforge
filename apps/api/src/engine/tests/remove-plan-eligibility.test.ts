/**
 * remove-plan-eligibility.test.ts — verifies that the Remove Plan
 * consults ManagedCapabilityRecord markers and refuses to auto-remove
 * packages that existed on the target before EnvForge installed them.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  assessRemoveEligibility,
  buildRemovePlan
} from "../../environment-plan.js";
import type { ManagedCapabilityRecord } from "../../action-runs.js";

function marker(overrides: Partial<ManagedCapabilityRecord> = {}): ManagedCapabilityRecord {
  return {
    id: "mc-1",
    capabilityKey: "web-server.nginx",
    catalogId: "nginx-web-service",
    installedByPlanId: "plan-1",
    installedAt: new Date().toISOString(),
    targetHostId: "conn-1",
    packagesInstalled: [
      { name: "nginx", manager: "apt", existedBefore: false, removableByEnvForge: true }
    ],
    configsTouched: [],
    servicesTouched: [],
    dataPathsKnown: [],
    ...overrides
  };
}

test("assessRemoveEligibility: managed + fresh package routes to autoPackages", () => {
  const out = assessRemoveEligibility(["nginx"], [marker()]);
  assert.equal(out.autoPackages.length, 1);
  assert.equal(out.manualPackages.length, 0);
});

test("assessRemoveEligibility: existedBefore=true → manualPackages", () => {
  const m = marker({
    packagesInstalled: [{ name: "nginx", manager: "apt", existedBefore: true, removableByEnvForge: true }]
  });
  const out = assessRemoveEligibility(["nginx"], [m]);
  assert.equal(out.autoPackages.length, 0);
  assert.equal(out.manualPackages.length, 1);
  assert.match(out.manualPackages[0].reason, /existedBefore=true/);
});

test("assessRemoveEligibility: removableByEnvForge=false → manualPackages", () => {
  const m = marker({
    packagesInstalled: [{ name: "nginx", manager: "apt", existedBefore: false, removableByEnvForge: false }]
  });
  const out = assessRemoveEligibility(["nginx"], [m]);
  assert.equal(out.manualPackages.length, 1);
  assert.match(out.manualPackages[0].reason, /removableByEnvForge=false/);
});

test("assessRemoveEligibility: package without any marker → manual (never installed by EnvForge)", () => {
  const out = assessRemoveEligibility(["openssh-server"], []);
  assert.equal(out.manualPackages.length, 1);
  assert.match(out.manualPackages[0].reason, /no managed marker/);
});

test("assessRemoveEligibility: mixed list — only fresh-managed packages auto", () => {
  const markers: ManagedCapabilityRecord[] = [
    marker({
      id: "mc-A",
      packagesInstalled: [
        { name: "nginx", manager: "apt", existedBefore: false, removableByEnvForge: true },
        { name: "openssl", manager: "apt", existedBefore: true, removableByEnvForge: true }
      ]
    })
  ];
  const out = assessRemoveEligibility(["nginx", "openssl", "curl"], markers);
  assert.deepEqual(
    out.autoPackages.map((p) => p.name),
    ["nginx"]
  );
  assert.deepEqual(
    out.manualPackages.map((p) => p.name).sort(),
    ["curl", "openssl"]
  );
});

// ───────────────────────────────────────────────────────────────────
// buildRemovePlan integration
// ───────────────────────────────────────────────────────────────────

test("buildRemovePlan: package with existedBefore=true triggers blockedUntilApproved on remove action", () => {
  const m = marker({
    packagesInstalled: [{ name: "nginx", manager: "apt", existedBefore: true, removableByEnvForge: true }]
  });
  const plan = buildRemovePlan({
    targetConnectionId: "conn-1",
    packages: ["nginx"],
    source: "apt",
    managedByEnvForge: true,
    managedMarkers: [m]
  });
  const removeAction = plan.items[0].actions.find((a) => a.id === "remove-packages");
  assert.ok(removeAction);
  assert.equal(removeAction?.blockedUntilApproved, true);
  // The plan review reasons must mention the manual-confirm requirement.
  assert.ok(
    plan.review.reasons.some((r) => /existed before/.test(r) || /manual confirmation/.test(r)),
    `expected review.reasons to mention manual confirmation; got: ${plan.review.reasons.join(" / ")}`
  );
});

test("buildRemovePlan: unmanaged package (no marker at all) triggers blockedUntilApproved", () => {
  const plan = buildRemovePlan({
    targetConnectionId: "conn-1",
    packages: ["nginx"],
    source: "apt",
    managedByEnvForge: false,
    managedMarkers: []
  });
  const removeAction = plan.items[0].actions.find((a) => a.id === "remove-packages");
  assert.equal(removeAction?.blockedUntilApproved, true);
});

test("buildRemovePlan: managed + fresh package does NOT block (auto-remove eligible)", () => {
  const m = marker();
  const plan = buildRemovePlan({
    targetConnectionId: "conn-1",
    packages: ["nginx"],
    source: "apt",
    managedByEnvForge: true,
    managedMarkers: [m]
  });
  const removeAction = plan.items[0].actions.find((a) => a.id === "remove-packages");
  assert.equal(removeAction?.blockedUntilApproved, false);
});

test("buildRemovePlan: evidence string lists auto vs manual packages", () => {
  const m = marker({
    packagesInstalled: [
      { name: "nginx", manager: "apt", existedBefore: false, removableByEnvForge: true },
      { name: "openssl", manager: "apt", existedBefore: true, removableByEnvForge: true }
    ]
  });
  const plan = buildRemovePlan({
    targetConnectionId: "conn-1",
    packages: ["nginx", "openssl"],
    source: "apt",
    managedByEnvForge: true,
    managedMarkers: [m]
  });
  const evidenceText = plan.items[0].evidence.join(" / ");
  assert.match(evidenceText, /Auto-remove eligible: nginx/);
  assert.match(evidenceText, /Manual confirmation required: openssl/);
});
