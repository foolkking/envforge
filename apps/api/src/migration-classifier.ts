import type { FullSystemSnapshot, SoftwareItem } from "./collectors/remote-collector.js";
import { getDetectionRules, findRuleForPackage, type CatalogDetectionRule } from "./catalog-rules.js";

export type MigrationClass =
  | "managed-software"
  | "system-baseline"
  | "user-dotfile"
  | "service-config"
  | "language-global-package"
  | "container-workload"
  | "manual-install"
  | "unknown-review"
  | "do-not-migrate";

export type ConfidenceBand = "high" | "medium" | "low" | "ignore";
export type ReviewDecision = "pending" | "approved" | "skipped" | "ignore" | "record-only" | "migrate-artifact" | "create-catalog-draft" | "add-to-plan" | "needs-manual-instruction";
export type RiskLevel = "safe" | "review" | "privileged" | "dangerous";
export type DecisionBand = "auto" | "review" | "manual" | "ignore";
export type MigrationSupportLevel = CatalogDetectionRule["supportLevel"];
export type PackageArtifactClass =
  | "system-baseline"
  | "library-dependency"
  | "user-installed-package"
  | "language-global-package"
  | "container-workload"
  | "manual-install"
  | "runtime-service"
  | "unknown-review";

export type RawEvidenceKind =
  | "package"
  | "language-package"
  | "service"
  | "schedule"
  | "container"
  | "manual-path"
  | "port"
  | "config"
  | "security-check"
  | "unknown";

export interface RawMigrationEvidence {
  id: string;
  kind: RawEvidenceKind;
  source: string;
  name?: string;
  value?: string;
  version?: string;
  status?: string;
  trust?: SoftwareItem["trust"];
  path?: string;
  port?: number;
  label?: string;
  category?: string;
  catalogRuleId?: string;
}

export interface NormalizedArtifact {
  artifactKey: string;
  artifactClass: PackageArtifactClass;
  displayName: string;
  migrationClass: MigrationClass;
  userFacing: boolean;
  capabilityKey?: string;
  catalogRuleId?: string;
  catalogRuleName?: string;
  evidenceSources: string[];
  rawEvidence: RawMigrationEvidence[];
  packageNames: string[];
  serviceNames: string[];
  ports: number[];
  configPaths: string[];
  dataPaths: string[];
  configBundles: ConfigBundle[];
  reasons: string[];
}

export type ConfigOwnership = "catalog-owned" | "inferred-owner" | "user-dotfile" | "system-security" | "unknown";
export type ConfigDefaultStatus = "default" | "modified" | "user-created" | "unknown";
export type ConfigBundleSensitivity = "safe" | "review" | "secret" | "blocked";
export type ConfigBundleMigrationStrategy =
  | "omit-default"
  | "copy-with-review"
  | "template-with-vars"
  | "secret-out-of-band"
  | "manual-only"
  | "blocked";

export interface ConfigBundleFile {
  path: string;
  isGlob: boolean;
  defaultStatus: ConfigDefaultStatus;
  sensitivity: ConfigBundleSensitivity;
  source: "catalog" | "security-checklist" | "inferred";
}

export interface ConfigBundle {
  id: string;
  ownerCapabilityKey: string | null;
  ownerRuleId?: string;
  ownerDisplayName?: string;
  paths: ConfigBundleFile[];
  ownership: ConfigOwnership;
  defaultStatus: ConfigDefaultStatus;
  sensitivity: ConfigBundleSensitivity;
  migrationStrategy: ConfigBundleMigrationStrategy;
  validationHint?: string;
  rollbackStrategy?: string;
  riskLevel: RiskLevel;
  reasons: string[];
}

export interface MigrationCandidate {
  id: string;
  name: string;
  source: string;
  version: string;
  migrationClass: MigrationClass;
  confidence: number;
  intentConfidence: number;
  migrationReadiness: number;
  riskLevel: RiskLevel;
  supportLevel: MigrationSupportLevel;
  decisionBand: DecisionBand;
  band: ConfidenceBand;
  catalogRuleId?: string;
  catalogRuleName?: string;
  reasons: string[];
  risks: string[];
  recommendedActions: string[];
  normalizedArtifactKey?: string;
  artifactClass?: PackageArtifactClass;
  rawEvidence?: RawMigrationEvidence[];
  normalizedArtifacts?: NormalizedArtifact[];
  configBundles?: ConfigBundle[];
  blockers?: string[];
  reviewReasons?: string[];
  evidenceSources?: string[];
  packageNames?: string[];
  serviceNames?: string[];
  ports?: number[];
  configPaths?: string[];
  dataPaths?: string[];
  validateCommands?: string[];
  restartServices?: string[];
}

export interface MigrationCandidateReport {
  sourceHost: string;
  generatedAt: string;
  summary: Record<ConfidenceBand | "total", number>;
  normalizedArtifacts: NormalizedArtifact[];
  configBundles: ConfigBundle[];
  candidates: MigrationCandidate[];
}

export interface MigrationPlanAction {
  kind: "installPackage" | "copyConfig" | "validate" | "restart" | "review" | "export";
  label: string;
  command?: string;
  requiresSudo?: boolean;
  backup?: boolean;
  packageNames?: string[];
  configPaths?: string[];
  serviceName?: string;
}

export interface MigrationPlanItem {
  id: string;
  name: string;
  type: MigrationClass;
  confidence: number;
  intentConfidence?: number;
  migrationReadiness?: number;
  riskLevel?: RiskLevel;
  supportLevel?: MigrationSupportLevel;
  decisionBand?: DecisionBand;
  actions: MigrationPlanAction[];
  risks: string[];
  configBundles?: ConfigBundle[];
  userDecision: ReviewDecision;
}

export interface MigrationPlan {
  sourceHost: string;
  generatedAt: string;
  items: MigrationPlanItem[];
}

export type MigrationDecisionMap = Record<string, MigrationPlanItem["userDecision"]>;

type SnapshotForMigration = Pick<FullSystemSnapshot, "software" | "configChecklist"> & {
  system?: Partial<FullSystemSnapshot["system"]>;
};

const languageSources = new Set(["npm", "pip", "gem", "cargo", "go-bin", "nvm", "pyenv", "rbenv", "asdf", "sdkman"]);
const manualSources = new Set(["local-bin", "local-app", "opt", "srv", "user-bin"]);
const serviceSources = new Set(["systemd", "systemd-timer", "cron"]);
const packageInventorySources = new Set(["apt", "rpm", "snap", "flatpak"]);

