/**
 * postgres-data-migration.ts — Phase 5R-B PostgreSQL dry-run first closed loop.
 *
 * Produces structured migration intent and dry-run evidence for PostgreSQL
 * database candidates. All command templates are permanently blocked from
 * execution — no real pg_dump/pg_restore, no database connection, no secrets.
 *
 * The dry-run closed loop transforms the advisory-only "Use pg_dump/pg_restore
 * for logical migration" text into a structured, testable, approval-gated
 * evidence artifact.
 */

import type { MigrationCandidate } from "./migration-classifier.js";
import type { StoredMigrationDataDecision, StoredProbeSnapshot } from "./runtime-store.js";
import { extractInventoryGraph } from "./inventory-graph.js";

// ══ Types ═══════════════════════════════════════════════════════════════

export type PostgresDataMigrationStrategy =
  | "logical-dump"
  | "physical-backup"
  | "record-only"
  | "manual"
  | "blocked";

export interface PostgresDataMigrationCommandTemplate {
  id: string;
  label: string;
  /** Sanitized command template — never contains real credentials. */
  template: string;
  sanitizedNotes: string[];
  /** Always true — blocks execution until credential model exists. */
  requiresSecret: boolean;
  /** Always true — execution requires explicit operator approval. */
  requiresApproval: boolean;
  /** Hard-coded true for Phase 5R-B. */
  blocked: true;
  blockedReason: string;
}

export interface PostgresDataMigrationIntent {
  candidateId: string;
  serviceName: string;
  sourceHost: string;
  strategy: PostgresDataMigrationStrategy;
  estimatedDataPaths: string[];
  estimatedConfigPaths: string[];
  estimatedVolumeBytes?: number;
  dryRunOnly: true;
  requiredApprovals: string[];
  blockedReason?: string;
  commandTemplates: PostgresDataMigrationCommandTemplate[];
}

export interface PostgresDataMigrationDryRun {
  intent: PostgresDataMigrationIntent;
  schemaVersion: "phase5r.dry-run.v1";
  generatedAt: string;
  hostname: string;
  assessment: {
    candidateFound: boolean;
    strategyRecommended: string;
    requiredDecisions: string[];
  };
  readiness: "requires-decision" | "dry-run-ready" | "blocked";
  approvalGates: Array<{
    gate: string;
    satisfied: boolean;
    reason?: string;
  }>;
  commandTemplates: PostgresDataMigrationCommandTemplate[];
  executionBlocked: true;
  executionBlockedReason: string;
  safetyNotes: string[];
}

// ══ Helpers ════════════════════════════════════════════════════════════

function isPostgresCandidate(candidate: MigrationCandidate): boolean {
  const text = `${candidate.name} ${candidate.catalogRuleName ?? ""}`;
  return /postgres/i.test(text);
}

function mapDataStrategy(
  decision: StoredMigrationDataDecision | undefined
): PostgresDataMigrationStrategy {
  if (!decision) return "blocked";
  switch (decision.strategy) {
    case "export-import":
    case "backup-restore":
      return "logical-dump";
    case "rsync-copy":
      return "physical-backup";
    case "no-data":
    case "manual":
      return "manual";
    default:
      return "blocked";
  }
}

function estimateDataPaths(
  candidate: MigrationCandidate,
  snapshot: StoredProbeSnapshot
): string[] {
  const paths = new Set<string>();

  // From candidate's own dataPaths (parsed from catalog rule or collector)
  for (const p of candidate.dataPaths ?? []) paths.add(p);

  // From InventoryGraph: find dataPath nodes whose label or packageName matches postgres
  try {
    const graph = extractInventoryGraph(snapshot);
    for (const node of graph.nodes) {
      if (node.kind !== "dataPath") continue;
      const dp = node as { label: string; packageName?: string; path?: string };
      if (/postgres/i.test(dp.label) || (dp.packageName && /postgres/i.test(dp.packageName))) {
        if (dp.path) paths.add(dp.path);
      }
    }
  } catch {
    // extractInventoryGraph may throw on malformed snapshots — gracefully degrade
  }

  return [...paths].sort();
}

