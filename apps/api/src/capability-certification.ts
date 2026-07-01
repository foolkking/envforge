import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

export const CAPABILITY_STATUSES = [
  "experimental",
  "community",
  "verified",
  "official",
  "production-certified"
] as const;

export type CapabilityCertificationLevel = (typeof CAPABILITY_STATUSES)[number];

export const CAPABILITY_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type CapabilityRiskLevel = (typeof CAPABILITY_RISK_LEVELS)[number];

export const CAPABILITY_ROLLBACK_LEVELS = ["none", "partial", "full", "manual"] as const;
export type CapabilityRollbackLevel = (typeof CAPABILITY_ROLLBACK_LEVELS)[number];

export const CAPABILITY_SAFETY_GATES = [
  "config-diff-confirm",
  "service-reload-confirm",
  "data-migration-strategy-confirm",
  "secret-handling-confirm",
  "backup-freshness-confirm",
  "version-compatibility-confirm",
  "manual-follow-up-confirm"
] as const;

export type CapabilitySafetyGate = (typeof CAPABILITY_SAFETY_GATES)[number];

export interface CapabilityDocument {
  id: string;
  name: string;
  publisher: string;
  version?: string;
  status: CapabilityCertificationLevel;
  riskLevel: CapabilityRiskLevel;
  catalogRefs?: string[];
  supports: {
    os: string[];
    architectures: string[];
  };
  features: {
    discover: boolean;
    plan: boolean;
    apply: boolean;
    verify: boolean;
    rollback: CapabilityRollbackLevel;
  };
  permissions: {
    read: string[];
    write: string[];
    commands: string[];
  };
  requiresGates: CapabilitySafetyGate[];
  testMatrix: string[];
  fixtures: Array<{
    id: string;
    path: string;
    type: string;
    covers?: string[];
  }>;
  certification: {
    evidence: Record<string, boolean | string | string[] | undefined>;
    notes?: string[];
  };
  redaction: {
    sensitiveKeys: string[];
    assertions: string[];
  };
  safety: {
    approvedPlanRequired: boolean;
    appliesViaManagedExecution: boolean;
    publicMutationApi: boolean;
    directMutationRoutes: string[];
    environmentPlanBoundary: string;
  };
  docs: {
    readme: string;
  };
}

export interface CapabilityValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  path?: string;
}

export interface CapabilityCertificationResult {
  filePath: string;
  packageDir: string;
  capability?: CapabilityDocument;
  passed: boolean;
  claimedLevel: CapabilityCertificationLevel;
  effectiveLevel: CapabilityCertificationLevel;
  maxEligibleLevel: CapabilityCertificationLevel;
  issues: CapabilityValidationIssue[];
  checks: string[];
}

export interface CapabilityCertificationSummary {
  rootDir: string;
  results: CapabilityCertificationResult[];
  passed: boolean;
}

const STATUS_ORDER = new Map<CapabilityCertificationLevel, number>(
  CAPABILITY_STATUSES.map((status, index) => [status, index])
);

const SENTINEL_SECRET_VALUES = [
  "SENTINEL_DB_PASSWORD_SHOULD_NOT_LEAK",
  "SENTINEL_API_TOKEN_SHOULD_NOT_LEAK",
  "SENTINEL_PRIVATE_KEY_SHOULD_NOT_LEAK"
] as const;

