/**
 * catalog-draft.ts — generate Capability Catalog v2 YAML drafts.
 *
 * The Review Queue lets operators mark unknown items with a
 * `create-catalog-draft` decision. This module turns the candidate evidence
 * into a fillable rule template that contributors can finish in a PR or in
 * the catalog admin panel.
 *
 * The default supportLevel is `detect-only` — anything stronger requires a
 * human to validate detect signals, configs, data strategy, validate
 * commands and rollback rules. We pre-fill what we know from the candidate
 * (package manager, version, evidence) and emit clearly-marked TODO fields
 * for everything else.
 */

import type { MigrationCandidate } from "./migration-classifier.js";

export interface CatalogDraft {
  /** Slugified id used as the catalog rule's primary key. */
  id: string;
  /** Capability key suggestion; contributors must finalise this. */
  capabilityKey: string;
  /** Final YAML draft text. */
  yaml: string;
  /** Notes and TODOs that the UI can show next to the draft. */
  notes: string[];
}

export function buildCatalogDraft(candidate: MigrationCandidate): CatalogDraft {
  const id = slugify(candidate.id || candidate.name);
  const capabilityKey = `unknown.${id}`;
  const lines: string[] = [];
  const notes: string[] = [];

  lines.push(`# EnvForge Capability Catalog draft.`);
  lines.push(`# Auto-generated from Review Queue candidate: ${candidate.name} (${candidate.source}).`);
  lines.push(`# Migration class: ${candidate.migrationClass}; confidence: ${Math.round(candidate.confidence * 100)}%.`);
  lines.push(`# Review TODOs are marked with "TODO:" in the YAML body. Resolve them before raising supportLevel.`);
  lines.push("");

  lines.push(`id: ${id}`);
  lines.push(`kind: software`);
  lines.push(`name: ${escapeYaml(candidate.name)}`);
  lines.push(`capabilityKey: ${escapeYaml(capabilityKey)}`);
  lines.push(`capability: ${escapeYaml(capabilityKey)}`);
  lines.push(`supportLevel: detect-only`);
  lines.push("");

  lines.push("detect:");
  lines.push("  packages:");
  lines.push(`    ${candidate.source}:`);
  const detectPackages = candidate.packageNames?.length ? candidate.packageNames : [candidate.name];
  for (const p of detectPackages) lines.push(`      - ${escapeYaml(p)}`);
  lines.push("  binaries: [] # TODO: list real binaries observed on the host");
  lines.push("  systemd: [] # TODO: list relevant unit files");
  lines.push("  ports: [] # TODO: list listening ports");
  lines.push("");

  lines.push("intentSignals:");
  lines.push("  high: []");
  lines.push("  medium: []");
  lines.push("  low: []");
  lines.push("");

  lines.push("configs:");
  if (candidate.configPaths?.length) {
    lines.push("  files:");
    for (const path of candidate.configPaths) lines.push(`    - ${escapeYaml(path)}`);
  } else {
    lines.push("  files: [] # TODO: list managed config paths");
  }
  lines.push("  globs: []");
  lines.push("  sensitivity: review");
  lines.push("  secretPatterns: []");
  lines.push("");

  lines.push("data:");
  if (candidate.dataPaths?.length) {
    lines.push("  paths:");
    for (const path of candidate.dataPaths) {
      lines.push(`    - path: ${escapeYaml(path)}`);
      lines.push(`      requiredForFunctionality: optional`);
      lines.push(`      strategy: rsync-review`);
    }
  } else {
    lines.push("  paths: [] # TODO: list data directories and migration strategy");
  }
  lines.push("");

  lines.push("references:");
  lines.push("  parse: []");
  lines.push("");

  lines.push("validate:");
  if (candidate.validateCommands?.length) {
    lines.push("  preApply: []");
    lines.push("  postApply:");
    for (const cmd of candidate.validateCommands) lines.push(`    - command: ${escapeYaml(cmd)}`);
  } else {
    lines.push("  preApply: [] # TODO: pre-apply validation commands");
    lines.push("  postApply: [] # TODO: post-apply health checks");
  }
  lines.push("");

  lines.push("rollback:");
  if (candidate.configPaths?.length) {
    lines.push("  backupPaths:");
    for (const path of candidate.configPaths) lines.push(`    - ${escapeYaml(path)}`);
  } else {
    lines.push("  backupPaths: []");
  }
  if (candidate.restartServices?.length) {
    lines.push("  restartServices:");
    for (const svc of candidate.restartServices) lines.push(`    - ${escapeYaml(svc)}`);
  } else {
    lines.push("  restartServices: []");
  }
  lines.push("");

  lines.push("security:");
  lines.push("  risk: review");
  lines.push("  notes:");
  for (const risk of candidate.risks) lines.push(`    - ${escapeYaml(risk)}`);
  if (candidate.risks.length === 0) {
    lines.push('    - "Confirm whether this software is part of the user environment."');
  }
  lines.push("");

  lines.push("crossDistro:");
  lines.push("  notes: \"TODO: list distro-specific package names, init systems, and config paths.\"");

  if (candidate.migrationClass === "unknown-review") notes.push("Candidate is in the Unknown Review Queue; double-check before publishing.");
  if (!candidate.configPaths?.length) notes.push("Add config paths and ownership signals before raising supportLevel.");
  if (!candidate.validateCommands?.length) notes.push("Add at least one post-apply validation command before raising supportLevel.");

  return { id, capabilityKey, yaml: lines.join("\n") + "\n", notes };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "draft";
}

function escapeYaml(value: string): string {
  return JSON.stringify(value);
}
