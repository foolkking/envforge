import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  type CapabilityCertificationResult,
  type CapabilityCertificationSummary,
  type CapabilityDocument,
  type CapabilityRiskLevel,
  type CapabilityValidationIssue,
  runCapabilityCertification
} from "./capability-certification.js";
import { listCatalogItems, type CatalogItem } from "./catalog.js";

export type CatalogPreviewOperation = "create" | "update" | "no-op" | "blocked";
export type CatalogDiffOperation = "add" | "modify" | "remove" | "unchanged" | "blocked";
export type CatalogDiffKind =
  | "metadata"
  | "service-stack-mapping"
  | "permission"
  | "gate"
  | "risk"
  | "feature"
  | "fixture"
  | "certification"
  | "redaction"
  | "unknown";

export interface CatalogDiffEntry {
  kind: CatalogDiffKind;
  operation: CatalogDiffOperation;
  path: string;
  before?: unknown;
  after?: unknown;
  reason: string;
}

export interface CapabilityCatalogPreview {
  source: {
    capabilityId: string;
    capabilityVersion?: string;
    publisher: string;
    certificationLevel: string;
    certificationPassed: boolean;
  };
  targetCatalog: {
    existingCatalogId?: string;
    generatedCatalogId: string;
    operation: CatalogPreviewOperation;
  };
  summary: string;
  serviceStackMappings: Array<{
    category: string;
    signals: string[];
    confidence: "high" | "medium" | "low";
  }>;
  permissions: {
    read: string[];
    write: string[];
    commands: string[];
  };
  gates: string[];
  risks: string[];
  features: {
    discover: boolean;
    plan: boolean;
    apply: boolean;
    verify: boolean;
    rollback: "none" | "partial" | "full" | "manual";
  };
  catalogArtifact: {
    id: string;
    name: string;
    publisher: string;
    sourceCapabilityId: string;
    riskLevel: CapabilityRiskLevel;
    serviceStackCategory: string;
    discoverSignals: string[];
    requiredGates: string[];
    risks: string[];
    permissions: {
      read: string[];
      write: string[];
      commands: string[];
    };
    features: CapabilityCatalogPreview["features"];
    fixtures: string[];
    certificationLevel: string;
    runtimeEnabled: false;
  };
  diff: CatalogDiffEntry[];
  blockers: string[];
  warnings: string[];
  generatedArtifact?: {
    path?: string;
    hash?: string;
    enabledByDefault: false;
  };
}

export interface CapabilityCatalogPreviewSummary {
  rootDir: string;
  certificationPassed: boolean;
  previews: CapabilityCatalogPreview[];
  blocked: CapabilityCatalogPreview[];
}

const RISK_ORDER: Record<CapabilityRiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3
};

const SENSITIVITY_TO_RISK: Record<CatalogItem["sensitivity"], CapabilityRiskLevel> = {
  safe: "low",
  review: "medium",
  privileged: "high"
};

const DOMAIN_RULES: Record<
  string,
  {
    serviceStackCategory: string;
    signals: string[];
    risks: string[];
    requiredGates: string[];
  }
> = {
  "official.nginx": {
    serviceStackCategory: "web-entry",
    signals: ["nginx service", "/etc/nginx", "nginx -t"],
    risks: ["certificate path missing", "config invalid", "reload impact"],
    requiredGates: ["config-diff-confirm", "service-reload-confirm"]
  },
  "official.postgresql": {
    serviceStackCategory: "database",
    signals: ["postgresql service", "port 5432", "/var/lib/postgresql", "pg_hba.conf", "postgresql.conf"],
    risks: ["raw file copy corruption", "version mismatch", "backup freshness unknown", "data volume unknown"],
    requiredGates: [
      "data-migration-strategy-confirm",
      "backup-freshness-confirm",
      "version-compatibility-confirm"
    ]
  }
};

export async function runCapabilityCatalogPreview(
  rootDir?: string,
  catalogItems = listCatalogItems()
): Promise<CapabilityCatalogPreviewSummary> {
  const certification = await runCapabilityCertification(rootDir);
  return buildCapabilityCatalogPreviewSummary(certification, catalogItems);
}

export function buildCapabilityCatalogPreviewSummary(
  certification: CapabilityCertificationSummary,
  catalogItems = listCatalogItems()
): CapabilityCatalogPreviewSummary {
  const previews = certification.results.map((result) => buildCapabilityCatalogPreview(result, catalogItems));
  return {
    rootDir: "capabilities",
    certificationPassed: certification.passed,
    previews,
    blocked: previews.filter((preview) => preview.targetCatalog.operation === "blocked")
  };
}

