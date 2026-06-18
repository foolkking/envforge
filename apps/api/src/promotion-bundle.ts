/**
 * promotion-bundle.ts — turn a runtime detection rule into a PR-ready bundle.
 *
 * Phase C2. A UI-authored runtime detection rule (Phase B2) can extend migrate
 * detection but never certify. To graduate it to a Full Migration certified,
 * user-visible capability a developer must land several artifacts in code +
 * harness + opt-in and pass `certification:check`. This module generates those
 * artifacts as TEXT — the API never writes the source tree. The admin/dev
 * copies or downloads each file, fills the gaps the readiness scorecard flags,
 * runs the gate, and opens a PR. Certification still happens on merge via CI;
 * runtime never auto-certifies.
 */

import type { CatalogRuleOverride } from "./runtime-store.js";
import { overrideReadiness } from "./certification-readiness.js";
import type { ItemAuditResult } from "./certification-audit.js";

export interface PromotionBundleFile {
  /** Repo-relative target path. */
  path: string;
  language: "typescript" | "json";
  /** "create" = new file; "edit" = paste into / merge with an existing file. */
  action: "create" | "edit";
  /** Short human label for the modal. */
  title: string;
  contents: string;
}

export interface PromotionBundle {
  id: string;
  capabilityKey: string;
  readiness: ItemAuditResult;
  files: PromotionBundleFile[];
  instructions: string[];
}

const q = (value: string): string => JSON.stringify(value);

export function buildPromotionBundle(override: CatalogRuleOverride): PromotionBundle {
  const rule = override.rule;
  const id = rule.id;
  const capabilityKey = rule.capabilityKey;
  const displayName = rule.displayName || id;
  const category = rule.category;
  const risk = rule.security?.risk ?? "review";
  const factory = override.archetype === "docker-app" ? "dockerAppRule" : "nativeRule";
  const readiness = overrideReadiness(override);

  // 1) Static detection rule — what the certification audit reads.
  const ruleFile: PromotionBundleFile = {
    path: "apps/api/src/catalog-rules.ts",
    language: "typescript",
    action: "edit",
    title: `Detection rule (${factory})`,
    contents:
      `// Add to a catalog-rules.ts batch array — this becomes the STATIC rule the\n` +
      `// certification audit reads (the runtime override does not certify).\n` +
      `${factory}(${JSON.stringify(override.input, null, 2)}),`
  };

  // 2) Catalog item literal — the certified, user-visible card.
  const itemFile: PromotionBundleFile = {
    path: "apps/api/src/catalog.ts",
    language: "typescript",
    action: "edit",
    title: "Catalog item literal",
    contents:
      `// Add to getNewSoftwareCatalog() in catalog.ts. Fill the TODO fields —\n` +
      `// install components and a rollback action are required to certify.\n` +
      `{\n` +
      `  id: ${q(id)},\n` +
      `  kind: "software",\n` +
      `  name: ${q(displayName)},\n` +
      `  nameEn: ${q(displayName)},\n` +
      `  category: ${q(category)},\n` +
      `  summary: ${q(`TODO: one-line summary for ${displayName}`)},\n` +
      `  summaryEn: ${q(`TODO: one-line summary for ${displayName}`)},\n` +
      `  rating: 4.5,\n` +
      `  installs: "0",\n` +
      `  imageTone: "slate",\n` +
      `  sensitivity: ${q(risk)},\n` +
      `  assets: [],\n` +
      `  guidePath: ${q(`configs/catalog/software/${id}.md`)},\n` +
      `  guideAuthor: "admin",\n` +
      `  installMode: "skip-existing",\n` +
      `  components: [\n` +
      `    // TODO: at least one component is required for the install section.\n` +
      `    { type: "software", label: ${q(id)}, labelEn: ${q(id)}, detail: "apt" }\n` +
      `  ],\n` +
      `  capabilityKey: ${q(capabilityKey)},\n` +
      `  supportLevel: "full-migration",\n` +
      `  managedActions: ["detect", "install", "config-migrate", "validate", "rollback"],\n` +
      `  compatibility: { families: ["debian-family", "rhel-family"] }\n` +
      `},`
  };

  // 3) capabilityKey + support-level registry.
  const dbFile: PromotionBundleFile = {
    path: "apps/api/src/database.ts",
    language: "typescript",
    action: "edit",
    title: "capabilityKey + support registry",
    contents:
      `// 1) Add to the catalogCapabilityKeys map:\n` +
      `${q(id)}: ${q(capabilityKey)},\n\n` +
      `// 2) Add to the capabilitySupport map:\n` +
      `${q(capabilityKey)}: { supportLevel: "full-migration", security: { risk: ${q(risk)} } },`
  };

  // 4) Certification opt-in.
  const optInFile: PromotionBundleFile = {
    path: "apps/api/src/catalog-certification.ts",
    language: "typescript",
    action: "edit",
    title: "CERTIFIED_OPT_IN entry",
    contents: `// Add this id to the CERTIFIED_OPT_IN set:\n${q(id)},`
  };

  // 5) Harness scenario scaffold.
  const scenario = {
    id: `build-${id}-success`,
    title: `Build ${displayName} — happy path`,
    destructive: false,
    planSource: { kind: "capability-selection", capabilityIds: [id] },
    expected: {
      planType: "rebuild",
      items: [{ id: `capability:${id}`, capabilityKey, supportLevel: "full-migration", minActions: 1 }],
      conflictsBlock: 0,
      conflictsWarn: 0,
      approvalsRequired: [],
      remainingRisks: []
    },
    approvalAcks: { risksAck: "ALL" },
    verify: { actionRunStatuses: ["succeeded"], managedCapabilityKeys: [capabilityKey] }
  };
  const scenarioFile: PromotionBundleFile = {
    path: `scripts/harness/scenarios/build-${id}-success.json`,
    language: "json",
    action: "create",
    title: "Harness scenario",
    contents: JSON.stringify(scenario, null, 2)
  };

  const gaps = readiness.missingRequirements.length
    ? readiness.missingRequirements.join(", ")
    : "(none — structural sections already satisfied)";

  const instructions = [
    `Paste the detection rule into a batch array in apps/api/src/catalog-rules.ts (the static export the audit reads).`,
    `Add the catalog item literal to getNewSoftwareCatalog() in apps/api/src/catalog.ts and fill every TODO.`,
    `Register the capabilityKey + support level in apps/api/src/database.ts (catalogCapabilityKeys + capabilitySupport).`,
    `Add ${q(id)} to CERTIFIED_OPT_IN in apps/api/src/catalog-certification.ts.`,
    `Create scripts/harness/scenarios/build-${id}-success.json; tune minActions / remainingRisks to match the real plan.`,
    `Close the readiness gaps: ${gaps}.`,
    `Run: npm run certification:check — confirm ${q(id)} is listed as certified with no missing requirements.`,
    `Run: npm run harness:scenarios — confirm the new scenario passes.`,
    `Open a PR. After it merges, delete this runtime detection-rule override; the static rule supersedes it.`
  ];

  return {
    id,
    capabilityKey,
    readiness,
    files: [ruleFile, itemFile, dbFile, optInFile, scenarioFile],
    instructions
  };
}
