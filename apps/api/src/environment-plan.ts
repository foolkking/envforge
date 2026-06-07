import type { CatalogItem } from "./catalog.js";
import type { MigrationPlan, MigrationPlanAction, MigrationPlanItem, ReviewDecision } from "./migration-classifier.js";
import { scanAndRedact } from "./sensitive-scan.js";
import { detectPlanConflicts, getCatalogConflict, type DetectedConflict } from "./catalog-conflicts.js";

export type EnvironmentPlanType = "migration" | "rebuild" | "change" | "remove" | "repair" | "imported-recipe";
export type EnvironmentPlanStatus =
  | "draft"
  | "needs-review"
  | "approved"
  | "applying"
  | "verifying"
  | "succeeded"
  | "partially-succeeded"
  | "failed"
  | "rolled-back"
  | "committed";

/**
 * Full set of action kinds the EnvForge plan engine understands.
 *
 * The list mirrors the design document so executors, planners, and
 * exporters can rely on a stable vocabulary. Some kinds (`backupFile`,
 * `restoreFile`) are aliases of older names (`backup`) kept for backwards
 * compatibility while we migrate callers.
 */
export type EnvironmentPlanActionKind =
  | "installPackage"
  | "removePackage"
  | "writeConfig"
  | "copyConfig"
  | "backupFile"
  | "restoreFile"
  | "createDirectory"
  | "transferArtifact"
  | "enableService"
  | "restartService"
  | "reloadService"
  | "validate"
  | "runCommand"
  | "review"
  | "manualStep"
  // ── Backwards-compatible aliases (kept so older plans still load) ──
  | "restart"
  | "backup"
  | "rollback";

/**
 * Action risk level — design contract requires the 4-tier scale below.
 * The legacy 3-tier scale (`low/medium/high`) is preserved as an alias so
 * plans persisted before this change still load. New code should use
 * the 4-tier values; the helper {@link normalizeRisk} converts both.
 */
export type EnvironmentPlanRisk = "safe" | "review" | "privileged" | "dangerous" | "low" | "medium" | "high";

export type SecretPolicy = "none" | "redact" | "confirm" | "blocked";

/**
 * Structured spec for the `apply` phase of an action. Older plans store the
 * apply command directly on the action; new plans should fill `apply`.
 */
export interface ActionApplySpec {
  /** Shell command to run during apply. */
  command?: string;
  /** Target file path for write/copy/backup actions. */
  path?: string;
  /** Sudo requirement (mirrors action.requiresSudo). */
  requiresSudo?: boolean;
  /** Optional retries for flaky network installs. */
  retries?: number;
}

/**
 * Structured spec for the `verify` phase. Multiple checks are allowed so a
 * single action can run config syntax + service activity + port checks.
 */
export interface ActionVerifySpec {
  /** Single command (legacy convenience). */
  command?: string;
  /** Multiple checks; each must exit 0 for the verify to pass. */
  checks?: Array<{ command: string; allowFailure?: boolean; description?: string }>;
}

/**
 * Structured spec for the `rollback` phase. Either a command or a
 * declarative restore (`restoreBackupOf` / `removeInstalledPackage`).
 */
export interface ActionRollbackSpec {
  command?: string;
  /** Restore the EnvForge backup of this path. */
  restoreBackupOf?: string;
  /** Uninstall the listed packages. */
  removeInstalledPackages?: string[];
  /** Reload the listed services after rollback. */
  reloadServices?: string[];
  description?: string;
}

export interface EnvironmentPlanAction {
  id: string;
  kind: EnvironmentPlanActionKind;
  label: string;
  /** @deprecated Use `apply.command` for new actions. */
  command?: string;
  packageNames?: string[];
  /** @deprecated Use `apply.path` for new actions. */
  path?: string;
  serviceName?: string;
  requiresSudo: boolean;
  changesTarget: boolean;
  canRollback: boolean;
  /** Action risk; supports both the design-document 4-tier scale and the
   *  historical 3-tier scale. */
  risk: EnvironmentPlanRisk;
  /** Legacy verify command. Prefer the structured `verifySpec`. */
  verify?: string;
  /** Legacy rollback command. Prefer the structured `rollbackSpec`. */
  rollback?: string;
  /** Structured apply spec — populated on new actions. */
  applySpec?: ActionApplySpec;
  /** Structured verify spec — populated on new actions. */
  verifySpec?: ActionVerifySpec;
  /** Structured rollback spec — populated on new actions. */
  rollbackSpec?: ActionRollbackSpec;
  /** Capability the action belongs to (capabilityKey). */
  capabilityId?: string;
  /** Connection id of the host the action mutates; defaults to plan.targetConnectionId. */
  targetHostId?: string;
  /** Evidence ids that justify the action (e.g. review queue candidate). */
  sourceEvidenceIds?: string[];
  /** How EnvForge handles secret material discovered for this action. */
  secretPolicy?: SecretPolicy;
  /** When true, even an "approved" plan keeps this action paused until a separate ack. */
  blockedUntilApproved?: boolean;
  notes?: string[];
}

/**
 * Map any of the seven recognised risk strings onto the canonical 4-tier
 * scale. Used by UIs and runners that want to display a single colour.
 */
export function normalizeRisk(risk: EnvironmentPlanRisk | undefined): "safe" | "review" | "privileged" | "dangerous" {
  switch (risk) {
    case "safe":
    case "low":
      return "safe";
    case "review":
    case "medium":
      return "review";
    case "privileged":
    case "high":
      return "privileged";
    case "dangerous":
      return "dangerous";
    default:
      return "review";
  }
}

export interface EnvironmentPlanItem {
  id: string;
  name: string;
  type: "capability" | "migration-candidate" | "config-change" | "remove-capability" | "repair" | "imported-recipe";
  sourceId?: string;
  confidence?: number;
  supportLevel?: CatalogItem["supportLevel"];
  risks: string[];
  evidence: string[];
  actions: EnvironmentPlanAction[];
  userDecision: ReviewDecision;
  /**
   * CapabilityKey resolved through the catalog metadata layer. Used by
   * conflict detection and approval gates.
   */
  capabilityKey?: string;
  /**
   * Subset of the catalog audit metadata pulled forward into the plan.
   * Required so Plan Review can render risk callouts even when the live
   * catalog has been edited since plan generation.
   */
  audit?: {
    supportLevel?: CatalogItem["supportLevel"];
    remainingRisks?: string[];
    capabilityKey?: string;
    reviewerNotes?: string;
  };
  /**
   * Approval gates the operator must satisfy before non-dry apply. The
   * Plan Review UI renders one checkbox per gate; the apply gate refuses
   * apply when any gate is missing from `acknowledgedApprovals`.
   */
  requiredApprovals?: PlanRequiredApproval[];
}

/**
 * Approval gate kind. Each high-risk catalog capability maps to one or
 * more typed gates; the operator must explicitly tick each gate before
 * the plan can be applied. The kinds intentionally describe the *check*
 * the operator is performing, not the catalog item, so the UI can group
 * gates of the same kind across multiple items.
 */
export type PlanApprovalKind =
  | "secret-confirm"
  | "data-strategy-confirm"
  | "ssh-lockout-confirm"
  | "firewall-lockout-confirm"
  | "identity-provider-confirm"
  | "backup-restore-confirm"
  | "manual-dns-confirm";

export interface PlanRequiredApproval {
  /** Stable id used in the apply request body. */
  id: string;
  kind: PlanApprovalKind;
  /** Plan item id this gate is attached to. */
  itemId: string;
  /** Short imperative label rendered in the Plan Review UI. */
  label: string;
  /** Long-form prompt explaining what the operator is confirming. */
  prompt: string;
}

export interface EnvironmentPlan {
  id: string;
  type: EnvironmentPlanType;
  status: EnvironmentPlanStatus;
  name: string;
  sourceHost?: string;
  targetConnectionId?: string;
  generatedAt: string;
  summary: {
    totalItems: number;
    totalActions: number;
    highRisk: number;
    requiresSudo: number;
    rollbackable: number;
    dataPreservedByDefault?: boolean;
    /**
     * Effective supportLevel for the whole plan. Equals
     * `min(item.supportLevel, item.audit.finalSupportLevel)` across all
     * plan items. The UI labels the plan card with this value so a
     * `full-migration` item next to a `detect-only` item never advertises
     * full migration. See E2E_SCENARIO_VALIDATION.md scenario 6.
     */
    effectiveSupportLevel?: NonNullable<CatalogItem["supportLevel"]>;
  };
  review: {
    required: boolean;
    reasons: string[];
    /**
     * Conflicts detected against the catalog conflict rule set. Empty
     * array when the plan is conflict-free. Block-severity conflicts
     * must be resolved (one capability removed) before apply; warn-
     * severity conflicts must be acknowledged.
     */
    conflicts?: PlanReviewConflict[];
    /**
     * Aggregated approval gates pulled from each item's
     * `requiredApprovals`. The apply gate refuses apply when any gate
     * here is not yet acknowledged.
     */
    approvalsRequired?: PlanRequiredApproval[];
    /**
     * Build Mode signal: did the planner have a fresh target snapshot
     * to consult? When `true`, the UI must surface a "Target state
     * unknown — plan may be incomplete" banner. See
     * E2E_SCENARIO_VALIDATION.md "Target Snapshot in Build Mode".
     */
    targetStateUnknown?: boolean;
    /** "verified" (snapshot < 24h), "stale" (older), "unknown" (none). */
    targetStateConfidence?: "verified" | "stale" | "unknown";
  };
  /**
   * Acknowledgements collected during Plan Review. Persisted on the
   * stored plan so the apply gate (and any future re-apply) can verify
   * that the operator confirmed every risk / conflict / approval gate.
   */
  approvals?: PlanApprovalState;
  items: EnvironmentPlanItem[];
  export?: {
    yaml?: string;
    markdown?: string;
  };
}

/**
 * Snapshot of a conflict at the moment the plan was generated. We persist
 * this rather than re-deriving so the UI can show consistent state even
 * if the catalog conflict rules are edited mid-flight.
 */
export interface PlanReviewConflict {
  /** Conflict rule id from `catalog-conflicts.ts`. */
  id: string;
  type: string;
  severity: "block" | "warn";
  reason: string;
  capabilityKeys: string[];
  /** Plan item ids that participate in the conflict. */
  participatingItemIds: string[];
  resolutionOptions: Array<{
    id: string;
    label: string;
    keepCapabilityKeys?: string[];
    removeCapabilityKeys?: string[];
  }>;
}

/**
 * Persisted acknowledgement state. Each section is keyed so re-applying
 * a plan can replay the acknowledgements without losing audit detail.
 */
export interface PlanApprovalState {
  /** itemId -> list of acknowledged risk strings. */
  risks?: Record<string, string[]>;
  /** Acknowledged conflict rule ids (warn severity) or resolution ids. */
  conflicts?: Array<{ conflictId: string; resolutionId?: string; ackedAt: string }>;
  /** Acknowledged approval gate ids (per item). */
  approvals?: Array<{ itemId: string; gateId: string; ackedAt: string }>;
}

export function migrationPlanToEnvironmentPlan(plan: MigrationPlan, targetConnectionId?: string): EnvironmentPlan {
  const items: EnvironmentPlanItem[] = plan.items.map((item) => ({
    id: item.id,
    name: item.name,
    type: "migration-candidate",
    confidence: item.confidence,
    risks: item.risks,
    evidence: [`Migration class: ${item.type}.`, `Confidence: ${Math.round(item.confidence * 100)}%.`],
    actions: item.actions.map((action, index) => migrationActionToEnvironmentAction(item, action, index)),
    userDecision: item.userDecision
  }));
  return attachConflictsAndApprovalAggregate(finalizePlan({
    id: `migration:${plan.sourceHost}:${plan.generatedAt}`,
    type: "migration",
    name: `Migration Plan for ${plan.sourceHost}`,
    sourceHost: plan.sourceHost,
    targetConnectionId,
    generatedAt: new Date().toISOString(),
    items,
    review: { required: true, reasons: ["Migration plans are generated from classified HostSnapshot evidence and require human approval."] }
  }));
}

export function buildRebuildPlan(
  items: CatalogItem[],
  targetConnectionId: string,
  options: {
    /**
     * Capabilities already present on the target host (capabilityKey →
     * evidence string). When provided, the planner emits a synthetic
     * `target-state` conflict for capabilities that overlap with one of
     * the conflict-rule families and tags items the target already
     * provides as a `reconcile`-style plan rather than a fresh install.
     */
    existingCapabilities?: Record<string, string>;
    /**
     * Build Mode contract: did the caller have a recent target
     * snapshot? When false, the plan is marked
     * `review.targetStateUnknown=true`.
     */
    targetSnapshotAvailable?: boolean;
    /** Snapshot age in milliseconds. >24h is "stale". */
    targetSnapshotAgeMs?: number;
  } = {}
): EnvironmentPlan {
  const existing = options.existingCapabilities ?? {};
  const planItems: EnvironmentPlanItem[] = items.map((item) => {
    const actions = actionsForCatalogItem(item);
    const capabilityKey = item.capabilityKey;
    const auditRemainingRisks = item.audit?.remainingRisks ?? [];
    const requiredApprovals = computeRequiredApprovalsForCatalogItem(`capability:${item.id}`, item);
    const reconcile = capabilityKey ? existing[capabilityKey] : undefined;
    return {
      id: `capability:${item.id}`,
      sourceId: item.id,
      name: item.nameEn || item.name,
      type: "capability",
      supportLevel: item.supportLevel ?? "basic-rebuild",
      risks: [
        ...risksForCatalogItem(item),
        ...(reconcile ? [`Target already provides ${capabilityKey}: ${reconcile}. Plan will reconcile rather than install.`] : [])
      ],
      evidence: [
        `Selected from Capability Catalog.`,
        `Support level: ${item.supportLevel ?? "basic-rebuild"}.`,
        `Sensitivity: ${item.sensitivity}.`,
        ...(reconcile ? [`Target snapshot evidence: ${reconcile}`] : [])
      ],
      actions,
      userDecision: "pending",
      capabilityKey,
      audit: {
        supportLevel: item.supportLevel,
        capabilityKey,
        remainingRisks: auditRemainingRisks,
        reviewerNotes: item.audit?.reviewerNotes
      },
      requiredApprovals
    };
  });
  const yaml = planItemsToYaml("EnvForge Rebuild Plan", planItems);
  const targetStateConfidence: "verified" | "stale" | "unknown" =
    options.targetSnapshotAvailable
      ? (options.targetSnapshotAgeMs !== undefined && options.targetSnapshotAgeMs > 24 * 3600 * 1000 ? "stale" : "verified")
      : "unknown";
  const reviewReasons = ["Build Mode must generate a Rebuild Plan before applying catalog capabilities."];
  if (targetStateConfidence === "unknown") {
    reviewReasons.push("Target state is unknown — no fresh snapshot was supplied. Plan may be incomplete.");
  } else if (targetStateConfidence === "stale") {
    reviewReasons.push("Target snapshot is more than 24 hours old; conflicts may be inaccurate.");
  }
  const plan = finalizePlan({
    id: `rebuild:${targetConnectionId}:${Date.now()}`,
    type: "rebuild",
    name: "Rebuild Plan",
    targetConnectionId,
    generatedAt: new Date().toISOString(),
    items: planItems,
    review: {
      required: true,
      reasons: reviewReasons,
      targetStateUnknown: targetStateConfidence === "unknown",
      targetStateConfidence
    },
    export: { yaml, markdown: planItemsToMarkdown("Rebuild Plan", planItems) }
  });
  return attachConflictsAndApprovalAggregate(plan, { existingCapabilities: existing });
}

export function buildImportedRecipePlan(input: {
  targetConnectionId: string;
  yaml: string;
  name?: string;
}): EnvironmentPlan {
  const risks = recipeRisks(input.yaml);
  const item: EnvironmentPlanItem = {
    id: `recipe:${Date.now()}`,
    name: input.name?.trim() || "Imported Recipe",
    type: "imported-recipe",
    risks,
    evidence: [
      "Imported YAML is treated as an advanced recipe, not a direct execution request.",
      "EnvForge must review risk, sudo usage, rollback gaps, and target impact before apply."
    ],
    actions: [
      {
        id: "recipe:risk-scan",
        kind: "review",
        label: "Review imported recipe risk scan",
        requiresSudo: false,
        changesTarget: false,
        canRollback: false,
        risk: risks.length > 1 ? "high" : "medium",
        notes: risks
      },
      {
        id: "recipe:apply",
        kind: "runCommand",
        label: "Apply imported recipe through the Environment Plan runner",
        command: "envforge apply imported-recipe",
        requiresSudo: /sudo|module:\s*(package|service|ufw|lineinfile|copy|template|systemd_unit)/i.test(input.yaml),
        changesTarget: true,
        canRollback: false,
        risk: "high",
        notes: ["The original YAML is preserved in plan.export.yaml and must not be executed until the plan is approved."]
      }
    ],
    userDecision: "pending"
  };
  return finalizePlan({
    id: `imported-recipe:${input.targetConnectionId}:${Date.now()}`,
    type: "imported-recipe",
    status: "needs-review",
    name: input.name?.trim() || "Imported Recipe Plan",
    targetConnectionId: input.targetConnectionId,
    generatedAt: new Date().toISOString(),
    items: [item],
    review: { required: true, reasons: ["Imported recipes are advanced inputs and must be converted to reviewed Environment Plans before apply."] },
    export: { yaml: input.yaml, markdown: planItemsToMarkdown("Imported Recipe Plan", [item]) }
  });
}

export function buildRemovePlan(input: {
  targetConnectionId: string;
  packages: string[];
  source: string;
  managedByEnvForge?: boolean;
  preserveDataByDefault?: boolean;
  /**
   * Optional managed-marker rows for the requested packages. When
   * supplied, each package the user wants to remove is checked against
   * the marker's `existedBefore` and `removableByEnvForge` flags. Any
   * package that existed before EnvForge installed it (or is marked
   * non-removable) is recorded as a manual risk so the apply gate can
   * refuse auto-remove.
   */
  managedMarkers?: import("./action-runs.js").ManagedCapabilityRecord[];
}): EnvironmentPlan {
  const preserveDataByDefault = input.preserveDataByDefault !== false;
  const packageList = [...new Set(input.packages.map((pkg) => pkg.trim()).filter(Boolean))];
  const eligibility = assessRemoveEligibility(packageList, input.managedMarkers ?? []);
  const actions: EnvironmentPlanAction[] = [
    {
      id: "backup-remove-context",
      kind: "backup",
      label: "Record target state before removal",
      command: `echo ${JSON.stringify(`Removing ${packageList.join(", ")} from ${input.source}`)}`,
      requiresSudo: false,
      changesTarget: false,
      canRollback: true,
      risk: "low",
      notes: ["Records evidence for the remove plan report."]
    },
    {
      id: "remove-packages",
      kind: "removePackage",
      label: `Remove package(s): ${packageList.join(", ")}`,
      packageNames: packageList,
      requiresSudo: input.source !== "pip",
      changesTarget: true,
      canRollback: input.managedByEnvForge === true,
      risk: input.managedByEnvForge ? "medium" : "high",
      rollback: input.managedByEnvForge ? "Reinstall package(s) from the recorded Environment Plan." : "Manual reinstall may be required because EnvForge did not install this capability.",
      // High-risk removes that involve a package which existed before
      // EnvForge installed it MUST be paused at apply time even after
      // approval. The apply route checks `blockedUntilApproved` against
      // `acknowledgedActionIds`.
      blockedUntilApproved: eligibility.manualPackages.length > 0
    },
    {
      id: "verify-removed",
      kind: "validate",
      label: "Verify removed package state",
      command: `echo ${JSON.stringify(`Verify ${packageList.join(", ")} is no longer active; data preserved: ${preserveDataByDefault}`)}`,
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "low"
    }
  ];
  const item: EnvironmentPlanItem = {
    id: `remove:${input.source}:${packageList.join("+")}`,
    name: `Remove ${packageList.join(", ")}`,
    type: "remove-capability",
    risks: [
      input.managedByEnvForge ? "Capability appears managed by EnvForge." : "Capability is not known to be installed by EnvForge; removal may affect unmanaged workloads.",
      preserveDataByDefault ? "Data paths are preserved by default." : "Data removal was requested; this is high risk.",
      ...eligibility.manualPackages.map((pkg) => `Package ${pkg.name} requires manual confirmation: ${pkg.reason}`)
    ],
    evidence: [
      `Source package manager: ${input.source}.`,
      `Packages: ${packageList.join(", ")}.`,
      `Auto-remove eligible: ${eligibility.autoPackages.map((p) => p.name).join(", ") || "(none)"}.`,
      `Manual confirmation required: ${eligibility.manualPackages.map((p) => p.name).join(", ") || "(none)"}.`
    ],
    actions,
    userDecision: "pending"
  };
  return finalizePlan({
    id: `remove:${input.targetConnectionId}:${Date.now()}`,
    type: "remove",
    status: input.managedByEnvForge ? "needs-review" : "draft",
    name: `Remove Capability Plan`,
    targetConnectionId: input.targetConnectionId,
    generatedAt: new Date().toISOString(),
    items: [item],
    review: {
      required: true,
      reasons: [
        "Remove plans must preserve data by default and require explicit user acknowledgement.",
        ...(input.managedByEnvForge ? [] : ["This remove request targets unmanaged software; apply must be blocked unless unmanaged-risk is explicitly acknowledged."]),
        ...(eligibility.manualPackages.length > 0
          ? [`${eligibility.manualPackages.length} package(s) existed before EnvForge installed the capability and need manual confirmation before removal.`]
          : [])
      ]
    },
    export: { yaml: planItemsToYaml("EnvForge Remove Capability Plan", [item]), markdown: planItemsToMarkdown("Remove Capability Plan", [item]) }
  }, { dataPreservedByDefault: preserveDataByDefault });
}