export function buildCapabilityCatalogPreview(
  result: CapabilityCertificationResult,
  catalogItems = listCatalogItems()
): CapabilityCatalogPreview {
  const capability = result.capability;
  const capabilityId = capability?.id ?? "unknown";
  const publisher = capability?.publisher ?? "unknown";
  const generatedCatalogId = capability?.catalogRefs?.[0] ?? capabilityId.replace(/^official\./, "");
  const existing = catalogItems.find((item) => item.id === generatedCatalogId);
  const domain = getDomainRules(capability);
  const permissions = {
    read: [...(capability?.permissions?.read ?? [])].sort(),
    write: [...(capability?.permissions?.write ?? [])].sort(),
    commands: [...(capability?.permissions?.commands ?? [])].sort()
  };
  const gates = [...(capability?.requiresGates ?? [])].sort();
  const features = {
    discover: capability?.features?.discover === true,
    plan: capability?.features?.plan === true,
    apply: capability?.features?.apply === true,
    verify: capability?.features?.verify === true,
    rollback: capability?.features?.rollback ?? "none"
  };
  const risks = uniqueSorted([
    ...(capability ? [`capability risk level: ${capability.riskLevel}`] : []),
    ...domain.risks
  ]);
  const blockers = findPreviewBlockers(result, existing, domain);
  const warnings = findPreviewWarnings(result, existing);
  const operation: CatalogPreviewOperation = blockers.length
    ? "blocked"
    : existing
      ? hasMeaningfulDiff(existing, capability, domain, permissions, gates, risks, features)
        ? "update"
        : "no-op"
      : "create";
  const serviceStackMappings = [
    {
      category: domain.serviceStackCategory,
      signals: domain.signals,
      confidence: "high" as const
    }
  ];
  const catalogArtifact = {
    id: generatedCatalogId,
    name: capability?.name ?? generatedCatalogId,
    publisher,
    sourceCapabilityId: capabilityId,
    riskLevel: capability?.riskLevel ?? "low",
    serviceStackCategory: domain.serviceStackCategory,
    discoverSignals: domain.signals,
    requiredGates: gates,
    risks,
    permissions,
    features,
    fixtures: [...(capability?.fixtures ?? []).map((fixture) => fixture.id)].sort(),
    certificationLevel: result.effectiveLevel,
    runtimeEnabled: false as const
  };
  const preview: CapabilityCatalogPreview = {
    source: {
      capabilityId,
      capabilityVersion: capability?.version,
      publisher,
      certificationLevel: result.effectiveLevel,
      certificationPassed: result.passed
    },
    targetCatalog: {
      existingCatalogId: existing?.id,
      generatedCatalogId,
      operation
    },
    summary: summarizePreview(capability, existing, operation),
    serviceStackMappings,
    permissions,
    gates,
    risks,
    features,
    catalogArtifact,
    diff: buildDiffEntries(existing, capability, domain, permissions, gates, risks, features, result, operation),
    blockers,
    warnings,
    generatedArtifact: {
      enabledByDefault: false
    }
  };
  return preview;
}

export function withGeneratedArtifactMetadata(
  preview: CapabilityCatalogPreview,
  relativePath: string
): CapabilityCatalogPreview {
  const artifactHash = hashStableJson({
    source: preview.source,
    targetCatalog: preview.targetCatalog,
    catalogArtifact: preview.catalogArtifact,
    diff: preview.diff,
    blockers: preview.blockers,
    warnings: preview.warnings
  });
  return {
    ...preview,
    generatedArtifact: {
      path: normalizePortablePath(relativePath),
      hash: artifactHash,
      enabledByDefault: false
    }
  };
}

