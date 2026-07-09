import { redactSecrets, safePreview } from "./action-runs.js";
import type { FullSystemSnapshot } from "./collectors/remote-collector.js";
import {
  extractInventoryGraph,
  aggregateServiceStacks,
  type ServiceStack
} from "./inventory-graph.js";
import type {
  MigrationCandidate,
  MigrationCandidateReport,
  RawMigrationEvidence,
  RiskLevel
} from "./migration-classifier.js";
import type {
  StoredMigrationDataDecision,
  StoredMigrationDecision,
  StoredMigrationSession,
  StoredProbeSnapshot
} from "./runtime-store.js";

export type AssessmentAvailability = "ready" | "collector-incomplete";
export type AssessmentServiceCategory =
  | "web-entry"
  | "app-runtime"
  | "database"
  | "cache"
  | "queue"
  | "storage"
  | "security"
  | "network"
  | "scheduled-job"
  | "unknown";

export interface AssessmentEvidenceRef {
  id: string;
  kind: string;
  source: string;
  label: string;
  value?: string;
  status?: string;
}

export interface AssessmentStackRelationship {
  type: "reverse-proxies" | "depends-on" | "provides-certs-for" | "exposes" | "triggers";
  targetServiceStackId: string;
  summary: string;
}

export interface AssessmentRequiredDecision {
  id: string;
  title: string;
  reason: string;
  relatedServiceStackIds: string[];
  defaultSafeChoice: string;
  options: Array<{ id: string; label: string; risk?: string }>;
}

export interface AssessmentServiceStack {
  id: string;
  name: string;
  category: AssessmentServiceCategory;
  summary: string;
  evidence: AssessmentEvidenceRef[];
  evidenceCount: number;
  confidence: "high" | "medium" | "low" | "unknown";
  confidenceReason: string;
  risk: "low" | "medium" | "high" | "unknown";
  riskReasons: string[];
  statefulness: "stateless" | "stateful" | "mixed" | "unknown";
  migrationReadiness:
    | "assessment-complete"
    | "plan-possible"
    | "requires-decision"
    | "blocked-by-missing-evidence"
    | "record-only-recommended"
    | "manual";
  requiredDecisions: AssessmentRequiredDecision[];
  recommendedStrategy?: string;
  relationships: AssessmentStackRelationship[];
  capabilityRefs: string[];
}

export interface AssessmentEvidenceQuality {
  overallStatus: "ok" | "partial" | "failed" | "unknown";
  completeness: number;
  collectors: Array<{
    name: string;
    status: "ok" | "partial" | "failed" | "skipped" | "unknown";
    completeness?: number;
    failedCommands?: string[];
    timedOutCommands?: string[];
    stderrSummary?: string;
    errors?: string[];
  }>;
  notes: string[];
}

export interface AssessmentReadiness {
  status:
    | "assessment-complete"
    | "plan-possible"
    | "apply-requires-decisions"
    | "blocked-by-missing-evidence"
    | "record-only-recommended";
  summary: string;
  blockers: string[];
  warnings: string[];
  nextActions: string[];
}

export interface AssessmentCompleteness {
  status: AssessmentEvidenceQuality["overallStatus"];
  score: number;
  failedCollectorCount: number;
  partialCollectorCount: number;
  timedOut: boolean;
}

export interface AssessmentRiskSummary {
  overall: "low" | "medium" | "high" | "unknown";
  low: number;
  medium: number;
  high: number;
  unknown: number;
  reasons: string[];
}

export interface AssessmentSummary {
  id: string;
  sessionId: string;
  availability: AssessmentAvailability;
  generatedAt: string;
  source?: { host?: string; os?: string; architecture?: string };
  snapshot?: { capturedAt?: string; completeness: AssessmentCompleteness };
  serviceStacks: AssessmentServiceStack[];
  /** Phase 6-B: enriched service stacks from the Inventory Graph engine. */
  enrichedStacks?: ServiceStack[];
  riskSummary: AssessmentRiskSummary;
  readiness: AssessmentReadiness;
  requiredDecisions: AssessmentRequiredDecision[];
  evidenceQuality: AssessmentEvidenceQuality;
  unsupportedOrManualItems: string[];
  report: { jsonAvailable: boolean; markdownAvailable: boolean };
  metadata: { envForgeVersion?: string; catalogVersion?: string };
  redactionNote: string;
}