/**
 * Decide which packages in a Remove plan can be auto-removed and
 * which need manual confirmation. The decision uses the
 * ManagedCapabilityRecord registry persisted by the managed-execution
 * orchestrator at install time.
 *
 * Pure function; the route is responsible for fetching the marker rows
 * and passing them in.
 */
export function assessRemoveEligibility(
  requestedPackages: string[],
  markers: import("./action-runs.js").ManagedCapabilityRecord[]
): {
  autoPackages: Array<{ name: string; reason: string }>;
  manualPackages: Array<{ name: string; reason: string }>;
} {
  // Index markers by package name → first matching install record.
  const byName = new Map<string, { existedBefore: boolean; removableByEnvForge: boolean }>();
  for (const marker of markers) {
    for (const pkg of marker.packagesInstalled) {
      // Last write wins; markers are append-only ordered by install
      // time in the runtime store.
      byName.set(pkg.name, { existedBefore: pkg.existedBefore, removableByEnvForge: pkg.removableByEnvForge });
    }
  }
  const autoPackages: Array<{ name: string; reason: string }> = [];
  const manualPackages: Array<{ name: string; reason: string }> = [];
  for (const name of requestedPackages) {
    const entry = byName.get(name);
    if (!entry) {
      manualPackages.push({ name, reason: "no managed marker — capability was not installed by EnvForge" });
      continue;
    }
    if (entry.existedBefore) {
      manualPackages.push({ name, reason: "existedBefore=true — package was on the host before EnvForge installed the capability" });
      continue;
    }
    if (!entry.removableByEnvForge) {
      manualPackages.push({ name, reason: "removableByEnvForge=false — explicit operator opt-out" });
      continue;
    }
    autoPackages.push({ name, reason: "managed marker says EnvForge installed this fresh and it is safe to remove" });
  }
  return { autoPackages, manualPackages };
}

export function buildConfigChangePlan(input: {
  targetConnectionId: string;
  path: string;
  originalContent: string;
  candidateContent: string;
  validationCommand?: string;
}): EnvironmentPlan {
  const scan = scanAndRedact(input.path, input.candidateContent);
  const hasSecrets = scan.hits.length > 0;
  const actions: EnvironmentPlanAction[] = [
    {
      id: "scan-secret",
      kind: "review",
      label: hasSecrets ? "Review secret scan hits before apply" : "Secret scan passed",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: hasSecrets ? "high" : "low",
      notes: scan.hits.map((hit) => `${hit.rule} at line ${hit.line}`)
    },
    {
      id: "backup-config",
      kind: "backup",
      label: `Backup ${input.path}`,
      path: input.path,
      requiresSudo: input.path.startsWith("/etc/"),
      changesTarget: false,
      canRollback: true,
      risk: "low",
      rollback: "Restore .envforge.bak backup."
    },
    {
      id: "write-config",
      kind: "writeConfig",
      label: `Apply candidate config to ${input.path}`,
      path: input.path,
      requiresSudo: input.path.startsWith("/etc/"),
      changesTarget: true,
      canRollback: true,
      risk: input.path.includes("/ssh/") || hasSecrets ? "high" : "medium",
      verify: input.validationCommand
    },
    {
      id: "validate-config",
      kind: "validate",
      label: input.validationCommand ? `Validate with: ${input.validationCommand}` : "No validation hook available; manual verification required",
      command: input.validationCommand,
      requiresSudo: Boolean(input.validationCommand?.startsWith("sudo ")),
      changesTarget: false,
      canRollback: false,
      risk: input.validationCommand ? "low" : "medium"
    }
  ];
  const item: EnvironmentPlanItem = {
    id: `change:${input.path}`,
    name: `Config Change: ${input.path}`,
    type: "config-change",
    risks: [
      ...(hasSecrets ? ["Candidate content contains possible secrets; do not expose them in logs or reports."] : []),
      ...(input.path.includes("/etc/ssh/") ? ["SSH config changes require sshd -t and rollback-safe session handling."] : [])
    ],
    evidence: [
      `Original size: ${input.originalContent.length} bytes.`,
      `Candidate size: ${input.candidateContent.length} bytes.`,
      `Changed: ${input.originalContent === input.candidateContent ? "no" : "yes"}.`
    ],
    actions,
    userDecision: "pending"
  };
  return finalizePlan({
    id: `change:${input.targetConnectionId}:${Date.now()}`,
    type: "change",
    name: "Config Change Proposal",
    targetConnectionId: input.targetConnectionId,
    generatedAt: new Date().toISOString(),
    items: [item],
    review: { required: true, reasons: ["Config edits must be reviewed as proposals with diff, secret scan, validation, and rollback."] },
    export: { markdown: planItemsToMarkdown("Config Change Proposal", [item]) }
  });
}

/**
 * Repair Plan failure source — what evidence should drive the repair.
 *
 * EnvForge produces Repair Plans automatically from two signal sources:
 *
 *   1. A previously applied plan whose verify step failed. The repair plan
 *      attempts to recover the failed actions: restart services, restore
 *      file backups, reinstall packages.
 *   2. A drift detection report (`/api/connections/:id/drift`) listing
 *      services that should be running, configs that have been modified,
 *      and packages that disappeared.
 *
 * Each failure entry maps to one or more Repair actions; the result is a
 * reviewable Environment Plan with the same lifecycle as Migration / Rebuild
 * / Change / Remove plans.
 */
export interface RepairFailure {
  /** Human-readable label shown in the plan UI. */
  label: string;
  /** Optional kind used to pick a default repair action. */
  kind?: "service-down" | "config-modified" | "package-missing" | "verify-failed" | "custom";
  /** Service unit name when kind=service-down. */
  serviceName?: string;
  /** File path when kind=config-modified. */
  path?: string;
  /** Package names when kind=package-missing. */
  packageNames?: string[];
  /** Validation command to re-run after repair. */
  validateCommand?: string;
  /** Optional explicit repair command for kind=custom. */
  repairCommand?: string;
  /** Severity hint for risk grading. */
  severity?: "low" | "medium" | "high";
  /** Free-form evidence rendered in the plan card. */
  evidence?: string[];
}

/**
 * Build a Repair Plan from a list of failures.
 *
 * The plan consists of one item per failure, each carrying:
 *  - a `backup` action recording context;
 *  - the kind-appropriate repair action (restart / restore / installPackage / runCommand);
 *  - a `validate` action that re-runs the verify command when known.
 *
 * Repair plans default to needs-review because EnvForge does not silently
 * mutate target state in response to drift.
 */
export function buildRepairPlan(input: {
  targetConnectionId: string;
  name?: string;
  /** Optional id of the plan whose verify failed; recorded in evidence. */
  sourcePlanId?: string;
  failures: RepairFailure[];
}): EnvironmentPlan {
  const failures = input.failures.filter((f) => f && f.label?.trim().length > 0);
  if (failures.length === 0) {
    failures.push({
      label: "No specific failure provided",
      kind: "custom",
      severity: "low",
      evidence: ["Caller did not supply any failure entries; plan is empty."]
    });
  }
  const planItems: EnvironmentPlanItem[] = failures.map((failure, index) => {
    const id = `repair-${index}:${slugifyFailure(failure)}`;
    const actions = actionsForRepair(id, failure);
    const evidence = [
      ...(failure.evidence ?? []),
      input.sourcePlanId ? `Originating plan: ${input.sourcePlanId}.` : "Originating signal: drift / manual.",
      `Failure kind: ${failure.kind ?? "custom"}.`
    ];
    return {
      id,
      name: failure.label,
      type: "repair",
      sourceId: input.sourcePlanId,
      risks: [
        failure.severity === "high" ? "High-severity repair: review carefully before apply." : "Repair actions mutate the target; review evidence before apply.",
        ...(failure.kind === "config-modified" ? ["Config repair restores an EnvForge backup; review the diff before applying."] : []),
        ...(failure.kind === "service-down" ? ["Service restart may interrupt running connections."] : []),
        ...(failure.kind === "package-missing" ? ["Reinstall pulls packages from the configured package manager; verify network reachability."] : [])
      ],
      evidence,
      actions,
      userDecision: "pending"
    };
  });

  return finalizePlan({
    id: `repair:${input.targetConnectionId}:${Date.now()}`,
    type: "repair",
    status: "needs-review",
    name: input.name?.trim() || "Repair Plan",
    targetConnectionId: input.targetConnectionId,
    generatedAt: new Date().toISOString(),
    items: planItems,
    review: {
      required: true,
      reasons: [
        "Repair Plans automate recovery for failed verifications and drift, but every action mutates the target.",
        ...(input.sourcePlanId ? [`Source: failed verification of plan ${input.sourcePlanId}.`] : ["Source: drift detection / operator-supplied failure list."])
      ]
    },
    export: {
      yaml: planItemsToYaml("EnvForge Repair Plan", planItems),
      markdown: planItemsToMarkdown("Repair Plan", planItems)
    }
  });
}

function actionsForRepair(itemId: string, failure: RepairFailure): EnvironmentPlanAction[] {
  const actions: EnvironmentPlanAction[] = [];
  // Always start with a `backup` step that records what the target looked
  // like before repair. This is recorded into plan history and lets the
  // operator audit every repair.
  actions.push({
    id: `${itemId}:context`,
    kind: "backup",
    label: `Record state before repairing: ${failure.label}`,
    command: `echo ${JSON.stringify(`Repair candidate evidence: ${failure.label}`)}`,
    requiresSudo: false,
    changesTarget: false,
    canRollback: true,
    risk: "low",
    notes: failure.evidence
  });

  switch (failure.kind) {
    case "service-down":
      if (failure.serviceName) {
        actions.push({
          id: `${itemId}:restart`,
          kind: "restart",
          label: `Restart service: ${failure.serviceName}`,
          serviceName: failure.serviceName,
          command: `sudo systemctl restart ${failure.serviceName}`,
          requiresSudo: true,
          changesTarget: true,
          canRollback: true,
          risk: failure.severity === "high" ? "high" : "medium",
          rollback: `sudo systemctl stop ${failure.serviceName}`,
          verify: failure.validateCommand ?? `systemctl is-active ${failure.serviceName}`
        });
      }
      break;

    case "config-modified":
      if (failure.path) {
        actions.push({
          id: `${itemId}:restore`,
          kind: "writeConfig",
          label: `Restore EnvForge backup for ${failure.path}`,
          path: failure.path,
          requiresSudo: failure.path.startsWith("/etc/") || failure.path.startsWith("/usr/") || failure.path.startsWith("/var/"),
          changesTarget: true,
          canRollback: true,
          risk: failure.severity === "high" ? "high" : "medium",
          rollback: "Re-apply the most recent change plan if this restore was wrong.",
          verify: failure.validateCommand,
          notes: ["Restores `<path>.envforge.bak` to the live path; review the diff before approval."]
        });
      }
      break;

    case "package-missing":
      if (failure.packageNames?.length) {
        actions.push({
          id: `${itemId}:install`,
          kind: "installPackage",
          label: `Reinstall package(s): ${failure.packageNames.join(", ")}`,
          packageNames: failure.packageNames,
          requiresSudo: true,
          changesTarget: true,
          canRollback: true,
          risk: failure.severity === "high" ? "high" : "medium",
          rollback: `sudo apt-get -y remove ${failure.packageNames.join(" ")} 2>/dev/null || sudo dnf -y remove ${failure.packageNames.join(" ")} 2>/dev/null || true`,
          verify: failure.validateCommand
        });
      }
      break;

    case "custom":
    case "verify-failed":
    default:
      if (failure.repairCommand) {
        actions.push({
          id: `${itemId}:run`,
          kind: "runCommand",
          label: `Run repair command: ${failure.label}`,
          command: failure.repairCommand,
          requiresSudo: failure.repairCommand.includes("sudo "),
          changesTarget: true,
          canRollback: false,
          risk: failure.severity === "high" ? "high" : "medium",
          notes: ["Custom repair command; ensure it is idempotent before approving."]
        });
      } else {
        actions.push({
          id: `${itemId}:review`,
          kind: "review",
          label: `Manual review required: ${failure.label}`,
          requiresSudo: false,
          changesTarget: false,
          canRollback: false,
          risk: "medium",
          notes: ["No automated repair strategy for this failure kind. Add a repairCommand or split into a more specific kind."]
        });
      }
      break;
  }

  if (failure.validateCommand) {
    actions.push({
      id: `${itemId}:validate`,
      kind: "validate",
      label: `Re-validate: ${failure.validateCommand}`,
      command: failure.validateCommand,
      requiresSudo: failure.validateCommand.startsWith("sudo "),
      changesTarget: false,
      canRollback: false,
      risk: "low"
    });
  }

  return actions;
}

function slugifyFailure(failure: RepairFailure): string {
  const seed = failure.serviceName ?? failure.path ?? failure.packageNames?.join("+") ?? failure.label;
  return seed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "failure";
}

export function buildConfigMigrationPlan(input: {
  sourceConnectionId: string;
  paths: string[];
  targetConnectionId?: string;
}): EnvironmentPlan {
  const uniquePaths = [...new Set(input.paths.map((path) => path.trim()).filter(Boolean))];
  const items: EnvironmentPlanItem[] = uniquePaths.map((path) => ({
    id: `config-migration:${path}`,
    name: `Migrate config: ${path}`,
    type: "config-change",
    risks: [
      "Config migration is explicit. It is not implied by package selection.",
      path.includes("/ssh/") || path.includes("sudoers") ? "High-risk system access config; validate before apply." : "Review ownership, secrets, and target conflicts before apply."
    ],
    evidence: [
      `Discovered on source connection: ${input.sourceConnectionId}.`,
      "This config must be reviewed with secret scan and diff before target apply."
    ],
    actions: [
      {
        id: `${path}:review`,
        kind: "review",
        label: `Review config ownership, secrets, and target conflict for ${path}`,
        path,
        requiresSudo: false,
        changesTarget: false,
        canRollback: false,
        risk: path.includes("/ssh/") || path.includes("sudoers") ? "high" : "medium"
      },
      {
        id: `${path}:backup-target`,
        kind: "backup",
        label: `Backup target ${path} before copy`,
        path,
        requiresSudo: path.startsWith("/etc/"),
        changesTarget: false,
        canRollback: true,
        risk: "low"
      },
      {
        id: `${path}:copy`,
        kind: "copyConfig",
        label: `Copy reviewed config to target: ${path}`,
        path,
        requiresSudo: path.startsWith("/etc/"),
        changesTarget: true,
        canRollback: true,
        risk: path.includes("/ssh/") || path.includes("sudoers") ? "high" : "medium",
        rollback: "Restore target backup if validation fails."
      },
      {
        id: `${path}:validate`,
        kind: "validate",
        label: `Validate target config after copy: ${path}`,
        requiresSudo: false,
        changesTarget: false,
        canRollback: false,
        risk: "medium",
        notes: ["Use catalog validation hook when ownership is known; otherwise require manual verification."]
      }
    ],
    userDecision: "pending"
  }));
  return finalizePlan({
    id: `config-migration:${input.sourceConnectionId}:${Date.now()}`,
    type: "migration",
    name: "Config Migration Plan",
    sourceHost: input.sourceConnectionId,
    targetConnectionId: input.targetConnectionId,
    generatedAt: new Date().toISOString(),
    items,
    review: { required: true, reasons: ["Config files are first-class migration artifacts and require explicit review."] },
    export: {
      yaml: planItemsToYaml("EnvForge Config Migration Plan", items),
      markdown: planItemsToMarkdown("Config Migration Plan", items)
    }
  });
}

function migrationActionToEnvironmentAction(item: MigrationPlanItem, action: MigrationPlanAction, index: number): EnvironmentPlanAction {
  const changesTarget = action.kind === "installPackage" || action.kind === "copyConfig" || action.kind === "restart";
  return {
    id: `${item.id}:${index}`,
    kind: action.kind === "copyConfig" ? "copyConfig" : action.kind === "installPackage" ? "installPackage" : action.kind === "restart" ? "restart" : action.kind === "validate" ? "validate" : "review",
    label: action.label,
    command: action.command,
    packageNames: action.packageNames,
    serviceName: action.serviceName,
    requiresSudo: action.requiresSudo === true,
    changesTarget,
    canRollback: action.backup === true || action.kind === "installPackage" || action.kind === "restart",
    risk: changesTarget ? "medium" : "low",
    verify: action.kind === "validate" ? action.command : undefined
  };
}

function actionsForCatalogItem(item: CatalogItem): EnvironmentPlanAction[] {
  const actions: EnvironmentPlanAction[] = [];
  if (item.supportLevel === "detect-only") {
    actions.push({
      id: `${item.id}:review-only`,
      kind: "review",
      label: `Review detected capability before creating apply actions: ${item.nameEn || item.name}`,
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      notes: ["Detect-only catalog rules provide evidence and review guidance, not direct target changes."]
    });
    return actions;
  }
  for (const component of item.components) {
    const dockerImageComponent =
      component.type === "software" &&
      component.detail.toLowerCase().includes("docker") &&
      /[/:]/.test(component.label);
    if (component.type === "software" && !dockerImageComponent) {
      actions.push({
        id: `${item.id}:install:${component.label}`,
        kind: "installPackage",
        label: `Install package: ${component.labelEn || component.label}`,
        packageNames: [component.label],
        requiresSudo: true,
        changesTarget: true,
        canRollback: true,
        risk: item.sensitivity === "privileged" ? "high" : "medium",
        verify: `command -v ${component.label.split(/[ .]/)[0]} || true`
      });
    } else if (dockerImageComponent) {
      actions.push({
        id: `${item.id}:image:${component.label}`,
        kind: "runCommand",
        label: `Pull container image: ${component.labelEn || component.label}`,
        command: `docker pull ${component.label}`,
        requiresSudo: false,
        changesTarget: true,
        canRollback: false,
        risk: item.sensitivity === "privileged" ? "high" : "medium",
        notes: ["Container-image pulls are represented separately from OS package installs."]
      });
    } else if (component.type === "system-config") {
      actions.push({
        id: `${item.id}:config:${component.label}`,
        kind: "writeConfig",
        label: `Prepare managed config: ${component.labelEn || component.label}`,
        path: component.detail,
        requiresSudo: component.detail.startsWith("/etc/"),
        changesTarget: true,
        canRollback: true,
        risk: item.sensitivity === "safe" ? "medium" : "high",
        notes: ["Config changes require a Config Change Proposal before direct write."]
      });
    } else {
      actions.push({
        id: `${item.id}:command:${component.label}`,
        kind: "runCommand",
        label: component.labelEn || component.label,
        command: component.detail,
        requiresSudo: component.detail.includes("sudo "),
        changesTarget: true,
        canRollback: false,
        risk: item.sensitivity === "privileged" ? "high" : "medium",
        notes: ["Command actions require review before apply."]
      });
    }
  }
  appendCapabilitySpecificActions(item, actions);
  actions.push({
    id: `${item.id}:verify`,
    kind: "validate",
    label: "Verify capability after apply",
    command: verificationCommandForItem(item),
    requiresSudo: false,
    changesTarget: false,
    canRollback: false,
    risk: "low"
  });
  return actions;
}

