/**
 * catalog-rule-store.ts — runtime detection-rule overlay store (Phase B2).
 *
 * UI-authored detection rules live in the runtime DB (`catalogRuleOverrides`)
 * and are loaded into the catalog-rules in-memory overlay so migrate
 * detection/classification can recognize more source-host software.
 *
 * Hard guardrail: these rules extend DETECTION ONLY. They never enter Build
 * certification — `deriveCertification` and the CI certification audit read
 * the static `catalogDetectionRules` export, not the merged view, and a
 * runtime rule may not reuse a baseline rule's id or capabilityKey (so it
 * cannot hijack a certified capability's detection semantics).
 */
import { readRuntimeDatabase, updateRuntimeDatabase, type CatalogRuleOverride, type RulePromotionState } from "./runtime-store.js";
import { catalogDetectionRules, setRuntimeDetectionRules, type CatalogDetectionRule } from "./catalog-rules.js";

const STATIC_RULE_IDS = new Set(catalogDetectionRules.map((rule) => rule.id));
const STATIC_RULE_CAPKEYS = new Set(catalogDetectionRules.map((rule) => rule.capabilityKey));

/** Read overrides from the DB and refresh the catalog-rules detection overlay. */
export async function loadRuntimeDetectionRules(): Promise<void> {
  await reconcilePromotions();
  const db = await readRuntimeDatabase();
  // Certified (merged) overrides are superseded by the now-static rule; drop
  // them from the detection overlay so the merged view never double-detects.
  const active = (db.catalogRuleOverrides ?? []).filter((override) => override.promotion?.status !== "certified");
  setRuntimeDetectionRules(active.map((override) => override.rule));
}

export async function listRuleOverrides(): Promise<CatalogRuleOverride[]> {
  return (await readRuntimeDatabase()).catalogRuleOverrides ?? [];
}

export async function getRuleOverride(id: string): Promise<CatalogRuleOverride | undefined> {
  return (await listRuleOverrides()).find((override) => override.id === id);
}

/**
 * Reasons a generated rule may not be persisted as a runtime override.
 * Returns null when the rule is acceptable.
 */
export function ruleOverrideRejectionReason(rule: CatalogDetectionRule, existingId?: string): string | null {
  if (STATIC_RULE_IDS.has(rule.id)) {
    return `rule id "${rule.id}" is owned by the certified baseline and cannot be overridden at runtime`;
  }
  if (STATIC_RULE_CAPKEYS.has(rule.capabilityKey)) {
    return `capabilityKey "${rule.capabilityKey}" belongs to a certified baseline rule; pick a distinct key`;
  }
  // id is the override key; on create it must be unique among existing overrides.
  return existingId && existingId !== rule.id ? `rule id "${rule.id}" does not match the edited override id` : null;
}

export async function saveRuleOverride(params: {
  archetype: CatalogRuleOverride["archetype"];
  input: Record<string, unknown>;
  rule: CatalogDetectionRule;
  modifiedBy: string;
  /** When set, update the existing override with this id instead of creating. */
  existingId?: string;
}): Promise<CatalogRuleOverride> {
  const now = new Date().toISOString();
  const saved = await updateRuntimeDatabase((db) => {
    if (!db.catalogRuleOverrides) db.catalogRuleOverrides = [];
    const idx = db.catalogRuleOverrides.findIndex((o) => o.id === (params.existingId ?? params.rule.id));
    if (idx >= 0) {
      const prev = db.catalogRuleOverrides[idx];
      const next: CatalogRuleOverride = {
        ...prev,
        id: params.rule.id,
        archetype: params.archetype,
        input: params.input,
        rule: params.rule,
        updatedAt: now,
        modifiedBy: params.modifiedBy
      };
      db.catalogRuleOverrides[idx] = next;
      return next;
    }
    const created: CatalogRuleOverride = {
      id: params.rule.id,
      archetype: params.archetype,
      input: params.input,
      rule: params.rule,
      createdAt: now,
      updatedAt: now,
      modifiedBy: params.modifiedBy
    };
    db.catalogRuleOverrides.push(created);
    return created;
  });
  await loadRuntimeDetectionRules();
  return saved;
}

export async function deleteRuleOverride(id: string): Promise<boolean> {
  const removed = await updateRuntimeDatabase((db) => {
    const before = db.catalogRuleOverrides?.length ?? 0;
    if (db.catalogRuleOverrides) {
      db.catalogRuleOverrides = db.catalogRuleOverrides.filter((o) => o.id !== id);
    }
    return before !== (db.catalogRuleOverrides?.length ?? 0);
  });
  await loadRuntimeDetectionRules();
  return removed;
}

/**
 * Advance / patch a runtime rule's promotion lifecycle (Phase C3). `status:
 * "certified"` is intentionally NOT settable here — only `reconcilePromotions`
 * may grant it, and only after the rule lands in the static baseline. This is
 * what keeps "runtime never self-certifies" true.
 */
export async function setPromotionState(
  id: string,
  patch: Partial<RulePromotionState>
): Promise<CatalogRuleOverride | undefined> {
  return updateRuntimeDatabase((db) => {
    const override = (db.catalogRuleOverrides ?? []).find((o) => o.id === id);
    if (!override) return undefined;
    const prev: RulePromotionState = override.promotion ?? { status: "detection-only" };
    override.promotion = { ...prev, ...patch, updatedAt: new Date().toISOString() };
    return override;
  });
}

/**
 * Flip any override whose rule has landed in the static baseline (matching id
 * or capabilityKey ⇒ the promotion PR merged) to `certified`. This is the ONLY
 * path to the certified status; manual callers cannot set it.
 */
export async function reconcilePromotions(): Promise<void> {
  await updateRuntimeDatabase((db) => {
    let changed = false;
    for (const override of db.catalogRuleOverrides ?? []) {
      const landed = STATIC_RULE_IDS.has(override.id) || STATIC_RULE_CAPKEYS.has(override.rule.capabilityKey);
      if (landed && override.promotion?.status !== "certified") {
        override.promotion = {
          ...(override.promotion ?? { status: "detection-only" }),
          status: "certified",
          updatedAt: new Date().toISOString()
        };
        changed = true;
      }
    }
    return changed;
  });
}
