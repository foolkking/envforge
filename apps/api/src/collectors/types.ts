/**
 * collectors/types.ts — collector module interface + completeness helpers
 *
 * Phase 2: Every collector returns a typed result so the runner can compute
 * per-collector and overall completeness without ambiguity.
 *
 * Backward compatible with existing StoredProbeSnapshot.collectors shape.
 */

export interface CollectorCommandEvidence {
  command: string;
  exitCode?: number;
  timedOut?: boolean;
}

export interface CollectorErrorEntry {
  code: string;
  message: string;
  command?: string;
  recoverable?: boolean;
}

/**
 * The canonical result shape every collector module must return.
 * Corresponds 1:1 with StoredProbeSnapshot.collectors[collector.id].
 */
export interface CollectorResult<T = string[]> {
  id: string;
  status: "ok" | "partial" | "failed" | "skipped";
  completeness: number; // 0–1
  commands: CollectorCommandEvidence[];
  stdout?: string;
  stderr?: string;
  errors: string[];
  collectedAt: string;
  data: T;
}

/** Summary the runner stores on the snapshot at collection.collectors[]. */
export interface CollectorSummary {
  id: string;
  status: "ok" | "partial" | "failed" | "skipped";
  completeness: number;
  commands: CollectorCommandEvidence[];
  stdout?: string;
  stderr?: string;
  errors: string[];
  collectedAt: string;
  data: string[];
}

/** Overall collection envelope persisted at snapshot.collection. */
export interface CollectionEnvelope {
  status: "ok" | "partial" | "failed";
  completeness: number;
  collectedAt: string;
  collectors: Record<string, CollectorSummary>;
}

// ══ Required / optional classification ═══════════════════════════════

/**
 * Collectors that are REQUIRED for a trustworthy snapshot.
 * If a required collector is "failed" the overall status can never be "ok".
 */
const REQUIRED_COLLECTOR_IDS = new Set([
  "os",
  "packages",
  "systemd",
  "network",
  "docker",
]);

/** Collectors that are optional and whose absence doesn't degrade overall status. */
const OPTIONAL_COLLECTOR_IDS = new Set([
  "compose",
  "config",
  "data",
  "security",
  "users",
  "certificates",
  "cron-timers",
  "runtime-processes",
]);

export function isRequiredCollector(id: string): boolean {
  return REQUIRED_COLLECTOR_IDS.has(id);
}

export function isOptionalCollector(id: string): boolean {
  return OPTIONAL_COLLECTOR_IDS.has(id);
}

// ══ Completeness helpers ═════════════════════════════════════════════

/**
 * Compute overall collection completeness from per-collector results.
 *
 * Rules:
 * - All required collectors are weighted equally.
 * - Optional collectors contribute to completeness but their SKIPPED status
 *   does NOT pull the overall status down to "failed".
 * - A required collector that is "failed" sets completeness = 0 for its weight.
 * - A required collector that is "partial" contributes its raw completeness.
 * - Skipped optional collectors are excluded from the average.
 * - If ALL collectors (including optional) skipped, completeness = 0.
 */
export function computeOverallCompleteness(
  results: CollectorSummary[]
): { completeness: number; status: "ok" | "partial" | "failed" } {
  const required = results.filter((r) => isRequiredCollector(r.id));
  const optional = results.filter((r) => isOptionalCollector(r.id));

  // Compute required collectors completeness
  let requiredCompleteness = 0;
  let requiredCount = 0;
  let hasFailedRequired = false;
  let hasDegradedRequired = false;

  for (const r of required) {
    requiredCount++;
    if (r.status === "failed") {
      hasFailedRequired = true;
      hasDegradedRequired = true;
      requiredCompleteness += 0;
    } else if (r.status === "skipped") {
      requiredCompleteness += 0;
      hasFailedRequired = true;
      hasDegradedRequired = true;
    } else {
      if (r.status === "partial") hasDegradedRequired = true;
      requiredCompleteness += r.completeness;
    }
  }

  const requiredAvg = requiredCount > 0 ? requiredCompleteness / requiredCount : 1.0;

  // Optional collectors — only those that actually ran contribute
  let optionalCompleteness = 0;
  let optionalRan = 0;
  for (const r of optional) {
    if (r.status === "skipped") continue;
    optionalRan++;
    optionalCompleteness += r.completeness;
  }
  const optionalAvg = optionalRan > 0 ? optionalCompleteness / optionalRan : 1.0;

  // Overall: blend required and optional, weighting required at 70%
  const totalRequired = requiredCount;
  const totalOptional = optionalRan;
  if (totalRequired + totalOptional === 0) {
    return { completeness: 0, status: "failed" };
  }

  const overall = (requiredAvg * totalRequired + optionalAvg * totalOptional)
    / (totalRequired + totalOptional);

  let status: "ok" | "partial" | "failed";
  if (hasFailedRequired) {
    status = overall > 0.3 ? "partial" : "failed";
  } else if (hasDegradedRequired || overall < 0.85) {
    status = "partial";
  } else {
    status = "ok";
  }

  return { completeness: Math.round(overall * 1000) / 1000, status };
}

/**
 * Answer whether a snapshot is partial from its collection.* envelope.
 */
export function isSnapshotPartial(snapshot: {
  collection?: { completeness?: number; status?: string };
}): boolean {
  const completeness = snapshot.collection?.completeness;
  if (completeness !== undefined && completeness < 1) return true;
  const status = snapshot.collection?.status;
  if (status === "partial" || status === "failed") return true;
  return false;
}

/**
 * Get snapshot completeness from its collection envelope.
 * Falls back to 1.0 for old snapshots without collection data.
 */
export function getSnapshotCompleteness(snapshot: {
  collection?: { completeness?: number };
}): number {
  return snapshot.collection?.completeness ?? 1.0;
}

/**
 * Look up a single collector's status from the collectors record.
 * Returns undefined for old snapshots where the record doesn't exist.
 */
export function getCollectorStatus(
  snapshot: { collectors?: Record<string, CollectorSummary> },
  collectorId: string
): "ok" | "partial" | "failed" | "skipped" | undefined {
  return snapshot.collectors?.[collectorId]?.status;
}

/**
 * Test whether a snapshot is complete enough for high-risk apply.
 * < 0.85 triggers partial-snapshot-confirm gate in the plan builder.
 */
export const PARTIAL_SNAPSHOT_THRESHOLD = 0.85;
