/**
 * collectors/runner.ts — collector registry + runner (Phase 2)
 *
 * Builds on the existing StoredProbeSnapshot.collectors shape. Each collector
 * runs independently; one failure doesn't poison the whole probe.
 */

import type { CollectorCommandEvidence, CollectorResult, CollectorSummary, CollectionEnvelope } from "./types.js";
import { computeOverallCompleteness } from "./types.js";

export interface CollectorModule<T = string[]> {
  /** Simple check: can this collector run in the current context? */
  canRun?: (host: string, executor?: CollectorExecutor) => Promise<boolean> | boolean;
  /** Execute collection. Never throw — return { status: "failed" } on error. */
  run: (host: string, executor: CollectorExecutor) => Promise<CollectorResult<T>>;
}

/**
 * Minimal executor interface — abstracts the SSH client away so collectors
 * are testable without a live connection.
 */
export interface CollectorExecutor {
  exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean }>;
}

export interface RunnerOptions {
  /** Override overall collectedAt timestamp. Defaults to now. */
  collectedAt?: string;
  /** Only run these collector ids (empty = all registered). */
  filterIds?: string[];
}

/**
 * Registry of collector modules, keyed by id.
 */
const registry = new Map<string, CollectorModule>();

export function registerCollector(id: string, mod: CollectorModule): void {
  if (registry.has(id)) throw new Error(`Collector "${id}" is already registered.`);
  registry.set(id, mod);
}

export function unregisterCollector(id: string): boolean {
  return registry.delete(id);
}

export function listRegisteredCollectors(): string[] {
  return [...registry.keys()];
}

/**
 * Run all registered collectors sequentially (no-ops that want concurrency can
 * be unified later).
 *
 * On throw: the single collector is marked as failed and the runner continues.
 * This matches the "partial snapshot" contract — you don't lose the whole probe
 * just because one collector timed out.
 */
export async function runCollectors(
  host: string,
  executor: CollectorExecutor,
  options: RunnerOptions = {}
): Promise<CollectionEnvelope> {
  const collectedAt = options.collectedAt ?? new Date().toISOString();
  const summaries: Record<string, CollectorSummary> = {};
  const collectorIds = options.filterIds?.length
    ? options.filterIds.filter((id) => registry.has(id))
    : [...registry.keys()];

  for (const id of collectorIds) {
    const mod = registry.get(id);
    if (!mod) continue;

    let canRun = true;
    try {
      canRun = mod.canRun ? await mod.canRun(host) : true;
    } catch {
      canRun = false;
    }

    if (!canRun) {
      summaries[id] = {
        id,
        status: "skipped",
        completeness: 1,
        commands: [],
        errors: ["Collector cannot run in this environment."],
        collectedAt,
        data: []
      };
      continue;
    }

    try {
      const result = await mod.run(host, executor);
      summaries[id] = {
        id: result.id,
        status: result.status,
        completeness: result.completeness,
        commands: result.commands,
        stdout: result.stdout,
        stderr: result.stderr,
        errors: result.errors,
        collectedAt: result.collectedAt,
        data: Array.isArray(result.data) ? result.data.map(String) : []
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summaries[id] = {
        id,
        status: "failed",
        completeness: 0,
        commands: [{ command: `collector ${id}`, exitCode: undefined, timedOut: false }],
        errors: [message],
        collectedAt,
        data: []
      };
    }
  }

  const completeness = computeOverallCompleteness(Object.values(summaries));

  return {
    status: completeness.status,
    completeness: completeness.completeness,
    collectedAt,
    collectors: summaries
  };
}

// ══ Helper: merge collector results into FullSystemSnapshot shape ══════

/**
 * Extract per-collector data as string[] suitable for serializing onto
 * StoredProbeSnapshot.collectors (which uses data: string[]).
 */
export function extractCollectorData(envelope: CollectionEnvelope): Record<string, CollectorSummary> {
  return envelope.collectors;
}

/**
 * True when the collection envelope signals a partial or failed snapshot
 * that should trigger the partial-snapshot-confirm apply gate.
 */
export function shouldTriggerPartialSnapshotGate(envelope: CollectionEnvelope): boolean {
  return envelope.status !== "ok" || envelope.completeness < 1;
}