export function buildMigrationCandidateReport(
  snapshot: SnapshotForMigration,
  options: { host?: string } = {}
): MigrationCandidateReport {
  const context = buildSnapshotEvidence(snapshot);
  const classified = snapshot.software.map((item) => classifySoftwareItem(item, context));
  const normalizedArtifacts = buildNormalizedArtifacts(classified, context);
  const configBundles = buildConfigBundles(normalizedArtifacts, context);
  const candidates = mergeCandidateEvidence(classified)
    .map((candidate) => attachNormalizedArtifact(candidate, normalizedArtifacts))
    .map((candidate) => attachConfigBundles(candidate, configBundles))
    .map(applyDecisionModel)
    .filter(isUserFacingCandidate)
    .sort(sortCandidates);
  const summary: MigrationCandidateReport["summary"] = { high: 0, medium: 0, low: 0, ignore: 0, total: candidates.length };
  for (const candidate of candidates) summary[candidate.band]++;
  return {
    sourceHost: options.host ?? snapshot.system?.hostname ?? "unknown-host",
    generatedAt: new Date().toISOString(),
    summary,
    normalizedArtifacts,
    configBundles,
    candidates
  };
}

export function buildMigrationPlanFromCandidates(report: MigrationCandidateReport, decisions: MigrationDecisionMap = {}): MigrationPlan {
  const items = report.candidates
    .filter((candidate) => candidate.band !== "ignore")
    .filter((candidate) => candidate.migrationClass !== "do-not-migrate")
    .filter((candidate) => decisions[candidate.id] !== "skipped" && decisions[candidate.id] !== "ignore")
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      type: candidate.migrationClass,
      confidence: candidate.confidence,
      intentConfidence: candidate.intentConfidence,
      migrationReadiness: candidate.migrationReadiness,
      riskLevel: candidate.riskLevel,
      supportLevel: candidate.supportLevel,
      decisionBand: candidate.decisionBand,
      actions: actionsForCandidate(candidate),
      risks: candidate.risks,
      configBundles: candidate.configBundles,
      userDecision: decisions[candidate.id] ?? "pending" as const
    }));
  return { sourceHost: report.sourceHost, generatedAt: new Date().toISOString(), items };
}

export function classifySoftwareItem(item: SoftwareItem, context: SnapshotEvidence = emptySnapshotEvidence()): MigrationCandidate {
  const rule = findRuleForSoftwareItem(item);
  const reasons: string[] = [];
  const risks: string[] = [];
  let score = 0.1;
  let migrationClass: MigrationClass = "unknown-review";

  if ((item.source === "apt" || item.source === "rpm") && isLowValueSystemPackage(item.name)) {
    return finalizeCandidate(item, "do-not-migrate", 0.05, undefined, [
      "Looks like a base image, kernel, firmware, library, or cloud-init package.",
      "EnvForge should not treat this as user migration intent."
    ], ["Usually restored by the target OS image or package dependencies."]);
  }

  if (rule) {
    score += 0.35;
    migrationClass = "managed-software";
    reasons.push(`Matched catalog capability: ${rule.displayName}.`);
  }
  if (item.trust === "user") {
    score += 0.12;
    reasons.push("Inventory marks this package as likely user-relevant.");
  } else if (item.trust === "uncertain") {
    score += 0.04;
    reasons.push("Package manager reports this as installed, but user intent is uncertain.");
  }
  if (languageSources.has(item.source)) {
    score += 0.18;
    migrationClass = rule ? "managed-software" : "language-global-package";
    reasons.push("Detected as a global language runtime/package artifact.");
  }
  if (item.source === "docker") {
    score += 0.14;
    migrationClass = "container-workload";
    reasons.push("Detected from Docker image inventory.");
    risks.push("Docker images are weak migration evidence; prefer compose files or service definitions.");
  }
  if (serviceSources.has(item.source)) {
    score += 0.22;
    migrationClass = rule ? "managed-software" : "service-config";
    reasons.push(item.status === "running" ? "Detected as a running service workload." : "Detected as an enabled or custom service/timer/cron workload.");
    if (item.status === "running") score += 0.1;
  }
  if (manualSources.has(item.source)) {
    score += 0.22;
    migrationClass = rule ? "managed-software" : "manual-install";
    reasons.push("Found in a user/manual install location such as /opt, /srv, /usr/local, or ~/.local/bin.");
    if (!rule) score = Math.max(score, 0.68);
  }
  if (item.source === "apt" || item.source === "rpm" || item.source === "snap" || item.source === "flatpak") {
    score += item.trust === "user" ? 0.08 : 0.03;
    reasons.push(`${item.source} reports the package as installed.`);
  }
  if (!rule && item.trust === "user" && packageInventorySources.has(item.source)) {
    score = Math.max(score, 0.45);
    reasons.push("Known user-relevant package-manager item; keep at medium confidence for review even without a catalog rule.");
  }
  if (rule && rule.detect.ports?.some((port) => context.openPorts?.has(port))) {
    score += 0.1;
    reasons.push(`Host is listening on catalog port(s): ${rule.detect.ports.filter((port) => context.openPorts?.has(port)).join(", ")}.`);
  }
  if (rule && context.configSignalIds?.has(rule.id)) {
    score += 0.06;
    reasons.push("Snapshot includes related configuration or security checklist evidence.");
  }

  addRuleGuidance(rule, reasons, risks);
  if (reasons.length === 0) reasons.push("Detected in host inventory, but no strong intent signal matched.");

  return finalizeCandidate(item, migrationClass, score, rule, reasons, risks);
}

function finalizeCandidate(
  item: SoftwareItem,
  migrationClass: MigrationClass,
  rawScore: number,
  rule: CatalogDetectionRule | undefined,
  reasons: string[],
  risks: string[]
): MigrationCandidate {
  const adjustedScore = rule && migrationClass !== "do-not-migrate" ? Math.max(rawScore, 0.45) : rawScore;
  const confidence = Math.max(0, Math.min(0.99, Number(adjustedScore.toFixed(2))));
  const candidate: MigrationCandidate = {
    id: `${item.source}:${item.name}`,
    name: item.name,
    source: item.source,
    version: item.version,
    migrationClass,
    confidence,
    intentConfidence: confidence,
    migrationReadiness: 0,
    riskLevel: "review",
    supportLevel: rule?.supportLevel ?? "detect-only",
    decisionBand: "review",
    band: bandForConfidence(confidence, migrationClass),
    catalogRuleId: rule?.id,
    catalogRuleName: rule?.displayName,
    reasons,
    risks,
    recommendedActions: recommendedActions(rule, migrationClass),
    normalizedArtifactKey: normalizedArtifactKeyFor(item, migrationClass, rule),
    artifactClass: artifactClassFor(item, migrationClass),
    rawEvidence: [rawEvidenceForSoftwareItem(item, migrationClass, rule)],
    evidenceSources: [item.source],
    packageNames: packageNamesForRule(rule, item),
    serviceNames: serviceNamesForItem(item),
    configPaths: configPathsForRule(rule),
    dataPaths: rule?.data?.paths ?? [],
    validateCommands: rule?.migrate.validate ?? [],
    restartServices: rule?.migrate.restartServices ?? []
  };
  return applyDecisionModel(candidate);
}