export interface BuildAssessmentInput {
  session: StoredMigrationSession;
  snapshot: FullSystemSnapshot | StoredProbeSnapshot;
  report: MigrationCandidateReport;
  host?: string;
  decisions?: StoredMigrationDecision[];
  dataDecisions?: StoredMigrationDataDecision[];
  generatedAt?: string;
  envForgeVersion?: string;
  catalogVersion?: string;
}

const REDACTION_NOTE = "Sensitive values are redacted by default. The report contains evidence metadata and existence indicators, not private keys, full credentials, database contents, or arbitrary user data.";

export function buildAssessmentSummary(input: BuildAssessmentInput): AssessmentSummary {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const evidenceQuality = buildEvidenceQuality(input.snapshot);
  const decisions = new Map((input.decisions ?? []).map((decision) => [decision.candidateId, decision.decision]));
  const confirmedData = new Set(
    (input.dataDecisions ?? [])
      .filter((decision) => decision.status === "confirmed")
      .map((decision) => decision.candidateId)
  );
  const serviceStacks = input.report.candidates.map((candidate) =>
    stackForCandidate(candidate, evidenceQuality, decisions.get(candidate.id), confirmedData.has(candidate.id))
  );
  attachRelationships(serviceStacks);

  // Phase 6-B: extract InventoryGraph + aggregate enriched ServiceStack array
  const graph = extractInventoryGraph(input.snapshot as StoredProbeSnapshot);
  const enrichedStacks = aggregateServiceStacks(graph);

  const requiredDecisions = dedupeDecisions(serviceStacks.flatMap((stack) => stack.requiredDecisions));
  const riskSummary = buildRiskSummary(serviceStacks);
  const readiness = buildAssessmentReadiness(serviceStacks, requiredDecisions, evidenceQuality);
  const failedCollectorCount = evidenceQuality.collectors.filter((collector) => collector.status === "failed").length;
  const partialCollectorCount = evidenceQuality.collectors.filter((collector) => collector.status === "partial").length;
  const summary: AssessmentSummary = {
    id: `assessment:${input.session.id}:${input.snapshot.collectedAt}`,
    sessionId: input.session.id,
    availability: evidenceQuality.overallStatus === "ok" ? "ready" : "collector-incomplete",
    generatedAt,
    source: {
      host: input.host ?? input.report.sourceHost ?? input.snapshot.system.hostname,
      os: input.snapshot.system.osPretty ?? [input.snapshot.system.platform, input.snapshot.system.release].filter(Boolean).join(" "),
      architecture: input.snapshot.system.arch
    },
    snapshot: {
      capturedAt: input.snapshot.collectedAt,
      completeness: {
        status: evidenceQuality.overallStatus,
        score: evidenceQuality.completeness,
        failedCollectorCount,
        partialCollectorCount,
        timedOut: Boolean(input.snapshot.collection?.timedOut)
      }
    },
    serviceStacks,
    enrichedStacks,
    riskSummary,
    readiness,
    requiredDecisions,
    evidenceQuality,
    unsupportedOrManualItems: serviceStacks
      .filter((stack) => stack.category === "unknown" || stack.migrationReadiness === "manual" || stack.migrationReadiness === "record-only-recommended")
      .map((stack) => stack.name),
    report: { jsonAvailable: true, markdownAvailable: true },
    metadata: {
      envForgeVersion: input.envForgeVersion ?? process.env.npm_package_version,
      catalogVersion: input.catalogVersion ?? process.env.ENVFORGE_CATALOG_VERSION
    },
    redactionNote: REDACTION_NOTE
  };
  return redactAssessment(summary);
}