function estimateConfigPaths(
  candidate: MigrationCandidate,
  snapshot: StoredProbeSnapshot
): string[] {
  const paths = new Set<string>();

  // From candidate's own configPaths
  for (const p of candidate.configPaths ?? []) paths.add(p);

  // From InventoryGraph: find configFile nodes matching postgres
  try {
    const graph = extractInventoryGraph(snapshot);
    for (const node of graph.nodes) {
      if (node.kind !== "configFile") continue;
      const cf = node as { label: string; path?: string };
      if (/postgres/i.test(cf.label)) {
        if (cf.path) paths.add(cf.path);
      }
    }
  } catch {
    // graceful degradation
  }

  return [...paths].sort();
}

// ══ Command template builders ══════════════════════════════════════════

function buildCommandTemplates(): PostgresDataMigrationCommandTemplate[] {
  return [
    {
      id: "pg-dump-custom",
      label: "pg_dump -Fc (custom format, recommended)",
      template:
        "pg_dump -h <source_host> -U <username> -d <dbname> -Fc -f <output_path>",
      sanitizedNotes: [
        "Credentials must be provided via ~/.pgpass or PGPASSWORD environment variable.",
        "Source host, username, and database name must be confirmed by operator.",
        "Custom format (-Fc) supports parallel restore with pg_restore -j.",
      ],
      requiresSecret: true,
      requiresApproval: true,
      blocked: true,
      blockedReason:
        "Database credential model not yet implemented; execution deferred to future phase.",
    },
    {
      id: "pg-dumpall",
      label: "pg_dumpall (global objects + all databases)",
      template:
        "pg_dumpall -h <source_host> -U <username> -f <output_path>",
      sanitizedNotes: [
        "pg_dumpall exports roles, tablespaces, and all databases.",
        "Consider using pg_dump per-database for selective migration.",
        "Credentials must be provided via ~/.pgpass or PGPASSWORD.",
      ],
      requiresSecret: true,
      requiresApproval: true,
      blocked: true,
      blockedReason:
        "Database credential model not yet implemented; execution deferred to future phase.",
    },
    {
      id: "pg-basebackup",
      label: "pg_basebackup (physical base backup)",
      template:
        "pg_basebackup -h <source_host> -U <replication_user> -D <target_directory> -Fp -Xs -P",
      sanitizedNotes: [
        "Requires replication connection and WAL archiving configured on source.",
        "Physical backups are version-specific and must match target PostgreSQL version.",
        "Typically faster for large databases but requires disk space equivalent to data directory size.",
      ],
      requiresSecret: true,
      requiresApproval: true,
      blocked: true,
      blockedReason:
        "Database credential model and replication configuration not yet implemented; execution deferred to future phase.",
    },
    {
      id: "pg-restore-custom",
      label: "pg_restore (restore custom-format dump)",
      template:
        "pg_restore -h <target_host> -U <username> -d <dbname> -Fc -j <jobs> <dump_file>",
      sanitizedNotes: [
        "Target database must already exist (pg_restore does not create it).",
        "Parallel restore (-j) can speed up large dumps on multi-core targets.",
        "Credentials must be provided via ~/.pgpass or PGPASSWORD.",
      ],
      requiresSecret: true,
      requiresApproval: true,
      blocked: true,
      blockedReason:
        "Database credential model and transfer safety not yet implemented; execution deferred to future phase.",
    },
  ];
}

// ══ Public API ══════════════════════════════════════════════════════════

export function buildPostgresDataMigrationIntent(params: {
  candidate: MigrationCandidate;
  snapshot: StoredProbeSnapshot;
  dataDecisions: StoredMigrationDataDecision[];
  host: string;
}): PostgresDataMigrationIntent | null {
  const { candidate, snapshot, dataDecisions, host } = params;

  // ── Gate 1: PostgreSQL detection ──
  if (!isPostgresCandidate(candidate)) return null;

  // ── Gate 2: strategy from data decisions ──
  const decision = dataDecisions.find((d) => d.candidateId === candidate.id);
  const strategy = mapDataStrategy(decision);

  // ── Estimate paths from candidate + InventoryGraph ──
  const estimatedDataPaths = estimateDataPaths(candidate, snapshot);
  const estimatedConfigPaths = estimateConfigPaths(candidate, snapshot);

  // ── Build blocked reason if needed ──
  let blockedReason: string | undefined;
  if (strategy === "blocked") {
    blockedReason = decision
      ? `Unsupported data migration strategy "${decision.strategy}". Must be one of: export-import, backup-restore, rsync-copy, no-data, manual, external.`
      : "Data migration strategy has not yet been decided. Use POST /api/migration/sessions/:sessionId/data-decisions to select a strategy.";
  }
  if (strategy !== "blocked" && estimatedDataPaths.length === 0) {
    blockedReason =
      "No PostgreSQL data paths detected. The snapshot may be incomplete — re-probe the host or confirm data directories manually.";
  }

  return {
    candidateId: candidate.id,
    serviceName: candidate.name,
    sourceHost: host,
    strategy,
    estimatedDataPaths,
    estimatedConfigPaths,
    dryRunOnly: true,
    requiredApprovals: ["data-strategy-confirm"],
    blockedReason,
    commandTemplates: buildCommandTemplates(),
  };
}

