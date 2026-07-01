import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFailureDiagnostic,
  collectSessionFailureEvidence,
  type FailureEvidenceInput
} from "../../failure-diagnostics.js";

const sentinelPassword = "SENTINEL_DB_PASSWORD_SHOULD_NOT_LEAK";
const sentinelToken = "SENTINEL_API_TOKEN_SHOULD_NOT_LEAK";

test("failure diagnostics: Nginx validation explains impact, safe boundary, and draft-only repair", () => {
  const diagnostic = buildFailureDiagnostic({
    id: "nginx-validation",
    source: "apply",
    whatFailed: "Nginx configuration validation failed.",
    whereFailed: "Validate generated Nginx configuration before reload.",
    attempted: "nginx -t",
    command: "nginx -t",
    stderr: "nginx: [emerg] cannot load certificate /etc/ssl/private/example.key",
    exitCode: 1,
    beforeMutation: true
  });
  assert.equal(diagnostic.category, "config-invalid");
  assert.match(diagnostic.impact, /was not reloaded/i);
  assert.equal(diagnostic.rollback.required, false);
  assert.match(diagnostic.rollback.boundary, /before a target mutation|before Nginx reload/i);
  assert.equal(diagnostic.repairPlanDraft?.status, "draft");
  assert.ok(diagnostic.repairPlanDraft?.proposedSteps.every((step) => step.requiresReview));
  assert.ok(diagnostic.repairPlanDraft?.proposedSteps.filter((step) => step.wouldRequireApprovedPlan).length);
  assert.match(diagnostic.repairPlanDraft?.safetyNotes.join(" ") ?? "", /must be reviewed.*approved Environment Plan/i);
  assert.ok(diagnostic.recommendedActions.some((action) => action.kind === "view-diff"));
  assert.ok(diagnostic.recommendedActions.some((action) => action.kind === "generate-repair-plan-draft" && action.available));
  assert.ok(diagnostic.recommendedActions.some((action) => action.kind === "mark-manual"));
  assert.ok(diagnostic.recommendedActions.some((action) => action.kind === "retry" && !action.available));
});

test("failure diagnostics: taxonomy covers secrets, data risk, permission, artifacts, and verification", () => {
  const fixtures: Array<[FailureEvidenceInput, string]> = [
    [{ source: "review", whatFailed: "Docker Compose secret missing from .env", stderr: `API_TOKEN=${sentinelToken}`, beforeMutation: true }, "secret-missing"],
    [{ source: "review", whatFailed: "PostgreSQL backup freshness unknown", beforeMutation: true }, "data-risk"],
    [{ source: "assessment", whatFailed: "Permission denied reading protected path", beforeMutation: true }, "permission-denied"],
    [{ source: "apply", whatFailed: "Artifact SHA-256 mismatch; artifact tampered" }, "missing-artifact"],
    [{ source: "verify", whatFailed: "Service nginx is unhealthy", command: "systemctl is-active nginx", exitCode: 3 }, "verification-failed"]
  ];
  for (const [input, expected] of fixtures) assert.equal(buildFailureDiagnostic(input).category, expected);
  const secret = buildFailureDiagnostic(fixtures[0]![0]);
  assert.doesNotMatch(JSON.stringify(secret), new RegExp(sentinelToken));
  assert.match(JSON.stringify(secret), /REDACTED/);
});

test("failure diagnostics: collector partial is evidence failure, never component absence", () => {
  const evidence = collectSessionFailureEvidence({
    snapshot: {
      agentId: "fixture",
      collectedAt: "2026-07-01T00:00:00.000Z",
      collection: { status: "partial", completeness: 0.5, commands: [], errors: [], timedOut: true },
      collectors: {
        "docker-images": {
          id: "docker-images", status: "partial", completeness: 0.2,
          commands: [{ command: "docker images", exitCode: 124, timedOut: true }],
          stderr: `password=${sentinelPassword}`, errors: ["collector timed out"],
          collectedAt: "2026-07-01T00:00:00.000Z", data: []
        }
      },
      system: {
        hostname: "fixture", platform: "linux", arch: "x86_64", release: "6", uptime: 1,
        cpu: { model: "fixture", cores: 1, speedMhz: 1 },
        memory: { totalBytes: 1, freeBytes: 1, usedBytes: 0, totalGb: "0", freeGb: "0" }
      },
      software: [], configChecklist: [],
      counts: { apt: 0, rpm: 0, snap: 0, flatpak: 0, npm: 0, pip: 0, gem: 0, cargo: 0, localBin: 0, opt: 0, userBin: 0, nvm: 0, pyenv: 0, docker: 0, enabledServices: 0, runningServices: 0, total: 0 }
    }
  });
  assert.equal(evidence.length, 1);
  const diagnostic = buildFailureDiagnostic(evidence[0]!);
  assert.equal(diagnostic.category, "collector-failed");
  assert.match(diagnostic.impact, /cannot be treated.*absent/i);
  assert.equal(diagnostic.retry.allowed, true);
  assert.doesNotMatch(JSON.stringify(diagnostic), new RegExp(sentinelPassword));
});

test("failure diagnostics: failed verification run maps service evidence without creating execution", () => {
  const evidence = collectSessionFailureEvidence({
    runs: [{
      id: "verify-run", userId: "user", sessionId: "session", connectionId: "source", targetConnectionId: "target",
      kind: "verify", status: "failed", createdAt: "2026-07-01T00:00:00.000Z",
      result: {
        checks: [{ itemName: "nginx", label: "Verify service is active", command: "systemctl is-active nginx", status: "failed", stdout: "inactive", stderr: "", exitCode: 3 }]
      }
    }]
  });
  assert.equal(evidence.length, 1);
  const diagnostic = buildFailureDiagnostic(evidence[0]!);
  assert.equal(diagnostic.category, "verification-failed");
  assert.match(diagnostic.rollback.boundary, /does not assume or execute rollback/i);
});
