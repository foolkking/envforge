/**
 * catalog-runtime-rules.test.ts — Phase B2 guardrail.
 *
 * Proves the core invariant of the runtime detection-rule overlay:
 *   1. A UI-authored runtime rule EXTENDS detection (findRuleForPackage /
 *      getDetectionRules see it).
 *   2. It NEVER extends certification: the static `catalogDetectionRules`
 *      export is unchanged, and a capability backed only by a runtime rule
 *      stays not-ready / not user-visible.
 *   3. A runtime rule may not reuse a baseline rule's id or capabilityKey.
 *
 * The overlay is process-local module state; the test sets and clears it
 * directly so it needs no DB.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  catalogDetectionRules,
  getDetectionRules,
  setRuntimeDetectionRules,
  findRuleForPackage,
  nativeRule
} from "../../catalog-rules.js";
import { ruleOverrideRejectionReason } from "../../catalog-rule-store.js";
import { deriveCertification } from "../../catalog-certification.js";
import type { CatalogItem } from "../../catalog.js";

function makeRuntimeRule() {
  return nativeRule({
    id: "acme-widget-daemon",
    displayName: "Acme Widget Daemon",
    capabilityKey: "service.acme-widget",
    category: "service",
    detect: { packages: { apt: ["acme-widget"] }, binaries: ["acme-widgetd"], systemd: ["acme-widget.service"], ports: [9999] },
    configFiles: ["/etc/acme/widget.conf"],
    references: [{ pattern: "include", type: "configInclude" }],
    migrationCompleteness: { configOnly: "partial", missingRisks: ["widget state"] },
    security: { risk: "review", notes: ["custom service"] },
    crossDistro: { packageMap: { apt: ["acme-widget"], dnf: ["acme-widget"] }, serviceMap: { debian: ["acme-widget"], rhel: ["acme-widget"] } },
    migrate: { data: "optional", strategy: "manual-review", restartServices: ["acme-widget"], validate: ["systemctl is-active acme-widget"] }
  });
}

test("runtime rule extends detection but not the static baseline", () => {
  const staticCount = catalogDetectionRules.length;
  assert.equal(findRuleForPackage("acme-widget"), undefined, "precondition: unknown before overlay");
  try {
    setRuntimeDetectionRules([makeRuntimeRule()]);
    // (1) detection sees it through the merged view
    assert.equal(getDetectionRules().length, staticCount + 1);
    const found = findRuleForPackage("acme-widget");
    assert.ok(found, "runtime rule should be found by package");
    assert.equal(found?.capabilityKey, "service.acme-widget");
    // (2) the static export is untouched — certification audit reads THIS
    assert.equal(catalogDetectionRules.length, staticCount, "static baseline must not grow");
    assert.ok(!catalogDetectionRules.some((r) => r.id === "acme-widget-daemon"));
  } finally {
    setRuntimeDetectionRules([]);
  }
  assert.equal(findRuleForPackage("acme-widget"), undefined, "overlay cleared");
});

test("a capability backed only by a runtime rule never certifies", () => {
  // deriveCertification consumes the catalog ITEM + CERTIFIED_OPT_IN, never
  // the rule overlay. An item not in the opt-in list stays not-ready even
  // while a matching runtime detection rule is active.
  try {
    setRuntimeDetectionRules([makeRuntimeRule()]);
    const item = {
      id: "acme-widget-daemon",
      capabilityKey: "service.acme-widget",
      category: "service",
      sensitivity: "safe",
      supportLevel: "full-migration"
    } as unknown as CatalogItem;
    const cert = deriveCertification(item);
    assert.equal(cert.status, "not-ready", "runtime-only capability must not be certified");
    assert.equal(cert.visibleToUsers, false, "runtime-only capability must not be user-visible in Build");
  } finally {
    setRuntimeDetectionRules([]);
  }
});

test("runtime rule may not reuse a baseline id or capabilityKey", () => {
  const baseline = catalogDetectionRules[0];
  const collidingId = nativeRule({
    id: baseline.id,
    displayName: "x",
    capabilityKey: "service.unique-key-xyz",
    category: "service",
    detect: { binaries: ["x"] },
    references: [{ pattern: "x", type: "configInclude" }],
    migrationCompleteness: { configOnly: "partial", missingRisks: [] },
    security: { risk: "safe", notes: [] },
    crossDistro: { packageMap: { apt: ["x"], dnf: ["x"] }, serviceMap: { debian: [], rhel: [] } },
    migrate: { data: "none", strategy: "manual-review", validate: ["true"] }
  });
  assert.ok(ruleOverrideRejectionReason(collidingId), "duplicate baseline id must be rejected");

  const collidingKey = nativeRule({
    id: "totally-unique-id-xyz",
    displayName: "x",
    capabilityKey: baseline.capabilityKey,
    category: "service",
    detect: { binaries: ["x"] },
    references: [{ pattern: "x", type: "configInclude" }],
    migrationCompleteness: { configOnly: "partial", missingRisks: [] },
    security: { risk: "safe", notes: [] },
    crossDistro: { packageMap: { apt: ["x"], dnf: ["x"] }, serviceMap: { debian: [], rhel: [] } },
    migrate: { data: "none", strategy: "manual-review", validate: ["true"] }
  });
  assert.ok(ruleOverrideRejectionReason(collidingKey), "duplicate baseline capabilityKey must be rejected");
});
