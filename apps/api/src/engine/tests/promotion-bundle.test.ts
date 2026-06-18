/**
 * promotion-bundle.test.ts — Phase C2/C3 readiness + bundle generation.
 *
 * Pure-function coverage (no DB): proves a runtime detection rule's readiness
 * audit flags the real promotion gaps, and that the generated bundle carries
 * every artifact a developer must land (static rule, catalog item, registry
 * edits, opt-in line, harness scenario) wired to the right capability id/key.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { nativeRule } from "../../catalog-rules.js";
import { buildPromotionBundle } from "../../promotion-bundle.js";
import { ruleReadiness } from "../../certification-readiness.js";
import type { CatalogRuleOverride } from "../../runtime-store.js";

function sampleOverride(): CatalogRuleOverride {
  const input = {
    id: "acme-widget-daemon",
    displayName: "Acme Widget Daemon",
    capabilityKey: "service.acme-widget",
    category: "service",
    detect: { packages: { apt: ["acme-widget"] }, binaries: ["acme-widgetd"] },
    configFiles: ["/etc/acme/widget.conf"],
    references: [{ pattern: "include", type: "configInclude" }],
    migrationCompleteness: { configOnly: "partial", missingRisks: [] },
    security: { risk: "review", notes: [] },
    crossDistro: { packageMap: { apt: ["acme-widget"], dnf: ["acme-widget"] }, serviceMap: { debian: ["acme-widget"], rhel: ["acme-widget"] } },
    migrate: { data: "optional", strategy: "manual-review", validate: ["systemctl is-active acme-widget"] }
  };
  const rule = nativeRule(input as Parameters<typeof nativeRule>[0]);
  return { id: rule.id, archetype: "native", input, rule, createdAt: "", updatedAt: "", modifiedBy: "test" };
}

test("ruleReadiness: rule-backed sections pass; install/rollback/harness flagged as gaps", () => {
  const o = sampleOverride();
  const r = ruleReadiness(o.rule, o.input);
  // The detection rule provides these:
  assert.equal(r.sectionResults.detection.ok, true);
  assert.equal(r.sectionResults.config.ok, true);
  assert.equal(r.sectionResults.references.ok, true);
  assert.equal(r.sectionResults.crossDistro.ok, true);
  assert.equal(r.sectionResults.validate.ok, true);
  // The rule cannot provide these — they are the real promotion gaps:
  assert.equal(r.sectionResults.harness.ok, false, "runtime rules never have a committed scenario");
  assert.equal(r.sectionResults.install.ok, false, "no catalog components");
  assert.equal(r.sectionResults.rollback.ok, false, "no managedActions/rollback");
});

test("buildPromotionBundle: emits the five artifacts wired to the right id/key", () => {
  const bundle = buildPromotionBundle(sampleOverride());
  const paths = bundle.files.map((f) => f.path);
  assert.ok(paths.includes("apps/api/src/catalog-rules.ts"));
  assert.ok(paths.includes("apps/api/src/catalog.ts"));
  assert.ok(paths.includes("apps/api/src/database.ts"));
  assert.ok(paths.includes("apps/api/src/catalog-certification.ts"));
  assert.ok(paths.some((p) => p.startsWith("scripts/harness/scenarios/") && p.endsWith(".json")));

  const optIn = bundle.files.find((f) => f.path.endsWith("catalog-certification.ts"));
  assert.ok(optIn?.contents.includes("acme-widget-daemon"), "opt-in artifact adds the id");

  const scenario = bundle.files.find((f) => f.language === "json");
  assert.ok(scenario, "a harness scenario file is present");
  const parsed = JSON.parse(scenario!.contents);
  assert.deepEqual(parsed.planSource.capabilityIds, ["acme-widget-daemon"]);
  assert.equal(parsed.expected.items[0].capabilityKey, "service.acme-widget");
  assert.equal(parsed.verify.managedCapabilityKeys[0], "service.acme-widget");

  assert.equal(typeof bundle.readiness.certificationScore, "number");
  assert.ok(bundle.instructions.length >= 5, "instructions guide the developer through the gate");
});