export async function writeCapabilityCatalogPreviewArtifacts(
  outputDir: string,
  previews: CapabilityCatalogPreview[]
): Promise<CapabilityCatalogPreview[]> {
  await fs.mkdir(outputDir, { recursive: true });
  const written: CapabilityCatalogPreview[] = [];
  for (const preview of previews) {
    const fileName = preview.source.capabilityId + ".catalog-preview.json";
    const relativePath = normalizePortablePath(path.join("generated", "catalog-preview", fileName));
    const withMetadata = withGeneratedArtifactMetadata(preview, relativePath);
    await fs.writeFile(path.join(outputDir, fileName), stableStringify(withMetadata) + "\n", "utf8");
    written.push(withMetadata);
  }
  const index = {
    schema: "envforge.capability-catalog-preview.index.v1",
    runtimeCatalogEnabled: false,
    configsCatalogMutated: false,
    capabilityCount: written.length,
    blockedCapabilityCount: written.filter((preview) => preview.targetCatalog.operation === "blocked").length,
    artifacts: written.map((preview) => ({
      capabilityId: preview.source.capabilityId,
      operation: preview.targetCatalog.operation,
      path: preview.generatedArtifact?.path,
      hash: preview.generatedArtifact?.hash,
      enabledByDefault: false
    }))
  };
  await fs.writeFile(path.join(outputDir, "index.json"), stableStringify(index) + "\n", "utf8");
  return written;
}

export function stableStringify(input: unknown): string {
  return JSON.stringify(sortJson(input), null, 2);
}

export function hashStableJson(input: unknown): string {
  return crypto.createHash("sha256").update(stableStringify(input)).digest("hex");
}

function buildDiffEntries(
  existing: CatalogItem | undefined,
  capability: CapabilityDocument | undefined,
  domain: ReturnType<typeof getDomainRules>,
  permissions: CapabilityCatalogPreview["permissions"],
  gates: string[],
  risks: string[],
  features: CapabilityCatalogPreview["features"],
  result: CapabilityCertificationResult,
  operation: CatalogPreviewOperation
): CatalogDiffEntry[] {
  if (!capability) {
    return [
      {
        kind: "certification",
        operation: "blocked",
        path: "capability",
        after: result.issues.map(issueSummary),
        reason: "Capability manifest could not be certified."
      }
    ];
  }

  const blocked = operation === "blocked";
  const entries: CatalogDiffEntry[] = [];
  entries.push(diffEntry("metadata", existing?.id ? "modify" : "add", "metadata.name", existing?.nameEn, capability.name, "Capability identity maps into a review-only catalog artifact.", blocked));
  entries.push(diffEntry("risk", existing ? "modify" : "add", "riskLevel", existing ? SENSITIVITY_TO_RISK[existing.sensitivity] : undefined, capability.riskLevel, "Capability risk is compared against existing catalog sensitivity.", blocked));
  entries.push(diffEntry("service-stack-mapping", existing ? "modify" : "add", "serviceStackMappings[0]", existing?.category, { category: domain.serviceStackCategory, signals: domain.signals }, "Capability signals become service-stack mapping review data.", blocked));
  entries.push(diffEntry("gate", existing ? "modify" : "add", "requiresGates", existing ? [] : undefined, gates, "Required gates must be reviewed before any runtime catalog sync.", blocked));
  entries.push(diffEntry("permission", existing ? "modify" : "add", "permissions", undefined, permissions, "Declared read/write/command permissions are review-only metadata.", blocked));
  entries.push(diffEntry("risk", existing ? "modify" : "add", "risks", existing?.audit?.remainingRisks ?? [], risks, "Capability risk notes are surfaced in catalog review.", blocked));
  entries.push(diffEntry("feature", existing ? "modify" : "add", "features", undefined, features, "Feature flags do not enable runtime behavior in preview.", blocked));
  entries.push(diffEntry("fixture", existing ? "modify" : "add", "fixtures", undefined, capability.fixtures.map((fixture) => fixture.id).sort(), "Fixture coverage is attached as certification evidence.", blocked));
  entries.push(diffEntry("certification", existing ? "modify" : "add", "certification", undefined, { claimed: result.claimedLevel, effective: result.effectiveLevel, passed: result.passed }, "Certification level is evidence-bounded by the harness.", blocked));
  entries.push(diffEntry("redaction", existing ? "modify" : "add", "redaction", undefined, capability.redaction.assertions, "Redaction assertions are included for review.", blocked));
  return entries;
}

function diffEntry(
  kind: CatalogDiffKind,
  operation: CatalogDiffOperation,
  diffPath: string,
  before: unknown,
  after: unknown,
  reason: string,
  blocked: boolean
): CatalogDiffEntry {
  return {
    kind,
    operation: blocked ? "blocked" : operation,
    path: diffPath,
    before,
    after,
    reason
  };
}