export function assessmentReportToMarkdown(summary: AssessmentSummary): string {
  const lines: string[] = [
    "# EnvForge Read-only Assessment Report",
    "",
    `- Assessment ID: \`${summary.id}\``,
    `- Migration session: \`${summary.sessionId}\``,
    `- Generated at: ${summary.generatedAt}`,
    `- Source host: ${summary.source?.host ?? "unknown"}`,
    `- Operating system: ${summary.source?.os ?? "unknown"}`,
    `- Architecture: ${summary.source?.architecture ?? "unknown"}`,
    `- Snapshot captured at: ${summary.snapshot?.capturedAt ?? "unknown"}`,
    `- Evidence status: ${summary.evidenceQuality.overallStatus}`,
    `- Collector completeness: ${Math.round(summary.evidenceQuality.completeness * 100)}%`,
    "",
    "> This assessment was generated in read-only mode.",
    "> No apply run was created.",
    "> No target mutation was performed.",
    "",
    "## Migration readiness",
    "",
    `**${summary.readiness.status}** — ${summary.readiness.summary}`,
    ""
  ];
  appendList(lines, "Blockers", summary.readiness.blockers);
  appendList(lines, "Warnings", summary.readiness.warnings);
  appendList(lines, "Next actions", summary.readiness.nextActions);

  lines.push(
    "## Risk summary",
    "",
    `- Overall risk: ${summary.riskSummary.overall}`,
    `- High-risk stacks: ${summary.riskSummary.high}`,
    `- Medium-risk stacks: ${summary.riskSummary.medium}`,
    `- Low-risk stacks: ${summary.riskSummary.low}`,
    `- Unknown-risk stacks: ${summary.riskSummary.unknown}`,
    ""
  );
  appendList(lines, "Assessment risk reasons", summary.riskSummary.reasons);

  lines.push("## Service stacks", "");
  if (!summary.serviceStacks.length) lines.push("No user-facing service stack was identified from the available evidence.", "");
  for (const stack of summary.serviceStacks) {
    lines.push(
      `### ${stack.name}`,
      "",
      `- Category: ${stack.category}`,
      `- Confidence: ${stack.confidence} — ${stack.confidenceReason}`,
      `- Risk: ${stack.risk}`,
      `- Statefulness: ${stack.statefulness}`,
      `- Migration readiness: ${stack.migrationReadiness}`,
      `- Summary: ${stack.summary}`,
      `- Recommended strategy: ${stack.recommendedStrategy ?? "Review evidence and choose a strategy before planning."}`,
      "",
      "Evidence:"
    );
    for (const evidence of stack.evidence) lines.push(`- ${evidence.label}${evidence.status ? ` (${evidence.status})` : ""}`);
    if (!stack.evidence.length) lines.push("- No direct evidence reference is available.");
    lines.push("");
    appendList(lines, "Risk reasons", stack.riskReasons);
  }

  lines.push("## Required decisions", "");
  if (!summary.requiredDecisions.length) lines.push("No required decisions were identified from the available evidence.", "");
  for (const decision of summary.requiredDecisions) {
    lines.push(`### ${decision.title}`, "", decision.reason, "", `Default safe choice: **${decision.defaultSafeChoice}**`, "", "Options:");
    for (const option of decision.options) lines.push(`- ${option.label}${option.risk ? ` — ${option.risk}` : ""}`);
    lines.push("");
  }

  lines.push("## Evidence quality", "");
  for (const collector of summary.evidenceQuality.collectors) {
    lines.push(`- **${collector.name}**: ${collector.status}${collector.completeness === undefined ? "" : ` (${Math.round(collector.completeness * 100)}%)`}`);
    for (const command of collector.failedCommands ?? []) lines.push(`  - Failed command: \`${command}\``);
    for (const command of collector.timedOutCommands ?? []) lines.push(`  - Timed out: \`${command}\``);
    if (collector.stderrSummary) lines.push(`  - stderr: ${collector.stderrSummary}`);
  }
  if (!summary.evidenceQuality.collectors.length) lines.push("- Per-collector evidence was not recorded for this snapshot.");
  lines.push("");
  appendList(lines, "Evidence notes", summary.evidenceQuality.notes);
  appendList(lines, "Unsupported or manual items", summary.unsupportedOrManualItems);

  lines.push(
    "## Redaction",
    "",
    summary.redactionNote,
    "",
    `EnvForge version: ${summary.metadata.envForgeVersion ?? "unavailable"}`,
    `Catalog version: ${summary.metadata.catalogVersion ?? "unavailable"}`,
    ""
  );
  return redactSecrets(lines.join("\n")).text;
}

