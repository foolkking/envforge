/**
 * certification-readiness.ts — live "how close to certified?" scorecard.
 *
 * A UI-authored runtime detection rule (Phase B2) has no catalog ITEM, so it
 * cannot be audited directly. This module synthesizes a DRAFT catalog item
 * from the rule (+ the archetype input the drawer captured) and runs the
 * shared 13-section audit (`certification-audit.ts`) against it.
 *
 * The result is diagnostic only: it tells an admin which structural sections
 * the rule already satisfies (detection, config, references, crossDistro,
 * validate, data) and which still need work before promotion (install
 * components, a rollback action, a harness scenario, approval gates). It NEVER
 * certifies anything — `hasScenario` is always false here, and certification
 * still flows through code + harness + opt-in + `certification:check`.
 */

import type { CatalogItem } from "./catalog.js";
import type { CatalogDetectionRule } from "./catalog-rules.js";
import type { CatalogRuleOverride } from "./runtime-store.js";
import { computeRequiredApprovalsForCatalogItem } from "./environment-plan.js";
import { auditCatalogItem, type ItemAuditResult } from "./certification-audit.js";

/**
 * Build a draft `CatalogItem` from a detection rule. Fields the rule inherently
 * carries (identity, capabilityKey, category, security risk, support level) are
 * mapped through; fields a certified catalog item needs but a detection rule
 * does not provide (install components, managedActions/rollback) are left empty
 * on purpose so the audit surfaces them as the real promotion gaps.
 */
export function draftItemFromRule(rule: CatalogDetectionRule, input: Record<string, unknown> = {}): CatalogItem {
  const components = Array.isArray(input.components) ? (input.components as CatalogItem["components"]) : [];
  const managedActions = Array.isArray(input.managedActions)
    ? (input.managedActions as NonNullable<CatalogItem["managedActions"]>)
    : [];
  const installMode = input.installMode === "replace-existing" ? "replace-existing" : "skip-existing";
  return {
    id: rule.id,
    kind: "software",
    name: rule.displayName,
    nameEn: rule.displayName,
    category: rule.category,
    // Seed the summary from the display name; promotion can refine it. This
    // keeps `identity` from flagging a field the rule implicitly carries.
    summary: rule.displayName,
    summaryEn: rule.displayName,
    rating: 0,
    installs: "",
    imageTone: "",
    sensitivity: rule.security?.risk ?? "review",
    assets: [],
    guidePath: "",
    guideAuthor: "admin",
    installMode,
    components,
    capabilityKey: rule.capabilityKey,
    supportLevel: rule.supportLevel ?? "full-migration",
    managedActions
  } as CatalogItem;
}

/** Audit a rule's draft item. `hasScenario` is always false for runtime rules. */
export function ruleReadiness(rule: CatalogDetectionRule, input: Record<string, unknown> = {}): ItemAuditResult {
  const item = draftItemFromRule(rule, input);
  return auditCatalogItem(item, {
    rule,
    hasScenario: false,
    computeApprovals: (it) => computeRequiredApprovalsForCatalogItem(`readiness:${it.id}`, it)
  });
}

/** Convenience: readiness for a persisted runtime override. */
export function overrideReadiness(override: CatalogRuleOverride): ItemAuditResult {
  return ruleReadiness(override.rule, (override.input ?? {}) as Record<string, unknown>);
}