function findPreviewBlockers(
  result: CapabilityCertificationResult,
  existing: CatalogItem | undefined,
  domain: ReturnType<typeof getDomainRules>
): string[] {
  const capability = result.capability;
  const blockers: string[] = [];
  if (!result.passed) {
    blockers.push(
      "Capability certification failed: " +
        result.issues.filter((issue) => issue.severity === "error").map(issueSummary).join("; ")
    );
  }
  if (!capability) return blockers;
  if (capability.id.startsWith("official.") && capability.publisher !== "envforge") {
    blockers.push("official namespace requires publisher=envforge.");
  }
  if (capability.permissions.write.length > 0 && capability.requiresGates.length === 0) {
    blockers.push("write permissions require review gates.");
  }
  if (capability.features.apply && !/approved immutable Environment Plan/i.test(capability.safety.environmentPlanBoundary)) {
    blockers.push("apply=true requires an approved immutable Environment Plan boundary.");
  }
  if (capability.features.rollback === "full" && capability.certification.evidence.liveDisposableTarget !== true) {
    blockers.push("rollback=full requires live disposable target evidence.");
  }
  for (const gate of domain.requiredGates) {
    if (!capability.requiresGates.includes(gate as never)) {
      blockers.push("required gate removed or missing: " + gate);
    }
  }
  if (existing) {
    const existingRisk = SENSITIVITY_TO_RISK[existing.sensitivity];
    if (RISK_ORDER[capability.riskLevel] < RISK_ORDER[existingRisk]) {
      blockers.push("risk downgrade without evidence: " + existingRisk + " -> " + capability.riskLevel);
    }
  }
  return uniqueSorted(blockers);
}

function findPreviewWarnings(
  result: CapabilityCertificationResult,
  existing: CatalogItem | undefined
): string[] {
  const warnings: string[] = [];
  if (!existing) warnings.push("No existing runtime catalog item matches this capability; review create operation before sync.");
  if (result.effectiveLevel !== result.claimedLevel) warnings.push("Claimed certification level was bounded to " + result.effectiveLevel + ".");
  if (result.capability?.features.apply) warnings.push("apply=true remains review-only in preview and does not enable runtime execution.");
  return warnings.sort();
}

function hasMeaningfulDiff(
  existing: CatalogItem,
  capability: CapabilityDocument | undefined,
  domain: ReturnType<typeof getDomainRules>,
  permissions: CapabilityCatalogPreview["permissions"],
  gates: string[],
  risks: string[],
  features: CapabilityCatalogPreview["features"]
): boolean {
  if (!capability) return true;
  return stableStringify({
    existing: {
      name: existing.nameEn,
      risk: SENSITIVITY_TO_RISK[existing.sensitivity],
      category: existing.category
    },
    generated: {
      name: capability.name,
      risk: capability.riskLevel,
      category: domain.serviceStackCategory,
      permissions,
      gates,
      risks,
      features
    }
  }).length > 0;
}

function getDomainRules(capability: CapabilityDocument | undefined): {
  serviceStackCategory: string;
  signals: string[];
  risks: string[];
  requiredGates: string[];
} {
  if (capability && DOMAIN_RULES[capability.id]) return DOMAIN_RULES[capability.id];
  const id = capability?.id.toLowerCase() ?? "";
  if (id.includes("nginx")) return DOMAIN_RULES["official.nginx"];
  if (id.includes("postgres")) return DOMAIN_RULES["official.postgresql"];
  return {
    serviceStackCategory: "unknown",
    signals: uniqueSorted([...(capability?.permissions.read ?? []), ...(capability?.permissions.commands ?? [])]),
    risks: capability ? ["capability risk level: " + capability.riskLevel] : [],
    requiredGates: []
  };
}

function summarizePreview(
  capability: CapabilityDocument | undefined,
  existing: CatalogItem | undefined,
  operation: CatalogPreviewOperation
): string {
  const capabilityName = capability?.name ?? "Unknown capability";
  if (operation === "blocked") return capabilityName + " catalog preview is blocked until certification and safety blockers are resolved.";
  if (operation === "create") return capabilityName + " would create a review-only catalog artifact. Runtime catalog remains unchanged.";
  if (operation === "update") return capabilityName + " would update review metadata for " + existing?.id + ". Runtime catalog remains unchanged.";
  return capabilityName + " does not change review metadata. Runtime catalog remains unchanged.";
}

function issueSummary(issue: CapabilityValidationIssue): string {
  return issue.code + (issue.path ? " " + issue.path : "") + ": " + issue.message;
}

function normalizePortablePath(input: string): string {
  return input.replace(/\\/g, "/");
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function sortJson(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(sortJson);
  if (input && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .filter(([, value]) => value !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, sortJson(value)])
    );
  }
  return input;
}
