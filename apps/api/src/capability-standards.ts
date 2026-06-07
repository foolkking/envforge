import type { CatalogItem } from "./catalog.js";
import type {
  CapabilityCertificationRun,
  CapabilityRequirementDraft,
  CapabilityRequirementSectionState,
  CapabilityRequirementVersion,
  CapabilityStandardProfile,
  CapabilityStandardSection,
  RuntimeDatabase
} from "./runtime-store.js";
import type { CertificationMetadata } from "./catalog-certification.js";

export const REQUIREMENT_SECTION_IDS = [
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

const DEFAULT_SECTIONS: CapabilityStandardSection[] = [
  section("identity", "Identity", "Capability identity, ownership, category, and supported modes."),
  section("detection", "Detection", "Runtime evidence that proves the capability is installed or in use."),
  section("install", "Install / Rebuild", "Package maps, ordered actions, preflight checks, and idempotency."),
  section("config", "Config Governance", "Managed config paths, secret patterns, validation, safe apply, and rollback."),
  section("data", "Data Strategy", "Persistent state handling, backup/restore command contracts, and data-loss warnings."),
  section("references", "Dependency / Reference Graph", "Config includes, service dependencies, ports, certificates, and external dependencies."),
  section("validate", "Validation", "Config, service, port, health, data restore, target state, and post-rollback checks."),
  section("rollback", "Rollback", "File restore, service state, package policy, data rollback, and failed rollback handling."),
  section("security", "Security & Approval", "Risk level, secret policy, approval gates, blocked operations, and redaction."),
  section("crossDistro", "Cross-distro", "Package, service, path, user/group, compatibility, and unsupported-target behavior."),
  section("conflicts", "Conflict Rules", "Mutual exclusion, port conflicts, overlaps, alternatives, and combo relationships."),
  section("planIntegration", "Environment Plan + Report", "Plan review, apply gate, managed execution, action runs, and report visibility."),
  section("harness", "Harness / Scenario", "Dry-run or live scenario coverage for planner and execution contracts.")
];

export const DEFAULT_STANDARD_PROFILE: CapabilityStandardProfile = {
  id: "full-migration-v1",
  key: "full-migration",
  name: "Full Migration Certified",
  version: 1,
  status: "active",
  description: "Default online-maintainable profile for the 13-section Full Migration contract.",
  sections: DEFAULT_SECTIONS,
  createdAt: "2026-05-31T00:00:00.000Z",
  updatedAt: "2026-05-31T00:00:00.000Z",
  createdBy: "system",
  updatedBy: "system"
};

function section(id: (typeof REQUIREMENT_SECTION_IDS)[number], label: string, description: string): CapabilityStandardSection {
  return {
    id,
    label,
    description,
    required: true,
    allowNotApplicable: true,
    severity: id === "security" || id === "rollback" || id === "data" ? "critical" : "required"
  };
}

export function listStandardProfiles(database: RuntimeDatabase): CapabilityStandardProfile[] {
  const overlays = database.capabilityStandardProfiles ?? [];
  const hasDefault = overlays.some((profile) => profile.id === DEFAULT_STANDARD_PROFILE.id);
  return hasDefault ? overlays : [DEFAULT_STANDARD_PROFILE, ...overlays];
}

export function getActiveStandardProfile(database: RuntimeDatabase, profileId?: string): CapabilityStandardProfile {
  const profiles = listStandardProfiles(database);
  if (profileId) {
    return profiles.find((profile) => profile.id === profileId) ?? DEFAULT_STANDARD_PROFILE;
  }
  const storedActive = (database.capabilityStandardProfiles ?? []).find((profile) => profile.status === "active");
  return (
    storedActive ??
    profiles.find((profile) => profile.status === "active") ??
    DEFAULT_STANDARD_PROFILE
  );
}

export function ensureMutableStandardProfile(
  database: RuntimeDatabase,
  profileId: string,
  userId: string,
  now: string
): CapabilityStandardProfile | undefined {
  database.capabilityStandardProfiles = database.capabilityStandardProfiles ?? [];
  const existing = database.capabilityStandardProfiles.find((profile) => profile.id === profileId);
  if (existing) return existing;
  const source = listStandardProfiles(database).find((profile) => profile.id === profileId);
  if (!source) return undefined;
  const hasStoredActiveForKey = database.capabilityStandardProfiles.some(
    (profile) => profile.key === source.key && profile.status === "active"
  );
  const materialized: CapabilityStandardProfile = {
    ...source,
    status: hasStoredActiveForKey && source.status === "active" ? "retired" : source.status,
    sections: source.sections.map((section) => ({ ...section })),
    updatedAt: now,
    updatedBy: userId
  };
  database.capabilityStandardProfiles.push(materialized);
  return materialized;
}

export function normalizeStandardProfileSections(
  input: Array<Partial<CapabilityStandardSection>>
): { sections: CapabilityStandardSection[] } | { error: string } {
  if (!Array.isArray(input) || input.length === 0) {
    return { error: "sections must be a non-empty array." };
  }
  const seen = new Set<string>();
  const sections: CapabilityStandardSection[] = [];
  const allowedSeverities = new Set<CapabilityStandardSection["severity"]>(["required", "critical", "advisory"]);
  for (const raw of input) {
    const id = `${raw.id ?? ""}`.trim();
    const label = `${raw.label ?? raw.id ?? ""}`.trim();
    const description = `${raw.description ?? ""}`.trim();
    const severity = `${raw.severity ?? "required"}` as CapabilityStandardSection["severity"];
    if (!id || !label) {
      return { error: "each section requires id and label." };
    }
    if (seen.has(id)) {
      return { error: `duplicate section id: ${id}` };
    }
    if (!allowedSeverities.has(severity)) {
      return { error: `invalid section severity: ${severity}` };
    }
    seen.add(id);
    sections.push({
      id,
      label,
      description,
      required: raw.required ?? true,
      allowNotApplicable: raw.allowNotApplicable ?? true,
      severity,
      schema: raw.schema
    });
  }
  return { sections };
}

export function normalizeRequirementSections(
  profile: CapabilityStandardProfile,
  input?: Record<string, Partial<CapabilityRequirementSectionState>>,
  fallbackStatus: CapabilityRequirementSectionState["status"] = "pending"
): Record<string, CapabilityRequirementSectionState> {
  const normalized: Record<string, CapabilityRequirementSectionState> = {};
  for (const sectionDef of profile.sections) {
    const current = input?.[sectionDef.id];
    normalized[sectionDef.id] = {
      status: current?.status ?? fallbackStatus,
      notes: current?.notes,
      evidence: Array.isArray(current?.evidence) ? current.evidence.filter(Boolean).map(String) : [],
      notApplicableReason: current?.notApplicableReason
    };
  }
  return normalized;
}

export function seedRequirementSectionsFromCertification(
  profile: CapabilityStandardProfile,
  certification: CertificationMetadata
): Record<string, CapabilityRequirementSectionState> {
  return normalizeRequirementSections(
    profile,
    undefined,
    certification.status === "certified" ? "satisfied" : "pending"
  );
}

export function findCurrentRequirementDraft(
  database: RuntimeDatabase,
  capabilityId: string,
  profileId: string
): CapabilityRequirementDraft | undefined {
  return (database.capabilityRequirementDrafts ?? [])
    .filter((draft) => draft.capabilityId === capabilityId && draft.profileId === profileId && draft.status !== "published")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export function listRequirementVersions(
  database: RuntimeDatabase,
  capabilityId: string,
  profileId: string
): CapabilityRequirementVersion[] {
  return (database.capabilityRequirementVersions ?? [])
    .filter((version) => version.capabilityId === capabilityId && version.profileId === profileId)
    .sort((a, b) => b.version - a.version);
}

export function latestCertificationRun(
  database: RuntimeDatabase,
  capabilityId: string,
  profileId: string
): CapabilityCertificationRun | undefined {
  return (database.capabilityCertificationRuns ?? [])
    .filter((run) => run.capabilityId === capabilityId && run.profileId === profileId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export function listCertificationRuns(
  database: RuntimeDatabase,
  capabilityId: string,
  profileId: string,
  limit = 20
): CapabilityCertificationRun[] {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  return (database.capabilityCertificationRuns ?? [])
    .filter((run) => run.capabilityId === capabilityId && run.profileId === profileId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, safeLimit);
}

export function simulateRequirementCertification(input: {
  item: CatalogItem;
  profile: CapabilityStandardProfile;
  baseCertification: CertificationMetadata;
  sections: Record<string, CapabilityRequirementSectionState>;
}): {
  status: CertificationMetadata["status"];
  visibleToUsers: boolean;
  reasons: string[];
  missingSections: string[];
  sectionResults: Record<string, { ok: boolean; reason?: string }>;
} {
  const reasons = [...input.baseCertification.reasons];
  const missingSections: string[] = [];
  const sectionResults: Record<string, { ok: boolean; reason?: string }> = {};

  for (const sectionDef of input.profile.sections) {
    const state = input.sections[sectionDef.id];
    if (!state || state.status === "pending") {
      missingSections.push(sectionDef.id);
      sectionResults[sectionDef.id] = { ok: false, reason: "section is still pending" };
      continue;
    }
    if (state.status === "blocked") {
      missingSections.push(sectionDef.id);
      sectionResults[sectionDef.id] = { ok: false, reason: "section is blocked" };
      continue;
    }
    if (state.status === "notApplicable" && !state.notApplicableReason?.trim()) {
      missingSections.push(sectionDef.id);
      sectionResults[sectionDef.id] = { ok: false, reason: "notApplicable requires a reason" };
      continue;
    }
    sectionResults[sectionDef.id] = { ok: true };
  }

  for (const sectionId of missingSections) {
    reasons.push(`standard.${sectionId}: online requirement section is not satisfied`);
  }

  const status = reasons.length === 0 ? "certified" : "not-ready";
  return {
    status,
    visibleToUsers: status === "certified",
    reasons,
    missingSections,
    sectionResults
  };
}