function stackForCandidate(
  candidate: MigrationCandidate,
  evidenceQuality: AssessmentEvidenceQuality,
  savedDecision: StoredMigrationDecision["decision"] | undefined,
  dataStrategyConfirmed: boolean
): AssessmentServiceStack {
  const category = categoryForCandidate(candidate);
  const evidence = evidenceForCandidate(candidate);
  const statefulness = statefulnessForCandidate(candidate, category);
  const requiredDecisions = requiredDecisionsForCandidate(candidate, category, statefulness, dataStrategyConfirmed, savedDecision);
  const risk = riskForLevel(candidate.riskLevel);
  const blockedByEvidence = evidenceQuality.overallStatus === "failed" || evidenceQuality.completeness < 0.7;
  const explicitlyRecordOnly = savedDecision === "record-only" || candidate.decisionOutcome === "record-only";
  const explicitlyManual = savedDecision === "needs-manual-instruction";
  const migrationReadiness: AssessmentServiceStack["migrationReadiness"] = blockedByEvidence
    ? "blocked-by-missing-evidence"
    : explicitlyRecordOnly
      ? "record-only-recommended"
      : explicitlyManual
        ? "manual"
        : requiredDecisions.length > 0
          ? "requires-decision"
          : candidate.decisionOutcome === "blocker" || (candidate.blockers?.length ?? 0) > 0
            ? "manual"
            : category === "unknown" || candidate.supportLevel === "detect-only"
              ? "manual"
              : candidate.migrationReadiness >= 0.65
                ? "plan-possible"
                : "assessment-complete";
  const riskReasons = riskReasonsForCandidate(candidate, category, statefulness);
  return {
    id: `stack:${candidate.id}`,
    name: displayName(candidate, category),
    category,
    summary: summaryForCandidate(candidate, category, statefulness),
    evidence,
    evidenceCount: evidence.length,
    confidence: confidenceBand(candidate.intentConfidence ?? candidate.confidence),
    confidenceReason: confidenceReason(candidate, evidence),
    risk,
    riskReasons,
    statefulness,
    migrationReadiness,
    requiredDecisions,
    recommendedStrategy: recommendedStrategy(candidate, category, statefulness),
    relationships: [],
    capabilityRefs: [candidate.catalogRuleId, candidate.normalizedArtifactKey]
      .filter((value): value is string => Boolean(value))
  };
}

function buildEvidenceQuality(snapshot: FullSystemSnapshot | StoredProbeSnapshot): AssessmentEvidenceQuality {
  const overallStatus = snapshot.collection?.status ?? "unknown";
  const completeness = clamp(snapshot.collection?.completeness ?? 0);
  const collectors = Object.entries(snapshot.collectors ?? {}).map(([name, collector]) => {
    const failedCommands = collector.commands
      .filter((command) => command.exitCode !== undefined && command.exitCode !== 0 && !command.timedOut)
      .map((command) => command.command);
    const timedOutCommands = collector.commands.filter((command) => command.timedOut).map((command) => command.command);
    return {
      name,
      status: collector.status,
      completeness: clamp(collector.completeness),
      failedCommands: failedCommands.length ? failedCommands : undefined,
      timedOutCommands: timedOutCommands.length ? timedOutCommands : undefined,
      stderrSummary: collector.stderr ? safePreview(collector.stderr, 800).text : undefined,
      errors: collector.errors.length ? collector.errors.map((error) => redactSecrets(error).text) : undefined
    };
  }).sort((left, right) => left.name.localeCompare(right.name));
  const notes: string[] = [];
  if (!snapshot.collection) notes.push("This snapshot predates the collector evidence envelope; completeness is unknown and must not be treated as complete evidence.");
  if (snapshot.collection?.timedOut) notes.push("The overall collector timed out; buffered output is partial evidence, not proof that missing components are absent.");
  for (const collector of collectors.filter((item) => item.status === "failed" || item.status === "partial")) {
    notes.push(`${collector.name} collection ${collector.status}; an empty result from this collector does not mean the component is absent.`);
  }
  if (overallStatus === "ok" && completeness >= 0.99) notes.push("Collector evidence completed successfully.");
  return { overallStatus, completeness, collectors, notes };
}

function evidenceForCandidate(candidate: MigrationCandidate): AssessmentEvidenceRef[] {
  const refs = (candidate.rawEvidence ?? []).map((evidence) => evidenceRef(evidence));
  for (const service of candidate.serviceNames ?? []) {
    refs.push({ id: `service:${service}`, kind: "service", source: "service-inventory", label: `${normalizeServiceName(service)} is active`, status: "detected" });
  }
  for (const port of candidate.ports ?? []) refs.push({ id: `port:${port}`, kind: "port", source: "network-inventory", label: `port ${port} is listening`, value: String(port), status: "detected" });
  for (const path of candidate.configPaths ?? []) refs.push({ id: `config:${path}`, kind: "config-path", source: "catalog-and-snapshot", label: `Relevant config path: ${path}`, status: "review" });
  for (const path of candidate.dataPaths ?? []) refs.push({ id: `data:${path}`, kind: "data-path", source: "catalog-and-snapshot", label: `Stateful data path: ${path}`, status: "review" });
  return dedupeEvidence(refs).slice(0, 30);
}

