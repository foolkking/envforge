import { canonicalHash } from "../platform/foundation.js";
import type { BlueprintContent } from "./model.js";

export interface LegacyServiceStackInput { id: string; name: string; service?: { name?: string; unit?: string }; packages?: Array<{ name?: string }>; configs?: Array<{ path?: string; containsSecret?: boolean }>; ports?: number[] }
export interface LegacyImportProposal { sourceId: string; sourceHash: string; state: "review-required"; unresolved: string[]; blueprintDraft: BlueprintContent }

export function proposeLegacyServiceStackImport(input: LegacyServiceStackInput): LegacyImportProposal {
  const safeConfigs = (input.configs ?? []).map((config, index) => ({ key: `legacy-config-${index + 1}`, classification: config.containsSecret ? "secret-placeholder" as const : "portable" as const, sanitizedArtifactRef: config.containsSecret ? undefined : config.path ? `legacy-sanitized:${canonicalHash(config.path)}` : undefined }));
  const unresolved = ["deployment-exact-version", "runtime-user-group", "ephemeral-state-review", ...(input.configs ?? []).filter((item) => item.containsSecret).map(() => "secret-provider-binding")];
  return {
    sourceId: input.id,
    sourceHash: canonicalHash(input),
    state: "review-required",
    unresolved,
    blueprintDraft: {
      identity: { name: input.name, kind: "legacy-service-stack", provenance: { sourceType: "ServiceStack", sourceId: input.id }, scope: {} },
      components: [{ key: "legacy-service", kind: input.service?.name ?? "service" }],
      runtime: { executionModel: "systemd", entrypoint: input.service?.unit ?? "unresolved", workingDirectory: "unresolved", runUser: "unresolved", runGroup: "unresolved", environmentRefs: [], environmentFileRefs: [], enabled: false, desiredState: "inactive", restartPolicy: "unresolved", restartDelaySeconds: 0, after: [], before: [], wants: [], requires: [], startupTimeoutSeconds: 0, shutdownTimeoutSeconds: 0, resourceLimits: {}, securityContext: {}, socketActivation: false, timerActivation: false, healthCheck: { status: "unresolved" }, allowedWritePaths: [], stateDirectories: [], runtimeDirectories: [] },
      deployment: { sourceType: "package", reference: input.packages?.map((item) => item.name).filter(Boolean).join(",") || "unresolved", exactVersion: "unresolved", checksum: canonicalHash(input.packages ?? []), provenance: { sourceType: "legacy-observation" }, fallbackStrategy: "manual-review" },
      config: safeConfigs, datasets: [], secretRequirements: safeConfigs.filter((item) => item.classification === "secret-placeholder").map((_, index) => ({ id: `legacy-secret-${index + 1}`, purpose: "legacy config placeholder", required: true })),
      endpoints: (input.ports ?? []).map((port) => ({ kind: "tcp", port })), systemIdentities: [], scheduledTasks: [], dependencies: [], externalDependencies: [],
      ephemeralState: { httpRequests: "manual", databaseTransactions: "manual", fileLocks: "manual", activeWriters: "manual", inMemorySessions: "discard-with-warning", activeJobs: "manual", leaderElection: "manual", scheduledExecutions: "manual", unpersistedMessages: "manual" },
      compatibility: { status: "unknown" }, verification: [], operationalRequirements: {}, migrationRequirements: {}, captureRequirements: {}, knownLimitations: unresolved
    }
  };
}