const FORBIDDEN_DIRECT_MUTATION_PATTERNS = [
  /\/api\/execute\b/i,
  /\/api\/batch-execute\b/i,
  /\/api\/multi-execute\b/i,
  /\/api\/rebuild-plan\/apply\b/i,
  /apply-remove-plan\b/i,
  /restore-config-backup\b/i,
  /migration\/sessions\/[^\s"']+\/apply\b/i
] as const;

const SECRET_ASSIGNMENT_PATTERN =
  /\b(password|passwd|token|secret|private_key|database_url|api_key)\b\s*[:=]\s*(?!["']?(?:<redacted>|\*\*\*REDACTED\*\*\*|REDACTED|redacted)["']?(?:\s|$))["']?[^"'\s#]+/gi;

export function getDefaultCapabilityRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../..", "capabilities");
}

export async function listCapabilityManifestPaths(rootDir = getDefaultCapabilityRoot()): Promise<string[]> {
  const manifests: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (caught) {
      if ((caught as NodeJS.ErrnoException).code === "ENOENT") return;
      throw caught;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      if (entry.isFile() && entry.name === "capability.yaml") manifests.push(fullPath);
    }
  }
  await walk(rootDir);
  return manifests.sort();
}

export async function loadCapabilityManifest(filePath: string): Promise<CapabilityDocument> {
  const raw = await fs.readFile(filePath, "utf8");
  return YAML.parse(raw) as CapabilityDocument;
}

export async function certifyCapabilityManifest(filePath: string): Promise<CapabilityCertificationResult> {
  const packageDir = path.dirname(filePath);
  const issues: CapabilityValidationIssue[] = [];
  let capability: CapabilityDocument | undefined;
  try {
    capability = await loadCapabilityManifest(filePath);
  } catch (caught) {
    issues.push(error("manifest.parse", "capability.yaml could not be parsed: " + (caught as Error).message));
  }

  if (capability) {
    issues.push(...validateCapabilityDocument(capability));
    issues.push(...(await validateCapabilityPackageFiles(packageDir, capability)));
  }

  const claimedLevel = capability?.status && isCertificationLevel(capability.status) ? capability.status : "experimental";
  const maxEligibleLevel = capability ? computeMaxEligibleLevel(capability, issues) : "experimental";
  if (compareLevel(claimedLevel, maxEligibleLevel) > 0) {
    issues.push(error("certification.level.exceeds-evidence", "claimed level " + claimedLevel + " exceeds evidence-supported level " + maxEligibleLevel, "status"));
  }

  const effectiveLevel = minLevel(claimedLevel, maxEligibleLevel);
  return {
    filePath,
    packageDir,
    capability,
    passed: !issues.some((issue) => issue.severity === "error"),
    claimedLevel,
    effectiveLevel,
    maxEligibleLevel,
    issues,
    checks: buildCheckSummary(capability, issues, effectiveLevel)
  };
}

export async function runCapabilityCertification(rootDir = getDefaultCapabilityRoot()): Promise<CapabilityCertificationSummary> {
  const manifests = await listCapabilityManifestPaths(rootDir);
  const results = await Promise.all(manifests.map((manifest) => certifyCapabilityManifest(manifest)));
  return {
    rootDir,
    results,
    passed: manifests.length > 0 && results.every((result) => result.passed)
  };
}

export function validateCapabilityDocument(input: Partial<CapabilityDocument> | unknown): CapabilityValidationIssue[] {
  const doc = asRecord(input);
  const issues: CapabilityValidationIssue[] = [];
  if (!doc) return [error("schema.type", "capability.yaml must contain a YAML object")];

  for (const field of ["id", "name", "publisher", "status", "riskLevel"] as const) {
    if (!stringField(doc, field)) issues.push(error("schema.required", field + " is required", field));
  }

  const id = stringField(doc, "id");
  const status = stringField(doc, "status");
  const riskLevel = stringField(doc, "riskLevel");
  if (status && !isCertificationLevel(status)) issues.push(error("schema.status", "invalid status: " + status, "status"));
  if (riskLevel && !isRiskLevel(riskLevel)) issues.push(error("schema.riskLevel", "invalid riskLevel: " + riskLevel, "riskLevel"));

  const supports = recordField(doc, "supports");
  if (!supports) {
    issues.push(error("schema.required", "supports is required", "supports"));
  } else {
    requireStringArray(supports, "os", "supports.os", issues);
    requireStringArray(supports, "architectures", "supports.architectures", issues);
  }

  const features = recordField(doc, "features");
  if (!features) {
    issues.push(error("schema.required", "features is required", "features"));
  } else {
    for (const field of ["discover", "plan", "apply", "verify"] as const) {
      if (typeof features[field] !== "boolean") issues.push(error("schema.feature", "features." + field + " must be boolean", "features." + field));
    }
    const rollback = stringField(features, "rollback");
    if (!rollback || !isRollbackLevel(rollback)) {
      issues.push(error("schema.rollback", "features.rollback must be one of " + CAPABILITY_ROLLBACK_LEVELS.join(", "), "features.rollback"));
    }
  }

  const permissions = recordField(doc, "permissions");
  if (!permissions) {
    issues.push(error("schema.required", "permissions is required", "permissions"));
  } else {
    requireStringArray(permissions, "read", "permissions.read", issues);
    requireStringArray(permissions, "write", "permissions.write", issues, true);
    requireStringArray(permissions, "commands", "permissions.commands", issues, true);
  }

  const gates = stringArrayField(doc, "requiresGates");
  if (!gates) {
    issues.push(error("schema.required", "requiresGates is required", "requiresGates"));
  } else {
    for (const gate of gates) {
      if (!CAPABILITY_SAFETY_GATES.includes(gate as CapabilitySafetyGate)) issues.push(error("schema.gate", "unknown safety gate: " + gate, "requiresGates"));
    }
  }

  requireStringArray(doc, "testMatrix", "testMatrix", issues);
  validateFixtures(doc, issues);
  validateCertificationEvidence(doc, issues);
  validateRedaction(doc, issues);
  validateSafety(doc, issues);
  validateDocs(doc, issues);

  const writePermissions = stringArrayField(permissions, "write") ?? [];
  const commands = stringArrayField(permissions, "commands") ?? [];
  const normalizedGates = gates ?? [];
  const applies = features?.apply === true;
  const rollback = stringField(features, "rollback");

  if (writePermissions.length > 0 && normalizedGates.length === 0) {
    issues.push(error("safety.write-without-gate", "write permissions require at least one review gate", "requiresGates"));
  }
  if (applies) {
    if (writePermissions.length === 0) issues.push(error("safety.apply-without-write-scope", "apply=true must declare permissions.write", "permissions.write"));
    const safety = recordField(doc, "safety");
    const boundary = stringField(safety, "environmentPlanBoundary") ?? "";
    if (safety?.approvedPlanRequired !== true || !/approved immutable Environment Plan/i.test(boundary)) {
      issues.push(error("safety.approved-plan-boundary", "apply=true must state that target-changing work requires an approved immutable Environment Plan", "safety.environmentPlanBoundary"));
    }
    if (safety?.appliesViaManagedExecution !== true) issues.push(error("safety.managed-execution", "apply=true must declare Managed Execution as the only applier path", "safety.appliesViaManagedExecution"));
    if (safety?.publicMutationApi !== false) issues.push(error("safety.public-mutation-api", "capability appliers must not expose public direct mutation APIs", "safety.publicMutationApi"));
    if (commands.some((command) => /\b(reload|restart|systemctl|nginx -t|pg_dump|pg_restore)\b/i.test(command)) && normalizedGates.length === 0) {
      issues.push(error("safety.command-without-gate", "service/data commands require explicit gates", "requiresGates"));
    }
  }

  if (rollback === "full") {
    const evidence = recordField(recordField(doc, "certification"), "evidence");
    if (evidence?.rollbackTested !== true || evidence?.liveDisposableTarget !== true) {
      issues.push(error("rollback.full-without-evidence", "rollback=full requires rollbackTested and liveDisposableTarget evidence", "features.rollback"));
    }
  }

  if (id) {
    const lowerId = id.toLowerCase();
    if (lowerId.includes("nginx")) requireGates(normalizedGates, ["config-diff-confirm", "service-reload-confirm"], issues, id);
    if (lowerId.includes("postgresql") || lowerId.includes("postgres")) {
      requireGates(normalizedGates, ["data-migration-strategy-confirm", "backup-freshness-confirm", "version-compatibility-confirm"], issues, id);
    }
  }

  const redaction = recordField(doc, "redaction");
  const sensitiveKeys = stringArrayField(redaction, "sensitiveKeys") ?? [];
  const combinedPermissionText = [...writePermissions, ...commands, ...sensitiveKeys].join("\n").toLowerCase();
  if (/(secret|token|password|env|database_url|api_key)/i.test(combinedPermissionText) && !normalizedGates.includes("secret-handling-confirm")) {
    issues.push(error("safety.secret-gate", "secret/env capability evidence requires secret-handling-confirm", "requiresGates"));
  }

  return issues;
}

export function findSecretSafetyIssues(text: string, source = "inline"): CapabilityValidationIssue[] {
  const issues: CapabilityValidationIssue[] = [];
  for (const sentinel of SENTINEL_SECRET_VALUES) {
    if (text.includes(sentinel)) issues.push(error("redaction.sentinel", "raw sentinel secret value appears in " + source, source));
  }
  for (const match of text.matchAll(SECRET_ASSIGNMENT_PATTERN)) {
    issues.push(error("redaction.raw-secret", "potential raw secret assignment appears in " + source + ": " + match[1], source));
  }
  return issues;
}

async function validateCapabilityPackageFiles(packageDir: string, capability: CapabilityDocument): Promise<CapabilityValidationIssue[]> {
  const issues: CapabilityValidationIssue[] = [];
  const readme = capability.docs?.readme;
  if (readme) {
    const readmePath = path.resolve(packageDir, readme);
    if (!(await exists(readmePath))) {
      issues.push(error("docs.missing-readme", "docs.readme does not exist: " + readme, "docs.readme"));
    } else {
      const text = await fs.readFile(readmePath, "utf8");
      if (!/Environment Plan/i.test(text)) issues.push(error("docs.environment-plan-boundary", "capability docs must mention the Environment Plan boundary", readme));
      issues.push(...findSecretSafetyIssues(text, readme));
      issues.push(...findForbiddenDirectMutationRoutes(text, readme));
    }
  }

  for (const fixture of capability.fixtures ?? []) {
    const fixturePath = path.resolve(packageDir, fixture.path);
    if (!(await exists(fixturePath))) {
      issues.push(error("fixtures.missing", "fixture does not exist: " + fixture.path, "fixtures"));
      continue;
    }
    const text = await fs.readFile(fixturePath, "utf8");
    issues.push(...findSecretSafetyIssues(text, fixture.path));
    issues.push(...findForbiddenDirectMutationRoutes(text, fixture.path));
  }

  const testsDir = path.resolve(packageDir, "tests");
  if (!(await exists(testsDir))) {
    issues.push(error("tests.missing", "capability package must include a tests/ directory", "tests"));
  } else {
    const text = await readTextTree(testsDir);
    issues.push(...findSecretSafetyIssues(text, "tests/"));
    issues.push(...findForbiddenDirectMutationRoutes(text, "tests/"));
  }

  const manifestText = await fs.readFile(path.resolve(packageDir, "capability.yaml"), "utf8");
  issues.push(...findSecretSafetyIssues(manifestText, "capability.yaml"));
  issues.push(...findForbiddenDirectMutationRoutes(manifestText, "capability.yaml"));
  return issues;
}

function findForbiddenDirectMutationRoutes(text: string, source: string): CapabilityValidationIssue[] {
  const issues: CapabilityValidationIssue[] = [];
  for (const pattern of FORBIDDEN_DIRECT_MUTATION_PATTERNS) {
    if (pattern.test(text)) issues.push(error("safety.direct-mutation-route", "capability package references forbidden direct mutation route in " + source, source));
  }
  return issues;
}

function computeMaxEligibleLevel(capability: CapabilityDocument, issues: CapabilityValidationIssue[]): CapabilityCertificationLevel {
  if (issues.some((issue) => issue.severity === "error" && issue.code.startsWith("schema."))) return "experimental";
  const evidence = capability.certification?.evidence ?? {};
  const hasDocs = Boolean(capability.docs?.readme);
  const hasFixture = Array.isArray(capability.fixtures) && capability.fixtures.length > 0;
  if (!hasDocs || !hasFixture) return "experimental";

  const hasRedaction = evidence.redactionTests === true && Array.isArray(capability.redaction?.assertions) && capability.redaction.assertions.length > 0;
  const hasDiscoverClassify = evidence.discoverClassifyTests === true;
  if (!hasRedaction || !hasDiscoverClassify) return "experimental";

  const hasVerifiedEvidence =
    (evidence.goldenScenario === true || evidence.equivalentFixture === true) &&
    evidence.planOnlyTests === true &&
    evidence.failureDiagnosticFixture === true &&
    capability.requiresGates.length > 0;
  if (!hasVerifiedEvidence) return "community";

  const hasOfficialEvidence =
    capability.publisher === "envforge" &&
    evidence.officialDocs === true &&
    evidence.certificationHarness === true &&
    evidence.p0SafetyGates === true &&
    capability.supports.os.length > 0 &&
    capability.testMatrix.length > 0;
  if (!hasOfficialEvidence) return "verified";

  const hasProductionEvidence =
    evidence.liveDisposableTarget === true &&
    evidence.applyVerifyReportTested === true &&
    evidence.rollbackBoundaryDocumented === true &&
    evidence.upgradeRegressionPolicy === true;
  if (!hasProductionEvidence) return "official";

  return "production-certified";
}

function buildCheckSummary(
  capability: CapabilityDocument | undefined,
  issues: CapabilityValidationIssue[],
  effectiveLevel: CapabilityCertificationLevel
): string[] {
  const checks = [
    "schema-valid",
    "permissions-declared",
    "write-permissions-require-gates",
    "approved-environment-plan-boundary",
    "managed-execution-boundary",
    "redaction-scan",
    "no-direct-mutation-route",
    "fixtures-present",
    "docs-present",
    "certification-level-bounded"
  ];
  if (capability?.id.toLowerCase().includes("nginx")) checks.push("nginx-required-gates");
  if (capability?.id.toLowerCase().includes("postgres")) checks.push("postgresql-required-gates");
  checks.push("effective-level:" + effectiveLevel);
  if (issues.some((issue) => issue.severity === "error")) checks.push("failed");
  return checks;
}

function validateFixtures(doc: Record<string, unknown>, issues: CapabilityValidationIssue[]): void {
  const fixtures = doc.fixtures;
  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    issues.push(error("fixtures.required", "fixtures must be a non-empty array", "fixtures"));
    return;
  }
  fixtures.forEach((raw, index) => {
    const fixture = asRecord(raw);
    if (!fixture) {
      issues.push(error("fixtures.type", "fixture must be an object", "fixtures." + index));
      return;
    }
    for (const field of ["id", "path", "type"] as const) {
      if (!stringField(fixture, field)) issues.push(error("fixtures.required", "fixture." + field + " is required", "fixtures." + index + "." + field));
    }
  });
}

