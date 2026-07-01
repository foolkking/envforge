import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CAPABILITY_SAFETY_GATES,
  certifyCapabilityManifest,
  findSecretSafetyIssues,
  runCapabilityCertification,
  validateCapabilityDocument
} from "../../capability-certification.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");
const capabilitiesRoot = path.join(repoRoot, "capabilities");

test("capability SDK: official examples pass certification harness", async () => {
  const summary = await runCapabilityCertification(capabilitiesRoot);
  assert.equal(summary.passed, true);
  const ids = summary.results.map((result) => result.capability?.id).sort();
  assert.deepEqual(ids, ["official.nginx", "official.postgresql"]);
  for (const result of summary.results) {
    assert.equal(result.passed, true, result.capability?.id + ": " + result.issues.map((issue) => issue.message).join("; "));
    assert.equal(result.effectiveLevel, "official");
    assert.ok(result.checks.includes("approved-environment-plan-boundary"));
    assert.ok(result.checks.includes("no-direct-mutation-route"));
  }
});

test("capability SDK: schema validates official.nginx and required gates", async () => {
  const result = await certifyCapabilityManifest(path.join(capabilitiesRoot, "official", "nginx", "capability.yaml"));
  assert.equal(result.passed, true);
  assert.equal(result.capability?.id, "official.nginx");
  assert.ok(result.capability?.requiresGates.includes("config-diff-confirm"));
  assert.ok(result.capability?.requiresGates.includes("service-reload-confirm"));
  assert.ok(result.capability?.requiresGates.includes("secret-handling-confirm"));
  assert.equal(result.capability?.features.rollback, "partial");
});

test("capability SDK: schema validates official.postgresql and database gates", async () => {
  const result = await certifyCapabilityManifest(path.join(capabilitiesRoot, "official", "postgresql", "capability.yaml"));
  assert.equal(result.passed, true);
  assert.equal(result.capability?.id, "official.postgresql");
  assert.ok(result.capability?.requiresGates.includes("data-migration-strategy-confirm"));
  assert.ok(result.capability?.requiresGates.includes("backup-freshness-confirm"));
  assert.ok(result.capability?.requiresGates.includes("version-compatibility-confirm"));
  assert.equal(result.capability?.riskLevel, "high");
  assert.equal(result.capability?.features.rollback, "manual");
});

test("capability SDK: invalid status and riskLevel fail", () => {
  const issues = validateCapabilityDocument({
    ...minimalCapability(),
    status: "stable",
    riskLevel: "dangerous"
  });
  assert.ok(issues.some((issue) => issue.code === "schema.status"));
  assert.ok(issues.some((issue) => issue.code === "schema.riskLevel"));
});

test("capability SDK: write/apply capability cannot omit gates or approved Plan boundary", () => {
  const issues = validateCapabilityDocument({
    ...minimalCapability(),
    requiresGates: [],
    safety: {
      approvedPlanRequired: false,
      appliesViaManagedExecution: false,
      publicMutationApi: true,
      directMutationRoutes: [],
      environmentPlanBoundary: "Runs a command directly."
    }
  });
  assert.ok(issues.some((issue) => issue.code === "safety.write-without-gate"));
  assert.ok(issues.some((issue) => issue.code === "safety.approved-plan-boundary"));
  assert.ok(issues.some((issue) => issue.code === "safety.managed-execution"));
  assert.ok(issues.some((issue) => issue.code === "safety.public-mutation-api"));
});

test("capability SDK: database and web capabilities require domain gates", () => {
  const postgresIssues = validateCapabilityDocument({
    ...minimalCapability(),
    id: "official.postgresql",
    requiresGates: ["secret-handling-confirm"]
  });
  assert.ok(postgresIssues.some((issue) => /data-migration-strategy-confirm/.test(issue.message)));
  assert.ok(postgresIssues.some((issue) => /backup-freshness-confirm/.test(issue.message)));
  assert.ok(postgresIssues.some((issue) => /version-compatibility-confirm/.test(issue.message)));

  const nginxIssues = validateCapabilityDocument({
    ...minimalCapability(),
    id: "official.nginx",
    requiresGates: ["secret-handling-confirm"]
  });
  assert.ok(nginxIssues.some((issue) => /config-diff-confirm/.test(issue.message)));
  assert.ok(nginxIssues.some((issue) => /service-reload-confirm/.test(issue.message)));
});

test("capability SDK: rollback=full requires stronger evidence", () => {
  const issues = validateCapabilityDocument({
    ...minimalCapability(),
    features: { discover: true, plan: true, apply: true, verify: true, rollback: "full" },
    certification: {
      evidence: {
        discoverClassifyTests: true,
        redactionTests: true,
        goldenScenario: true,
        planOnlyTests: true,
        failureDiagnosticFixture: true,
        officialDocs: true,
        certificationHarness: true,
        p0SafetyGates: true
      }
    }
  });
  assert.ok(issues.some((issue) => issue.code === "rollback.full-without-evidence"));
});

test("capability SDK: secret sentinels and raw assignments are rejected", () => {
  const issues = findSecretSafetyIssues(
    [
      "DATABASE_URL=postgres://user:raw-password@example/db",
      "api_token=SENTINEL_API_TOKEN_SHOULD_NOT_LEAK",
      "PRIVATE_KEY=SENTINEL_PRIVATE_KEY_SHOULD_NOT_LEAK"
    ].join("\n"),
    "fixture"
  );
  assert.ok(issues.some((issue) => issue.code === "redaction.sentinel"));
  assert.ok(issues.some((issue) => issue.code === "redaction.raw-secret"));
});

test("capability SDK: all declared safety gates are part of the supported baseline", () => {
  assert.deepEqual([...CAPABILITY_SAFETY_GATES].sort(), [
    "backup-freshness-confirm",
    "config-diff-confirm",
    "data-migration-strategy-confirm",
    "manual-follow-up-confirm",
    "secret-handling-confirm",
    "service-reload-confirm",
    "version-compatibility-confirm"
  ]);
});

function minimalCapability(): Record<string, unknown> {
  return {
    id: "official.example",
    name: "Example",
    publisher: "envforge",
    version: "0.1.0",
    status: "official",
    riskLevel: "medium",
    supports: { os: ["ubuntu-22.04"], architectures: ["x86_64"] },
    features: { discover: true, plan: true, apply: true, verify: true, rollback: "partial" },
    permissions: {
      read: ["/etc/example"],
      write: ["/etc/example"],
      commands: ["systemctl reload example"]
    },
    requiresGates: ["config-diff-confirm", "service-reload-confirm"],
    testMatrix: ["ubuntu-22.04"],
    fixtures: [{ id: "example", path: "fixtures/example.json", type: "assessment" }],
    certification: {
      evidence: {
        discoverClassifyTests: true,
        redactionTests: true,
        goldenScenario: true,
        planOnlyTests: true,
        failureDiagnosticFixture: true,
        officialDocs: true,
        certificationHarness: true,
        p0SafetyGates: true
      }
    },
    redaction: { sensitiveKeys: [], assertions: ["no raw secret values"] },
    safety: {
      approvedPlanRequired: true,
      appliesViaManagedExecution: true,
      publicMutationApi: false,
      directMutationRoutes: [],
      environmentPlanBoundary: "Target-changing applier steps execute only as actions in an approved immutable Environment Plan through Managed Execution."
    },
    docs: { readme: "README.md" }
  };
}