function addRuleGuidance(rule: CatalogDetectionRule | undefined, reasons: string[], risks: string[]): void {
  if (!rule) return;
  reasons.push(`Catalog support level: ${rule.supportLevel}.`);
  if (rule.config?.files?.length || rule.config?.globs?.length) reasons.push("Catalog rule defines concrete config files/globs for governed migration.");
  if (rule.migrate.validate?.length) reasons.push(`Validation available: ${rule.migrate.validate.join("; ")}.`);
  if (rule.migrationCompleteness?.configOnly !== "complete") risks.push(`Config-only migration is ${rule.migrationCompleteness?.configOnly ?? "unknown"}; review missing dependencies.`);
  for (const risk of rule.migrationCompleteness?.missingRisks ?? []) risks.push(`May also require: ${risk}.`);
  for (const note of rule.security?.notes ?? []) risks.push(note);
  if (rule.migrate.data !== "none") risks.push(`${rule.displayName} has data paths; data migration should be reviewed separately.`);
  if (rule.config?.secretPatterns?.length) risks.push("Config may contain secrets and requires content-level scan/review.");
}

function recommendedActions(rule: CatalogDetectionRule | undefined, migrationClass: MigrationClass): string[] {
  if (!rule) {
    if (migrationClass === "language-global-package") return ["Generate language-specific reinstall command.", "Review version and lockfile compatibility."];
    if (migrationClass === "container-workload") return ["Search for compose files before migrating images.", "Review container inspect data if compose is missing."];
    if (migrationClass === "manual-install") return ["Add to review queue and ask user for config/data paths."];
    return ["Review manually before adding to a migration plan."];
  }
  const actions: string[] = [];
  if (rule.migrate.package) actions.push(`Install package/capability ${rule.displayName}.`);
  if (rule.migrate.config) actions.push("Copy catalog-owned config files with backup and diff.");
  if (rule.migrate.data !== "none") actions.push(`Review ${rule.migrate.data} data directories before copy.`);
  for (const validate of rule.migrate.validate ?? []) actions.push(`Validate with: ${validate}.`);
  for (const service of rule.migrate.restartServices ?? []) actions.push(`Reload/restart service: ${service}.`);
  return actions;
}

function actionsForCandidate(candidate: MigrationCandidate): MigrationPlanAction[] {
  const actions: MigrationPlanAction[] = [];
  for (const label of candidate.recommendedActions) {
    if (label.startsWith("Install")) {
      actions.push({
        kind: "installPackage" as const,
        label,
        requiresSudo: true,
        packageNames: candidate.packageNames?.length ? candidate.packageNames : [candidate.name]
      });
      continue;
    }
    if (label.startsWith("Copy")) {
      const copyablePaths = candidate.configBundles?.length
        ? candidate.configBundles
          .filter((bundle) => bundle.migrationStrategy === "copy-with-review" || bundle.migrationStrategy === "template-with-vars")
          .flatMap((bundle) => bundle.paths.map((file) => file.path))
        : candidate.configPaths ?? [];
      if (copyablePaths.length) {
        actions.push({
          kind: "copyConfig" as const,
          label,
          requiresSudo: true,
          backup: true,
          configPaths: [...new Set(copyablePaths)]
        });
      }
      for (const bundle of candidate.configBundles ?? []) {
        if (bundle.migrationStrategy === "secret-out-of-band" || bundle.migrationStrategy === "manual-only" || bundle.migrationStrategy === "blocked" || bundle.migrationStrategy === "omit-default") {
          actions.push({
            kind: "review" as const,
            label: `Review config bundle ${bundle.id}: ${bundle.migrationStrategy}.`,
            requiresSudo: bundle.ownership === "system-security" || bundle.riskLevel === "privileged"
          });
        }
      }
      continue;
    }
    if (label.startsWith("Validate")) {
      for (const command of candidate.validateCommands?.length ? candidate.validateCommands : [label.replace(/^Validate with:\s*/i, "").replace(/\.$/, "")]) {
        actions.push({
          kind: "validate" as const,
          label: `Validate with: ${command}.`,
          command,
          requiresSudo: false
        });
      }
      continue;
    }
    if (label.startsWith("Reload") || label.startsWith("Restart")) {
      for (const serviceName of candidate.restartServices?.length ? candidate.restartServices : [label.replace(/^Reload\/restart service:\s*/i, "").replace(/\.$/, "")]) {
        actions.push({
          kind: "restart" as const,
          label: `Reload/restart service: ${serviceName}.`,
          serviceName,
          requiresSudo: true
        });
      }
      continue;
    }
    actions.push({ kind: "review" as const, label, requiresSudo: candidate.migrationClass !== "language-global-package" });
  }
  if (actions.length === 0) actions.push({ kind: "review", label: "Review this item before execution." });
  return actions;
}

interface SnapshotEvidence {
  openPorts: Set<number>;
  configSignalIds: Set<string>;
  portEvidence: RawMigrationEvidence[];
  configEvidenceByRuleId: Map<string, RawMigrationEvidence[]>;
}

function emptySnapshotEvidence(): SnapshotEvidence {
  return {
    openPorts: new Set<number>(),
    configSignalIds: new Set<string>(),
    portEvidence: [],
    configEvidenceByRuleId: new Map<string, RawMigrationEvidence[]>()
  };
}

function buildSnapshotEvidence(snapshot: SnapshotForMigration): SnapshotEvidence {
  const openPorts = new Set<number>();
  const configSignalIds = new Set<string>();
  const portEvidence: RawMigrationEvidence[] = [];
  const configEvidenceByRuleId = new Map<string, RawMigrationEvidence[]>();
  for (const item of snapshot.configChecklist ?? []) {
    if (item.category === "network") {
      for (const match of item.label.matchAll(/\b(\d{1,5})\b/g)) {
        const port = Number(match[1]);
        if (port > 0 && port <= 65535) {
          openPorts.add(port);
          portEvidence.push({
            id: `raw:port:${port}`,
            kind: "port",
            source: "open-port",
            value: `${port}/tcp`,
            port,
            label: item.label,
            category: item.category
          });
        }
      }
    }
    for (const ruleId of ruleIdsForConfigChecklistItem(item)) {
      configSignalIds.add(ruleId);
      const list = configEvidenceByRuleId.get(ruleId) ?? [];
      list.push({
        id: `raw:config:${encodeEvidenceId(item.id)}:${ruleId}`,
        kind: item.category === "security" ? "security-check" : "config",
        source: "config-checklist",
        name: item.id,
        value: item.status,
        status: item.status,
        label: item.label,
        category: item.category,
        catalogRuleId: ruleId
      });
      configEvidenceByRuleId.set(ruleId, list);
    }
  }
  return { openPorts, configSignalIds, portEvidence: dedupeRawEvidence(portEvidence), configEvidenceByRuleId };
}

