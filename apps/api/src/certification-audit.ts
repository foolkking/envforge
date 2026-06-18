/**
 * certification-audit.ts — the 13-section Full Migration audit, shared.
 *
 * This is the SINGLE source of truth for "what Full Migration Certified
 * requires". Two consumers run identical logic:
 *
 *   1. `scripts/check-full-migration-certification.mjs` (CI gate) — imports
 *      the compiled `dist/certification-audit.js`, feeds every catalog item,
 *      and fails the build on any drift between certified status and the
 *      structural checks.
 *   2. The live readiness scorecard (Phase C) — synthesizes a draft catalog
 *      item from a UI-authored runtime detection rule and reports which of
 *      the 13 sections still fail, so an admin knows exactly what is missing
 *      before a capability can be promoted to certified.
 *
 * The three ambient dependencies the CI script used to close over are
 * injected via `AuditContext`:
 *   - `rule`            — the detection rule for the item's capabilityKey
 *                         (was `rulesByCapKey.get(item.capabilityKey)`).
 *   - `hasScenario`     — whether a harness scenario references the item id
 *                         (was `scenarioCoverage.has(item.id)`).
 *   - `computeApprovals`— approval-gate introspection for privileged items
 *                         (was `computeRequiredApprovalsForCatalogItem`).
 *
 * NOTE: this module deliberately does NOT own `CERTIFIED_OPT_IN`, the
 * opt-in/blocker logic, `DECISION_OVERRIDES`, scoring of decision status,
 * or the markdown report — those stay in their existing homes
 * (`catalog-certification.ts` and the CI script). This module only answers
 * the structural question "which of the 13 sections pass for this item?".
 */

import type { CatalogItem } from "./catalog.js";
import type { CatalogDetectionRule } from "./catalog-rules.js";

export const REQUIREMENT_SECTIONS = [
  "identity",
  "detection",
  "install",
  "config",
  "data",
  "references",
  "validate",
  "rollback",
  "security",
  "crossDistro",
  "conflicts",
  "planIntegration",
  "harness"
] as const;

export type RequirementSection = (typeof REQUIREMENT_SECTIONS)[number];

export interface SectionResult {
  ok: boolean;
  reasons: string[];
}

export interface AuditContext {
  /** Detection rule registered for `item.capabilityKey`, if any. */
  rule?: CatalogDetectionRule;
  /** True when a harness scenario references this catalog id. */
  hasScenario: boolean;
  /**
   * Returns the approval gates required for the (privileged) item.
   * Injected so this module needs no dependency on environment-plan.
   */
  computeApprovals: (item: CatalogItem) => unknown[];
}

export interface ItemAuditResult {
  sectionResults: Record<RequirementSection, SectionResult>;
  missingRequirements: RequirementSection[];
  certificationScore: number;
}

function ok(): SectionResult {
  return { ok: true, reasons: [] };
}
function fail(...reasons: string[]): SectionResult {
  return { ok: false, reasons };
}

/**
 * `item.audit?.supportLevel ?? item.supportLevel`. The audit record may carry
 * a `supportLevel` at runtime that the static `CatalogItem["audit"]` type does
 * not enumerate; read it through a narrow cast so behavior matches the legacy
 * untyped CI script exactly.
 */
function effectiveSupportLevel(item: CatalogItem): string | undefined {
  return (item.audit as { supportLevel?: string } | undefined)?.supportLevel ?? item.supportLevel;
}

function checkIdentity(item: CatalogItem): SectionResult {
  const reasons: string[] = [];
  if (!item.id) reasons.push("missing id");
  if (!item.capabilityKey) reasons.push("missing capabilityKey");
  if (!item.name) reasons.push("missing name");
  if (!item.category) reasons.push("missing category");
  if (!item.summary && !item.summaryEn) reasons.push("missing summary/description");
  return reasons.length === 0 ? ok() : fail(...reasons);
}

function checkDetection(_item: CatalogItem, ctx: AuditContext): SectionResult {
  const rule = ctx.rule;
  if (!rule) return fail("no detection rule registered for this capabilityKey");
  const detect = (rule.detect ?? {}) as Record<string, unknown>;
  const config = (rule.config ?? {}) as Record<string, unknown>;
  const signals = [
    detect.packages,
    detect.binaries,
    detect.systemd,
    detect.ports,
    detect.processes,
    detect.containers,
    config.files,
    config.globs
  ].filter((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v) && Object.keys(v as object).length > 0));
  if (signals.length === 0) return fail("rule lists no packages/binaries/systemd/ports/processes/containers/configFiles");
  return ok();
}

function checkInstall(item: CatalogItem, ctx: AuditContext): SectionResult {
  const rule = ctx.rule;
  if (!rule) return fail("no catalog rule (install.packageMap requires one)");
  const pm = rule.crossDistro?.packageMap ?? {};
  const reasons: string[] = [];
  if (!pm.apt) reasons.push("install.packageMap.apt missing");
  if (!pm.dnf) reasons.push("install.packageMap.dnf missing");
  if ((item.components ?? []).length === 0) reasons.push("install.actions: catalog item has no components");
  if (!item.installMode) reasons.push("install.idempotency: installMode missing");
  return reasons.length === 0 ? ok() : fail(...reasons);
}

