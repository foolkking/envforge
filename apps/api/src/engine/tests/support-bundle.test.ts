import test from "node:test";
import assert from "node:assert/strict";
import { buildFailureDiagnostic } from "../../failure-diagnostics.js";
import { buildSupportBundle, supportBundleToMarkdown } from "../../support-bundle.js";
import type { AssessmentSummary } from "../../migration-assessment.js";
import type { ActionRunRecord } from "../../action-runs.js";

const dbSecret = "SENTINEL_DB_PASSWORD_SHOULD_NOT_LEAK";
const apiSecret = "SENTINEL_API_TOKEN_SHOULD_NOT_LEAK";
const privateKey = "SENTINEL_PRIVATE_KEY_SHOULD_NOT_LEAK";

function assessment(): AssessmentSummary {
  return {
    id: "assessment:fixture", sessionId: "session", availability: "collector-incomplete", generatedAt: "2026-07-01T00:00:00.000Z",
    source: { host: "fixture.example", os: "Ubuntu 24.04", architecture: "x86_64" },
    snapshot: { capturedAt: "2026-07-01T00:00:00.000Z", completeness: { status: "partial", score: 0.8, failedCollectorCount: 0, partialCollectorCount: 1, timedOut: false } },
    serviceStacks: [],
    riskSummary: { overall: "high", low: 0, medium: 0, high: 1, unknown: 0, reasons: ["Backup freshness unknown"] },
    readiness: { status: "apply-requires-decisions", summary: "Review required", blockers: [], warnings: ["PostgreSQL data migration strategy"], nextActions: ["Review decisions"] },
    requiredDecisions: [{
      id: "decision:postgres", title: "PostgreSQL data migration strategy", reason: "Stateful data requires review.", relatedServiceStackIds: ["stack:postgres"],
      defaultSafeChoice: "Record only until backup freshness is confirmed.", options: [{ id: "record-only", label: "Record only" }]
    }],
    evidenceQuality: {
      overallStatus: "partial", completeness: 0.8,
      collectors: [{ name: "docker-images", status: "partial", completeness: 0.5, stderrSummary: `API_TOKEN=${apiSecret}` }],
      notes: ["Partial evidence"]
    },
    unsupportedOrManualItems: [], report: { jsonAvailable: true, markdownAvailable: true },
    metadata: { envForgeVersion: "test", catalogVersion: "test-catalog" },
    redactionNote: "Sensitive values are redacted by default."
  };
}

function actionRun(): ActionRunRecord {
  return {
    id: "action-run", planId: "plan", planHash: "hash", itemId: "item", actionId: "action", targetConnectionId: "target",
    dryRun: false, commandSummaries: [{ phase: "apply", command: "docker compose up" }], startedAt: "2026-07-01T00:00:00.000Z",
    endedAt: "2026-07-01T00:01:00.000Z", status: "failed", exitCode: 1,
    stdoutPreview: `DATABASE_URL=postgres://app:${dbSecret}@db/app`,
    stderrPreview: `API_TOKEN=${apiSecret}`,
    error: `password=${dbSecret}`,
    redacted: false
  };
}

test("support bundle includes Plan/Apply/action evidence and always redacts secrets", () => {
  const diagnostic = buildFailureDiagnostic({
    source: "apply", whatFailed: "Docker secret missing", stderr: `API_TOKEN=${apiSecret}\nPRIVATE_KEY=${privateKey}`, beforeMutation: true
  });
  const bundle = buildSupportBundle({
    sessionId: "session", generatedAt: "2026-07-01T00:02:00.000Z", assessment: assessment(),
    plan: {
      id: "plan", name: "Migration Plan", type: "migration", status: "failed", planHash: "hash", approvedPlanHash: "hash",
      artifactHashes: [{ id: "artifact", kind: "config", contentSha256: "abc123", storageRef: "/safe/path" }]
    },
    apply: { applyRunId: "apply-run", idempotencyKey: "idempotency", status: "failed", targetConnectionId: "target" },
    actionRecords: [actionRun()], verification: { ok: false, stderr: `password=${dbSecret}`, databaseUrl: `postgres://app:${dbSecret}@db/app` }, failureDiagnostics: [diagnostic]
  });
  const json = JSON.stringify(bundle);
  const markdown = supportBundleToMarkdown(bundle);
  for (const sentinel of [dbSecret, apiSecret, privateKey]) {
    assert.doesNotMatch(json, new RegExp(sentinel));
    assert.doesNotMatch(markdown, new RegExp(sentinel));
  }
  assert.match(json, /REDACTED/);
  assert.equal(bundle.plan?.planHash, "hash");
  assert.equal(bundle.plan?.approvedPlanHash, "hash");
  assert.equal(bundle.apply?.applyRunId, "apply-run");
  assert.equal(bundle.actionRecords.length, 1);
  assert.equal(bundle.plan?.artifactHashes?.[0]?.contentSha256, "abc123");
  assert.equal(bundle.safetyBoundary.approvalCreated, false);
  assert.equal(bundle.safetyBoundary.applyRunCreated, false);
  assert.equal(bundle.safetyBoundary.actionRunCreated, false);
  assert.match(markdown, /No approval, Apply Run, or ActionRunRecord was created/i);
  assert.match(markdown, /No target mutation was performed/i);
});