function buildNormalizedArtifacts(candidates: MigrationCandidate[], context: SnapshotEvidence): NormalizedArtifact[] {
  const byKey = new Map<string, NormalizedArtifact>();

  for (const candidate of candidates) {
    const key = candidate.normalizedArtifactKey ?? normalizedArtifactKeyForCandidate(candidate);
    const artifact = byKey.get(key) ?? {
      artifactKey: key,
      artifactClass: candidate.artifactClass ?? "unknown-review",
      displayName: candidate.catalogRuleName ?? candidate.name,
      migrationClass: candidate.migrationClass,
      userFacing: isUserFacingCandidate(candidate),
      capabilityKey: ruleForCandidate(candidate)?.capabilityKey,
      catalogRuleId: candidate.catalogRuleId,
      catalogRuleName: candidate.catalogRuleName,
      evidenceSources: [],
      rawEvidence: [],
      packageNames: [],
      serviceNames: [],
      ports: [],
      configPaths: [],
      dataPaths: [],
      configBundles: [],
      reasons: []
    };

    artifact.userFacing = artifact.userFacing || isUserFacingCandidate(candidate);
    artifact.evidenceSources = mergeStrings(artifact.evidenceSources, candidate.evidenceSources ?? [candidate.source]);
    artifact.rawEvidence = dedupeRawEvidence([...(artifact.rawEvidence ?? []), ...(candidate.rawEvidence ?? [])]);
    artifact.packageNames = mergeStrings(artifact.packageNames, candidate.packageNames ?? []);
    artifact.serviceNames = mergeStrings(artifact.serviceNames, candidate.serviceNames ?? []);
    artifact.ports = mergeNumbers(artifact.ports, candidate.ports ?? []);
    artifact.configPaths = mergeStrings(artifact.configPaths, candidate.configPaths ?? []);
    artifact.dataPaths = mergeStrings(artifact.dataPaths, candidate.dataPaths ?? []);
    artifact.reasons = mergeStrings(artifact.reasons, candidate.reasons);
    byKey.set(key, artifact);
  }

  for (const artifact of byKey.values()) {
    const rule = artifact.catalogRuleId ? getDetectionRules().find((candidateRule) => candidateRule.id === artifact.catalogRuleId) : undefined;
    if (!rule) continue;
    const matchingPorts = (rule.detect.ports ?? []).filter((port) => context.openPorts.has(port));
    for (const evidence of context.portEvidence.filter((item) => item.port !== undefined && matchingPorts.includes(item.port))) {
      artifact.rawEvidence = dedupeRawEvidence([...artifact.rawEvidence, { ...evidence, catalogRuleId: rule.id }]);
    }
    if (matchingPorts.length) {
      artifact.evidenceSources = mergeStrings(artifact.evidenceSources, ["open-port"]);
      artifact.ports = mergeNumbers(artifact.ports, matchingPorts);
    }
    const configEvidence = context.configEvidenceByRuleId.get(rule.id) ?? [];
    if (configEvidence.length) {
      artifact.evidenceSources = mergeStrings(artifact.evidenceSources, ["config-checklist"]);
      artifact.rawEvidence = dedupeRawEvidence([...artifact.rawEvidence, ...configEvidence]);
    }
  }

  for (const artifact of byKey.values()) {
    artifact.reasons = mergeStrings(artifact.reasons, [
      `Normalized artifact aggregates ${artifact.rawEvidence.length} raw evidence item(s).`
    ]);
  }

  return [...byKey.values()].sort((a, b) => Number(b.userFacing) - Number(a.userFacing) || a.displayName.localeCompare(b.displayName));
}

function attachNormalizedArtifact(candidate: MigrationCandidate, artifacts: NormalizedArtifact[]): MigrationCandidate {
  const key = candidate.normalizedArtifactKey ?? normalizedArtifactKeyForCandidate(candidate);
  const artifact = artifacts.find((item) => item.artifactKey === key);
  if (!artifact) return candidate;
  const evidenceSources = artifact.evidenceSources.length ? artifact.evidenceSources : candidate.evidenceSources;
  const rawEvidence = artifact.rawEvidence.length ? artifact.rawEvidence : candidate.rawEvidence;
  return {
    ...candidate,
    source: evidenceSources?.length ? evidenceSources.join("+") : candidate.source,
    normalizedArtifactKey: artifact.artifactKey,
    artifactClass: artifact.artifactClass,
    rawEvidence,
    normalizedArtifacts: [artifact],
    evidenceSources,
    packageNames: mergeStrings(candidate.packageNames ?? [], artifact.packageNames),
    serviceNames: mergeStrings(candidate.serviceNames ?? [], artifact.serviceNames),
    ports: mergeNumbers(candidate.ports ?? [], artifact.ports),
    configPaths: mergeStrings(candidate.configPaths ?? [], artifact.configPaths),
    dataPaths: mergeStrings(candidate.dataPaths ?? [], artifact.dataPaths),
    reasons: mergeStrings(candidate.reasons, artifact.reasons)
  };
}

function attachConfigBundles(candidate: MigrationCandidate, configBundles: ConfigBundle[]): MigrationCandidate {
  const rule = ruleForCandidate(candidate);
  const bundles = rule
    ? configBundles.filter((bundle) => bundle.ownerRuleId === rule.id || bundle.ownerCapabilityKey === rule.capabilityKey)
    : [];
  return {
    ...candidate,
    configBundles: bundles,
    configPaths: mergeStrings(candidate.configPaths ?? [], bundles.flatMap((bundle) => bundle.paths.map((path) => path.path)))
  };
}

function applyDecisionModel(candidate: MigrationCandidate): MigrationCandidate {
  const rule = ruleForCandidate(candidate);
  const supportLevel = rule?.supportLevel ?? candidate.supportLevel ?? "detect-only";
  const intentConfidence = clampScore(candidate.confidence);
  const riskLevel = riskLevelForCandidate(candidate, rule);
  const migrationReadiness = readinessForCandidate(candidate, rule, riskLevel);
  const { blockers, reviewReasons } = reviewStateForCandidate(candidate, rule, riskLevel, migrationReadiness);
  const decisionBand = decisionBandForCandidate(candidate, {
    intentConfidence,
    migrationReadiness,
    riskLevel,
    supportLevel,
    blockers,
    reviewReasons
  });

  return {
    ...candidate,
    confidence: intentConfidence,
    intentConfidence,
    migrationReadiness,
    riskLevel,
    supportLevel,
    decisionBand,
    blockers,
    reviewReasons,
    band: bandForConfidence(intentConfidence, candidate.migrationClass)
  };
}