function validateCertificationEvidence(doc: Record<string, unknown>, issues: CapabilityValidationIssue[]): void {
  const certification = recordField(doc, "certification");
  if (!certification) {
    issues.push(error("certification.required", "certification is required", "certification"));
    return;
  }
  if (!recordField(certification, "evidence")) issues.push(error("certification.evidence", "certification.evidence is required", "certification.evidence"));
}

function validateRedaction(doc: Record<string, unknown>, issues: CapabilityValidationIssue[]): void {
  const redaction = recordField(doc, "redaction");
  if (!redaction) {
    issues.push(error("redaction.required", "redaction is required", "redaction"));
    return;
  }
  requireStringArray(redaction, "sensitiveKeys", "redaction.sensitiveKeys", issues, true);
  requireStringArray(redaction, "assertions", "redaction.assertions", issues);
}

function validateSafety(doc: Record<string, unknown>, issues: CapabilityValidationIssue[]): void {
  const safety = recordField(doc, "safety");
  if (!safety) {
    issues.push(error("safety.required", "safety is required", "safety"));
    return;
  }
  for (const field of ["approvedPlanRequired", "appliesViaManagedExecution", "publicMutationApi"] as const) {
    if (typeof safety[field] !== "boolean") issues.push(error("safety.boolean", "safety." + field + " must be boolean", "safety." + field));
  }
  requireStringArray(safety, "directMutationRoutes", "safety.directMutationRoutes", issues, true);
  if (!stringField(safety, "environmentPlanBoundary")) issues.push(error("safety.boundary", "safety.environmentPlanBoundary is required", "safety.environmentPlanBoundary"));
  const directRoutes = stringArrayField(safety, "directMutationRoutes") ?? [];
  if (directRoutes.length > 0) issues.push(error("safety.direct-routes", "direct mutation routes must not be declared", "safety.directMutationRoutes"));
}