function evidenceRef(evidence: RawMigrationEvidence): AssessmentEvidenceRef {
  const label = evidence.label
    ?? (evidence.kind === "package" ? `${evidence.name ?? evidence.value ?? "package"} package is installed`
      : evidence.kind === "service" ? `${normalizeServiceName(evidence.name ?? evidence.value ?? "service")} is active`
        : evidence.kind === "port" ? `port ${evidence.port ?? evidence.value ?? "unknown"} is listening`
          : [evidence.name, evidence.value].filter(Boolean).join(": ") || `${evidence.kind} evidence detected`);
  return {
    id: evidence.id,
    kind: evidence.kind,
    source: evidence.source,
    label,
    value: evidence.value,
    status: evidence.status
  };
}

function requiredDecisionsForCandidate(
  candidate: MigrationCandidate,
  category: AssessmentServiceCategory,
  statefulness: AssessmentServiceStack["statefulness"],
  dataStrategyConfirmed: boolean,
  savedDecision?: StoredMigrationDecision["decision"]
): AssessmentRequiredDecision[] {
  const stackId = `stack:${candidate.id}`;
  const decisions: AssessmentRequiredDecision[] = [];
  const explicitlyHandled = savedDecision === "record-only" || savedDecision === "needs-manual-instruction";
  if (category === "database" && statefulness !== "stateless" && !dataStrategyConfirmed && !explicitlyHandled) {
    const postgres = /postgres/i.test(`${candidate.name} ${candidate.catalogRuleName ?? ""}`);
    decisions.push({
      id: `decision:${candidate.id}:data-strategy`,
      title: postgres ? "PostgreSQL data migration strategy" : `${displayName(candidate, category)} data migration strategy`,
      reason: "This service contains stateful data and cannot be safely migrated by config copy alone.",
      relatedServiceStackIds: [stackId],
      defaultSafeChoice: "Record only until backup freshness is confirmed.",
      options: postgres ? [
        { id: "logical", label: "Use pg_dump/pg_restore", risk: "Recommended logical migration" },
        { id: "physical", label: "Use physical base backup", risk: "Requires version and consistency review" },
        { id: "record-only", label: "Record only, do not migrate", risk: "Safest until backup evidence exists" },
        { id: "manual", label: "Mark as manual", risk: "Operator-owned follow-up" }
      ] : [
        { id: "backup-restore", label: "Use supported backup/restore", risk: "Recommended" },
        { id: "record-only", label: "Record only, do not migrate", risk: "Safest default" },
        { id: "manual", label: "Mark as manual", risk: "Operator-owned follow-up" }
      ]
    });
  }
  if ((candidate.blockers?.length ?? 0) > 0 && !decisions.length) {
    decisions.push({
      id: `decision:${candidate.id}:manual-review`,
      title: `${displayName(candidate, category)} migration review`,
      reason: candidate.blockers?.join(" ") ?? "Migration blockers require an operator decision.",
      relatedServiceStackIds: [stackId],
      defaultSafeChoice: "Record only until the blockers are resolved.",
      options: [
        { id: "record-only", label: "Record only", risk: "Safe default" },
        { id: "manual", label: "Manual follow-up", risk: "Requires operator ownership" }
      ]
    });
  }
  return decisions;
}

function categoryForCandidate(candidate: MigrationCandidate): AssessmentServiceCategory {
  const text = `${candidate.name} ${candidate.catalogRuleName ?? ""} ${candidate.catalogRuleId ?? ""} ${(candidate.serviceNames ?? []).join(" ")}`.toLowerCase();
  if (/nginx|caddy|apache|httpd|haproxy|traefik/.test(text)) return "web-entry";
  if (/postgres|mysql|mariadb|mongodb|database|cockroach|sqlite/.test(text)) return "database";
  if (/redis|memcached/.test(text)) return "cache";
  if (/rabbitmq|kafka|nats|queue/.test(text)) return "queue";
  if (/docker|compose|podman|node(?:js)?|python|php|java|ruby|go runtime|application/.test(text)) return "app-runtime";
  if (/ufw|firewall|fail2ban|apparmor|selinux|certificate|certbot|security/.test(text)) return "security";
  if (/ssh|sshd|wireguard|tailscale|network|dns|frp/.test(text)) return "network";
  if (/cron|systemd-timer|timer\b|scheduled/.test(text) || candidate.source === "cron" || candidate.source === "systemd-timer") return "scheduled-job";
  if (/minio|nfs|samba|storage|filesystem/.test(text)) return "storage";
  return "unknown";
}