function buildConfigBundles(artifacts: NormalizedArtifact[], context: SnapshotEvidence): ConfigBundle[] {
  const ruleIds = new Set<string>();
  for (const artifact of artifacts) {
    if (artifact.catalogRuleId) ruleIds.add(artifact.catalogRuleId);
  }
  for (const ruleId of context.configEvidenceByRuleId.keys()) ruleIds.add(ruleId);

  const bundles = [...ruleIds]
    .flatMap((ruleId) => {
      const rule = getDetectionRules().find((candidateRule) => candidateRule.id === ruleId);
      return rule ? configBundlesForRule(rule, context) : [];
    });

  for (const artifact of artifacts) {
    artifact.configBundles = artifact.catalogRuleId
      ? bundles.filter((bundle) => bundle.ownerRuleId === artifact.catalogRuleId)
      : [];
  }

  return dedupeConfigBundles(bundles).sort((a, b) => a.id.localeCompare(b.id));
}

function configBundlesForRule(rule: CatalogDetectionRule, context: SnapshotEvidence): ConfigBundle[] {
  const paths = configPathsForRule(rule);
  const evidence = context.configEvidenceByRuleId.get(rule.id) ?? [];
  if (!paths.length && !evidence.length) return [];

  const files: ConfigBundleFile[] = paths.length
    ? paths.map((path) => configBundleFileForPath(path, rule, "catalog"))
    : securityFallbackPathsForRule(rule).map((path) => configBundleFileForPath(path, rule, "security-checklist"));

  const grouped = new Map<ConfigBundleMigrationStrategy, ConfigBundleFile[]>();
  for (const file of files) {
    const strategy = configStrategyForFile(file, rule);
    grouped.set(strategy, [...(grouped.get(strategy) ?? []), file]);
  }

  return [...grouped.entries()].map(([migrationStrategy, groupFiles]) => {
    const ownership = ownershipForConfigBundle(rule, groupFiles);
    const sensitivity = maxSensitivity(groupFiles.map((file) => file.sensitivity));
    const defaultStatus = maxDefaultStatus(groupFiles.map((file) => file.defaultStatus));
    const riskLevel = riskLevelForConfigBundle(rule, ownership, sensitivity, migrationStrategy);
    const validationHint = validationHintForBundle(rule, groupFiles);
    return {
      id: `config:${rule.id}:${migrationStrategy}`,
      ownerCapabilityKey: rule.capabilityKey,
      ownerRuleId: rule.id,
      ownerDisplayName: rule.displayName,
      paths: groupFiles,
      ownership,
      defaultStatus,
      sensitivity,
      migrationStrategy,
      validationHint,
      rollbackStrategy: rollbackStrategyForBundle(ownership, migrationStrategy),
      riskLevel,
      reasons: configBundleReasons(rule, groupFiles, evidence, migrationStrategy, sensitivity, ownership)
    };
  });
}

function configBundleFileForPath(path: string, rule: CatalogDetectionRule, source: ConfigBundleFile["source"]): ConfigBundleFile {
  return {
    path,
    isGlob: path.includes("*"),
    defaultStatus: defaultStatusForConfigPath(path),
    sensitivity: sensitivityForConfigPath(path, rule),
    source
  };
}

