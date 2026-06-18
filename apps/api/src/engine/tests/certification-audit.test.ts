/**
 * certification-audit.test.ts — guards the shared 13-section audit.
 *
 * `scripts/check-full-migration-certification.mjs` (the CI gate) and the
 * Phase C readiness scorecard both call `auditCatalogItem`. These probes lock
 * the structural logic so a refactor cannot silently change what "certified"
 * requires. (Full-catalog byte-parity with the previous inline CI script was
 * verified empirically at extraction time; this keeps it from regressing.)
 */
import test from "node:test";
import assert from "node:assert/strict";
import { auditCatalogItem, REQUIREMENT_SECTIONS } from "../../certification-audit.js";
import { nativeRule } from "../../catalog-rules.js";
import type { CatalogItem } from "../../catalog.js";

function wellFormedRule() {
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

function wellFormedItem(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: "acme-widget-daemon",
    kind: "software",
    name: "Acme Widget",
    nameEn: "Acme Widget",
    category: "service",
    summary: "Acme widget daemon",
    summaryEn: "Acme widget daemon",
    sensitivity: "safe",
    installMode: "skip-existing",
    components: [{ type: "software", label: "acme", labelEn: "acme", detail: "apt" }],
    managedActions: ["detect", "install", "config-migrate", "validate", "rollback"],
    supportLevel: "full-migration",
    capabilityKey: "service.acme-widget",
    ...overrides
  } as unknown as CatalogItem;
}

test("a complete item + rule passes all 13 sections (score 100)", () => {
  const res = auditCatalogItem(wellFormedItem(), {
    rule: wellFormedRule(),
    hasScenario: true,
    computeApprovals: () => []
  });
  assert.deepEqual(res.missingRequirements, [], `expected no missing, got ${res.missingRequirements.join(", ")}`);
  assert.equal(res.certificationScore, 100);
  for (const section of REQUIREMENT_SECTIONS) {
    assert.equal(res.sectionResults[section].ok, true, `${section} should pass`);
  }
});

test("a detect-only item with no rule and no scenario fails the expected sections", () => {
  const item = wellFormedItem({ supportLevel: "detect-only", components: [], capabilityKey: "service.acme-widget" });
  const res = auditCatalogItem(item, { rule: undefined, hasScenario: false, computeApprovals: () => [] });
  // No rule → every rule-backed section fails; detect-only → planIntegration; no scenario → harness.
  for (const section of ["detection", "install", "config", "data", "references", "validate", "crossDistro", "planIntegration", "harness"] as const) {
    assert.equal(res.sectionResults[section].ok, false, `${section} should fail`);
  }
  // identity still passes (item has id/key/name/category/summary); rollback passes (managedActions has it).
  assert.equal(res.sectionResults.identity.ok, true);
  assert.equal(res.sectionResults.rollback.ok, true);
  assert.ok(res.certificationScore < 50);
});

test("privileged item requires approval gates for the security section", () => {
  const privileged = wellFormedItem({ sensitivity: "privileged" });
  const rule = wellFormedRule();
  const noGates = auditCatalogItem(privileged, { rule, hasScenario: true, computeApprovals: () => [] });
  assert.equal(noGates.sectionResults.security.ok, false, "privileged + no approvals → security fails");

  const withGates = auditCatalogItem(privileged, { rule, hasScenario: true, computeApprovals: () => [{ id: "ssh-approval" }] });
  assert.equal(withGates.sectionResults.security.ok, true, "privileged + approvals → security passes");
  assert.deepEqual(withGates.missingRequirements, []);
});

test("missingRequirements preserves canonical section order", () => {
  const item = wellFormedItem({ supportLevel: "detect-only", components: [] });
  const res = auditCatalogItem(item, { rule: undefined, hasScenario: false, computeApprovals: () => [] });
  const canonical = REQUIREMENT_SECTIONS.filter((s) => res.missingRequirements.includes(s));
  assert.deepEqual(res.missingRequirements, canonical, "missing list must follow REQUIREMENT_SECTIONS order");
});