function appendCapabilitySpecificActions(item: CatalogItem, actions: EnvironmentPlanAction[]): void {
  if (item.id === "firewall-baseline") {
    actions.push(
      {
        id: `${item.id}:manual:ssh-port`,
        kind: "manualStep",
        label: "Confirm current SSH port before firewall apply",
        requiresSudo: false,
        changesTarget: false,
        canRollback: false,
        risk: "high",
        notes: [
          "The operator must record the active SSH port in ENVFORGE_CURRENT_SSH_PORT before live apply.",
          "safeFirewallApply refuses when the current SSH port is unknown, so a dry-run can be reviewed without risking lockout."
        ]
      },
      {
        id: `${item.id}:backup:rules`,
        kind: "backupFile",
        label: "Snapshot firewall rules before safeFirewallApply",
        path: "/etc/ufw/user.rules",
        requiresSudo: true,
        changesTarget: false,
        canRollback: true,
        risk: "high",
        rollbackSpec: { restoreBackupOf: "/etc/ufw/user.rules" },
        notes: ["firewalld targets use the equivalent /etc/firewalld/zones backup path during live execution."]
      },
      {
        id: `${item.id}:safe-apply`,
        kind: "runCommand",
        label: "safeFirewallApply with SSH protection and rollback timer",
        command:
          "sudo sh -lc 'set -e; ssh_port=\"${ENVFORGE_CURRENT_SSH_PORT:-}\"; test -n \"$ssh_port\" || { echo \"Refusing firewall apply: current SSH port unknown\"; exit 42; }; cp -p /etc/ufw/user.rules /etc/ufw/user.rules.envforge.bak 2>/dev/null || true; (sleep 120; cp -p /etc/ufw/user.rules.envforge.bak /etc/ufw/user.rules 2>/dev/null; ufw reload 2>/dev/null || true) >/tmp/envforge-firewall-rollback.log 2>&1 & ufw allow \"$ssh_port\"/tcp comment EnvForge-ssh-protect; ufw --force enable; ufw status numbered'",
        requiresSudo: true,
        changesTarget: true,
        canRollback: true,
        risk: "high",
        verifySpec: {
          checks: [
            { command: "sudo ufw status numbered || sudo firewall-cmd --state", description: "firewall status" },
            { command: "sh -lc 'ss -ltn | grep -E \":(${ENVFORGE_CURRENT_SSH_PORT:-22}|22)\\\\b\" || systemctl is-active ssh || systemctl is-active sshd'", description: "SSH reachable/listening guard" }
          ]
        },
        rollbackSpec: {
          command:
            "sudo sh -lc 'test -f /etc/ufw/user.rules.envforge.bak && cp -p /etc/ufw/user.rules.envforge.bak /etc/ufw/user.rules && ufw reload || true'"
        },
        notes: [
          "This action is refused unless the current SSH port is explicitly supplied.",
          "The rollback timer restores the previous UFW ruleset if the operator loses access."
        ]
      }
    );
  }

  if (item.id === "fail2ban-protection") {
    actions.push(
      {
        id: `${item.id}:backup:jails`,
        kind: "backupFile",
        label: "Snapshot Fail2Ban jail configuration",
        path: "/etc/fail2ban/jail.local",
        requiresSudo: true,
        changesTarget: false,
        canRollback: true,
        risk: "medium",
        rollbackSpec: { restoreBackupOf: "/etc/fail2ban/jail.local" },
        notes: ["Live execution also reviews jail.d custom files before applying a managed sshd baseline."]
      },
      {
        id: `${item.id}:manual:custom-jails`,
        kind: "manualStep",
        label: "Review custom Fail2Ban actions and log paths",
        requiresSudo: false,
        changesTarget: false,
        canRollback: false,
        risk: "medium",
        secretPolicy: "redact",
        notes: [
          "Custom action scripts can contain webhook URLs or credentials and are redacted in reports.",
          "Log paths must exist on the target before the jail is enabled."
        ]
      }
    );
  }

  if (item.id === "redis-server") {
    actions.push({
      id: `${item.id}:manual:data-strategy`,
      kind: "manualStep",
      label: "Review Redis RDB/AOF migration strategy",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "Redis data is migrated by explicit RDB/AOF review using SAVE/BGSAVE or application-level cache reset.",
        "EnvForge must not copy /var/lib/redis blindly while Redis is running."
      ]
    });
  }

  if (item.id === "postgres-profile") {
    actions.push(
      {
        id: `${item.id}:backup:configs`,
        kind: "backupFile",
        label: "Snapshot PostgreSQL configuration",
        path: "/etc/postgresql",
        requiresSudo: true,
        changesTarget: false,
        canRollback: true,
        risk: "high",
        rollbackSpec: { restoreBackupOf: "/etc/postgresql" },
        notes: ["Rollback restores postgresql.conf / pg_hba.conf before service reload."]
      },
      {
        id: `${item.id}:manual:data-strategy`,
        kind: "manualStep",
        label: "Confirm PostgreSQL pg_dump / pg_dumpall strategy",
        requiresSudo: false,
        changesTarget: false,
        canRollback: false,
        risk: "high",
        secretPolicy: "redact",
        notes: [
          "Use pg_dump / pg_dumpall or pg_basebackup by explicit operator decision; do not raw-copy /var/lib/postgresql.",
          "Roles, grants, extensions, encodings, and superuser ownership must be reviewed before restore.",
          "Restore validation must run a simple psql query after service start."
        ]
      }
    );
  }

  if (item.id === "mysql-server" || item.id === "mariadb") {
    actions.push(
      {
        id: `${item.id}:backup:configs`,
        kind: "backupFile",
        label: "Snapshot MySQL / MariaDB configuration",
        path: "/etc/mysql",
        requiresSudo: true,
        changesTarget: false,
        canRollback: true,
        risk: "high",
        rollbackSpec: { restoreBackupOf: "/etc/mysql" },
        notes: ["Rollback restores my.cnf and included conf.d files before service restart."]
      },
      {
        id: `${item.id}:manual:data-strategy`,
        kind: "manualStep",
        label: "Confirm MySQL dump / restore strategy",
        requiresSudo: false,
        changesTarget: false,
        canRollback: false,
        risk: "high",
        secretPolicy: "redact",
        notes: [
          "Use mysqldump / mariadb-dump by explicit operator decision; do not raw-copy live InnoDB files under /var/lib/mysql.",
          "Users, grants, routines, triggers, character sets, and per-database restore order must be reviewed.",
          "Restore validation must run mysqladmin ping or a simple SELECT after service start."
        ]
      }
    );
  }

  if (item.id === "haproxy-lb") {
    actions.push(
      {
        id: `${item.id}:backup:configs`,
        kind: "backupFile",
        label: "Snapshot HAProxy configuration",
        path: "/etc/haproxy/haproxy.cfg",
        requiresSudo: true,
        changesTarget: false,
        canRollback: true,
        risk: "medium",
        secretPolicy: "redact",
        rollbackSpec: { restoreBackupOf: "/etc/haproxy/haproxy.cfg" }
      },
      {
        id: `${item.id}:manual:backends`,
        kind: "manualStep",
        label: "Review HAProxy backends and TLS material",
        requiresSudo: false,
        changesTarget: false,
        canRollback: false,
        risk: "medium",
        secretPolicy: "redact",
        notes: [
          "Backend server host:port references must exist on the target network before HAProxy is enabled.",
          "TLS cert/key bundles referenced by bind lines are redacted and require explicit operator review."
        ]
      }
    );
  }

  if (item.id === "apache-httpd") {
    actions.push(
      {
        id: `${item.id}:backup:configs`,
        kind: "backupFile",
        label: "Snapshot Apache configuration",
        path: "/etc/apache2",
        requiresSudo: true,
        changesTarget: false,
        canRollback: true,
        risk: "medium",
        secretPolicy: "redact",
        rollbackSpec: { restoreBackupOf: "/etc/apache2" },
        notes: ["RHEL-family targets use /etc/httpd for the equivalent rollback snapshot."]
      },
      {
        id: `${item.id}:manual:vhosts`,
        kind: "manualStep",
        label: "Review Apache vhosts, modules, and PHP handler",
        requiresSudo: false,
        changesTarget: false,
        canRollback: false,
        risk: "medium",
        secretPolicy: "redact",
        notes: [
          "DocumentRoot, ProxyPass, .htaccess, and TLS key references must be reviewed before apply.",
          "mod_php vs php-fpm routing must match the target PHP capability selection."
        ]
      }
    );
  }

  if (item.id === "php-fpm") {
    actions.push(
      {
        id: `${item.id}:backup:pools`,
        kind: "backupFile",
        label: "Snapshot PHP-FPM pool configuration",
        path: "/etc/php",
        requiresSudo: true,
        changesTarget: false,
        canRollback: true,
        risk: "medium",
        secretPolicy: "redact",
        rollbackSpec: { restoreBackupOf: "/etc/php" },
        notes: ["RHEL-family targets use /etc/php-fpm.d for pool rollback snapshots."]
      },
      {
        id: `${item.id}:manual:pools`,
        kind: "manualStep",
        label: "Review PHP-FPM pools and web-server upstreams",
        requiresSudo: false,
        changesTarget: false,
        canRollback: false,
        risk: "medium",
        secretPolicy: "redact",
        notes: [
          "pm.max_children, listen socket/TCP choices, user/group, and per-app env vars are reviewed before apply.",
          "Nginx/Apache upstream blocks must point at the target PHP-FPM listener."
        ]
      }
    );
  }

  if (item.id === "certbot-ssl") {
    actions.push(
      {
        id: `${item.id}:backup:letsencrypt`,
        kind: "backupFile",
        label: "Snapshot Let's Encrypt renewal metadata",
        path: "/etc/letsencrypt",
        requiresSudo: true,
        changesTarget: false,
        canRollback: true,
        risk: "high",
        secretPolicy: "redact",
        rollbackSpec: { restoreBackupOf: "/etc/letsencrypt" },
        notes: ["Private keys are redacted in reports and require explicit approval before transport."]
      },
      {
        id: `${item.id}:manual:domain-ownership`,
        kind: "manualStep",
        label: "Confirm domain ownership and DNS / HTTP-01 route",
        requiresSudo: false,
        changesTarget: false,
        canRollback: false,
        risk: "high",
        notes: [
          "Dry-run must not contact ACME. The operator confirms DNS, public routing, and webroot / reverse proxy readiness before live issue or renewal.",
          "Nginx / Apache / Caddy references to certificate files must be reviewed with the web-server plan."
        ]
      },
      {
        id: `${item.id}:manual:private-keys`,
        kind: "manualStep",
        label: "Confirm Let's Encrypt private key handling",
        requiresSudo: false,
        changesTarget: false,
        canRollback: false,
        risk: "high",
        secretPolicy: "redact",
        notes: [
          "privkey.pem and DNS provider credentials are secrets and are not transported without explicit operator approval.",
          "Rollback restores prior web-server certificate references if the migrated certificate is not accepted."
        ]
      }
    );
  }

  if (item.id === "caddy-server") {
    actions.push(
      {
        id: `${item.id}:backup:caddyfile`,
        kind: "backupFile",
        label: "Snapshot Caddy configuration",
        path: "/etc/caddy/Caddyfile",
        requiresSudo: true,
        changesTarget: false,
        canRollback: true,
        risk: "medium",
        rollbackSpec: { restoreBackupOf: "/etc/caddy/Caddyfile" }
      },
      {
        id: `${item.id}:manual:acme-storage`,
        kind: "manualStep",
        label: "Review Caddy ACME storage and DNS credentials",
        requiresSudo: false,
        changesTarget: false,
        canRollback: false,
        risk: "high",
        secretPolicy: "redact",
        notes: [
          "/var/lib/caddy stores ACME account material and private keys; transport requires explicit approval.",
          "DNS challenge tokens such as Cloudflare API credentials are redacted in reports."
        ]
      },
      {
        id: `${item.id}:manual:site-upstreams`,
        kind: "manualStep",
        label: "Review Caddy site roots and upstream services",
        requiresSudo: false,
        changesTarget: false,
        canRollback: false,
        risk: "medium",
        notes: [
          "Caddyfile root and reverse_proxy targets must exist on the target host before apply.",
          "Conflicting HTTP frontends on ports 80/443 must be removed or kept out of this plan."
        ]
      }
    );
  }

  if (item.id === "openresty") {
    actions.push(
      {
        id: `${item.id}:backup:configs`,
        kind: "backupFile",
        label: "Snapshot OpenResty configuration",
        path: "/etc/openresty",
        requiresSudo: true,
        changesTarget: false,
        canRollback: true,
        risk: "medium",
        rollbackSpec: { restoreBackupOf: "/etc/openresty" },
        notes: ["Live targets using /usr/local/openresty/nginx/conf are backed up by the same managed adapter."]
      },
      {
        id: `${item.id}:manual:lua-modules`,
        kind: "manualStep",
        label: "Review custom Lua modules and site roots",
        requiresSudo: false,
        changesTarget: false,
        canRollback: false,
        risk: "medium",
        secretPolicy: "redact",
        notes: [
          "Custom Lua modules and package paths are reviewed explicitly; EnvForge does not raw-copy /usr/local/openresty/lualib.",
          "TLS key paths and proxy upstreams are redacted/reviewed before apply."
        ]
      }
    );
  }

  if (item.id === "traefik-proxy") {
    actions.push(
      {
        id: `${item.id}:backup:configs`,
        kind: "backupFile",
        label: "Snapshot Traefik configuration",
        path: "/etc/traefik",
        requiresSudo: true,
        changesTarget: false,
        canRollback: true,
        risk: "medium",
        secretPolicy: "redact",
        rollbackSpec: { restoreBackupOf: "/etc/traefik" }
      },
      {
        id: `${item.id}:manual:acme-storage`,
        kind: "manualStep",
        label: "Review Traefik ACME storage and provider secrets",
        requiresSudo: false,
        changesTarget: false,
        canRollback: false,
        risk: "high",
        secretPolicy: "redact",
        notes: [
          "acme.json contains private keys and must not be copied without explicit operator approval.",
          "DNS provider tokens and dashboard credentials are redacted in reports."
        ]
      },
      {
        id: `${item.id}:manual:providers`,
        kind: "manualStep",
        label: "Review Docker/file providers and dashboard exposure",
        requiresSudo: false,
        changesTarget: false,
        canRollback: false,
        risk: "medium",
        notes: [
          "Docker provider labels require docker-host-profile target readiness.",
          "Dynamic file provider configs and dashboard routing must be verified before apply."
        ]
      }
    );
  }

  if (item.id === "node-runtime-profile") {
    actions.push({
      id: `${item.id}:manual:global-packages`,
      kind: "manualStep",
      label: "Review global npm packages and registry credentials",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "Global npm packages are reviewed and reinstalled intentionally; EnvForge does not bulk-copy npm global directories.",
        "~/.npmrc tokens and private registry URLs are redacted in reports."
      ]
    });
  }

  if (item.id === "nodejs-version-mgr") {
    actions.push({
      id: `${item.id}:manual:nvm-user-state`,
      kind: "manualStep",
      label: "Review NVM shell init, default alias, and npm globals",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "low",
      secretPolicy: "redact",
      notes: [
        "NVM is per-user; shell init files and the default Node alias must match the target user.",
        "Global npm packages, npm cache, and ~/.npmrc private registry tokens are reviewed rather than copied blindly."
      ]
    });
  }

  if (item.id === "python-toolchain") {
    actions.push({
      id: `${item.id}:manual:user-packages`,
      kind: "manualStep",
      label: "Review pipx, venv, and user/global pip packages",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "pipx apps, virtualenvs, and user/global packages are rebuilt from reviewed requirements rather than copied blindly.",
        "pip.conf index credentials are redacted in reports."
      ]
    });
  }

  if (item.id === "pyenv-toolchain") {
    actions.push({
      id: `${item.id}:manual:pyenv-user-state`,
      kind: "manualStep",
      label: "Review pyenv versions, plugins, and rebuild scope",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "low",
      secretPolicy: "redact",
      notes: [
        "pyenv is per-user; global/local version files and shell init must be reviewed for the target user.",
        "Compiled Python versions, virtualenvs, plugins, and pip index credentials are rebuilt or selected explicitly."
      ]
    });
  }

  if (item.id === "php-toolchain") {
    actions.push({
      id: `${item.id}:manual:composer`,
      kind: "manualStep",
      label: "Review Composer global packages and repository credentials",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "Global Composer packages are reviewed and reinstalled intentionally; EnvForge does not copy project vendor trees.",
        "Composer auth tokens and private repository URLs are redacted in reports."
      ]
    });
  }

  if (item.id === "ruby-toolchain") {
    actions.push({
      id: `${item.id}:manual:gems`,
      kind: "manualStep",
      label: "Review RubyGems, Bundler config, and private gem sources",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "Global gems are reviewed and reinstalled intentionally; EnvForge does not copy project vendor/bundle trees.",
        "RubyGems API keys and private Bundler source credentials are redacted in reports."
      ]
    });
  }

  if (item.id === "golang-runtime") {
    actions.push({
      id: `${item.id}:manual:go-env`,
      kind: "manualStep",
      label: "Review Go env and private module settings",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "GOPRIVATE/GONOSUMDB can reveal private module domains and require review.",
        "Module cache and build artifacts are rebuilt rather than copied."
      ]
    });
  }

  if (item.id === "openjdk-runtime") {
    actions.push({
      id: `${item.id}:manual:maven-settings`,
      kind: "manualStep",
      label: "Review Maven settings and JVM tuning",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "Maven settings.xml can contain private repository credentials and mirror URLs.",
        "JVM heap/GC tuning is environment-specific and must be reviewed on the target."
      ]
    });
  }

  if (item.id === "rust-toolchain") {
    actions.push({
      id: `${item.id}:manual:cargo-config`,
      kind: "manualStep",
      label: "Review Cargo registries and credentials",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "Cargo credentials and private registry tokens are redacted before reports are shared.",
        "target directories and registry caches are rebuilt on demand."
      ]
    });
  }

  if (item.id === "dotnet-runtime") {
    actions.push({
      id: `${item.id}:manual:nuget-config`,
      kind: "manualStep",
      label: "Review NuGet feeds and credentials",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "NuGet.Config can contain private feed URLs and clear-text package source credentials.",
        "Global package caches and project build outputs are rebuilt rather than copied."
      ]
    });
  }

  if (item.id === "git-version-control") {
    actions.push({
      id: `${item.id}:manual:git-config`,
      kind: "manualStep",
      label: "Review Git credential helpers and signing keys",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "Git credential helpers, URL rewrites, and signing key paths can expose secrets or private endpoints.",
        "Repositories, SSH keys, and GPG keys are not copied by this card."
      ]
    });
  }

  if (item.id === "ansible-tool") {
    actions.push({
      id: `${item.id}:manual:ansible-secrets`,
      kind: "manualStep",
      label: "Review Ansible inventories, vaults, and SSH keys",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "Inventories, vault password files, and private key references are operator-owned.",
        "EnvForge does not copy playbook repositories or vault material automatically."
      ]
    });
  }

  if (item.id === "terraform-iac") {
    actions.push({
      id: `${item.id}:manual:terraform-state`,
      kind: "manualStep",
      label: "Review Terraform credentials and block state-file migration",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "Terraform credentials files are redacted and require explicit review.",
        "terraform.tfstate is project-owned and must not be migrated by EnvForge."
      ]
    });
  }

  if (item.id === "kubernetes-tools") {
    actions.push({
      id: `${item.id}:manual:kubeconfig`,
      kind: "manualStep",
      label: "Review kubeconfig and Helm registry credentials",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "Kubeconfigs contain cluster endpoints, client certificates, and tokens.",
        "Helm repository and OCI registry credentials are redacted before reports are shared."
      ]
    });
  }

  if (item.id === "flutter-sdk") {
    actions.push({
      id: `${item.id}:manual:flutter-user-state`,
      kind: "manualStep",
      label: "Review Flutter SDK path, pub cache, and platform SDK scope",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "low",
      secretPolicy: "redact",
      notes: [
        "Flutter SDK paths and PATH updates are per-user and must be reviewed against the target account.",
        "Pub credentials are redacted; Android SDK, emulator images, and Xcode toolchains are outside this card's migration scope."
      ]
    });
  }

  if (item.id === "rsync-tools") {
    actions.push({
      id: `${item.id}:manual:rsync-secrets`,
      kind: "manualStep",
      label: "Review rsync daemon secrets and backup repositories",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "rsync daemon secrets, SSH keys, rclone remotes, and borg/restic repositories stay operator-owned.",
        "This card installs tools and governs config; it does not migrate backup datasets."
      ]
    });
  }

  if (item.id === "htop-tools") {
    actions.push({
      id: `${item.id}:manual:ops-tool-preferences`,
      kind: "manualStep",
      label: "Review ops tool preferences and sysstat history",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "low",
      notes: [
        "htop preferences are per-user and can be copied only after target users exist.",
        "Historical sar/sysstat samples are not migrated."
      ]
    });
  }

  if (item.id === "zsh-shell") {
    actions.push({
      id: `${item.id}:manual:zsh-dotfiles`,
      kind: "manualStep",
      label: "Review Zsh dotfiles and default-shell change",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "low",
      secretPolicy: "redact",
      notes: [
        "chsh is not automated until the target user exists and the operator confirms the login shell.",
        "Custom Oh My Zsh plugins and sourced files are reviewed as per-user dotfiles."
      ]
    });
  }

  if (item.id === "fish-shell") {
    actions.push({
      id: `${item.id}:manual:fish-config`,
      kind: "manualStep",
      label: "Review Fish functions and Starship prompt config",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "low",
      secretPolicy: "redact",
      notes: [
        "Default-shell switching is manual and requires the target user to exist.",
        "Fish functions, conf.d snippets, and Starship config are per-user and reviewed before transport."
      ]
    });
  }

  if (item.id === "neovim-editor") {
    actions.push({
      id: `${item.id}:manual:nvim-config`,
      kind: "manualStep",
      label: "Review Neovim config, plugins, and LSP rebuild scope",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "low",
      secretPolicy: "redact",
      notes: [
        "Neovim package install is system-scoped; plugin manager state and LSP servers are rebuilt.",
        "Lua configs can reference external plugin hosts or tokens and are redacted in reports."
      ]
    });
  }

  if (item.id === "tmux-multiplex") {
    actions.push({
      id: `${item.id}:manual:tmux-config`,
      kind: "manualStep",
      label: "Review tmux config, shell hooks, and plugin state",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "low",
      secretPolicy: "redact",
      notes: [
        "Live tmux sessions are not migrated.",
        "run-shell hooks and plugin declarations are reviewed before copying user-level config."
      ]
    });
  }

  if (item.id === "rust-cli-tools") {
    actions.push({
      id: `${item.id}:manual:cli-tool-config`,
      kind: "manualStep",
      label: "Review modern CLI tool config and distro package drift",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "low",
      notes: [
        "bat, fd, eza/exa, and tldr package names differ across distros.",
        "Tool caches and shell integrations are rebuilt instead of copied."
      ]
    });
  }

  if (item.id === "nethogs-bandwidth") {
    actions.push({
      id: `${item.id}:manual:packet-capture-scope`,
      kind: "manualStep",
      label: "Review packet-capture privileges and vnstat history",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      notes: [
        "nethogs, iftop, and tcpdump require root or CAP_NET_RAW when used for capture.",
        "vnstat per-interface history under /var/lib/vnstat is not migrated."
      ]
    });
  }

  if (item.id === "memcached") {
    actions.push({
      id: `${item.id}:manual:memcached-bind`,
      kind: "manualStep",
      label: "Review Memcached bind address and memory limit",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      notes: [
        "Memcached is in-memory only; there is no persistent cache data to migrate.",
        "Bind address, port, max memory, and internet exposure must be reviewed before live apply."
      ]
    });
  }

  if (item.id === "valkey-server") {
    actions.push({
      id: `${item.id}:manual:valkey-data-strategy`,
      kind: "manualStep",
      label: "Review Valkey RDB/AOF strategy and secrets",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "Valkey persistence uses explicit SAVE/BGSAVE review or operator cache reset.",
        "requirepass, masterauth, ACL files, and replication endpoints are secret/review surfaces."
      ]
    });
  }

  if (item.id === "prometheus-monitoring") {
    actions.push({
      id: `${item.id}:manual:prometheus-tsdb`,
      kind: "manualStep",
      label: "Review Prometheus TSDB snapshot and scrape credentials",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "Prometheus TSDB data must use snapshot/export or be rebuilt from scrape targets.",
        "Bearer tokens, remote_write credentials, and target TLS files are redacted before reporting."
      ]
    });
  }

  if (item.id === "grafana-dashboard") {
    actions.push({
      id: `${item.id}:manual:grafana-backup`,
      kind: "manualStep",
      label: "Review Grafana database backup and datasource secrets",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "Dashboards, users, and alerting state live in the Grafana database and require backup/restore review.",
        "Datasource secureJsonData, OAuth client secrets, and secret_key are treated as secrets."
      ]
    });
  }

  if (item.id === "netdata-monitoring") {
    actions.push({
      id: `${item.id}:manual:netdata-cloud-stream`,
      kind: "manualStep",
      label: "Review Netdata claim tokens, stream config, and metric history",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "Cloud claim tokens and streaming credentials are rotated or re-issued on the target.",
        "Historical metric databases are rebuilt unless the operator explicitly exports them."
      ]
    });
  }

  if (item.id === "zabbix-monitoring") {
    actions.push({
      id: `${item.id}:manual:zabbix-agent-config`,
      kind: "manualStep",
      label: "Review Zabbix server endpoints, TLS PSK, and UserParameters",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "Server and ServerActive endpoints must be reachable from the target network.",
        "TLS PSK files and custom UserParameter scripts are operator-reviewed before transport."
      ]
    });
  }

  if (item.id === "loki-logging") {
    actions.push({
      id: `${item.id}:manual:loki-retention`,
      kind: "manualStep",
      label: "Review Loki retention, object storage, and promtail offsets",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "Loki chunks and indexes are migrated only through an operator-approved retention/export strategy.",
        "Promtail positions files are reset or reviewed to avoid replaying old offsets."
      ]
    });
  }

  if (item.id === "mosquitto-mqtt") {
    actions.push({
      id: `${item.id}:manual:mosquitto-secrets`,
      kind: "manualStep",
      label: "Review Mosquitto password files, TLS keys, and retained messages",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "passwd_file, psk_file, bridge credentials, and TLS private keys are secret surfaces.",
        "Retained message persistence under /var/lib/mosquitto is optional and must not be copied while the broker is live."
      ]
    });
  }

  if (item.id === "rabbitmq") {
    actions.push({
      id: `${item.id}:manual:rabbitmq-definitions`,
      kind: "manualStep",
      label: "Review RabbitMQ definitions, queue contents, and Erlang cookie",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "Topology moves through definitions export/import; durable queue contents need a separate operator strategy.",
        ".erlang.cookie and TLS keys are treated as secrets."
      ]
    });
  }

  if (item.id === "meilisearch") {
    actions.push({
      id: `${item.id}:manual:meilisearch-dump`,
      kind: "manualStep",
      label: "Review Meilisearch dump/import and master key",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "Index data should move through Meilisearch dump/import rather than raw filesystem copy.",
        "MEILI_MASTER_KEY must remain consistent for API keys and protected indexes."
      ]
    });
  }

  if (item.id === "jenkins-ci") {
    actions.push({
      id: `${item.id}:manual:jenkins-home`,
      kind: "manualStep",
      label: "Review JENKINS_HOME backup, credentials store, and plugins",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "JENKINS_HOME snapshot/export is operator-approved and version-aware.",
        "credentials.xml, master.key, secret.key, and plugin compatibility are reviewed before apply."
      ]
    });
  }

  if (item.id === "gitlab-runner") {
    actions.push({
      id: `${item.id}:manual:runner-registration`,
      kind: "manualStep",
      label: "Review GitLab Runner token handling and executor dependencies",
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: "medium",
      secretPolicy: "redact",
      notes: [
        "Runner re-registration is preferred over copying project/group scoped tokens.",
        "Docker, shell, SSH, or custom executor dependencies must exist on the target."
      ]
    });
  }

  const batch10ManualActions: Partial<Record<string, { suffix: string; label: string; risk: EnvironmentPlanAction["risk"]; notes: string[] }>> = {
    "wireguard-vpn": {
      suffix: "peer-key-routing",
      label: "Review WireGuard peer keys, routes, and forwarding",
      risk: "high",
      notes: [
        "PrivateKey and PresharedKey values are secrets and require explicit transport approval.",
        "Peer endpoints, AllowedIPs, IP forwarding, NAT, and firewall rules must match the target network."
      ]
    },
    "openvpn-server": {
      suffix: "pki-routes",
      label: "Review OpenVPN PKI, pushed routes, and client config",
      risk: "high",
      notes: [
        "ca.crt, server.key, dh.pem, client certificates, and tls-auth/tls-crypt keys travel out of band.",
        "Pushed routes, CCD entries, and tunnel addresses must be reviewed against the target network."
      ]
    },
    "samba-share": {
      suffix: "share-acl",
      label: "Review Samba shares, users, ACLs, and passdb handling",
      risk: "medium",
      notes: [
        "Share paths and ACLs must exist on the target before smbd starts.",
        "Samba passdb/smbpasswd state is rebuilt or transported only after operator approval."
      ]
    },
    "nfs-server": {
      suffix: "exports",
      label: "Review NFS exports, client scopes, and backing paths",
      risk: "medium",
      notes: [
        "Export roots must exist on the target filesystem and match the intended client CIDRs.",
        "no_root_squash and Kerberos-backed exports require explicit operator review."
      ]
    },
    "tailscale": {
      suffix: "reauth",
      label: "Review Tailscale re-authentication and subnet routes",
      risk: "medium",
      notes: [
        "Re-authenticating with a reusable or ephemeral auth key is preferred over copying tailscaled.state.",
        "Subnet router, exit-node, and ACL behavior are coordinator-side state and must be confirmed."
      ]
    },
    "code-server": {
      suffix: "remote-dev-auth",
      label: "Review code-server auth, TLS, and workspace scope",
      risk: "medium",
      notes: [
        "code-server exposes an interactive development environment; password/hash, auth mode, and bind address are reviewed.",
        "Workspace repositories, SSH keys, GPG keys, and developer credentials are not copied by this card."
      ]
    },
    "sonarqube": {
      suffix: "backup-restore",
      label: "Review SonarQube database backup, plugins, and credentials",
      risk: "medium",
      notes: [
        "Project history and quality profiles move through SonarQube database backup/restore, not raw Docker volume copy.",
        "JDBC credentials, default admin credentials, plugins, and Elasticsearch index rebuild timing are reviewed."
      ]
    },
    "mongodb": {
      suffix: "dump-restore",
      label: "Review MongoDB dump/restore, auth, and replica-set scope",
      risk: "high",
      notes: [
        "MongoDB data moves through mongodump/mongorestore, replica-set resync, or an operator-approved backup.",
        "keyFile auth, users, roles, and replica-set membership must match the target topology."
      ]
    },
    "minio-storage": {
      suffix: "bucket-replication",
      label: "Review MinIO bucket replication and root credentials",
      risk: "medium",
      notes: [
        "Bucket data moves through mc mirror, replication, or vendor tooling rather than blind filesystem copy.",
        "Root credentials, KMS references, and external server URLs are re-issued or explicitly approved."
      ]
    },
    "elasticsearch": {
      suffix: "snapshot-restore",
      label: "Review Elasticsearch snapshot repository and keystore",
      risk: "medium",
      notes: [
        "Index data moves through snapshot/restore, not raw /var/lib/elasticsearch copy.",
        "elasticsearch.keystore, TLS material, bootstrap passwords, and cluster discovery settings are reviewed."
      ]
    },
    "clickhouse": {
      suffix: "backup-restore",
      label: "Review ClickHouse backup, users, and Keeper scope",
      risk: "medium",
      notes: [
        "Table data moves through BACKUP/RESTORE or clickhouse-backup, not raw /var/lib/clickhouse copy.",
        "Users, password hashes, LDAP/Kerberos settings, and Keeper/ZooKeeper coordination are reviewed."
      ]
    },
    "influxdb": {
      suffix: "backup-restore",
      label: "Review InfluxDB backup, tokens, and retention policy",
      risk: "medium",
      notes: [
        "TSDB data moves through influxd backup/restore, not raw filesystem copy.",
        "Operator tokens, bucket retention policies, and v1/v2 compatibility are reviewed."
      ]
    },
    "firewalld": {
      suffix: "ssh-lockout",
      label: "Review firewalld zones, SSH access, and rollback timer",
      risk: "high",
      notes: [
        "The public zone must keep the active SSH port open before firewalld reloads.",
        "UFW and firewalld are mutually exclusive at the packet-filter layer and must not both be active."
      ]
    },
    "vault-secrets": {
      suffix: "snapshot-unseal",
      label: "Review Vault snapshot, unseal, and auto-unseal handling",
      risk: "high",
      notes: [
        "Vault state moves through Vault snapshot/restore APIs, never raw filesystem copy.",
        "Unseal keys, root tokens, and cloud KMS auto-unseal settings remain operator-managed secrets."
      ]
    },
    "k3s": {
      suffix: "snapshot-kubeconfig",
      label: "Review k3s snapshot, kubeconfig, and persistent volume scope",
      risk: "high",
      notes: [
        "Control-plane state moves through k3s snapshot/restore or a documented SQLite backup path.",
        "k3s.yaml, node-token, cluster CA, and local-path persistent volumes require explicit review."
      ]
    },
    "swap-config": {
      suffix: "fstab-zram",
      label: "Review swap file, fstab, filesystem, and zram compatibility",
      risk: "high",
      notes: [
        "Swap changes write /etc/fstab and consume root filesystem space.",
        "Cloud image policy, sparse-file support, existing swap, and zram must be reviewed before live apply."
      ]
    },
    "nodejs-pm2": {
      suffix: "dump-user-env",
      label: "Review PM2 saved process list, user context, and environment",
      risk: "medium",
      notes: [
        "PM2 dump.pm2 is per-user state and can reference application directories outside the PM2 card.",
        "Environment variables in ecosystem files or dump output can contain secrets and are redacted."
      ]
    },
    "nextcloud": {
      suffix: "maintenance-backup",
      label: "Review Nextcloud maintenance-mode backup and restore",
      risk: "high",
      notes: [
        "Nextcloud migration requires maintenance mode, DB dump/restore, data directory transfer, and occ validation.",
        "config.php secrets, trusted domains, apps, previews, and external storage mounts require explicit review."
      ]
    },
    "gitea-server": {
      suffix: "dump-restore",
      label: "Review Gitea dump/restore, repositories, LFS, and app.ini secrets",
      risk: "medium",
      notes: [
        "Gitea repositories, LFS objects, hooks, and DB state move through gitea dump/restore.",
        "SECRET_KEY, INTERNAL_TOKEN, JWT_SECRET, OAuth provider secrets, and webhook URLs require review."
      ]
    },
    "jellyfin-media": {
      suffix: "library-metadata",
      label: "Review Jellyfin library metadata, media mounts, and hardware acceleration",
      risk: "medium",
      notes: [
        "Media files are usually operator-owned bind mounts and are not blindly copied by this card.",
        "User state, metadata, plugins, cache paths, and VAAPI/NVENC driver dependencies require review."
      ]
    },
    "keycloak": {
      suffix: "realm-export",
      label: "Review Keycloak realm export, database restore, providers, and secrets",
      risk: "high",
      notes: [
        "Realm data moves through kc.sh export/import or an operator-approved database backup/restore.",
        "OIDC client secrets, SMTP credentials, custom providers, themes, and hostname settings require review."
      ]
    },
    "authelia": {
      suffix: "state-proxy",
      label: "Review Authelia state, secrets, and reverse-proxy pairing",
      risk: "high",
      notes: [
        "JWT_SECRET, SESSION_SECRET, STORAGE_ENCRYPTION_KEY, and SQLite state must stay consistent.",
        "TOTP/WebAuthn enrolments and forward-auth proxy middleware require target-specific review."
      ]
    },
    "vaultwarden": {
      suffix: "vault-export",
      label: "Review Vaultwarden export, attachments, and admin token",
      risk: "high",
      notes: [
        "Password-vault data moves through a reviewed backup/export path rather than blind live-volume copy.",
        "ADMIN_TOKEN, SMTP credentials, attachments, and SQLite/PostgreSQL state require explicit review."
      ]
    },
    "pihole": {
      suffix: "dns-cutover",
      label: "Review Pi-hole DNS cutover and gravity data",
      risk: "high",
      notes: [
        "Pi-hole owns UDP/TCP 53; disable conflicting DNSStubListener or other resolvers before apply.",
        "WEBPASSWORD, DHCP mode, custom lists, and gravity database migration require review."
      ]
    },
    "authentik": {
      suffix: "blueprint-export",
      label: "Review Authentik blueprint export and IdP secrets",
      risk: "high",
      notes: [
        "Authentik user/provider state moves through `ak dump_config` or an approved database backup.",
        "AUTHENTIK_SECRET_KEY, OIDC/SAML client secrets, SMTP credentials, and outpost tokens require review."
      ]
    },
    "wikijs": {
      suffix: "content-backup",
      label: "Review Wiki.js content, uploads, and database backup",
      risk: "medium",
      notes: [
        "Wiki.js content moves through DB backup/restore and optional git sync repository review.",
        "Uploads, auth provider secrets, and search/index plugins must match the target deployment."
      ]
    },
    "n8n": {
      suffix: "credential-key",
      label: "Review n8n credentials, encryption key, and webhook URLs",
      risk: "medium",
      notes: [
        "N8N_ENCRYPTION_KEY must remain available to decrypt stored workflow credentials.",
        "Webhook URLs, queue mode, binary data storage, and external DB credentials require review."
      ]
    },
    "bookstack": {
      suffix: "app-key-db",
      label: "Review BookStack APP_KEY, database, and uploads",
      risk: "medium",
      notes: [
        "APP_KEY continuity is required for encrypted data and sessions.",
        "Database backup, image uploads, mail settings, and auth providers require review."
      ]
    },
    "home-assistant": {
      suffix: "hardware-integrations",
      label: "Review Home Assistant integrations and hardware bindings",
      risk: "medium",
      notes: [
        "secrets.yaml and cloud/device tokens are redacted and require target-specific review.",
        "USB/Zigbee/Z-Wave hardware, host networking, and recorder database migration are operator-owned."
      ]
    },
    "gitlab-ce": {
      suffix: "backup-restore",
      label: "Review GitLab backup, registry, and secrets",
      risk: "high",
      notes: [
        "GitLab data must move through gitlab-backup with source/target version compatibility.",
        "gitlab-secrets.json, repositories, LFS, registry data, and CI variables require explicit review."
      ]
    },
    "umami": {
      suffix: "analytics-db",
      label: "Review Umami database, app secret, and tracking domain",
      risk: "medium",
      notes: [
        "Analytics state moves through PostgreSQL backup/restore or approved DB export.",
        "APP_SECRET, tracker script name, website IDs, and retention policy are target-specific."
      ]
    },
    "nocodb": {
      suffix: "metadata-db",
      label: "Review NocoDB metadata database and external connections",
      risk: "medium",
      notes: [
        "NocoDB metadata and uploads are backed up before target start.",
        "JWT secret, external database/base credentials, and webhook integrations require review."
      ]
    },
    "adguard-home": {
      suffix: "dns-cutover",
      label: "Review AdGuard Home DNS cutover and encrypted DNS",
      risk: "high",
      notes: [
        "AdGuard Home owns UDP/TCP 53 and can conflict with Pi-hole or systemd-resolved.",
        "AdGuardHome.yaml user hashes, query logs, DoH/DoT certificates, and upstream DNS settings require review."
      ]
    },
    "docker-mailserver": {
      suffix: "maildir-dkim",
      label: "Review maildir data, DKIM keys, and mail DNS",
      risk: "high",
      notes: [
        "Maildir state, account config, DKIM private keys, and TLS material require operator-approved migration.",
        "A/MX/SPF/DKIM/DMARC/MTA-STS records and IP reputation are checked before apply."
      ]
    },
    "onlyoffice-docs": {
      suffix: "jwt-storage",
      label: "Review OnlyOffice JWT, database, and message queue",
      risk: "medium",
      notes: [
        "JWT_SECRET must match the integrating app's document-server configuration.",
        "PostgreSQL, RabbitMQ, document cache, and fonts/plugins are reviewed before target start."
      ]
    },
    "immich": {
      suffix: "photo-library-db",
      label: "Review Immich photo library and database backup",
      risk: "medium",
      notes: [
        "Photo uploads and external library mounts are operator-owned data paths.",
        "PostgreSQL/vector extension state, machine-learning cache, and object storage settings require review."
      ]
    },
    "forgejo": {
      suffix: "dump-restore",
      label: "Review Forgejo dump/restore, repositories, and secrets",
      risk: "medium",
      notes: [
        "Forgejo repositories, LFS objects, hooks, and DB state move through a dump/restore path.",
        "SECRET_KEY, INTERNAL_TOKEN, JWT_SECRET, OAuth provider secrets, and webhook URLs require review."
      ]
    },
    "uptime-kuma": {
      suffix: "sqlite-notifiers",
      label: "Review Uptime Kuma database and notifier secrets",
      risk: "medium",
      notes: [
        "kuma.db stores monitors, status pages, and notification credentials.",
        "Docker socket monitors and external endpoint reachability must match the target."
      ]
    },
    "paperless-ngx": {
      suffix: "documents-db",
      label: "Review Paperless document media, database, and secret key",
      risk: "medium",
      notes: [
        "Document media, consume/export directories, and PostgreSQL state must be backed up together.",
        "PAPERLESS_SECRET_KEY, mail credentials, OCR language packs, and Redis broker settings require review."
      ]
    },
    "navidrome": {
      suffix: "music-library",
      label: "Review Navidrome music library and metadata database",
      risk: "medium",
      notes: [
        "Music folders are usually operator-owned bind mounts and are not blindly copied.",
        "SQLite metadata, cover cache, and Last.fm/Spotify secrets require review."
      ]
    },
    "audiobookshelf": {
      suffix: "library-metadata",
      label: "Review Audiobookshelf libraries, metadata, and auth tokens",
      risk: "medium",
      notes: [
        "Audiobook/podcast libraries are operator-owned bind mounts.",
        "Metadata, user progress, podcast feeds, and auth tokens require backup/restore review."
      ]
    },
    "freshrss": {
      suffix: "opml-db",
      label: "Review FreshRSS OPML/users, database, and API tokens",
      risk: "medium",
      notes: [
        "FreshRSS users and feeds move through DB backup/restore or explicit OPML export/import.",
        "Fever/API tokens, feed credentials, cron settings, and OIDC secrets require review."
      ]
    }
  };
  const batch10ManualAction = batch10ManualActions[item.id];
  if (batch10ManualAction) {
    actions.push({
      id: `${item.id}:manual:${batch10ManualAction.suffix}`,
      kind: "manualStep",
      label: batch10ManualAction.label,
      requiresSudo: false,
      changesTarget: false,
      canRollback: false,
      risk: batch10ManualAction.risk,
      secretPolicy: "redact",
      notes: batch10ManualAction.notes
    });
  }
}

