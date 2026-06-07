/**
 * snapshot-to-plan.ts — turn a vm-snapshot profile into staged evidence YAML.
 *
 * EnvForge does not deploy snapshots directly. A snapshot is **evidence**:
 * software, configs, env vars, and services that were observed on the source
 * host. Before any of it can change a target VM, a human must build a
 * Migration / Rebuild / Change Plan from this evidence and review it.
 *
 * This module groups snapshot data into four review-friendly stages so the
 * UI can present them side by side. Each stage emits a YAML document whose
 * tasks are deliberately read-only (`echo` placeholders) — they are meant to
 * be inspected, classified, and converted into Environment Plan actions, not
 * executed against a live target.
 *
 * Stages:
 *   1. software   — observed packages
 *   2. configs    — captured configuration files
 *   3. env        — observed environment variables
 *   4. services   — observed services
 *
 * The historical export name `buildStagedPlaybooks` is preserved as a
 * deprecated alias so older callers keep working during the rename.
 */

import yaml from "yaml";
import type { StoredUserProfile } from "./runtime-store.js";

export type SnapshotEvidenceStage = "software" | "configs" | "env" | "services";
/** @deprecated Use {@link SnapshotEvidenceStage}. */
export type DeployStage = SnapshotEvidenceStage;

export interface SnapshotEvidenceStages {
  software: string;
  configs: string;
  env: string;
  services: string;
  /** Counts per stage so the UI can show how much evidence each section holds. */
  counts: Record<SnapshotEvidenceStage, number>;
}

/** @deprecated Use {@link SnapshotEvidenceStages}. */
export type StagedPlaybooks = SnapshotEvidenceStages;

interface AnyTask {
  name: string;
  module: string;
  args: Record<string, unknown>;
}

function pkgsFromComponents(profile: StoredUserProfile): string[] {
  return profile.components
    .filter((c) => c.type === "software")
    .map((c) => c.label.split(/\s+/)[0])
    .filter(Boolean);
}

function envVarsFromSnapshot(profile: StoredUserProfile): Record<string, string> {
  return profile.envSnapshot?.envVars ?? {};
}

function configFilesFromSnapshot(profile: StoredUserProfile): Array<{ path: string; content: string }> {
  return profile.envSnapshot?.configFiles ?? [];
}

function servicesFromSnapshot(profile: StoredUserProfile): string[] {
  // Rough heuristic: keep package names that are also commonly used as service
  // names. A future improvement would be to collect the real enabled service
  // list alongside the snapshot and use it directly.
  const sw = pkgsFromComponents(profile);
  const serviceLikely = ["nginx", "redis-server", "redis", "postgresql", "mysql", "docker", "ssh", "fail2ban", "caddy"];
  return sw.filter((s) => serviceLikely.includes(s));
}

function buildSoftwareTasks(profile: StoredUserProfile): AnyTask[] {
  const pkgs = pkgsFromComponents(profile);
  if (pkgs.length === 0) return [];
  return [
    {
      name: `Review ${pkgs.length} package evidence item(s) from snapshot`,
      module: "shell",
      args: {
        cmd: `echo ${JSON.stringify(`Snapshot package evidence: ${pkgs.join(", ")}. Generate an Environment Plan before installing.`)}`
      }
    }
  ];
}

function buildConfigTasks(profile: StoredUserProfile): AnyTask[] {
  const files = configFilesFromSnapshot(profile);
  return files.map((f) => ({
    name: `Review config evidence: ${f.path}`,
    module: "shell",
    args: {
      cmd: `echo ${JSON.stringify(`Snapshot config evidence for ${f.path}. Create a Config Change Proposal before applying.`)}`
    }
  }));
}

function buildEnvTasks(profile: StoredUserProfile): AnyTask[] {
  const vars = envVarsFromSnapshot(profile);
  return Object.entries(vars).map(([key, value]) => ({
    name: `Review environment variable evidence: ${key}`,
    module: "shell",
    args: {
      cmd: `echo ${JSON.stringify(`Snapshot environment evidence for ${key}=${value}. Generate an Environment Plan before applying.`)}`
    }
  }));
}

function buildServiceTasks(profile: StoredUserProfile): AnyTask[] {
  const services = servicesFromSnapshot(profile);
  return services.map((s) => ({
    name: `Review service evidence: ${s}`,
    module: "shell",
    args: {
      cmd: `echo ${JSON.stringify(`Snapshot service evidence for ${s}. Classify and generate an Environment Plan before enabling.`)}`
    }
  }));
}

function tasksToYaml(name: string, tasks: AnyTask[]): string {
  if (tasks.length === 0) {
    return yaml.stringify({
      name,
      hosts: "all",
      tasks: [
        { name: "Nothing to do for this stage", module: "shell", args: { cmd: "true" } }
      ]
    });
  }
  return yaml.stringify({ name, hosts: "all", tasks });
}

/** Build the four evidence stages that the UI can render side by side. */
export function buildSnapshotEvidenceStages(profile: StoredUserProfile): SnapshotEvidenceStages {
  const swTasks = buildSoftwareTasks(profile);
  const cfgTasks = buildConfigTasks(profile);
  const envTasks = buildEnvTasks(profile);
  const svcTasks = buildServiceTasks(profile);

  return {
    software: tasksToYaml(`${profile.name} · software evidence`, swTasks),
    configs: tasksToYaml(`${profile.name} · config evidence`, cfgTasks),
    env: tasksToYaml(`${profile.name} · env evidence`, envTasks),
    services: tasksToYaml(`${profile.name} · service evidence`, svcTasks),
    counts: {
      software: swTasks.length,
      configs: cfgTasks.length,
      env: envTasks.length,
      services: svcTasks.length
    }
  };
}

/** @deprecated Use {@link buildSnapshotEvidenceStages}. */
export const buildStagedPlaybooks = buildSnapshotEvidenceStages;