export function buildPostgresDataMigrationDryRun(
  intent: PostgresDataMigrationIntent
): PostgresDataMigrationDryRun {
  const now = new Date().toISOString();

  // ── Readiness ──
  let readiness: PostgresDataMigrationDryRun["readiness"];
  if (intent.blockedReason) {
    readiness = "blocked";
  } else if (
    intent.strategy !== "logical-dump" &&
    intent.strategy !== "physical-backup"
  ) {
    readiness = "requires-decision";
  } else {
    readiness = "dry-run-ready";
  }

  // ── Approval gates ──
  const dataStrategyGate = {
    gate: "data-strategy-confirm",
    satisfied: intent.strategy !== "blocked" && intent.strategy !== "manual",
    reason:
      intent.strategy === "blocked"
        ? "Data strategy is blocked — no executable migration strategy selected."
        : intent.strategy === "manual"
          ? "Data strategy is manual — operator must provide custom migration instructions."
          : undefined,
  };

  const approvalGates = [dataStrategyGate];

  // ── Execution blocked reason (always populated) ──
  const executionBlockedReason =
    "Real pg_dump/pg_restore execution is not implemented in this phase. " +
    "Only dry-run evidence is produced. Database credentials, transfer safety, " +
    "and restore verification must be designed before execution is enabled.";

  // ── Safety notes ──
  const safetyNotes = [
    "No database connection was made to produce this evidence. All analysis is read-only.",
    "All command templates are sanitized and contain no credentials, passwords, or connection strings.",
    "Execution requires: confirmed data strategy, approved Environment Plan, valid source and target connections, and database credentials via Secret Transport (not yet implemented).",
    "pg_dump and pg_restore may require significant downtime for large databases — plan accordingly.",
    "Physical backups (pg_basebackup) require matching PostgreSQL major versions between source and target.",
    "Direct file copy of /var/lib/postgresql while the database is running WILL corrupt data. Always use pg_dump or pg_basebackup.",
  ];

  return {
    intent,
    schemaVersion: "phase5r.dry-run.v1",
    generatedAt: now,
    hostname: intent.sourceHost,
    assessment: {
      candidateFound: true,
      strategyRecommended:
        intent.strategy === "logical-dump"
          ? "Use pg_dump/pg_restore for logical migration."
          : intent.strategy === "physical-backup"
            ? "Use pg_basebackup for physical migration."
            : intent.strategy,
      requiredDecisions: ["PostgreSQL data migration strategy"],
    },
    readiness,
    approvalGates,
    commandTemplates: intent.commandTemplates,
    executionBlocked: true,
    executionBlockedReason,
    safetyNotes,
  };
}

export function postgresDataMigrationDryRunForAssessment(params: {
  candidates: MigrationCandidate[];
  snapshot: StoredProbeSnapshot;
  dataDecisions: StoredMigrationDataDecision[];
  host: string;
}): PostgresDataMigrationDryRun | undefined {
  const pgCandidate = params.candidates.find(isPostgresCandidate);
  if (!pgCandidate) return undefined;

  const intent = buildPostgresDataMigrationIntent({
    candidate: pgCandidate,
    snapshot: params.snapshot,
    dataDecisions: params.dataDecisions,
    host: params.host,
  });

  if (!intent) return undefined;

  return buildPostgresDataMigrationDryRun(intent);
}