function statefulnessForCandidate(candidate: MigrationCandidate, category: AssessmentServiceCategory): AssessmentServiceStack["statefulness"] {
  if ((candidate.dataPaths?.length ?? 0) > 0) return category === "app-runtime" ? "mixed" : "stateful";
  if (category === "database" || category === "cache" || category === "queue" || category === "storage") return "stateful";
  if (category === "web-entry" || category === "security" || category === "network" || category === "scheduled-job") return "stateless";
  return "unknown";
}

function recommendedStrategy(candidate: MigrationCandidate, category: AssessmentServiceCategory, statefulness: AssessmentServiceStack["statefulness"]): string {
  if (/postgres/i.test(`${candidate.name} ${candidate.catalogRuleName ?? ""}`)) return "Use pg_dump/pg_restore for logical migration.";
  if (category === "database" || statefulness === "stateful") return "Confirm a supported backup/restore or export/import strategy before creating a Plan.";
  if (category === "app-runtime" && /docker|compose/i.test(candidate.name)) return "Reconstruct from reviewed Compose/config artifacts; do not copy /var/lib/docker blindly.";
  if (category === "unknown") return "Keep as record-only or assign a manual migration owner until stronger evidence is available.";
  return candidate.recommendedActions?.[0] ?? "Review the evidence, then create a Plan-only draft if migration is intended.";
}

function riskReasonsForCandidate(candidate: MigrationCandidate, category: AssessmentServiceCategory, statefulness: AssessmentServiceStack["statefulness"]): string[] {
  const reasons = [...candidate.risks, ...(candidate.blockers ?? []), ...(candidate.reviewReasons ?? [])];
  if (/postgres/i.test(`${candidate.name} ${candidate.catalogRuleName ?? ""}`)) {
    reasons.push(
      "Direct file copy may corrupt data if PostgreSQL is running.",
      "Version mismatch may break restore.",
      "Data volume size is unknown until explicitly measured.",
      "Backup freshness is unknown until verified."
    );
  } else if (category === "database" || statefulness === "stateful") {
    reasons.push("Stateful data requires an explicit consistency, backup, restore, and verification strategy.");
  }
  return [...new Set(reasons.filter(Boolean))].slice(0, 20);
}

function buildRiskSummary(stacks: AssessmentServiceStack[]): AssessmentRiskSummary {
  const counts = { low: 0, medium: 0, high: 0, unknown: 0 };
  for (const stack of stacks) counts[stack.risk] += 1;
  const overall = counts.high ? "high" : counts.medium ? "medium" : counts.low ? "low" : "unknown";
  return { overall, ...counts, reasons: [...new Set(stacks.flatMap((stack) => stack.riskReasons))].slice(0, 20) };
}

function buildAssessmentReadiness(
  stacks: AssessmentServiceStack[],
  requiredDecisions: AssessmentRequiredDecision[],
  evidence: AssessmentEvidenceQuality
): AssessmentReadiness {
  if (evidence.overallStatus === "failed" || evidence.completeness < 0.7) {
    return {
      status: "blocked-by-missing-evidence",
      summary: "The server can be described only partially; missing collector evidence must be reviewed before planning.",
      blockers: ["Collector completeness is below the safe planning threshold."],
      warnings: evidence.notes,
      nextActions: ["Review failed and timed-out collectors.", "Re-run the read-only scan.", "Keep unsupported components as record-only until evidence improves."]
    };
  }
  if (requiredDecisions.length) {
    return {
      status: "apply-requires-decisions",
      summary: `${requiredDecisions.length} migration decision(s) must be resolved before a trusted Plan can be prepared.`,
      blockers: [],
      warnings: requiredDecisions.map((decision) => decision.title),
      nextActions: ["Review the required decisions.", "Export this Assessment Report.", "Explicitly generate a Plan-only draft after decisions are recorded."]
    };
  }
  if (!stacks.length || stacks.every((stack) => stack.migrationReadiness === "manual" || stack.migrationReadiness === "record-only-recommended")) {
    return {
      status: "record-only-recommended",
      summary: "No service stack is currently ready for automated planning; retain the evidence and assign manual follow-up where needed.",
      blockers: [], warnings: [],
      nextActions: ["Export the Assessment Report.", "Add missing capability or manual ownership evidence before planning."]
    };
  }
  return {
    status: "plan-possible",
    summary: "The read-only assessment has enough evidence to support an explicit Plan-only draft.",
    blockers: [], warnings: evidence.notes,
    nextActions: ["Review service stacks and risks.", "Export the Assessment Report.", "Generate a Plan-only draft only when explicitly requested."]
  };
}