function validateDocs(doc: Record<string, unknown>, issues: CapabilityValidationIssue[]): void {
  const docs = recordField(doc, "docs");
  if (!docs) {
    issues.push(error("docs.required", "docs is required", "docs"));
    return;
  }
  if (!stringField(docs, "readme")) issues.push(error("docs.readme", "docs.readme is required", "docs.readme"));
}

function requireGates(gates: string[], required: CapabilitySafetyGate[], issues: CapabilityValidationIssue[], capabilityId: string): void {
  for (const gate of required) {
    if (!gates.includes(gate)) issues.push(error("safety.required-gate", capabilityId + " requires " + gate, "requiresGates"));
  }
}

function requireStringArray(
  obj: Record<string, unknown> | undefined,
  field: string,
  displayPath: string,
  issues: CapabilityValidationIssue[],
  allowEmpty = false
): void {
  const value = stringArrayField(obj, field);
  if (!value || (!allowEmpty && value.length === 0)) {
    issues.push(error("schema.array", displayPath + " must be a " + (allowEmpty ? "" : "non-empty ") + "string array", displayPath));
  }
}

function asRecord(input: unknown): Record<string, unknown> | undefined {
  return typeof input === "object" && input !== null && !Array.isArray(input) ? (input as Record<string, unknown>) : undefined;
}