function risksForCatalogItem(item: CatalogItem): string[] {
  const risks = [`Support level is ${item.supportLevel ?? "basic-rebuild"}.`];
  if (item.sensitivity === "privileged") risks.push("Privileged capability; review sudo commands and service changes carefully.");
  if (item.sensitivity === "review") risks.push("Review config, data, and secret handling before apply.");
  if (item.supportLevel === "detect-only") risks.push("Detect-only capabilities should not be applied automatically.");
  return risks;
}

function verificationCommandForItem(item: CatalogItem): string {
  if (item.id === "firewall-baseline") return "sh -lc 'ufw status || firewall-cmd --state; ss -ltn | grep -E \":(22|${ENVFORGE_CURRENT_SSH_PORT:-22})\\\\b\" || systemctl is-active ssh || systemctl is-active sshd'";
  if (item.id === "firewalld") return "firewall-cmd --check-config && firewall-cmd --state";
  if (item.id === "swap-config") return "swapon --show";
  if (item.id === "fail2ban-protection") return "fail2ban-client status || systemctl is-active fail2ban";
  if (item.id === "postgres-profile") return "psql -c 'select 1' || systemctl is-active postgresql";
  if (item.id === "mysql-server") return "mysqladmin ping || mysql --execute 'select 1'";
  if (item.id === "mariadb") return "mariadb --version && (systemctl is-active mariadb || mysqladmin ping)";
  if (item.id === "certbot-ssl") return "certbot certificates; nginx -t 2>/dev/null || apachectl configtest 2>/dev/null || true";
  if (item.id === "caddy-server") return "caddy validate --config /etc/caddy/Caddyfile && systemctl is-active caddy";
  if (item.id === "openresty") return "openresty -t && systemctl is-active openresty";
  if (item.id === "traefik-proxy") return "traefik healthcheck || systemctl is-active traefik";
  if (item.id === "haproxy-lb") return "haproxy -c -f /etc/haproxy/haproxy.cfg && systemctl is-active haproxy";
  if (item.id === "apache-httpd") return "apachectl configtest && (systemctl is-active apache2 || systemctl is-active httpd)";
  if (item.id === "samba-share") return "testparm -s && (systemctl is-active smbd || systemctl is-active smb || true)";
  if (item.id === "nfs-server") return "exportfs -s && (systemctl is-active nfs-server || systemctl is-active nfs-kernel-server || true)";
  if (item.id === "wireguard-vpn") return "wg show || systemctl is-active wg-quick@wg0 || true";
  if (item.id === "openvpn-server") return "openvpn --version && (systemctl is-active openvpn-server@server || systemctl is-active openvpn || true)";
  if (item.id === "tailscale") return "tailscale status || systemctl is-active tailscaled";
  if (item.id === "php-fpm") return "php-fpm -t || php-fpm8.2 -t || php-fpm8.3 -t";
  if (item.id === "node-runtime-profile") return "node --version && npm --version";
  if (item.id === "nodejs-version-mgr") return "bash -lc 'source ~/.nvm/nvm.sh 2>/dev/null && nvm --version || node --version'";
  if (item.id === "nodejs-pm2") return "pm2 --version && pm2 ls || true";
  if (item.id === "python-toolchain") return "python3 --version && (pip3 --version || pip --version)";
  if (item.id === "pyenv-toolchain") return "pyenv --version || python3 --version";
  if (item.id === "php-toolchain") return "php --version && composer --version";
  if (item.id === "ruby-toolchain") return "ruby --version && gem --version && bundle --version";
  if (item.id === "golang-runtime") return "go version";
  if (item.id === "openjdk-runtime") return "java -version && javac -version && mvn --version";
  if (item.id === "rust-toolchain") return "rustc --version && cargo --version";
  if (item.id === "dotnet-runtime") return "dotnet --version";
  if (item.id === "git-version-control") return "git --version";
  if (item.id === "ansible-tool") return "ansible --version && ansible-playbook --version";
  if (item.id === "terraform-iac") return "terraform version";
  if (item.id === "kubernetes-tools") return "kubectl version --client && helm version";
  if (item.id === "k3s") return "k3s kubectl get nodes || systemctl is-active k3s || true";
  if (item.id === "flutter-sdk") return "flutter --version || dart --version";
  if (item.id === "code-server") return "code-server --version || systemctl is-active code-server || true";
  if (item.id === "sonarqube") return "curl -fsS http://127.0.0.1:9000/api/system/status || docker ps --filter name=sonarqube || true";
  if (item.id === "nextcloud") return "nextcloud.occ status || sudo -u www-data php /var/www/nextcloud/occ status || true";
  if (item.id === "gitea-server") return "gitea --version && (systemctl is-active gitea || true)";
  if (item.id === "jellyfin-media") return "curl -fsS http://127.0.0.1:8096/System/Info/Public || systemctl is-active jellyfin || true";
  if (item.id === "keycloak") return "curl -fsS http://127.0.0.1:8080/realms/master || docker ps --filter name=keycloak || true";
  if (item.id === "authelia") return "curl -fsS http://127.0.0.1:9091/api/state || docker ps --filter name=authelia || true";
  const batch20Verify: Record<string, string> = {
    "vaultwarden": "curl -fsS http://127.0.0.1:8080/alive || docker ps --filter name=vaultwarden || true",
    "pihole": "curl -fsS http://127.0.0.1/admin/ || docker ps --filter name=pihole || true",
    "authentik": "curl -fsS http://127.0.0.1:9000/-/health/ready || docker ps --filter name=authentik || true",
    "wikijs": "curl -fsS http://127.0.0.1:3000/healthz || docker ps --filter name=wikijs || true",
    "n8n": "curl -fsS http://127.0.0.1:5678/healthz || docker ps --filter name=n8n || true",
    "bookstack": "curl -fsS http://127.0.0.1/login || docker ps --filter name=bookstack || true",
    "home-assistant": "curl -fsS http://127.0.0.1:8123/ || docker ps --filter name=home-assistant || true",
    "gitlab-ce": "curl -fsS http://127.0.0.1/-/health || docker ps --filter name=gitlab || true",
    "umami": "curl -fsS http://127.0.0.1:3000/api/heartbeat || docker ps --filter name=umami || true",
    "nocodb": "curl -fsS http://127.0.0.1:8080/api/v1/health || docker ps --filter name=nocodb || true",
    "adguard-home": "curl -fsS http://127.0.0.1:3000/control/status || docker ps --filter name=adguard || true",
    "docker-mailserver": "docker ps --filter name=mailserver || ss -ltn | grep -E ':(25|587|993)\\\\b' || true",
    "onlyoffice-docs": "curl -fsS http://127.0.0.1/healthcheck || docker ps --filter name=onlyoffice || true",
    "immich": "curl -fsS http://127.0.0.1:2283/api/server/ping || docker ps --filter name=immich || true",
    "forgejo": "curl -fsS http://127.0.0.1:3000/api/healthz || docker ps --filter name=forgejo || true",
    "uptime-kuma": "curl -fsS http://127.0.0.1:3001/ || docker ps --filter name=uptime-kuma || true",
    "paperless-ngx": "curl -fsS http://127.0.0.1:8000/api/ || docker ps --filter name=paperless || true",
    "navidrome": "curl -fsS http://127.0.0.1:4533/ping || docker ps --filter name=navidrome || true",
    "audiobookshelf": "curl -fsS http://127.0.0.1:13378/ping || docker ps --filter name=audiobookshelf || true",
    "freshrss": "curl -fsS http://127.0.0.1/i/ || docker ps --filter name=freshrss || true"
  };
  if (batch20Verify[item.id]) return batch20Verify[item.id];
  if (item.id === "rsync-tools") return "rsync --version";
  if (item.id === "htop-tools") return "htop --version || iostat -V || true";
  if (item.id === "zsh-shell") return "zsh --version";
  if (item.id === "fish-shell") return "fish --version";
  if (item.id === "neovim-editor") return "nvim --version";
  if (item.id === "tmux-multiplex") return "tmux -V";
  if (item.id === "rust-cli-tools") return "rg --version && (fzf --version || true) && (zoxide --version || true)";
  if (item.id === "nethogs-bandwidth") return "nethogs -V || true; vnstat --version || true; nmap --version";
  if (item.id === "memcached") return "memcached -h && (systemctl is-active memcached || true)";
  if (item.id === "mongodb") return "mongosh --eval 'db.runCommand({ ping: 1 })' || mongo --eval 'db.runCommand({ ping: 1 })' || systemctl is-active mongod";
  if (item.id === "minio-storage") return "curl -fsS http://127.0.0.1:9000/minio/health/live || mc admin info local || systemctl is-active minio";
  if (item.id === "elasticsearch") return "curl -fsS http://127.0.0.1:9200/_cluster/health || systemctl is-active elasticsearch";
  if (item.id === "clickhouse") return "clickhouse-client --query 'SELECT 1' || systemctl is-active clickhouse-server";
  if (item.id === "influxdb") return "curl -fsS http://127.0.0.1:8086/health || influx ping || systemctl is-active influxdb";
  if (item.id === "valkey-server") return "valkey-cli ping || redis-cli ping || systemctl is-active valkey || systemctl is-active valkey-server";
  if (item.id === "prometheus-monitoring") return "promtool check config /etc/prometheus/prometheus.yml && (systemctl is-active prometheus || true)";
  if (item.id === "grafana-dashboard") return "curl -fsS http://127.0.0.1:3000/api/health || systemctl is-active grafana-server || true";
  if (item.id === "netdata-monitoring") return "systemctl is-active netdata || curl -fsS http://127.0.0.1:19999/api/v1/info || true";
  if (item.id === "zabbix-monitoring") return "zabbix_agentd -t agent.ping || zabbix_agent2 -t agent.ping || systemctl is-active zabbix-agent || true";
  if (item.id === "loki-logging") return "curl -fsS http://127.0.0.1:3100/ready || systemctl is-active loki || true";
  if (item.id === "mosquitto-mqtt") return "mosquitto -c /etc/mosquitto/mosquitto.conf -t || systemctl is-active mosquitto || true";
  if (item.id === "rabbitmq") return "rabbitmq-diagnostics ping || systemctl is-active rabbitmq-server || true";
  if (item.id === "meilisearch") return "curl -fsS http://127.0.0.1:7700/health || systemctl is-active meilisearch || true";
  if (item.id === "jenkins-ci") return "curl -fsS http://127.0.0.1:8080/login || systemctl is-active jenkins || true";
  if (item.id === "gitlab-runner") return "gitlab-runner verify || systemctl is-active gitlab-runner || true";
  if (item.id === "vault-secrets") return "vault status || systemctl is-active vault || true";
  const firstService = item.components.find((component) => component.label.includes("nginx") || component.label.includes("docker") || component.label.includes("redis") || component.label.includes("postgres"))?.label;
  if (firstService?.includes("nginx")) return "nginx -t";
  if (firstService?.includes("docker")) return "docker version";
  if (firstService?.includes("redis")) return "redis-cli ping";
  if (firstService?.includes("postgres")) return "psql --version";
  return "true";
}