function attachRelationships(stacks: AssessmentServiceStack[]): void {
  const first = (category: AssessmentServiceCategory) => stacks.find((stack) => stack.category === category);
  const web = first("web-entry");
  const app = first("app-runtime");
  const database = first("database");
  const security = first("security");
  const scheduled = first("scheduled-job");
  if (web && app) web.relationships.push({ type: "reverse-proxies", targetServiceStackId: app.id, summary: `${web.name} may reverse proxy ${app.name}; confirm upstream configuration.` });
  if (app && database) app.relationships.push({ type: "depends-on", targetServiceStackId: database.id, summary: `${app.name} may depend on ${database.name}; confirm connection and migration order.` });
  if (security && web && /cert|tls/i.test(security.name)) security.relationships.push({ type: "provides-certs-for", targetServiceStackId: web.id, summary: `${security.name} may provide certificates for ${web.name}.` });
  if (security && web) security.relationships.push({ type: "exposes", targetServiceStackId: web.id, summary: `${security.name} controls network exposure for ${web.name}.` });
  if (scheduled) {
    const target = database ?? app;
    if (target) scheduled.relationships.push({ type: "triggers", targetServiceStackId: target.id, summary: `${scheduled.name} may trigger maintenance or backup work for ${target.name}.` });
  }
}

function displayName(candidate: MigrationCandidate, category: AssessmentServiceCategory): string {
  const base = candidate.catalogRuleName ?? candidate.name;
  if (category === "database" && /postgres/i.test(base) && !/database/i.test(base)) return `${base} Database`;
  return base;
}

function summaryForCandidate(candidate: MigrationCandidate, category: AssessmentServiceCategory, statefulness: AssessmentServiceStack["statefulness"]): string {
  return `${displayName(candidate, category)} was identified as ${category} from ${candidate.evidenceSources?.length ?? 0} evidence source(s). It is ${statefulness} and currently ${candidate.decisionOutcome ?? candidate.decisionBand}.`;
}

function confidenceReason(candidate: MigrationCandidate, evidence: AssessmentEvidenceRef[]): string {
  const sources = candidate.evidenceSources ?? [];
  return `${evidence.length} evidence reference(s) across ${sources.length || 1} source(s); classifier score ${Math.round((candidate.intentConfidence ?? candidate.confidence) * 100)}%.`;
}

function confidenceBand(score: number | undefined): AssessmentServiceStack["confidence"] {
  if (score === undefined || !Number.isFinite(score)) return "unknown";
  if (score >= 0.75) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

function riskForLevel(level: RiskLevel | undefined): AssessmentServiceStack["risk"] {
  if (level === "safe") return "low";
  if (level === "review") return "medium";
  if (level === "privileged" || level === "dangerous") return "high";
  return "unknown";
}

function normalizeServiceName(name: string): string {
  const clean = name.replace(/\.(service|timer)$/, "");
  return `${clean}.${name.endsWith(".timer") ? "timer" : "service"}`;
}

function dedupeEvidence(evidence: AssessmentEvidenceRef[]): AssessmentEvidenceRef[] {
  return [...new Map(evidence.map((item) => [`${item.kind}:${item.source}:${item.label}`, item])).values()];
}

function dedupeDecisions(decisions: AssessmentRequiredDecision[]): AssessmentRequiredDecision[] {
  return [...new Map(decisions.map((decision) => [decision.id, decision])).values()];
}

function appendList(lines: string[], title: string, items: string[]): void {
  if (!items.length) return;
  lines.push(`### ${title}`, "");
  for (const item of items) lines.push(`- ${item}`);
  lines.push("");
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function redactAssessment<T>(value: T): T {
  if (typeof value === "string") return redactSecrets(value).text as T;
  if (Array.isArray(value)) return value.map((item) => redactAssessment(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactAssessment(item)])) as T;
  }
  return value;
}