function sensitivityForConfigPath(path: string, rule: CatalogDetectionRule): ConfigBundleSensitivity {
  const lower = path.toLowerCase();
  if (/(^|\/)(shadow|gshadow)$|\/ssl\/private\/|id_rsa|id_ed25519|private[_-]?key|\.key$|\.pem$/.test(lower)) return "blocked";
  if (/(\.env$|\.env[/*]|secret|credential|token|password|auths|acme\.json|\.npmrc|\/\.docker\/config\.json|tailscaled\.state)/.test(lower)) return "secret";
  if (isSystemSecurityConfigPath(path)) return "review";
  if ((rule.config?.secretPatterns ?? []).length) return "review";
  return "safe";
}

function defaultStatusForConfigPath(path: string): ConfigDefaultStatus {
  const lower = path.toLowerCase();
  if (/(\.default|\.dist|\.dpkg-dist|\.rpmnew|sample|mime\.types)$/.test(lower)) return "default";
  if (path.includes("*") || /\/(conf\.d|sites-available|sites-enabled|jail\.d|pool\.d)\//.test(path)) return "user-created";
  return "unknown";
}

function configStrategyForFile(file: ConfigBundleFile, rule: CatalogDetectionRule): ConfigBundleMigrationStrategy {
  if (file.sensitivity === "blocked") return "blocked";
  if (file.sensitivity === "secret") return "secret-out-of-band";
  if (isSystemSecurityConfigPath(file.path) || rule.id === "security-baseline") return "manual-only";
  if (file.defaultStatus === "default") return "omit-default";
  if (rule.migrate.strategy === "template-or-copy") return "template-with-vars";
  return "copy-with-review";
}

function ownershipForConfigBundle(rule: CatalogDetectionRule, files: ConfigBundleFile[]): ConfigOwnership {
  if (rule.id === "security-baseline" || files.some((file) => isSystemSecurityConfigPath(file.path))) return "system-security";
  return "catalog-owned";
}

function riskLevelForConfigBundle(
  rule: CatalogDetectionRule,
  ownership: ConfigOwnership,
  sensitivity: ConfigBundleSensitivity,
  strategy: ConfigBundleMigrationStrategy
): RiskLevel {
  if (sensitivity === "blocked" || strategy === "blocked") return "dangerous";
  if (ownership === "system-security" || rule.security?.risk === "privileged") return "privileged";
  if (sensitivity === "secret" || sensitivity === "review" || rule.security?.risk === "review") return "review";
  return "safe";
}

function configBundleReasons(
  rule: CatalogDetectionRule,
  files: ConfigBundleFile[],
  evidence: RawMigrationEvidence[],
  strategy: ConfigBundleMigrationStrategy,
  sensitivity: ConfigBundleSensitivity,
  ownership: ConfigOwnership
): string[] {
  const reasons = [
    `Config bundle belongs to ${rule.displayName}.`,
    `Strategy: ${strategy}.`,
    `Sensitivity: ${sensitivity}.`,
    `Ownership: ${ownership}.`
  ];
  if (evidence.length) reasons.push(`Snapshot contributed ${evidence.length} config/security checklist evidence item(s).`);
  if (files.some((file) => file.defaultStatus === "default")) reasons.push("Default config paths are omitted unless the operator confirms a modified copy.");
  if (strategy === "secret-out-of-band") reasons.push("Secret-bearing config is not copied directly; values must be re-entered or templated out of band.");
  if (strategy === "blocked") reasons.push("Blocked config is not read or migrated by default.");
  if (ownership === "system-security") reasons.push("Security-sensitive system config requires validation and rollback review.");
  return reasons;
}

function validationHintForBundle(rule: CatalogDetectionRule, files: ConfigBundleFile[]): string | undefined {
  return rule.migrate.validate?.[0] ?? files.map((file) => validationHintForConfigPath(file.path)).find(Boolean);
}

function validationHintForConfigPath(path: string): string | undefined {
  if (path.includes("/etc/nginx/")) return "nginx -t";
  if (path.includes("/etc/ssh/")) return "sshd -t";
  if (path.includes("/etc/sudoers")) return "visudo -cf";
  if (path.includes("/etc/ufw/") || path.includes("firewalld") || path.includes("nftables")) return "firewall reload + SSH reachability probe";
  if (path.includes("/etc/postgresql/")) return "psql -c 'select 1'";
  if (path.includes("/etc/mysql/") || path.includes("/etc/mariadb/")) return "mysqladmin ping";
  return undefined;
}

function rollbackStrategyForBundle(ownership: ConfigOwnership, strategy: ConfigBundleMigrationStrategy): string {
  if (strategy === "blocked") return "No automatic migration; operator handles source material manually.";
  if (ownership === "system-security") return "Create backup, validate before apply, arm rollback timer or fresh SSH reachability check.";
  if (strategy === "secret-out-of-band") return "Do not copy source secret; rollback only target template changes.";
  return "Create target backup before writing and restore the backup on validation failure.";
}

function securityFallbackPathsForRule(rule: CatalogDetectionRule): string[] {
  if (rule.id !== "security-baseline") return [];
  return ["/etc/ssh/sshd_config", "/etc/sudoers", "/etc/ufw/user.rules", "/etc/firewalld/zones/*.xml"];
}

function isSystemSecurityConfigPath(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.includes("/etc/ssh/") ||
    lower.includes("/etc/sudoers") ||
    lower.includes("/etc/ufw/") ||
    lower.includes("/etc/firewalld/") ||
    lower.includes("/etc/nftables") ||
    lower.includes("/etc/iptables");
}

function maxSensitivity(values: ConfigBundleSensitivity[]): ConfigBundleSensitivity {
  const order: ConfigBundleSensitivity[] = ["safe", "review", "secret", "blocked"];
  return values.reduce((max, value) => order.indexOf(value) > order.indexOf(max) ? value : max, "safe");
}

function maxDefaultStatus(values: ConfigDefaultStatus[]): ConfigDefaultStatus {
  if (values.includes("modified")) return "modified";
  if (values.includes("user-created")) return "user-created";
  if (values.includes("unknown")) return "unknown";
  return "default";
}

function dedupeConfigBundles(bundles: ConfigBundle[]): ConfigBundle[] {
  const byId = new Map<string, ConfigBundle>();
  for (const bundle of bundles) byId.set(bundle.id, bundle);
  return [...byId.values()];
}

function riskLevelForCandidate(candidate: MigrationCandidate, rule: CatalogDetectionRule | undefined): RiskLevel {
  const bundles = candidate.configBundles ?? [];
  if (candidate.migrationClass === "do-not-migrate") return "safe";
  if (bundles.some((bundle) => bundle.riskLevel === "dangerous")) return "dangerous";
  if (bundles.some((bundle) => bundle.riskLevel === "privileged") || rule?.security?.risk === "privileged" || rule?.id === "security-baseline") return "privileged";
  if (!rule || candidate.migrationClass === "manual-install" || candidate.migrationClass === "unknown-review" || candidate.migrationClass === "container-workload") return "review";
  if (bundles.some((bundle) => bundle.riskLevel === "review") || rule.security?.risk === "review" || rule.migrate.data !== "none") return "review";
  return "safe";
}

function readinessForCandidate(candidate: MigrationCandidate, rule: CatalogDetectionRule | undefined, riskLevel: RiskLevel): number {
  if (candidate.migrationClass === "do-not-migrate") return 0.05;
  if (!rule) {
    const fallback = candidate.migrationClass === "language-global-package" ? 0.42 :
      candidate.migrationClass === "service-config" ? 0.34 :
      candidate.migrationClass === "container-workload" ? 0.28 :
      candidate.migrationClass === "manual-install" ? 0.22 :
      0.24;
    return Number(fallback.toFixed(2));
  }

  let score = supportReadinessBase(rule.supportLevel);
  if (rule.migrate.package) score += 0.04;
  if (rule.migrate.validate?.length) score += 0.08;
  if (rule.migrate.config && candidate.configBundles?.some((bundle) => bundle.migrationStrategy !== "blocked")) score += 0.03;
  if (rule.migrate.data === "optional") score -= rule.category === "database" ? 0.18 : 0.1;
  if (rule.migrate.data === "recommended") score -= rule.category === "database" ? 0.24 : 0.16;
  if (rule.migrationCompleteness?.configOnly === "partial") score -= 0.1;
  if (rule.migrationCompleteness?.configOnly === "insufficient") score -= 0.2;
  if (candidate.configBundles?.some((bundle) => bundle.migrationStrategy === "secret-out-of-band")) score -= 0.08;
  if (candidate.configBundles?.some((bundle) => bundle.migrationStrategy === "blocked")) score -= 0.25;
  if (riskLevel === "privileged") score -= 0.1;
  if (riskLevel === "dangerous") score -= 0.25;
  return clampScore(score);
}

function supportReadinessBase(supportLevel: MigrationSupportLevel): number {
  if (supportLevel === "full-migration") return 0.82;
  if (supportLevel === "managed-config") return 0.72;
  if (supportLevel === "basic-rebuild") return 0.58;
  return 0.25;
}

function reviewStateForCandidate(
  candidate: MigrationCandidate,
  rule: CatalogDetectionRule | undefined,
  riskLevel: RiskLevel,
  migrationReadiness: number
): { blockers: string[]; reviewReasons: string[] } {
  const blockers: string[] = [];
  const reviewReasons: string[] = [];
  const bundles = candidate.configBundles ?? [];

  if (candidate.migrationClass === "do-not-migrate") blockers.push("System baseline or dependency-only evidence is ignored.");
  if (!rule) reviewReasons.push("No catalog rule matched; user must provide manual migration instructions or create a catalog draft.");
  if (rule?.supportLevel === "detect-only") reviewReasons.push("Catalog support is detect-only; EnvForge can record evidence but cannot safely rebuild it.");
  if (migrationReadiness < 0.7) reviewReasons.push("Migration readiness is below the automatic stage threshold.");
  if (riskLevel === "privileged") reviewReasons.push("Privileged system changes require explicit review and rollback planning.");
  if (riskLevel === "dangerous") blockers.push("Dangerous or blocked evidence must be handled manually.");
  if (rule?.category === "database" && rule.migrate.data !== "none") reviewReasons.push("Database data strategy must be confirmed before plan execution.");
  else if (rule?.migrate.data !== "none") reviewReasons.push("Data paths exist; copy/export strategy must be reviewed.");
  if (bundles.some((bundle) => bundle.migrationStrategy === "manual-only")) reviewReasons.push("One or more config bundles require manual-only handling.");
  if (bundles.some((bundle) => bundle.migrationStrategy === "secret-out-of-band")) reviewReasons.push("Secret config must be handled out of band; raw values are not copied.");
  if (bundles.some((bundle) => bundle.migrationStrategy === "blocked")) blockers.push("At least one config bundle is blocked from automatic migration.");

  return { blockers: mergeStrings([], blockers), reviewReasons: mergeStrings([], reviewReasons) };
}

function decisionBandForCandidate(candidate: MigrationCandidate, scores: {
  intentConfidence: number;
  migrationReadiness: number;
  riskLevel: RiskLevel;
  supportLevel: MigrationSupportLevel;
  blockers: string[];
  reviewReasons: string[];
}): DecisionBand {
  if (candidate.migrationClass === "do-not-migrate" || scores.blockers.some((blocker) => blocker.includes("ignored"))) return "ignore";
  if (scores.blockers.length) return "review";
  if (!candidate.catalogRuleId && scores.intentConfidence >= 0.45) return "manual";
  if (
    scores.intentConfidence >= 0.82 &&
    scores.migrationReadiness >= 0.7 &&
    scores.supportLevel !== "detect-only" &&
    scores.riskLevel !== "dangerous" &&
    scores.riskLevel !== "privileged" &&
    scores.reviewReasons.length === 0
  ) return "auto";
  if (scores.intentConfidence >= 0.45 || scores.reviewReasons.length) return "review";
  return "manual";
}

function findRuleForSoftwareItem(item: SoftwareItem): CatalogDetectionRule | undefined {
  const direct = findRuleForPackage(item.name, item.source);
  if (direct) return direct;

  const normalized = normalizePackageNameForMatch(item.name);
  if (serviceSources.has(item.source)) {
    return getDetectionRules().find((rule) =>
      (rule.detect.systemd ?? []).some((serviceName) => normalizePackageNameForMatch(serviceName) === normalized)
    );
  }

  return undefined;
}

function ruleForCandidate(candidate: MigrationCandidate): CatalogDetectionRule | undefined {
  return candidate.catalogRuleId ? getDetectionRules().find((rule) => rule.id === candidate.catalogRuleId) : undefined;
}

function isUserFacingCandidate(candidate: MigrationCandidate): boolean {
  return candidate.migrationClass !== "do-not-migrate" && candidate.band !== "ignore";
}

function normalizedArtifactKeyFor(item: SoftwareItem, migrationClass: MigrationClass, rule: CatalogDetectionRule | undefined): string {
  if (rule) return `catalog:${rule.id}`;
  const name = normalizePackageNameForMatch(item.name);
  if (migrationClass === "do-not-migrate") return `system-baseline:${item.source}:${name}`;
  if (migrationClass === "container-workload") return `container:${name}`;
  if (migrationClass === "manual-install") return `manual:${item.source}:${name}`;
  if (migrationClass === "service-config") return `service:${name}`;
  return `${item.source}:${name}`;
}

function normalizedArtifactKeyForCandidate(candidate: MigrationCandidate): string {
  if (candidate.catalogRuleId) return `catalog:${candidate.catalogRuleId}`;
  const name = normalizePackageNameForMatch(candidate.name);
  if (candidate.migrationClass === "do-not-migrate") return `system-baseline:${candidate.source}:${name}`;
  if (candidate.migrationClass === "container-workload") return `container:${name}`;
  if (candidate.migrationClass === "manual-install") return `manual:${candidate.source}:${name}`;
  if (candidate.migrationClass === "service-config") return `service:${name}`;
  return `${candidate.source}:${name}`;
}

function artifactClassFor(item: SoftwareItem, migrationClass: MigrationClass): PackageArtifactClass {
  if (migrationClass === "do-not-migrate") return "system-baseline";
  if (migrationClass === "language-global-package") return "language-global-package";
  if (migrationClass === "container-workload") return "container-workload";
  if (migrationClass === "manual-install") return "manual-install";
  if (migrationClass === "service-config" || serviceSources.has(item.source)) return "runtime-service";
  if (migrationClass === "unknown-review") return "unknown-review";
  if (/^lib/i.test(item.name) && packageInventorySources.has(item.source)) return "library-dependency";
  return "user-installed-package";
}

function rawEvidenceForSoftwareItem(item: SoftwareItem, migrationClass: MigrationClass, rule: CatalogDetectionRule | undefined): RawMigrationEvidence {
  const kind = rawEvidenceKindFor(item);
  return {
    id: `raw:${item.source}:${encodeEvidenceId(item.name)}`,
    kind,
    source: item.source,
    name: item.name,
    value: item.name,
    version: item.version,
    status: item.status,
    trust: item.trust,
    path: pathForSoftwareItem(item),
    catalogRuleId: rule?.id
  };
}

function rawEvidenceKindFor(item: SoftwareItem): RawEvidenceKind {
  if (languageSources.has(item.source)) return "language-package";
  if (item.source === "docker") return "container";
  if (manualSources.has(item.source)) return "manual-path";
  if (item.source === "cron" || item.source === "systemd-timer") return "schedule";
  if (serviceSources.has(item.source)) return "service";
  if (packageInventorySources.has(item.source)) return "package";
  return "unknown";
}

function serviceNamesForItem(item: SoftwareItem): string[] {
  if (!serviceSources.has(item.source)) return [];
  if (item.source === "cron") return [];
  const suffix = item.source === "systemd-timer" ? ".timer" : ".service";
  return [item.name.endsWith(suffix) ? item.name : `${item.name}${suffix}`];
}

function pathForSoftwareItem(item: SoftwareItem): string | undefined {
  if (item.source === "opt") return `/opt/${item.name}`;
  if (item.source === "srv") return `/srv/${item.name}`;
  if (item.source === "local-bin") return `/usr/local/bin/${item.name}`;
  if (item.source === "local-app") return `/usr/local/${item.name}`;
  if (item.source === "user-bin") return `~/.local/bin/${item.name}`;
  if (item.source === "go-bin") return `~/go/bin/${item.name}`;
  return undefined;
}

function ruleIdsForConfigChecklistItem(item: FullSystemSnapshot["configChecklist"][number]): string[] {
  const lower = `${item.id} ${item.label} ${item.category}`.toLowerCase();
  const ids = new Set<string>();
  if (item.category === "security" || /\b(ssh|sshd|ufw|firewall|fail2ban|unattended)\b/.test(lower)) ids.add("security-baseline");

  for (const rule of getDetectionRules()) {
    const tokens = [
      rule.id,
      rule.displayName,
      rule.capabilityKey,
      ...(rule.detect.binaries ?? []),
      ...(rule.detect.systemd ?? []).map((serviceName) => serviceName.replace(/\.(service|timer)$/, "")),
      ...Object.values(rule.detect.packages ?? {}).flat()
    ]
      .map((token) => normalizePackageNameForMatch(token))
      .filter((token) => token.length >= 3);
    if (tokens.some((token) => lower.includes(token))) ids.add(rule.id);
  }

  return [...ids];
}

function dedupeRawEvidence(evidence: RawMigrationEvidence[]): RawMigrationEvidence[] {
  const byId = new Map<string, RawMigrationEvidence>();
  for (const item of evidence) byId.set(item.id, item);
  return [...byId.values()];
}

function mergeStrings(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b].filter(Boolean))];
}

function mergeNumbers(a: number[], b: number[]): number[] {
  return [...new Set([...a, ...b].filter((value) => Number.isFinite(value)))].sort((left, right) => left - right);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(0.99, Number(value.toFixed(2))));
}

function encodeEvidenceId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function mergeCandidateEvidence(candidates: MigrationCandidate[]): MigrationCandidate[] {
  const byKey = new Map<string, MigrationCandidate>();
  const baseConfidenceByCandidate = new WeakMap<MigrationCandidate, number>();
  for (const candidate of candidates) {
    const key = candidate.catalogRuleId ? `catalog:${candidate.catalogRuleId}` : `${candidate.source}:${candidate.name}`.toLowerCase();
    const existing = byKey.get(key);
    if (!existing) {
      const stored = candidate.catalogRuleId ? { ...candidate, id: key } : candidate;
      byKey.set(key, stored);
      baseConfidenceByCandidate.set(stored, candidate.confidence);
      continue;
    }
    const evidenceSources = [...new Set([...(existing.evidenceSources ?? [existing.source]), ...(candidate.evidenceSources ?? [candidate.source])])];
    const mergedPackageNames = [...new Set([...(existing.packageNames ?? []), ...(candidate.packageNames ?? [])])];
    const mergedRawEvidence = dedupeRawEvidence([...(existing.rawEvidence ?? []), ...(candidate.rawEvidence ?? [])]);
    const mergedServiceNames = [...new Set([...(existing.serviceNames ?? []), ...(candidate.serviceNames ?? [])])];
    const mergedPorts = [...new Set([...(existing.ports ?? []), ...(candidate.ports ?? [])])].sort((a, b) => a - b);
    const hasOperationalEvidence = evidenceSources.some((source) => serviceSources.has(source)) ||
      existing.reasons.some(isOperationalReason) ||
      candidate.reasons.some(isOperationalReason);
    const sourceBonus = Math.min(0.16, (evidenceSources.length - 1) * 0.06);
    const operationalBonus = hasOperationalEvidence ? 0.08 : 0;
    const packageEvidenceBonus = existing.catalogRuleId
      ? Math.min(0.14, Math.max(0, mergedPackageNames.length - 1) * 0.04)
      : 0;
    const baseConfidence = Math.max(baseConfidenceByCandidate.get(existing) ?? existing.confidence, candidate.confidence);
    baseConfidenceByCandidate.set(existing, baseConfidence);
    const confidence = Math.min(0.99, baseConfidence + sourceBonus + operationalBonus + packageEvidenceBonus);
    existing.confidence = Number(confidence.toFixed(2));
    existing.band = bandForConfidence(existing.confidence, existing.migrationClass);
    existing.source = evidenceSources.join("+");
    existing.version = [...new Set([existing.version, candidate.version].filter(Boolean))].join(", ");
    existing.evidenceSources = evidenceSources;
    const mergedReasons = [...existing.reasons, ...candidate.reasons]
      .filter((reason) => !/^Matched \d+ packages for this catalog capability:/.test(reason));
    existing.reasons = [...new Set([
      ...mergedReasons,
      `Evidence sources: ${evidenceSources.join(", ")}.`,
      ...(existing.catalogRuleId && mergedPackageNames.length > 1 ? [`Matched ${mergedPackageNames.length} packages for this catalog capability: ${mergedPackageNames.join(", ")}.`] : [])
    ])];
    existing.risks = [...new Set([...existing.risks, ...candidate.risks])];
    existing.rawEvidence = mergedRawEvidence;
    existing.packageNames = mergedPackageNames;
    existing.serviceNames = mergedServiceNames;
    existing.ports = mergedPorts;
    existing.configPaths = [...new Set([...(existing.configPaths ?? []), ...(candidate.configPaths ?? [])])];
    existing.dataPaths = [...new Set([...(existing.dataPaths ?? []), ...(candidate.dataPaths ?? [])])];
    existing.validateCommands = [...new Set([...(existing.validateCommands ?? []), ...(candidate.validateCommands ?? [])])];
    existing.restartServices = [...new Set([...(existing.restartServices ?? []), ...(candidate.restartServices ?? [])])];
  }
  return [...byKey.values()];
}

function isOperationalReason(reason: string): boolean {
  const lower = reason.toLowerCase();
  return lower.includes("running service") ||
    lower.includes("listening on catalog port") ||
    lower.includes("configuration or security checklist");
}

function packageNamesForRule(rule: CatalogDetectionRule | undefined, item: SoftwareItem): string[] {
  if (!rule?.migrate.package) return [];
  const apt = rule.detect.packages?.apt ?? [];
  const rpm = rule.detect.packages?.rpm ?? [];
  const sourcePackages = rule.detect.packages?.[item.source as keyof NonNullable<CatalogDetectionRule["detect"]["packages"]>] ?? [];
  const normalizedItem = normalizePackageNameForMatch(item.name);
  const sourceMatch = sourcePackages.find((pkg) => normalizePackageNameForMatch(pkg) === normalizedItem);
  if (sourceMatch) return [sourceMatch];
  const anyPackageMatch = Object.values(rule.detect.packages ?? {}).flat()
    .find((pkg) => normalizePackageNameForMatch(pkg) === normalizedItem);
  if (anyPackageMatch) return [anyPackageMatch];
  if (packageInventorySources.has(item.source)) return [item.name];
  const chosen = sourcePackages.length ? sourcePackages : apt.length ? apt : rpm;
  return chosen.length ? [chosen[0]] : [item.name];
}

function configPathsForRule(rule: CatalogDetectionRule | undefined): string[] {
  return [...(rule?.config?.files ?? []), ...(rule?.config?.globs ?? [])];
}

function isLowValueSystemPackage(name: string): boolean {
  return /^(linux-|lib|firmware|cloud-init|ubuntu-|base-files|systemd|initramfs|grub|tzdata|ca-certificates|gcc-|g\+\+-|python3-minimal)/i.test(name);
}

function bandForConfidence(confidence: number, migrationClass: MigrationClass): ConfidenceBand {
  return confidence >= 0.75 ? "high" : confidence >= 0.45 ? "medium" : migrationClass === "do-not-migrate" ? "ignore" : "low";
}

function normalizePackageNameForMatch(name: string): string {
  return name.toLowerCase().replace(/\.service$/, "").replace(/^docker\.io$/, "docker").trim();
}

function sortCandidates(a: MigrationCandidate, b: MigrationCandidate): number {
  return b.confidence - a.confidence || a.name.localeCompare(b.name);
}