function recordField(obj: Record<string, unknown> | undefined, field: string): Record<string, unknown> | undefined {
  return asRecord(obj?.[field]);
}

function stringField(obj: Record<string, unknown> | undefined, field: string): string | undefined {
  const value = obj?.[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArrayField(obj: Record<string, unknown> | undefined, field: string): string[] | undefined {
  const value = obj?.[field];
  if (!Array.isArray(value)) return undefined;
  return value.every((item) => typeof item === "string") ? value.map((item) => item.trim()).filter(Boolean) : undefined;
}

function isCertificationLevel(input: string): input is CapabilityCertificationLevel {
  return CAPABILITY_STATUSES.includes(input as CapabilityCertificationLevel);
}

function isRiskLevel(input: string): input is CapabilityRiskLevel {
  return CAPABILITY_RISK_LEVELS.includes(input as CapabilityRiskLevel);
}

function isRollbackLevel(input: string): input is CapabilityRollbackLevel {
  return CAPABILITY_ROLLBACK_LEVELS.includes(input as CapabilityRollbackLevel);
}

function compareLevel(a: CapabilityCertificationLevel, b: CapabilityCertificationLevel): number {
  return (STATUS_ORDER.get(a) ?? 0) - (STATUS_ORDER.get(b) ?? 0);
}

function minLevel(a: CapabilityCertificationLevel, b: CapabilityCertificationLevel): CapabilityCertificationLevel {
  return compareLevel(a, b) <= 0 ? a : b;
}

function error(code: string, message: string, issuePath?: string): CapabilityValidationIssue {
  return { severity: "error", code, message, path: issuePath };
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readTextTree(root: string): Promise<string> {
  const parts: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      if (entry.isFile() && /\.(md|txt|ya?ml|json|ts|js)$/i.test(entry.name)) parts.push(await fs.readFile(fullPath, "utf8"));
    }
  }
  await walk(root);
  return parts.join("\n");
}