function checkConfig(_item: CatalogItem, ctx: AuditContext): SectionResult {
  const rule = ctx.rule;
  if (!rule) return fail("no catalog rule");
  const reasons: string[] = [];
  const files = rule.config?.files ?? [];
  const globs = rule.config?.globs ?? [];
  if (files.length === 0 && globs.length === 0) {
    reasons.push("config.files: rule has no config.files / config.globs");
  }
  const validate = rule.migrate?.validate ?? [];
  if (validate.length === 0) reasons.push("config.validation: migrate.validate is empty");
  return reasons.length === 0 ? ok() : fail(...reasons);
}

function checkData(_item: CatalogItem, ctx: AuditContext): SectionResult {
  const rule = ctx.rule;
  if (!rule) return fail("no catalog rule");
  const strategy = rule.migrate?.strategy;
  // `data` is widened to string: the legacy audit compares against
  // "required", a value outside the current union (so this guard is a
  // defence-in-depth no-op today). Kept verbatim for byte-parity with CI.
  const data = rule.migrate?.data as string | undefined;
  if (!strategy) return fail("data.strategy: missing migrate.strategy");
  if (data === "required" && strategy === "template-or-copy") {
    return fail(`data.strategy: capability requires data but strategy=${strategy}; expected dump-restore / official-backup-restore / manual / blocked`);
  }
  return ok();
}

function checkReferences(_item: CatalogItem, ctx: AuditContext): SectionResult {
  const rule = ctx.rule;
  if (!rule) return fail("no catalog rule");
  if (!Array.isArray(rule.references) || rule.references.length === 0) {
    return fail("references graph is empty (configIncludes / serviceDependencies / secretFiles / filesystemPaths)");
  }
  return ok();
}

function checkValidate(_item: CatalogItem, ctx: AuditContext): SectionResult {
  const rule = ctx.rule;
  if (!rule) return fail("no catalog rule");
  const validate = rule.migrate?.validate ?? [];
  if (validate.length === 0) return fail("validate.config: migrate.validate is empty");
  return ok();
}

function checkRollback(item: CatalogItem): SectionResult {
  const reasons: string[] = [];
  const actions = item.managedActions ?? [];
  if (!actions.includes("rollback")) reasons.push("rollback: managedActions does not include rollback");
  return reasons.length === 0 ? ok() : fail(...reasons);
}

function checkSecurity(item: CatalogItem, ctx: AuditContext): SectionResult {
  const reasons: string[] = [];
  if (!item.sensitivity) reasons.push("security.riskLevel: sensitivity missing");
  if (item.sensitivity === "privileged") {
    const approvals = ctx.computeApprovals(item);
    if (!Array.isArray(approvals) || approvals.length === 0) {
      reasons.push("security.requiredApprovals: privileged capability has no approval gates");
    }
  }
  return reasons.length === 0 ? ok() : fail(...reasons);
}

function checkCrossDistro(_item: CatalogItem, ctx: AuditContext): SectionResult {
  const rule = ctx.rule;
  if (!rule) return fail("no catalog rule");
  const reasons: string[] = [];
  if (!rule.crossDistro?.packageMap?.apt) reasons.push("crossDistro.packageMap.apt missing");
  if (!rule.crossDistro?.packageMap?.dnf) reasons.push("crossDistro.packageMap.dnf missing");
  if (!rule.crossDistro?.serviceMap) reasons.push("crossDistro.serviceMap missing");
  return reasons.length === 0 ? ok() : fail(...reasons);
}

function checkConflicts(_item: CatalogItem): SectionResult {
  // Conflict families are owned by catalog-conflicts.ts; trust the registry.
  return ok();
}

function checkPlanIntegration(item: CatalogItem): SectionResult {
  if (effectiveSupportLevel(item) === "detect-only") {
    return fail("planIntegration: detect-only items emit review-only actions; not user-applicable");
  }
  return ok();
}

function checkHarness(_item: CatalogItem, ctx: AuditContext): SectionResult {
  if (!ctx.hasScenario) {
    return fail("harness.scenario: no scripts/harness/scenarios/*.json references this catalog id");
  }
  return ok();
}

/**
 * Run all 13 structural checks for a single catalog item. The caller owns
 * opt-in / decision-override / certification-status logic; this returns only
 * the per-section results, the missing sections, and an equal-weight score.
 */
export function auditCatalogItem(item: CatalogItem, ctx: AuditContext): ItemAuditResult {
  const sectionResults: Record<RequirementSection, SectionResult> = {
    identity: checkIdentity(item),
    detection: checkDetection(item, ctx),
    install: checkInstall(item, ctx),
    config: checkConfig(item, ctx),
    data: checkData(item, ctx),
    references: checkReferences(item, ctx),
    validate: checkValidate(item, ctx),
    rollback: checkRollback(item),
    security: checkSecurity(item, ctx),
    crossDistro: checkCrossDistro(item, ctx),
    conflicts: checkConflicts(item),
    planIntegration: checkPlanIntegration(item),
    harness: checkHarness(item, ctx)
  };

  const missingRequirements = REQUIREMENT_SECTIONS.filter((section) => !sectionResults[section].ok);
  const passed = REQUIREMENT_SECTIONS.length - missingRequirements.length;
  const certificationScore = Math.round((passed / REQUIREMENT_SECTIONS.length) * 100);

  return { sectionResults, missingRequirements, certificationScore };
}