function finalizePlan(
  plan: Omit<EnvironmentPlan, "summary" | "status"> & Partial<Pick<EnvironmentPlan, "status">>,
  extra: Partial<EnvironmentPlan["summary"]> = {}
): EnvironmentPlan {
  const actions = plan.items.flatMap((item) => item.actions);
  return {
    ...plan,
    status: plan.status ?? "needs-review",
    summary: {
      totalItems: plan.items.length,
      totalActions: actions.length,
      highRisk: actions.filter((action) => action.risk === "high").length,
      requiresSudo: actions.filter((action) => action.requiresSudo).length,
      rollbackable: actions.filter((action) => action.canRollback).length,
      ...extra
    }
  };
}

function recipeRisks(yaml: string): string[] {
  const risks = ["Imported recipes are not first-class EnvForge capability rules."];
  if (/module:\s*shell|cmd:/i.test(yaml)) risks.push("Contains shell commands that require review.");
  if (/sudo|become:\s*true/i.test(yaml)) risks.push("May require sudo privileges.");
  if (/module:\s*(ufw|firewall)|sshd_config|sudoers/i.test(yaml)) risks.push("Touches high-risk access or firewall configuration.");
  if (/state:\s*absent|remove|delete/i.test(yaml)) risks.push("May remove packages, files, or services.");
  if (/module:\s*(copy|template|lineinfile|systemd_unit)/i.test(yaml)) risks.push("May write target files and needs rollback review.");
  return [...new Set(risks)];
}