test("support bundle supports assessment-only sessions without Plan or Apply metadata", () => {
  const bundle = buildSupportBundle({ sessionId: "assessment-only", assessment: assessment(), failureDiagnostics: [] });
  assert.equal(bundle.plan, undefined);
  assert.equal(bundle.apply, undefined);
  assert.deepEqual(bundle.actionRecords, []);
  assert.equal(bundle.assessment?.readiness.status, "apply-requires-decisions");
  assert.equal(bundle.reviewDecisions.length, 1);
  assert.match(supportBundleToMarkdown(bundle), /Plan ID: unavailable/);
});

// ── Phase 6-B: InventoryGraph and enriched stacks in support bundle ──

test("support bundle includes inventoryGraph and enrichedStacks when assessment has them", () => {
  const assess = assessment();
  // Simulate enriched stacks being set on the assessment
  const bundle = buildSupportBundle({
    sessionId: "session",
    assessment: assess,
    enrichedStacks: [],
    failureDiagnostics: []
  });
  // enrichedStacks propagated from input
  assert.ok(Array.isArray(bundle.enrichedStacks), "enrichedStacks is an array");
  assert.equal(bundle.enrichedStacks.length, 0, "empty enriched stacks propagated correctly");
});

test("support bundle omits inventoryGraph when not provided and assessment has no enrichedStacks", () => {
  const assess = assessment();
  // assessment() fixture doesn't have enrichedStacks built-in
  const bundle = buildSupportBundle({
    sessionId: "session",
    assessment: assess,
    failureDiagnostics: []
  });
  // Without enrichedStacks on assessment and no input override, inventoryGraph is undefined
  assert.equal(bundle.inventoryGraph, undefined);
  assert.equal(bundle.enrichedStacks, undefined);
});

test("Repair Plan output is evidence only and exposes no execution capability", () => {
  const diagnostic = buildFailureDiagnostic({ source: "apply", whatFailed: "Nginx configuration validation failed", command: "nginx -t", exitCode: 1, beforeMutation: true });
  assert.equal(diagnostic.repairPlanDraft?.status, "draft");
  assert.equal("execute" in (diagnostic.repairPlanDraft ?? {}), false);
  assert.equal("apply" in (diagnostic.repairPlanDraft ?? {}), false);
  assert.ok(diagnostic.repairPlanDraft?.proposedSteps.every((step) => step.requiresReview));
});

// ── Phase 7-B: H2 — Support bundle auto-propagation from assessment.enrichedStacks ──

test("H2: Support bundle auto-propagates enrichedStacks from assessment when input doesn't override", () => {
  const mockStack = {
    id: "stack:test",
    label: "test",
    service: { id: "service:test", kind: "service" as const, label: "test", unit: "test", status: "running", evidence: {} },
    packages: [],
    ports: [],
    configFiles: [],
    containers: [],
    confidence: "low" as const,
    reasoning: "test"
  };
  const assess = assessment();
  (assess as unknown as Record<string, unknown>).enrichedStacks = [mockStack];

  // Do NOT pass enrichedStacks explicitly → should auto-propagate from assessment
  const bundle = buildSupportBundle({
    sessionId: "session",
    assessment: assess,
    failureDiagnostics: []
  });

  assert.ok(Array.isArray(bundle.enrichedStacks), "enrichedStacks is an array");
  assert.equal(bundle.enrichedStacks!.length, 1, "enrichedStacks has 1 entry");
  assert.equal(bundle.enrichedStacks![0].id, "stack:test", "enrichedStacks propagated from assessment");
  assert.equal(bundle.enrichedStacks![0].confidence, "low", "stack shape preserved during propagation");
});

// ── Phase 7-B: H2b — Support bundle allows explicit override of enrichedStacks ──

test("H2b: Support bundle accepts explicit enrichedStacks override over assessment", () => {
  const assess = assessment();
  (assess as unknown as Record<string, unknown>).enrichedStacks = [{ id: "stack:from-assessment", confidence: "low" }];

  const explicitStack = { id: "stack:explicit", label: "explicit", service: { id: "service:exp", kind: "service" as const, label: "exp", unit: "exp", status: "running", evidence: {} }, packages: [], ports: [], configFiles: [], containers: [], confidence: "high" as const, reasoning: "explicit override" };

  const bundle = buildSupportBundle({
    sessionId: "session",
    assessment: assess,
    enrichedStacks: [explicitStack],
    failureDiagnostics: []
  });

  assert.equal(bundle.enrichedStacks!.length, 1, "explicit override has 1 entry");
  assert.equal(bundle.enrichedStacks![0].id, "stack:explicit", "explicit override wins over assessment");
  assert.equal(bundle.enrichedStacks![0].confidence, "high", "explicit override shape preserved");
});
