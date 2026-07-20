import { canonicalHash } from "../platform/foundation.js";
import { compilePlan, type CompilerInput } from "./compiler.js";

export const APPROVED_BUILD_FIXTURE_ID = "phase1-approved-build-v1";

export const APPROVED_BUILD_FIXTURE_INPUT: CompilerInput = {
  projectId: "018f0000-0000-7000-8000-000000000001",
  mode: "build",
  blueprints: [{
    id: "018f0000-0000-7000-8000-000000000002",
    workloadId: "018f0000-0000-7000-8000-000000000003",
    hash: "1".repeat(64),
    content: {
      identity: { name: "Golden Web Application", kind: "web-app", provenance: { source: "phase1-fixture" }, scope: {} },
      components: [{ key: "app", kind: "service" }],
      runtime: {
        executionModel: "systemd", entrypoint: "artifact-entrypoint-ref", workingDirectory: "/srv/app", runUser: "app", runGroup: "app",
        environmentRefs: [], environmentFileRefs: ["secret-requirement:app-env"], enabled: true, desiredState: "active",
        restartPolicy: "on-failure", restartDelaySeconds: 5, after: ["network-online.target"], before: [], wants: ["network-online.target"], requires: [],
        startupTimeoutSeconds: 60, shutdownTimeoutSeconds: 30, resourceLimits: {}, securityContext: { noNewPrivileges: true },
        socketActivation: false, timerActivation: false, healthCheck: { kind: "http", path: "/health" },
        allowedWritePaths: ["/srv/app/uploads"], stateDirectories: ["app"], runtimeDirectories: ["app"]
      },
      deployment: {
        sourceType: "git", reference: "https://example.test/envforge-golden-web.git", exactVersion: "0123456789abcdef",
        checksum: "2".repeat(64), lockfile: "package-lock.json", provenance: { repository: "example" }, fallbackStrategy: "blocked"
      },
      config: [{ key: "app-config", classification: "portable", sanitizedArtifactRef: "artifact:config", validationCommandRef: "capability:validate-config", owner: "app", mode: "0640" }],
      datasets: [],
      secretRequirements: [{ id: "app-env", purpose: "application environment", providerBindingRef: "provider-ref:app-env", required: true }],
      endpoints: [{ kind: "http", port: 8080 }], systemIdentities: [{ user: "app", group: "app" }], scheduledTasks: [], dependencies: [], externalDependencies: [],
      ephemeralState: {
        httpRequests: "drain", databaseTransactions: "quiesce", fileLocks: "restart", activeWriters: "quiesce",
        inMemorySessions: "discard-with-warning", activeJobs: "requeue", leaderElection: "restart",
        scheduledExecutions: "requeue", unpersistedMessages: "requeue"
      },
      compatibility: { architectures: ["x64"] }, verification: [{ kind: "http", path: "/health" }],
      operationalRequirements: {}, migrationRequirements: {}, captureRequirements: {}, knownLimitations: []
    }
  }],
  decision: { id: "018f0000-0000-7000-8000-000000000004", hash: "3".repeat(64), content: {} },
  targetSnapshot: { id: "018f0000-0000-7000-8000-000000000005", hash: "4".repeat(64) },
  capability: { id: "envforge.build.golden-web", hash: "5".repeat(64), version: "1.0.0", certifiedModes: ["build"] },
  policy: { id: "envforge.policy.phase1", hash: "6".repeat(64), version: "1.0.0" }
};

const compiled = compilePlan(APPROVED_BUILD_FIXTURE_INPUT);
if (compiled.outcome === "blocked") throw new Error(`Approved Build fixture is blocked: ${compiled.blockers.join(",")}`);

export const APPROVED_BUILD_FIXTURE = {
  fixtureId: APPROVED_BUILD_FIXTURE_ID,
  status: "approved" as const,
  planHash: compiled.hash,
  approvalHash: canonicalHash({ fixtureId: APPROVED_BUILD_FIXTURE_ID, planHash: compiled.hash, status: "approved", approverRole: "fixture-approver" }),
  canonicalPlan: compiled.plan
};