function planItemsToYaml(name: string, items: EnvironmentPlanItem[]): string {
  const lines = [`name: ${name}`, "hosts: all", "tasks:"];
  for (const item of items) {
    for (const action of item.actions) {
      if (action.kind === "installPackage") {
        lines.push(`  - name: ${escapeYaml(action.label)}`);
        lines.push("    module: package");
        lines.push("    args:");
        lines.push("      name:");
        for (const pkg of action.packageNames ?? []) lines.push(`        - ${pkg}`);
        lines.push("      state: present");
      } else if (action.kind === "removePackage") {
        lines.push(`  - name: ${escapeYaml(action.label)}`);
        lines.push("    module: package");
        lines.push("    args:");
        lines.push("      name:");
        for (const pkg of action.packageNames ?? []) lines.push(`        - ${pkg}`);
        lines.push("      state: absent");
      } else if (action.command) {
        lines.push(`  - name: ${escapeYaml(action.label)}`);
        lines.push("    module: shell");
        lines.push("    args:");
        lines.push(`      cmd: ${JSON.stringify(action.command)}`);
      } else {
        lines.push(`  - name: ${escapeYaml(action.label)}`);
        lines.push("    module: shell");
        lines.push("    args:");
        lines.push(`      cmd: ${JSON.stringify(`echo ${action.label}`)}`);
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

function planItemsToMarkdown(name: string, items: EnvironmentPlanItem[]): string {
  const lines = [`# ${name}`, ""];
  for (const item of items) {
    lines.push(`## ${item.name}`, "");
    lines.push(`Decision: ${item.userDecision}`);
    if (item.risks.length) lines.push(`Risks: ${item.risks.join("; ")}`);
    for (const action of item.actions) lines.push(`- ${action.label} (${action.kind})`);
    lines.push("");
  }
  return lines.join("\n");
}

function escapeYaml(value: string): string {
  return JSON.stringify(value);
}

/**
 * Map known catalog ids onto the approval gates the operator must
 * acknowledge before non-dry apply. Each id can request multiple gates;
 * the apply gate refuses when any returned gate is missing from
 * `acknowledgedApprovals` on the apply request.
 *
 * The mapping is intentionally explicit per id (rather than synthesised
 * from sensitivity) because the catalog audit produced specific
 * remainingRisks contracts for each high-risk item and we want the gate
 * copy to match those contracts.
 */
const CATALOG_APPROVAL_GATES: Record<string, Array<{ kind: PlanApprovalKind; label: string; prompt: string }>> = {
  "docker-host-profile": [
    {
      kind: "secret-confirm",
      label: "Confirm docker daemon.json secrets handling",
      prompt:
        "If /etc/docker/daemon.json carries registry credentials or proxy auth headers, those values are operator-managed and will not be transported by EnvForge."
    },
    {
      kind: "data-strategy-confirm",
      label: "Confirm container volume data is operator-owned",
      prompt:
        "EnvForge will not migrate /var/lib/docker. Named volumes, bind mounts, and compose state are operator-owned and migrate via the application's own backup tooling."
    }
  ],
  "ssh-hardening": [
    {
      kind: "ssh-lockout-confirm",
      label: "Confirm SSH lockout protection",
      prompt:
        "I have a second SSH session open OR I confirm safe-apply will probe SSH after writing sshd_config and auto-rollback on failure."
    },
    {
      kind: "secret-confirm",
      label: "Confirm authorized_keys handling",
      prompt: "I have reviewed the authorized_keys migration and accept that key transport happens out of band."
    }
  ],
  "firewall-baseline": [
    {
      kind: "firewall-lockout-confirm",
      label: "Confirm firewall lockout protection",
      prompt:
        "I confirm the current SSH port is explicitly recorded, remains allowed, and an auto-rollback timer is scheduled before the new ruleset is loaded."
    }
  ],
  "security-baseline": [
    {
      kind: "ssh-lockout-confirm",
      label: "Confirm SSH hardening lockout protection",
      prompt:
        "I have a second SSH session open or I confirm safe-apply will validate sshd_config and auto-rollback if reachability fails."
    },
    {
      kind: "firewall-lockout-confirm",
      label: "Confirm firewall lockout protection",
      prompt:
        "I confirm the current SSH port remains allowed while UFW/firewalld rules are changed and a rollback timer is in place."
    }
  ],
  "redis-server": [
    {
      kind: "data-strategy-confirm",
      label: "Confirm Redis RDB/AOF data strategy",
      prompt:
        "Redis persistence will use an explicit RDB/AOF review (SAVE/BGSAVE or cache reset decision). EnvForge will not copy /var/lib/redis blindly while Redis is running."
    }
  ],
  "postgres-profile": [
    {
      kind: "data-strategy-confirm",
      label: "Confirm PostgreSQL logical backup / restore strategy",
      prompt:
        "PostgreSQL data will be migrated with pg_dump / pg_dumpall / reviewed pg_basebackup, including roles and extensions. EnvForge will not raw-copy /var/lib/postgresql."
    }
  ],
  "mysql-server": [
    {
      kind: "data-strategy-confirm",
      label: "Confirm MySQL logical dump / restore strategy",
      prompt:
        "MySQL / MariaDB data will be migrated with mysqldump or mariadb-dump, including users and grants. EnvForge will not raw-copy live InnoDB files."
    }
  ],
  "mariadb": [
    {
      kind: "data-strategy-confirm",
      label: "Confirm MariaDB logical dump / restore strategy",
      prompt:
        "MariaDB data will be migrated with mariadb-dump or mysqldump, including users and grants. EnvForge will not raw-copy live InnoDB files."
    }
  ],
  "certbot-ssl": [
    {
      kind: "secret-confirm",
      label: "Confirm Let's Encrypt private key handling",
      prompt: "I have reviewed /etc/letsencrypt private keys and DNS provider credentials; secret transport requires explicit operator approval."
    },
    {
      kind: "manual-dns-confirm",
      label: "Confirm domain ownership and ACME route",
      prompt: "I confirm DNS / HTTP-01 or DNS-01 validation is ready before any live ACME issue or renewal. Dry-run will not contact ACME."
    }
  ],
  "node-runtime-profile": [
    {
      kind: "secret-confirm",
      label: "Confirm npm registry token handling",
      prompt: "I have reviewed ~/.npmrc and private registry credentials; tokens are redacted and not copied without explicit approval."
    }
  ],
  "python-toolchain": [
    {
      kind: "secret-confirm",
      label: "Confirm pip index credential handling",
      prompt: "I have reviewed pip.conf and private index URLs; credentials are redacted and not copied without explicit approval."
    }
  ],
  "caddy-server": [
    {
      kind: "secret-confirm",
      label: "Confirm Caddy ACME storage handling",
      prompt: "I have reviewed /var/lib/caddy ACME account material, private keys, and DNS challenge credentials before transport."
    },
    {
      kind: "manual-dns-confirm",
      label: "Confirm Caddy domain routing",
      prompt: "I confirm ports 80/443 and DNS records are ready for Caddy before any live automatic HTTPS issuance."
    }
  ],
  "openresty": [
    {
      kind: "secret-confirm",
      label: "Confirm OpenResty TLS and Lua secret handling",
      prompt: "I have reviewed OpenResty TLS key paths, Lua module references, and upstream secrets; sensitive values are redacted."
    }
  ],
  "traefik-proxy": [
    {
      kind: "secret-confirm",
      label: "Confirm Traefik ACME/provider secret handling",
      prompt: "I have reviewed acme.json, provider tokens, dashboard credentials, and Docker provider secrets before transport."
    },
    {
      kind: "manual-dns-confirm",
      label: "Confirm Traefik domain routing",
      prompt: "I confirm DNS, ports 80/443, and ACME challenge routing are ready before any live Traefik ACME use."
    }
  ],
  "haproxy-lb": [
    {
      kind: "secret-confirm",
      label: "Confirm HAProxy TLS key handling",
      prompt: "I have reviewed HAProxy bind certificate/key paths and backend references; secrets are redacted before reports are shared."
    }
  ],
  "apache-httpd": [
    {
      kind: "secret-confirm",
      label: "Confirm Apache TLS and auth file handling",
      prompt: "I have reviewed Apache TLS key paths, AuthUserFile references, vhost includes, and PHP handler coupling before transport."
    }
  ],
  "php-fpm": [
    {
      kind: "secret-confirm",
      label: "Confirm PHP-FPM pool secret handling",
      prompt: "I have reviewed PHP-FPM pool env vars, socket paths, and per-app credentials; sensitive values are redacted."
    }
  ],
  "php-toolchain": [
    {
      kind: "secret-confirm",
      label: "Confirm Composer credential handling",
      prompt: "I have reviewed Composer auth tokens and private repository credentials; secrets are redacted and not copied without approval."
    }
  ],
  "ruby-toolchain": [
    {
      kind: "secret-confirm",
      label: "Confirm RubyGems credential handling",
      prompt: "I have reviewed RubyGems API keys and private Bundler source credentials; secrets are redacted and not copied without approval."
    }
  ],
  "golang-runtime": [
    {
      kind: "secret-confirm",
      label: "Confirm Go private module handling",
      prompt: "I have reviewed Go env settings such as GOPRIVATE and private module endpoints; caches are rebuilt, not copied."
    }
  ],
  "openjdk-runtime": [
    {
      kind: "secret-confirm",
      label: "Confirm Maven credential handling",
      prompt: "I have reviewed Maven settings.xml private repository credentials and mirror URLs; secrets are redacted."
    }
  ],
  "rust-toolchain": [
    {
      kind: "secret-confirm",
      label: "Confirm Cargo credential handling",
      prompt: "I have reviewed Cargo credentials and private registry tokens; build artifacts and caches are rebuilt."
    }
  ],
  "dotnet-runtime": [
    {
      kind: "secret-confirm",
      label: "Confirm NuGet credential handling",
      prompt: "I have reviewed NuGet.Config private feed credentials; package caches and build outputs are rebuilt."
    }
  ],
  "git-version-control": [
    {
      kind: "secret-confirm",
      label: "Confirm Git credential helper handling",
      prompt: "I have reviewed Git credential helpers, URL rewrites, signing key paths, and include files before transport."
    }
  ],
  "ansible-tool": [
    {
      kind: "secret-confirm",
      label: "Confirm Ansible vault and key handling",
      prompt: "I have reviewed Ansible inventories, vault password files, and private key references; project repositories are not copied."
    }
  ],
  "terraform-iac": [
    {
      kind: "secret-confirm",
      label: "Confirm Terraform credential handling",
      prompt: "I have reviewed Terraform credentials; terraform.tfstate files are project-owned and must not be migrated by EnvForge."
    }
  ],
  "kubernetes-tools": [
    {
      kind: "secret-confirm",
      label: "Confirm kubeconfig credential handling",
      prompt: "I have reviewed kubeconfig client keys/tokens and Helm registry credentials before transport."
    }
  ],
  "samba-share": [
    {
      kind: "data-strategy-confirm",
      label: "Confirm Samba share data strategy",
      prompt: "Samba share contents and ACLs are operator-owned. EnvForge reviews smb.conf and does not infer or copy arbitrary share roots without explicit approval."
    },
    {
      kind: "secret-confirm",
      label: "Confirm Samba account and passdb handling",
      prompt: "I have reviewed smbpasswd/passdb/account mappings and accept that Samba credentials are rebuilt or transported out of band."
    }
  ],
  "nfs-server": [
    {
      kind: "data-strategy-confirm",
      label: "Confirm NFS export path strategy",
      prompt: "NFS export roots must already exist or be migrated by an operator-approved filesystem plan; EnvForge only applies reviewed export config."
    }
  ],
  "code-server": [
    {
      kind: "secret-confirm",
      label: "Confirm code-server auth and remote-dev exposure",
      prompt: "I have reviewed code-server password/hash, bind address, TLS, and reverse-proxy exposure before making the remote development service reachable."
    }
  ],
  "sonarqube": [
    {
      kind: "data-strategy-confirm",
      label: "Confirm SonarQube backup / restore strategy",
      prompt: "SonarQube project history, quality profiles, and plugins require an operator-approved DB backup/restore; EnvForge will not raw-copy Docker volumes."
    },
    {
      kind: "secret-confirm",
      label: "Confirm SonarQube credentials",
      prompt: "I have reviewed JDBC credentials and default admin credentials and will rotate or re-issue them on the target."
    }
  ],
  "mongodb": [
    {
      kind: "data-strategy-confirm",
      label: "Confirm MongoDB dump / restore strategy",
      prompt: "MongoDB data will use mongodump/mongorestore, replica-set resync, or an operator-approved backup. EnvForge will not raw-copy /var/lib/mongodb."
    },
    {
      kind: "secret-confirm",
      label: "Confirm MongoDB auth material",
      prompt: "I have reviewed keyFile auth, users, roles, replica-set membership, and bind IPs before migrate."
    }
  ],
  "minio-storage": [
    {
      kind: "data-strategy-confirm",
      label: "Confirm MinIO bucket replication strategy",
      prompt: "MinIO bucket data will move through mc mirror, site replication, or vendor tooling. EnvForge will not blind-copy object data."
    },
    {
      kind: "secret-confirm",
      label: "Confirm MinIO root/KMS credentials",
      prompt: "I have reviewed root credentials, KMS references, and site URLs and will re-issue or explicitly approve them on the target."
    }
  ],
  "elasticsearch": [
    {
      kind: "data-strategy-confirm",
      label: "Confirm Elasticsearch snapshot / restore strategy",
      prompt: "Elasticsearch index data will use snapshot/restore. EnvForge will not raw-copy /var/lib/elasticsearch."
    },
    {
      kind: "secret-confirm",
      label: "Confirm Elasticsearch keystore and TLS material",
      prompt: "I have reviewed elasticsearch.keystore, bootstrap passwords, TLS material, and cluster discovery settings."
    }
  ],
  "clickhouse": [
    {
      kind: "data-strategy-confirm",
      label: "Confirm ClickHouse backup / restore strategy",
      prompt: "ClickHouse table data will use BACKUP/RESTORE or clickhouse-backup. EnvForge will not raw-copy /var/lib/clickhouse."
    },
    {
      kind: "secret-confirm",
      label: "Confirm ClickHouse user and cluster secrets",
      prompt: "I have reviewed users.xml password hashes, LDAP/Kerberos settings, and Keeper/ZooKeeper coordination."
    }
  ],
  "influxdb": [
    {
      kind: "data-strategy-confirm",
      label: "Confirm InfluxDB backup / restore strategy",
      prompt: "InfluxDB TSDB data will use influxd backup/restore. EnvForge will not raw-copy /var/lib/influxdb."
    },
    {
      kind: "secret-confirm",
      label: "Confirm InfluxDB tokens",
      prompt: "I have reviewed operator API tokens, bolt DB secret state, and bucket retention policy before migrate."
    }
  ],
  "rsync-tools": [
    {
      kind: "secret-confirm",
      label: "Confirm rsync/backup secret handling",
      prompt: "I have reviewed rsync daemon secrets, SSH keys, rclone remotes, and borg/restic repository credentials."
    }
  ],
  "valkey-server": [
    {
      kind: "data-strategy-confirm",
      label: "Confirm Valkey RDB/AOF data strategy",
      prompt:
        "Valkey persistence will use explicit SAVE/BGSAVE review or an operator cache-reset decision. EnvForge will not raw-copy /var/lib/valkey while Valkey is running."
    },
    {
      kind: "secret-confirm",
      label: "Confirm Valkey password and ACL handling",
      prompt: "I have reviewed requirepass, masterauth, ACL files, and replication credentials; secrets are redacted and transported out of band."
    }
  ],
  "prometheus-monitoring": [
    {
      kind: "data-strategy-confirm",
      label: "Confirm Prometheus TSDB strategy",
      prompt: "Prometheus TSDB data will be snapshot/exported or rebuilt; EnvForge will not raw-copy a live /var/lib/prometheus."
    },
    {
      kind: "secret-confirm",
      label: "Confirm Prometheus scrape credential handling",
      prompt: "I have reviewed bearer tokens, remote_write credentials, and target TLS files; secrets are redacted and transported out of band."
    }
  ],
  "grafana-dashboard": [
    {
      kind: "backup-restore-confirm",
      label: "Confirm Grafana database backup/restore",
      prompt: "Grafana dashboards, users, and alert state will move through a backup/snapshot path, not blind live copy."
    },
    {
      kind: "secret-confirm",
      label: "Confirm Grafana datasource secrets",
      prompt: "I have reviewed datasource passwords, secureJsonData, OAuth client secrets, and Grafana secret_key."
    }
  ],
  "netdata-monitoring": [
    {
      kind: "secret-confirm",
      label: "Confirm Netdata cloud and stream secrets",
      prompt: "I have reviewed Netdata claim tokens, stream credentials, and alert webhook tokens; metric history is rebuilt unless explicitly exported."
    }
  ],
  "zabbix-monitoring": [
    {
      kind: "secret-confirm",
      label: "Confirm Zabbix TLS PSK handling",
      prompt: "I have reviewed Zabbix TLS PSK files, Server/ServerActive endpoints, and custom UserParameter scripts."
    }
  ],
  "loki-logging": [
    {
      kind: "data-strategy-confirm",
      label: "Confirm Loki chunk/index retention strategy",
      prompt: "Loki chunk/index data will use an operator-approved retention/export strategy; promtail offsets are reset or reviewed."
    },
    {
      kind: "secret-confirm",
      label: "Confirm Loki object-storage secrets",
      prompt: "I have reviewed S3/GCS credentials, tenant auth headers, and promtail client credentials."
    }
  ],
  "mosquitto-mqtt": [
    {
      kind: "data-strategy-confirm",
      label: "Confirm Mosquitto retained-message strategy",
      prompt: "Retained messages under /var/lib/mosquitto are optional and will not be copied while the broker is live."
    },
    {
      kind: "secret-confirm",
      label: "Confirm Mosquitto password and TLS handling",
      prompt: "I have reviewed password_file, psk_file, bridge credentials, and TLS key material."
    }
  ],
  "rabbitmq": [
    {
      kind: "data-strategy-confirm",
      label: "Confirm RabbitMQ definitions and queue strategy",
      prompt: "RabbitMQ topology will use definitions export/import; durable queue contents require a separate operator-approved strategy."
    },
    {
      kind: "secret-confirm",
      label: "Confirm RabbitMQ Erlang cookie and TLS handling",
      prompt: "I have reviewed .erlang.cookie, TLS keys, and management credentials before transport."
    }
  ],
  "meilisearch": [
    {
      kind: "data-strategy-confirm",
      label: "Confirm Meilisearch dump/import strategy",
      prompt: "Meilisearch index data will move through dump/import or be rebuilt; EnvForge will not raw-copy a live data.ms directory."
    },
    {
      kind: "secret-confirm",
      label: "Confirm Meilisearch master key handling",
      prompt: "I have reviewed MEILI_MASTER_KEY continuity and API key impact before transport."
    }
  ],
  "jenkins-ci": [
    {
      kind: "backup-restore-confirm",
      label: "Confirm Jenkins home backup/restore",
      prompt: "JENKINS_HOME migration uses an operator-approved snapshot/export with compatible Jenkins/plugin versions."
    },
    {
      kind: "secret-confirm",
      label: "Confirm Jenkins credential store handling",
      prompt: "I have reviewed credentials.xml, master.key, secret.key, and plugin secrets; secrets travel out of band."
    }
  ],
  "gitlab-runner": [
    {
      kind: "secret-confirm",
      label: "Confirm GitLab Runner token handling",
      prompt: "I will re-register runners or explicitly confirm config.toml tokens; job caches and builds are not migrated."
    }
  ],
  "firewalld": [
    {
      kind: "firewall-lockout-confirm",
      label: "Confirm firewalld lockout protection",
      prompt:
        "I confirm the public zone keeps SSH open and an auto-rollback timer is scheduled before reloading the rule set."
    }
  ],
  "wireguard-vpn": [
    {
      kind: "secret-confirm",
      label: "Confirm WireGuard private key handling",
      prompt: "Per-peer private keys will not leave the source host without explicit operator transport."
    }
  ],
  "openvpn-server": [
    {
      kind: "secret-confirm",
      label: "Confirm OpenVPN PKI handling",
      prompt:
        "ca.crt, server.key, dh.pem, tls-auth/tls-crypt static keys are confirmed and will travel out of band."
    }
  ],
  "tailscale": [
    {
      kind: "secret-confirm",
      label: "Confirm Tailscale node identity migration",
      prompt:
        "I will re-authenticate (`tailscale up --authkey=...`) on the target rather than copy /var/lib/tailscale/tailscaled.state."
    }
  ],
  "k3s": [
    {
      kind: "backup-restore-confirm",
      label: "Confirm k3s state migration uses snapshot/restore",
      prompt:
        "K3s data will be migrated via `etcd-snapshot save` (or db backup for SQLite mode) — never raw rsync of /var/lib/rancher."
    },
    {
      kind: "secret-confirm",
      label: "Confirm node-token + k3s.yaml handling",
      prompt: "Cluster CA, admin token, and node-token are treated as secrets and confirmed."
    }
  ],
  "swap-config": [
    {
      kind: "data-strategy-confirm",
      label: "Confirm swap filesystem and zram compatibility",
      prompt: "The target filesystem supports the planned swap file, existing zram/swap policy has been reviewed, and /etc/fstab rollback is available."
    }
  ],
  "nodejs-pm2": [
    {
      kind: "secret-confirm",
      label: "Confirm PM2 environment secret handling",
      prompt: "I have reviewed PM2 dump/ecosystem environment variables; app secrets are redacted and not copied without approval."
    }
  ],
  "nextcloud": [
    {
      kind: "backup-restore-confirm",
      label: "Confirm Nextcloud maintenance backup/restore",
      prompt: "Nextcloud will be put in maintenance mode and migrated with DB dump/restore plus reviewed data directory transfer."
    },
    {
      kind: "secret-confirm",
      label: "Confirm Nextcloud config.php secrets",
      prompt: "config.php instance secrets, DB credentials, trusted domains, and app credentials have been reviewed."
    }
  ],
  "gitea-server": [
    {
      kind: "backup-restore-confirm",
      label: "Confirm Gitea dump/restore strategy",
      prompt: "Gitea repositories, LFS objects, hooks, and DB state will move through gitea dump/restore, not raw rsync."
    },
    {
      kind: "secret-confirm",
      label: "Confirm Gitea app.ini secret handling",
      prompt: "SECRET_KEY, INTERNAL_TOKEN, JWT_SECRET, OAuth provider secrets, and webhook credentials have been reviewed."
    }
  ],
  "jellyfin-media": [
    {
      kind: "data-strategy-confirm",
      label: "Confirm Jellyfin media and metadata scope",
      prompt: "Media bind mounts, library metadata, plugins, cache paths, and hardware acceleration drivers are operator-reviewed."
    }
  ],
  "vault-secrets": [
    {
      kind: "secret-confirm",
      label: "Confirm Vault unseal and storage handling",
      prompt: "Unseal keys / root token / storage backend snapshots are operator-managed and not transported by EnvForge."
    },
    {
      kind: "backup-restore-confirm",
      label: "Confirm Vault snapshot/restore",
      prompt: "Vault state will be migrated using Vault snapshot APIs, never via filesystem copy."
    }
  ],
  "vaultwarden": [
    {
      kind: "secret-confirm",
      label: "Confirm vault data handling",
      prompt: "vw-data/db.sqlite3, attachments, and ADMIN_TOKEN are treated as secrets and confirmed."
    },
    {
      kind: "data-strategy-confirm",
      label: "Confirm migration via Bitwarden export",
      prompt: "Vaultwarden data will be migrated via Bitwarden's own export tooling, not raw filesystem copy."
    }
  ],
  "pihole": [
    {
      kind: "manual-dns-confirm",
      label: "Confirm Pi-hole DNS cutover",
      prompt:
        "Pi-hole will own UDP/TCP 53 on the target; systemd-resolved DNSStubListener or other DNS services are disabled or intentionally excluded."
    },
    {
      kind: "secret-confirm",
      label: "Confirm Pi-hole admin secret handling",
      prompt: "WEBPASSWORD/admin hashes, DHCP settings, custom lists, and gravity data are reviewed before target cutover."
    }
  ],
  "authentik": [
    {
      kind: "identity-provider-confirm",
      label: "Confirm Authentik IdP migration",
      prompt: "Authentik realms will be migrated via `ak dump_config` + restore, not via raw Postgres rsync."
    },
    {
      kind: "secret-confirm",
      label: "Confirm AUTHENTIK_SECRET_KEY handling",
      prompt: "AUTHENTIK_SECRET_KEY, smtp credentials, and OIDC client secrets are confirmed."
    }
  ],
  "adguard-home": [
    {
      kind: "manual-dns-confirm",
      label: "Confirm AdGuard Home DNS cutover",
      prompt:
        "AdGuard Home will own UDP/TCP 53 on the target; Pi-hole/systemd-resolved conflicts are resolved before apply."
    },
    {
      kind: "secret-confirm",
      label: "Confirm AdGuard Home credential handling",
      prompt: "AdGuardHome.yaml user hashes, DoH/DoT certificates, upstream credentials, and query-log retention are reviewed."
    }
  ],
  "keycloak": [
    {
      kind: "identity-provider-confirm",
      label: "Confirm Keycloak realm migration",
      prompt: "Realm migration will use `kc.sh export` + import, not raw Postgres rsync."
    },
    {
      kind: "secret-confirm",
      label: "Confirm Keycloak secret handling",
      prompt: "KEYCLOAK_ADMIN_PASSWORD, OIDC client secrets, and SMTP credentials are confirmed."
    }
  ],
  "authelia": [
    {
      kind: "identity-provider-confirm",
      label: "Confirm Authelia state handling",
      prompt: "JWT_SECRET, SESSION_SECRET, STORAGE_ENCRYPTION_KEY, and TOTP/WebAuthn DB are confirmed."
    },
    {
      kind: "secret-confirm",
      label: "Confirm Authelia secret continuity",
      prompt: "Authelia JWT, session, storage encryption, SMTP, and OIDC secrets will remain consistent or be explicitly rotated."
    }
  ],
  "gitlab-ce": [
    {
      kind: "backup-restore-confirm",
      label: "Confirm gitlab-backup migration",
      prompt:
        "GitLab data will move via `gitlab-backup create` / `gitlab-backup restore`. Versions on source and target match."
    },
    {
      kind: "secret-confirm",
      label: "Confirm gitlab-secrets.json handling",
      prompt: "/etc/gitlab/gitlab-secrets.json travels with the data and is treated as a secret."
    }
  ],
  "docker-mailserver": [
    {
      kind: "manual-dns-confirm",
      label: "Confirm DNS records for new mail host",
      prompt: "A/MX/SPF/DKIM/DMARC/MTA-STS records have been updated at the registrar before apply."
    },
    {
      kind: "secret-confirm",
      label: "Confirm DKIM private key handling",
      prompt: "DKIM private keys under opendkim/ are operator-managed and confirmed."
    }
  ],
  "mail-stack": [
    {
      kind: "manual-dns-confirm",
      label: "Confirm mail-stack DNS handling",
      prompt: "Mail DNS records will be updated at the registrar; IP reputation impact is acknowledged."
    },
    {
      kind: "secret-confirm",
      label: "Confirm mail-stack secret handling",
      prompt: "DKIM keys, admin passwords, and SMTP credentials are operator-managed and confirmed."
    }
  ],
  "sso-stack": [
    {
      kind: "identity-provider-confirm",
      label: "Confirm SSO identity cutover",
      prompt:
        "Authelia users, 2FA state, Redis session reset, and forward-auth routing have been reviewed before the stack becomes the login gate."
    },
    {
      kind: "secret-confirm",
      label: "Confirm SSO secret continuity",
      prompt:
        "JWT_SECRET, SESSION_SECRET, STORAGE_ENCRYPTION_KEY, Traefik ACME material, and downstream client secrets are preserved or explicitly rotated."
    }
  ]
};

export function computeRequiredApprovalsForCatalogItem(
  itemId: string,
  catalogItem: CatalogItem
): PlanRequiredApproval[] {
  const explicit = CATALOG_APPROVAL_GATES[catalogItem.id];
  if (!explicit) return [];
  return explicit.map((gate, idx) => ({
    id: `${itemId}:gate:${gate.kind}:${idx}`,
    kind: gate.kind,
    itemId,
    label: gate.label,
    prompt: gate.prompt
  }));
}

/**
 * Detect catalog conflicts among the supplied plan items and aggregate
 * each item's `requiredApprovals` onto `plan.review.approvalsRequired`.
 *
 * Used by the rebuild planner; other plan kinds can opt in by calling
 * this helper on the finalised plan before persistence.
 *
 * When `existingCapabilities` is supplied, the helper additionally checks
 * each catalog conflict rule against the union of the plan's
 * capabilityKeys and the target's existing capabilityKeys. This produces
 * "target-state" conflicts: e.g. the user selects `caddy-server` but the
 * target already runs nginx — the http-frontend rule still triggers.
 */
export function attachConflictsAndApprovalAggregate(
  plan: EnvironmentPlan,
  options: { existingCapabilities?: Record<string, string> } = {}
): EnvironmentPlan {
  const existing = options.existingCapabilities ?? {};
  // Plan-only conflicts (the historical behaviour).
  const detected = detectPlanConflicts(
    plan.items.map((item) => ({ id: item.id, capabilityKey: item.capabilityKey ?? item.audit?.capabilityKey }))
  );
  // Target-state conflicts: pretend the existing capabilities are
  // additional plan items so a single `caddy-server` selection can still
  // trigger http-frontend when nginx is already on the target.
  const phantomItems = Object.entries(existing).map(([capabilityKey, evidence]) => ({
    id: `target:${capabilityKey}`,
    capabilityKey
  }));
  const detectedWithTarget = detectPlanConflicts([
    ...plan.items.map((item) => ({ id: item.id, capabilityKey: item.capabilityKey ?? item.audit?.capabilityKey })),
    ...phantomItems
  ]);
  // Merge: keep plan-only conflicts as-is, but if a rule only fires when
  // we add target capabilities, surface it as a synthetic conflict whose
  // participatingItemIds includes both real plan items and phantom
  // target ids so the UI can label the source.
  const seenIds = new Set(detected.map((d) => d.rule.id));
  for (const extra of detectedWithTarget) {
    if (seenIds.has(extra.rule.id)) continue;
    detected.push(extra);
  }
  const approvalsRequired = plan.items.flatMap((item) => item.requiredApprovals ?? []);
  return {
    ...plan,
    summary: {
      ...plan.summary,
      effectiveSupportLevel: computeEffectiveSupportLevel(plan.items)
    },
    review: {
      ...plan.review,
      conflicts: detected.map((d) => detectedConflictToReviewConflict(d, existing)),
      approvalsRequired
    }
  };
}

/**
 * Combo / multi-item plans take the **minimum** supportLevel across all
 * plan items. The order is detect-only < basic-rebuild < managed-config <
 * full-migration. The UI labels the plan with this value so a single
 * detect-only component drags the whole plan back to detect-only depth.
 */
const SUPPORT_LEVEL_ORDER: Record<NonNullable<CatalogItem["supportLevel"]>, number> = {
  "detect-only": 0,
  "basic-rebuild": 1,
  "managed-config": 2,
  "full-migration": 3
};

export function computeEffectiveSupportLevel(items: EnvironmentPlanItem[]): NonNullable<CatalogItem["supportLevel"]> | undefined {
  let best: NonNullable<CatalogItem["supportLevel"]> | undefined;
  for (const item of items) {
    const lvl = (item.audit?.supportLevel ?? item.supportLevel) as NonNullable<CatalogItem["supportLevel"]> | undefined;
    if (!lvl) continue;
    if (best === undefined || SUPPORT_LEVEL_ORDER[lvl] < SUPPORT_LEVEL_ORDER[best]) {
      best = lvl;
    }
  }
  return best;
}

function detectedConflictToReviewConflict(
  detected: DetectedConflict,
  existingCapabilities: Record<string, string> = {}
): PlanReviewConflict {
  const participatingItemIds = [...detected.participatingItemIds];
  // Tag target-state participants explicitly so the UI can show a "this
  // capability is already on the target" badge.
  for (const key of Object.keys(detected.participatingByCapabilityKey)) {
    if (existingCapabilities[key] && !detected.rule.capabilityKeys.includes(key)) continue;
    if (existingCapabilities[key] && participatingItemIds.every((id) => !id.startsWith("target:"))) {
      participatingItemIds.push(`target:${key}`);
    }
  }
  return {
    id: detected.rule.id,
    type: detected.rule.type,
    severity: detected.rule.severity,
    reason: detected.rule.reason,
    capabilityKeys: detected.rule.capabilityKeys,
    participatingItemIds,
    resolutionOptions: detected.rule.resolutionOptions.map((opt) => ({
      id: opt.id,
      label: opt.label,
      keepCapabilityKeys: opt.keepCapabilityKeys,
      removeCapabilityKeys: opt.removeCapabilityKeys
    }))
  };
}

/**
 * Apply gate verdict — what is missing that prevents apply.
 * Returned as data so route handlers can shape the HTTP response and
 * the test suite can assert exact gates without parsing strings.
 */
export interface ApplyGateVerdict {
  ok: boolean;
  blockingConflicts: PlanReviewConflict[];
  unresolvedWarnConflicts: PlanReviewConflict[];
  missingRiskAcks: Array<{ itemId: string; risks: string[] }>;
  missingApprovalGates: PlanRequiredApproval[];
  reasons: string[];
  /**
   * Detect-only items that emit at least one mutating action (anything
   * other than `kind=review` or `kind=manualStep`). Such items are an
   * audit violation: detect-only must never produce a direct apply.
   */
  detectOnlyViolations: Array<{ itemId: string; offendingActions: string[] }>;
  /**
   * Warn conflicts whose resolutionId did not match any of the rule's
   * `resolutionOptions`. Forged acks (the client sending an unknown
   * resolutionId) end up here.
   */
  invalidResolutionIds: Array<{ conflictId: string; resolutionId: string }>;
  /**
   * When the operator picked `keep-X` but the plan still contains a
   * conflicting capability, the resolution is inconsistent. Recorded
   * here so the gate can refuse with a precise message.
   */
  inconsistentResolutions: Array<{
    conflictId: string;
    resolutionId: string;
    stillPresentCapabilityKeys: string[];
  }>;
}

/**
 * Compute whether a plan can be applied non-dry given the supplied
 * acknowledgements. The logic is shared between the apply route and
 * the test suite; UI also re-implements the readiness display.
 *
 * Server-side trust contract (E2E_SCENARIO_VALIDATION.md):
 *
 *   - **Block conflicts are recomputed from `plan.items[*].capabilityKey`.**
 *     We do NOT rely on `plan.review.conflicts` because the client may
 *     have edited the plan body. If two conflicting capabilities are
 *     still present, the gate refuses regardless of the acks shipped.
 *   - **resolutionId must belong to the rule's `resolutionOptions`.**
 *     Unknown ids are flagged as invalid.
 *   - **resolutionId must be consistent with the plan body.** When the
 *     operator picks `keep-nginx`, the plan must not still contain any
 *     of `web-server.caddy` / `web-server.openresty` /
 *     `network.reverse-proxy.traefik`.
 *   - **Detect-only items must not have mutating actions.** Any
 *     `installPackage` / `writeConfig` / `runCommand` / `restart` /
 *     `enableService` / `removePackage` action on a detect-only item is
 *     a violation.
 */
export function evaluateApplyGate(
  plan: EnvironmentPlan,
  ack: {
    risks?: Record<string, string[]>;
    conflicts?: Array<{ conflictId: string; resolutionId?: string }>;
    approvals?: Array<{ itemId: string; gateId: string }>;
  } = {}
): ApplyGateVerdict {
  // ── 1. Re-derive conflicts from the live plan body ────────────────
  const liveDetected = detectPlanConflicts(
    plan.items.map((item) => ({
      id: item.id,
      capabilityKey: item.capabilityKey ?? item.audit?.capabilityKey
    }))
  );
  const liveConflicts: PlanReviewConflict[] = liveDetected.map((d) => detectedConflictToReviewConflict(d));
  // Fold in any conflicts already attached during plan generation
  // (e.g. target-state synthetic conflicts) that the live re-derivation
  // wouldn't see because the target capabilities aren't in plan.items.
  const persistedConflicts = plan.review.conflicts ?? [];
  const seen = new Set(liveConflicts.map((c) => c.id));
  for (const c of persistedConflicts) {
    if (!seen.has(c.id)) {
      liveConflicts.push(c);
      seen.add(c.id);
    }
  }

  const blocking = liveConflicts.filter((c) => c.severity === "block");
  const warnConflicts = liveConflicts.filter((c) => c.severity === "warn");
  const ackByConflict = new Map<string, { conflictId: string; resolutionId?: string }>();
  for (const entry of ack.conflicts ?? []) ackByConflict.set(entry.conflictId, entry);
  const conflictAckIds = new Set([...ackByConflict.keys()]);

  // ── 2. Validate resolutionIds against the catalog rule definitions ─
  const invalidResolutionIds: Array<{ conflictId: string; resolutionId: string }> = [];
  const inconsistentResolutions: Array<{
    conflictId: string;
    resolutionId: string;
    stillPresentCapabilityKeys: string[];
  }> = [];
  const planCapKeys = new Set(
    plan.items
      .map((item) => item.capabilityKey ?? item.audit?.capabilityKey)
      .filter((k): k is string => Boolean(k))
  );
  for (const ackEntry of ack.conflicts ?? []) {
    if (!ackEntry.resolutionId) continue;
    const rule = getCatalogConflict(ackEntry.conflictId);
    if (!rule) {
      invalidResolutionIds.push({ conflictId: ackEntry.conflictId, resolutionId: ackEntry.resolutionId });
      continue;
    }
    const option = rule.resolutionOptions.find((opt) => opt.id === ackEntry.resolutionId);
    if (!option) {
      invalidResolutionIds.push({ conflictId: ackEntry.conflictId, resolutionId: ackEntry.resolutionId });
      continue;
    }
    // Consistency: any capabilityKey listed in `removeCapabilityKeys`
    // must NOT still be in the plan; equivalently if `keepCapabilityKeys`
    // is set, the plan must not still contain other rule keys.
    const stillPresent: string[] = [];
    if (option.removeCapabilityKeys) {
      for (const key of option.removeCapabilityKeys) {
        if (planCapKeys.has(key)) stillPresent.push(key);
      }
    }
    if (option.keepCapabilityKeys) {
      const others = rule.capabilityKeys.filter((k) => !option.keepCapabilityKeys?.includes(k));
      for (const key of others) {
        if (planCapKeys.has(key) && !stillPresent.includes(key)) stillPresent.push(key);
      }
    }
    if (stillPresent.length > 0) {
      inconsistentResolutions.push({
        conflictId: ackEntry.conflictId,
        resolutionId: ackEntry.resolutionId,
        stillPresentCapabilityKeys: stillPresent
      });
    }
  }

  const blockingConflicts = blocking;
  const unresolvedWarnConflicts = warnConflicts.filter((c) => !conflictAckIds.has(c.id));

  // ── 3. Risk acks ──────────────────────────────────────────────────
  const missingRiskAcks: Array<{ itemId: string; risks: string[] }> = [];
  for (const item of plan.items) {
    const remaining = item.audit?.remainingRisks ?? [];
    if (remaining.length === 0) continue;
    const acked = new Set((ack.risks?.[item.id] ?? []).map((value) => value.trim()));
    const missing = remaining.filter((risk) => !acked.has(risk.trim()));
    if (missing.length > 0) missingRiskAcks.push({ itemId: item.id, risks: missing });
  }

  // ── 4. Approval gates ─────────────────────────────────────────────
  const approvalsRequired = plan.review.approvalsRequired ?? [];
  const approvalAcks = new Set(
    (ack.approvals ?? []).map((entry) => `${entry.itemId}::${entry.gateId}`)
  );
  const missingApprovalGates = approvalsRequired.filter(
    (gate) => !approvalAcks.has(`${gate.itemId}::${gate.id}`)
  );

  // ── 5. Detect-only must not mutate the target ─────────────────────
  const MUTATING_KINDS = new Set<EnvironmentPlanActionKind>([
    "installPackage",
    "removePackage",
    "writeConfig",
    "copyConfig",
    "transferArtifact",
    "enableService",
    "restartService",
    "reloadService",
    "runCommand",
    "restart",
    "rollback"
  ]);
  const detectOnlyViolations: Array<{ itemId: string; offendingActions: string[] }> = [];
  for (const item of plan.items) {
    const lvl = (item.audit?.supportLevel ?? item.supportLevel) as
      | NonNullable<CatalogItem["supportLevel"]>
      | undefined;
    if (lvl !== "detect-only") continue;
    const offending = item.actions
      .filter((action) => MUTATING_KINDS.has(action.kind))
      .map((action) => `${action.kind}:${action.id}`);
    if (offending.length > 0) {
      detectOnlyViolations.push({ itemId: item.id, offendingActions: offending });
    }
  }

  const reasons: string[] = [];
  if (blockingConflicts.length > 0) {
    reasons.push(
      `${blockingConflicts.length} blocking conflict(s): ${blockingConflicts.map((c) => c.id).join(", ")}.`
    );
  }
  if (unresolvedWarnConflicts.length > 0) {
    reasons.push(
      `${unresolvedWarnConflicts.length} warning conflict(s) require acknowledgement.`
    );
  }
  if (invalidResolutionIds.length > 0) {
    reasons.push(
      `${invalidResolutionIds.length} resolutionId(s) are invalid for their conflict rule.`
    );
  }
  if (inconsistentResolutions.length > 0) {
    reasons.push(
      `${inconsistentResolutions.length} resolution(s) are inconsistent with the plan body (conflicting capabilities still present).`
    );
  }
  if (missingRiskAcks.length > 0) {
    reasons.push(
      `${missingRiskAcks.length} item(s) have remainingRisks awaiting per-risk acknowledgement.`
    );
  }
  if (missingApprovalGates.length > 0) {
    reasons.push(
      `${missingApprovalGates.length} approval gate(s) are not yet acknowledged.`
    );
  }
  if (detectOnlyViolations.length > 0) {
    reasons.push(
      `${detectOnlyViolations.length} detect-only item(s) have mutating actions; detect-only must not apply directly.`
    );
  }

  return {
    ok:
      blockingConflicts.length === 0 &&
      unresolvedWarnConflicts.length === 0 &&
      invalidResolutionIds.length === 0 &&
      inconsistentResolutions.length === 0 &&
      missingRiskAcks.length === 0 &&
      missingApprovalGates.length === 0 &&
      detectOnlyViolations.length === 0,
    blockingConflicts,
    unresolvedWarnConflicts,
    missingRiskAcks,
    missingApprovalGates,
    reasons,
    detectOnlyViolations,
    invalidResolutionIds,
    inconsistentResolutions
  };
}


/**
 * Plan Report — generated after Plan Review (regardless of whether
 * apply succeeded). The report is the audit trail required by
 * E2E_SCENARIO_VALIDATION.md.
 *
 * Two consumers:
 *   - `GET /api/plans/:id/report?format=json` — structured JSON for the
 *     UI's history page.
 *   - `GET /api/plans/:id/report?format=markdown` — human-readable
 *     export the operator can paste into change-management tickets.
 */
export interface PlanReport {
  generatedAt: string;
  planId: string;
  planType: EnvironmentPlanType;
  status: EnvironmentPlanStatus;
  effectiveSupportLevel?: NonNullable<CatalogItem["supportLevel"]>;
  selectedCapabilities: Array<{
    itemId: string;
    name: string;
    capabilityKey?: string;
    supportLevel?: NonNullable<CatalogItem["supportLevel"]>;
  }>;
  conflictsDetected: PlanReviewConflict[];
  conflictResolutions: Array<{ conflictId: string; resolutionId?: string; ackedAt?: string }>;
  remainingRisks: Array<{
    itemId: string;
    risks: string[];
    ackedRisks: string[];
    pendingRisks: string[];
  }>;
  requiredApprovalGates: Array<{
    itemId: string;
    gateId: string;
    kind: PlanApprovalKind;
    label: string;
    acked: boolean;
  }>;
  approvalState: "pending" | "partial" | "complete";
  dataStrategyDecisions: Array<{ itemId: string; strategy: string; evidence: string }>;
  validateResults: {
    ran: boolean;
    passed: string[];
    failed: string[];
  };
  rollbackAvailability: Array<{ itemId: string; canRollback: boolean }>;
  skippedDetectOnlyItems: string[];
  unresolvedManualSteps: Array<{ itemId: string; actionId: string; label: string }>;
  /**
   * Action-level run records (Managed Execution Hardening phase).
   * One entry per action that went through the orchestrator. Empty when
   * the plan has not been applied yet.
   */
  actionRuns: Array<{
    actionId: string;
    itemId: string;
    status: string;
    startedAt: string;
    endedAt?: string;
    snapshotKind?: string;
    backupPath?: string;
    redacted: boolean;
    error?: string;
    applyOk?: boolean;
    verifyOk?: boolean;
    rollbackOk?: boolean;
  }>;
  /**
   * Severity of the report: `info` (clean closed loop), `warn` (clean
   * but with degraded depth — e.g. detect-only effective level), `error`
   * (audit violation: detect-only items emitted mutating actions, raw
   * filesystem rsync detected for a database, etc.).
   */
  severity: "info" | "warn" | "error";
  severityReasons: string[];
}

const RAW_DATA_PATHS_BY_CAPABILITY: Record<string, string[]> = {
  "database.postgresql": ["/var/lib/postgresql"],
  "database.mysql": ["/var/lib/mysql"],
  "cache.redis": ["/var/lib/redis"],
  "cache.valkey": ["/var/lib/valkey"],
  "security.tls.certbot": ["/etc/letsencrypt"],
  "web-server.caddy": ["/var/lib/caddy"],
  "web-server.openresty": ["/usr/local/openresty/lualib"],
  "network.reverse-proxy.traefik": ["/etc/traefik/acme.json", "/var/lib/traefik"],
  "network.load-balancer.haproxy": ["/etc/haproxy/certs", "/var/lib/haproxy"],
  "web-server.apache": ["/var/www", "/srv/www"],
  "runtime.php-fpm": ["/var/lib/php/sessions", "/run/php"]
};

function inferDataStrategy(item: EnvironmentPlanItem): { strategy: string; evidence: string } {
  const cap = item.capabilityKey ?? item.audit?.capabilityKey ?? "";
  const rawPaths = RAW_DATA_PATHS_BY_CAPABILITY[cap] ?? [];
  // If any action copies/writes a raw data path directly, that is
  // forbidden — return a sentinel "raw-rsync" strategy.
  for (const action of item.actions) {
    if (action.kind === "backupFile") continue;
    const path = action.applySpec?.path ?? action.path ?? "";
    if (path && rawPaths.some((rp) => path.startsWith(rp))) {
      return { strategy: "raw-rsync", evidence: `Action ${action.id} writes raw data path ${path}.` };
    }
  }
  if (cap === "database.postgresql") return { strategy: "dump-restore", evidence: "pg_dump + pg_restore (per catalog audit)." };
  if (cap === "database.mysql") return { strategy: "dump-restore", evidence: "mysqldump + restore (per catalog audit)." };
  if (cap === "cache.redis") return { strategy: "dump-restore", evidence: "redis-cli SAVE / BGSAVE (per catalog audit)." };
  if (cap === "cache.valkey") return { strategy: "dump-restore", evidence: "valkey-cli SAVE / BGSAVE (per catalog audit)." };
  if (cap === "security.tls.certbot") return { strategy: "manual-review", evidence: "/etc/letsencrypt private keys and ACME renewal metadata require explicit operator approval." };
  if (cap === "security.firewall.firewalld") return { strategy: "manual-review", evidence: "firewalld zones and services require SSH lockout review and UFW/firewalld exclusivity confirmation." };
  if (cap === "network.vpn.wireguard") return { strategy: "manual-review", evidence: "WireGuard private keys, peer endpoints, AllowedIPs, and forwarding policy require explicit operator approval." };
  if (cap === "network.vpn.openvpn") return { strategy: "manual-review", evidence: "OpenVPN PKI material, pushed routes, and client-config-dir entries require explicit operator approval." };
  if (cap === "security.secrets.vault") return { strategy: "backup-restore", evidence: "Vault state migrates via Vault snapshot/restore APIs; unseal material stays out of band." };
  if (cap === "container.kubernetes.k3s") return { strategy: "backup-restore", evidence: "K3s control-plane state migrates via snapshot/restore; kubeconfig and node-token are secret-reviewed." };
  if (cap === "system.swap") return { strategy: "manual-review", evidence: "Swap file/fstab changes require filesystem, zram, cloud-image, and rollback review." };
  if (cap === "runtime.nodejs.pm2") return { strategy: "manual-review", evidence: "PM2 dump.pm2 and ecosystem env belong to a target user and require app-directory and secret review." };
  if (cap === "app.nextcloud") return { strategy: "backup-restore", evidence: "Nextcloud requires maintenance-mode DB dump/restore, data directory transfer, and config.php secret review." };
  if (cap === "developer.gitea") return { strategy: "backup-restore", evidence: "Gitea data moves through gitea dump/restore; repositories, LFS, hooks, and app.ini secrets are reviewed." };
  if (cap === "app.media.jellyfin") return { strategy: "manual-review", evidence: "Jellyfin media mounts, metadata, plugins, and hardware acceleration are operator-owned and reviewed." };
  if (cap === "security.sso.keycloak") return { strategy: "backup-restore", evidence: "Keycloak uses realm export/import or DB backup/restore plus provider/theme and OIDC secret review." };
  if (cap === "security.sso.authelia") return { strategy: "backup-restore", evidence: "Authelia config/state backup requires secret continuity and reverse-proxy pairing review." };
  const batch20Strategies: Record<string, { strategy: string; evidence: string }> = {
    "app.password.vaultwarden": { strategy: "backup-restore", evidence: "Vaultwarden vault data migrates through reviewed backup/export plus attachment and ADMIN_TOKEN review." },
    "app.dns.pihole": { strategy: "manual-review", evidence: "Pi-hole migration requires DNS cutover, gravity/list review, DHCP scope review, and admin secret handling." },
    "security.sso.authentik": { strategy: "backup-restore", evidence: "Authentik migrates through blueprint export/import or DB backup plus AUTHENTIK_SECRET_KEY and client-secret review." },
    "app.docs.wikijs": { strategy: "backup-restore", evidence: "Wiki.js content, uploads, and auth provider settings move through DB backup/export and optional git sync review." },
    "app.automation.n8n": { strategy: "backup-restore", evidence: "n8n workflows and credentials require DB backup plus N8N_ENCRYPTION_KEY continuity." },
    "app.docs.bookstack": { strategy: "backup-restore", evidence: "BookStack requires database backup plus APP_KEY continuity and upload/image review." },
    "app.home.home-assistant": { strategy: "manual-review", evidence: "Home Assistant config, recorder DB, secrets.yaml, and device bindings require target-specific review." },
    "developer.gitlab": { strategy: "backup-restore", evidence: "GitLab data moves through gitlab-backup restore with version match plus gitlab-secrets.json review." },
    "app.analytics.umami": { strategy: "backup-restore", evidence: "Umami analytics data moves through PostgreSQL backup/restore with APP_SECRET and tracking-domain review." },
    "app.nocodb": { strategy: "backup-restore", evidence: "NocoDB metadata DB, uploads, JWT secret, and external DB credentials require backup/restore review." },
    "app.dns.adguard-home": { strategy: "manual-review", evidence: "AdGuard Home migration requires DNS cutover, AdGuardHome.yaml credential review, and query-log policy review." },
    "app.mail.docker-mailserver": { strategy: "manual-review", evidence: "docker-mailserver needs maildir/account backup, DKIM/TLS secret review, and DNS reputation cutover." },
    "app.office.onlyoffice": { strategy: "backup-restore", evidence: "OnlyOffice requires JWT continuity plus PostgreSQL/RabbitMQ/document-cache review." },
    "app.photos.immich": { strategy: "backup-restore", evidence: "Immich requires photo-library transfer plus PostgreSQL/vector extension backup and ML cache review." },
    "developer.forgejo": { strategy: "backup-restore", evidence: "Forgejo uses dump/restore for repositories, LFS, hooks, DB state, and app.ini secrets." },
    "observability.uptime-kuma": { strategy: "backup-restore", evidence: "Uptime Kuma stores monitors and notifier credentials in kuma.db, which needs explicit backup/restore review." },
    "app.docs.paperless": { strategy: "backup-restore", evidence: "Paperless document media, PostgreSQL metadata, Redis broker, and PAPERLESS_SECRET_KEY must be migrated consistently." },
    "app.media.navidrome": { strategy: "manual-review", evidence: "Navidrome music folders are operator-owned bind mounts; metadata DB and API secrets are reviewed." },
    "app.media.audiobookshelf": { strategy: "manual-review", evidence: "Audiobookshelf library mounts, metadata, user progress, podcast feeds, and tokens require review." },
    "app.rss.freshrss": { strategy: "backup-restore", evidence: "FreshRSS users/feeds move through DB backup or OPML export/import plus API token review." }
  };
  if (batch20Strategies[cap]) return batch20Strategies[cap];
  if (cap === "web-server.caddy") return { strategy: "manual-review", evidence: "Caddy ACME storage, site roots, and upstream references require explicit operator approval." };
  if (cap === "web-server.openresty") return { strategy: "manual-review", evidence: "OpenResty Lua modules, site roots, TLS keys, and upstream references require explicit operator approval." };
  if (cap === "network.reverse-proxy.traefik") return { strategy: "manual-review", evidence: "Traefik acme.json, provider configs, and dashboard exposure require explicit operator approval." };
  if (cap === "network.load-balancer.haproxy") return { strategy: "manual-review", evidence: "HAProxy cert bundles, stats sockets, and backend dependencies require explicit operator approval." };
  if (cap === "web-server.apache") return { strategy: "manual-review", evidence: "Apache site roots, TLS keys, enabled modules, and PHP handler coupling require explicit operator approval." };
  if (cap === "runtime.php-fpm") return { strategy: "manual-review", evidence: "PHP-FPM pools, sockets, session paths, and per-app env vars require explicit operator approval." };
  return { strategy: "none-required", evidence: "Capability has no persistent data plane." };
}

export function buildPlanReport(
  plan: EnvironmentPlan,
  options: {
    verifyResults?: { passed: string[]; failed: string[] };
    /** Optional override of effectiveSupportLevel; defaults to plan.summary.effectiveSupportLevel. */
    effectiveSupportLevel?: NonNullable<CatalogItem["supportLevel"]>;
    /**
     * Action-level run records (one per action that went through the
     * managed orchestrator). Caller supplies them from the runtime
     * store; the plan body itself does not own them.
     */
    actionRuns?: Array<{
      planId: string;
      itemId: string;
      actionId: string;
      status: string;
      startedAt: string;
      endedAt?: string;
      snapshot?: { kind?: string; backupPath?: string };
      applyResult?: { ok: boolean };
      verifyResult?: { ok: boolean };
      rollbackResult?: { ok: boolean };
      redacted: boolean;
      error?: string;
    }>;
  } = {}
): PlanReport {
  const ackedRisks = plan.approvals?.risks ?? {};
  const ackedApprovals = new Set(
    (plan.approvals?.approvals ?? []).map((entry) => `${entry.itemId}::${entry.gateId}`)
  );
  const conflictResolutions = (plan.approvals?.conflicts ?? []).map((entry) => ({
    conflictId: entry.conflictId,
    resolutionId: entry.resolutionId,
    ackedAt: entry.ackedAt
  }));

  const selectedCapabilities = plan.items.map((item) => ({
    itemId: item.id,
    name: item.name,
    capabilityKey: item.capabilityKey ?? item.audit?.capabilityKey,
    supportLevel: (item.audit?.supportLevel ?? item.supportLevel) as NonNullable<CatalogItem["supportLevel"]> | undefined
  }));

  const remainingRisks = plan.items
    .map((item) => {
      const all = item.audit?.remainingRisks ?? [];
      const acked = ackedRisks[item.id] ?? [];
      const pending = all.filter((risk) => !acked.includes(risk));
      return { itemId: item.id, risks: all, ackedRisks: acked, pendingRisks: pending };
    })
    .filter((entry) => entry.risks.length > 0);

  const requiredApprovalGates = (plan.review.approvalsRequired ?? []).map((gate) => ({
    itemId: gate.itemId,
    gateId: gate.id,
    kind: gate.kind,
    label: gate.label,
    acked: ackedApprovals.has(`${gate.itemId}::${gate.id}`)
  }));

  const approvalsRequiredCount = requiredApprovalGates.length + remainingRisks.reduce((acc, r) => acc + r.risks.length, 0);
  const approvalsAckedCount =
    requiredApprovalGates.filter((g) => g.acked).length +
    remainingRisks.reduce((acc, r) => acc + r.ackedRisks.length, 0);
  let approvalState: PlanReport["approvalState"] = "pending";
  if (approvalsRequiredCount === 0 || approvalsAckedCount === approvalsRequiredCount) approvalState = "complete";
  else if (approvalsAckedCount > 0) approvalState = "partial";

  const dataStrategyDecisions = plan.items.map((item) => ({
    itemId: item.id,
    ...inferDataStrategy(item)
  }));

  const skippedDetectOnlyItems = plan.items
    .filter((item) => (item.audit?.supportLevel ?? item.supportLevel) === "detect-only")
    .map((item) => item.id);

  const unresolvedManualSteps: Array<{ itemId: string; actionId: string; label: string }> = [];
  for (const item of plan.items) {
    for (const action of item.actions) {
      if (action.kind === "manualStep" || action.kind === "review") {
        // detect-only items emit a single review action; we already
        // surface them under skippedDetectOnlyItems, so only record
        // genuine manualStep actions here.
        if (action.kind === "manualStep" || (action.kind === "review" && (item.audit?.supportLevel ?? item.supportLevel) !== "detect-only")) {
          unresolvedManualSteps.push({ itemId: item.id, actionId: action.id, label: action.label });
        }
      }
    }
  }

  const rollbackAvailability = plan.items.map((item) => ({
    itemId: item.id,
    canRollback: item.actions.some((action) => action.canRollback)
  }));

  const validateResults = options.verifyResults
    ? { ran: true, passed: options.verifyResults.passed, failed: options.verifyResults.failed }
    : { ran: false, passed: [], failed: [] };

  // Severity computation
  const severityReasons: string[] = [];
  let severity: PlanReport["severity"] = "info";
  // Error: raw-rsync data strategy on a known-data capability
  for (const decision of dataStrategyDecisions) {
    if (decision.strategy === "raw-rsync") {
      severity = "error";
      severityReasons.push(`raw-rsync data strategy is forbidden: ${decision.evidence}`);
    }
  }
  // Error: detect-only items with mutating actions (audit violation)
  for (const item of plan.items) {
    if ((item.audit?.supportLevel ?? item.supportLevel) !== "detect-only") continue;
    const offending = item.actions.filter((action) =>
      action.kind === "installPackage" ||
      action.kind === "removePackage" ||
      action.kind === "writeConfig" ||
      action.kind === "runCommand" ||
      action.kind === "restart" ||
      action.kind === "restartService" ||
      action.kind === "enableService"
    );
    if (offending.length > 0) {
      severity = "error";
      severityReasons.push(
        `detect-only item ${item.id} emits ${offending.length} mutating action(s); detect-only must not apply directly.`
      );
    }
  }
  // Warn: effective support level is detect-only with non-empty plan
  const effectiveSupportLevel = options.effectiveSupportLevel ?? plan.summary.effectiveSupportLevel;
  if (severity !== "error" && effectiveSupportLevel === "detect-only" && plan.items.length > 0) {
    severity = "warn";
    severityReasons.push("Effective support level is detect-only; plan cannot apply directly.");
  }
  // Warn: target state unknown
  if (severity === "info" && plan.review.targetStateUnknown) {
    severity = "warn";
    severityReasons.push("Target state was unknown when the plan was generated.");
  }
  // Warn: blocking conflicts present
  if ((plan.review.conflicts ?? []).some((c) => c.severity === "block")) {
    if (severity === "info") severity = "warn";
    severityReasons.push("Plan contains block-severity conflicts; apply will be refused until resolved.");
  }

  return {
    generatedAt: new Date().toISOString(),
    planId: plan.id,
    planType: plan.type,
    status: plan.status,
    effectiveSupportLevel,
    selectedCapabilities,
    conflictsDetected: plan.review.conflicts ?? [],
    conflictResolutions,
    remainingRisks,
    requiredApprovalGates,
    approvalState,
    dataStrategyDecisions,
    validateResults,
    rollbackAvailability,
    skippedDetectOnlyItems,
    unresolvedManualSteps,
    actionRuns: (options.actionRuns ?? []).map((run) => ({
      actionId: run.actionId,
      itemId: run.itemId,
      status: run.status,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      snapshotKind: run.snapshot?.kind,
      backupPath: run.snapshot?.backupPath,
      redacted: run.redacted,
      error: run.error,
      applyOk: run.applyResult?.ok,
      verifyOk: run.verifyResult?.ok,
      rollbackOk: run.rollbackResult?.ok
    })),
    severity,
    severityReasons
  };
}

/**
 * Render a Plan Report as Markdown for export.
 */
export function planReportToMarkdown(report: PlanReport): string {
  const lines: string[] = [];
  lines.push(`# Plan Report: ${report.planId}`);
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Type: ${report.planType}`);
  lines.push(`Status: ${report.status}`);
  lines.push(`Severity: **${report.severity}**`);
  if (report.effectiveSupportLevel) lines.push(`Effective support level: \`${report.effectiveSupportLevel}\``);
  lines.push("");
  if (report.severityReasons.length > 0) {
    lines.push("## Severity reasons");
    for (const reason of report.severityReasons) lines.push(`- ${reason}`);
    lines.push("");
  }
  lines.push("## Selected capabilities");
  for (const cap of report.selectedCapabilities) {
    lines.push(`- **${cap.name}** (\`${cap.itemId}\`) — capability \`${cap.capabilityKey ?? "?"}\` — supportLevel \`${cap.supportLevel ?? "?"}\``);
  }
  lines.push("");
  if (report.conflictsDetected.length > 0) {
    lines.push("## Conflicts detected");
    for (const c of report.conflictsDetected) {
      lines.push(`- \`${c.id}\` (${c.severity}, ${c.type}): ${c.reason}`);
    }
    lines.push("");
    lines.push("## Conflict resolutions");
    for (const res of report.conflictResolutions) {
      lines.push(`- \`${res.conflictId}\` → \`${res.resolutionId ?? "(none)"}\` ${res.ackedAt ? `(acked at ${res.ackedAt})` : ""}`);
    }
    lines.push("");
  }
  if (report.remainingRisks.length > 0) {
    lines.push("## Remaining risks (per item)");
    for (const entry of report.remainingRisks) {
      lines.push(`### ${entry.itemId}`);
      for (const risk of entry.risks) {
        const acked = entry.ackedRisks.includes(risk);
        lines.push(`- ${acked ? "[x]" : "[ ]"} ${risk}`);
      }
    }
    lines.push("");
  }
  if (report.requiredApprovalGates.length > 0) {
    lines.push("## Required approval gates");
    for (const gate of report.requiredApprovalGates) {
      lines.push(`- ${gate.acked ? "[x]" : "[ ]"} **${gate.label}** (\`${gate.kind}\` on \`${gate.itemId}\`)`);
    }
    lines.push("");
  }
  lines.push(`Approval state: **${report.approvalState}**`);
  lines.push("");
  lines.push("## Data strategy decisions");
  for (const ds of report.dataStrategyDecisions) {
    lines.push(`- \`${ds.itemId}\`: **${ds.strategy}** — ${ds.evidence}`);
  }
  lines.push("");
  if (report.validateResults.ran) {
    lines.push("## Validate results");
    lines.push(`Passed: ${report.validateResults.passed.length}`);
    for (const p of report.validateResults.passed) lines.push(`- [x] ${p}`);
    lines.push(`Failed: ${report.validateResults.failed.length}`);
    for (const f of report.validateResults.failed) lines.push(`- [ ] ${f}`);
    lines.push("");
  }
  if (report.skippedDetectOnlyItems.length > 0) {
    lines.push("## Skipped detect-only items");
    for (const id of report.skippedDetectOnlyItems) lines.push(`- \`${id}\``);
    lines.push("");
  }
  if (report.unresolvedManualSteps.length > 0) {
    lines.push("## Unresolved manual steps");
    for (const step of report.unresolvedManualSteps) {
      lines.push(`- \`${step.itemId}/${step.actionId}\`: ${step.label}`);
    }
    lines.push("");
  }
  lines.push("## Rollback availability");
  for (const r of report.rollbackAvailability) {
    lines.push(`- \`${r.itemId}\`: ${r.canRollback ? "rollback available" : "no rollback"}`);
  }
  if (report.actionRuns.length > 0) {
    lines.push("");
    lines.push("## Action run records");
    for (const run of report.actionRuns) {
      const flags: string[] = [run.status];
      if (run.applyOk !== undefined) flags.push(`apply=${run.applyOk ? "ok" : "fail"}`);
      if (run.verifyOk !== undefined) flags.push(`verify=${run.verifyOk ? "ok" : "fail"}`);
      if (run.rollbackOk !== undefined) flags.push(`rollback=${run.rollbackOk ? "ok" : "fail"}`);
      if (run.redacted) flags.push("redacted");
      lines.push(`- \`${run.itemId}/${run.actionId}\` — ${flags.join(", ")}${run.error ? ` — ${run.error}` : ""}`);
      if (run.backupPath) lines.push(`  - backup: \`${run.backupPath}\``);
    }
  }
  return lines.join("\n");
}
