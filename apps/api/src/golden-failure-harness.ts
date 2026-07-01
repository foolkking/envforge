import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildFailureDiagnostic, type FailureCategory, type FailureEvidenceInput, type FailureRecommendedActionKind } from "./failure-diagnostics.js";
import { buildSupportBundle, supportBundleToMarkdown, type SupportBundle } from "./support-bundle.js";

export const GOLDEN_FAILURE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/golden-scenarios/failures"
);

export interface GoldenFailureDefinition {
  id: string;
  name: string;
  goal: string;
  evidenceFile: string;
  expectedDiagnosticFile: string;
  expectedSupportBundleFile: string;
  security: {
    createsPlan: false;
    createsApproval: false;
    createsApplyRun: false;
    createsActionRun: false;
    executesRepair: false;
    executesRollback: false;
    secretsRedacted: true;
  };
  limitations: string[];
}

interface ExpectedDiagnostic {
  category: FailureCategory;
  recommendedActions: FailureRecommendedActionKind[];
  retryAllowed: boolean;
  skipAllowed: boolean;
  rollbackRequired: boolean;
  repairPlanStatus?: "draft" | "not-available";
  includes: string[];
}

interface ExpectedSupportBundle {
  format: Array<"json" | "markdown">;
  includes: string[];
  forbiddenValues: string[];
}

export interface GoldenFailureRun {
  definition: GoldenFailureDefinition;
  evidence: FailureEvidenceInput;
  diagnostic: ReturnType<typeof buildFailureDiagnostic>;
  supportBundle: SupportBundle;
  jsonBundle: string;
  markdownBundle: string;
  assertions: string[];
}

export async function loadGoldenFailureDefinitions(root = GOLDEN_FAILURE_ROOT): Promise<GoldenFailureDefinition[]> {
  const directories = (await fs.readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  return Promise.all(directories.map(async (directory) =>
    JSON.parse(await fs.readFile(path.join(root, directory, "scenario.json"), "utf8")) as GoldenFailureDefinition
  ));
}

export async function runGoldenFailureScenario(definition: GoldenFailureDefinition, root = GOLDEN_FAILURE_ROOT): Promise<GoldenFailureRun> {
  const directory = path.join(root, definition.id);
  const evidence = JSON.parse(await fs.readFile(path.join(directory, definition.evidenceFile), "utf8")) as FailureEvidenceInput;
  const expectedDiagnostic = JSON.parse(await fs.readFile(path.join(directory, definition.expectedDiagnosticFile), "utf8")) as ExpectedDiagnostic;
  const expectedSupport = JSON.parse(await fs.readFile(path.join(directory, definition.expectedSupportBundleFile), "utf8")) as ExpectedSupportBundle;
  const diagnostic = buildFailureDiagnostic(evidence);
  const supportBundle = buildSupportBundle({
    sessionId: `golden-failure-${definition.id}`,
    goldenScenarioId: definition.id,
    generatedAt: "2026-07-01T00:00:00.000Z",
    failureDiagnostics: [diagnostic],
    envForgeVersion: "golden-fixture",
    catalogVersion: "repository-catalog"
  });
  const run: GoldenFailureRun = {
    definition,
    evidence,
    diagnostic,
    supportBundle,
    jsonBundle: JSON.stringify(supportBundle, null, 2),
    markdownBundle: supportBundleToMarkdown(supportBundle),
    assertions: []
  };
  assertGoldenFailure(run, expectedDiagnostic, expectedSupport);
  return run;
}

export async function runAllGoldenFailureScenarios(root = GOLDEN_FAILURE_ROOT): Promise<GoldenFailureRun[]> {
  const definitions = await loadGoldenFailureDefinitions(root);
  const runs: GoldenFailureRun[] = [];
  for (const definition of definitions) runs.push(await runGoldenFailureScenario(definition, root));
  return runs;
}

function assertGoldenFailure(run: GoldenFailureRun, expected: ExpectedDiagnostic, support: ExpectedSupportBundle): void {
  const { definition, diagnostic, supportBundle, jsonBundle, markdownBundle } = run;
  invariant(diagnostic.category === expected.category, definition.id, `expected ${expected.category}, got ${diagnostic.category}`);
  invariant(diagnostic.retry.allowed === expected.retryAllowed, definition.id, "retry boundary mismatch");
  invariant(diagnostic.skip.allowed === expected.skipAllowed, definition.id, "skip boundary mismatch");
  invariant(diagnostic.rollback.required === expected.rollbackRequired, definition.id, "rollback boundary mismatch");
  if (expected.repairPlanStatus) invariant(diagnostic.repairPlanDraft?.status === expected.repairPlanStatus, definition.id, "repair draft status mismatch");
  for (const action of expected.recommendedActions) invariant(diagnostic.recommendedActions.some((item) => item.kind === action), definition.id, `missing action ${action}`);
  for (const text of expected.includes) invariant(includes(JSON.stringify(diagnostic), text), definition.id, `diagnostic text missing: ${text}`);
  run.assertions.push("diagnostic-taxonomy", "recommended-actions", "recovery-boundaries");

  invariant(support.format.includes("json") && jsonBundle.length > 0, definition.id, "JSON Support Bundle missing");
  invariant(support.format.includes("markdown") && markdownBundle.length > 0, definition.id, "Markdown Support Bundle missing");
  for (const text of support.includes) invariant(includes(`${jsonBundle}\n${markdownBundle}`, text), definition.id, `Support Bundle text missing: ${text}`);
  for (const forbidden of support.forbiddenValues) invariant(!jsonBundle.includes(forbidden) && !markdownBundle.includes(forbidden), definition.id, `secret leaked: ${forbidden}`);
  invariant(supportBundle.redaction.applied, definition.id, "redaction not marked as applied");
  run.assertions.push("support-bundle-json-markdown", "redaction");

  invariant(!definition.security.createsPlan, definition.id, "failure fixture must not create Plan");
  invariant(!definition.security.createsApproval, definition.id, "failure fixture must not create Approval");
  invariant(!definition.security.createsApplyRun, definition.id, "failure fixture must not create Apply Run");
  invariant(!definition.security.createsActionRun, definition.id, "failure fixture must not create ActionRunRecord");
  invariant(!definition.security.executesRepair, definition.id, "failure fixture must not execute repair");
  invariant(!definition.security.executesRollback, definition.id, "failure fixture must not execute rollback");
  invariant(definition.security.secretsRedacted, definition.id, "failure fixture must require redaction");
  invariant(supportBundle.safetyBoundary.readOnlyExport, definition.id, "Support Bundle export must be read-only");
  invariant(!supportBundle.safetyBoundary.approvalCreated && !supportBundle.safetyBoundary.applyRunCreated && !supportBundle.safetyBoundary.actionRunCreated, definition.id, "Support Bundle must not create execution state");
  invariant(definition.limitations.length > 0, definition.id, "limitations must be documented");
  run.assertions.push("read-only-security-boundary", "limitations-documented");
}

function invariant(condition: unknown, scenarioId: string, message: string): asserts condition {
  if (!condition) throw new Error(`[${scenarioId}] ${message}`);
}

function includes(value: string, expected: string): boolean {
  return value.toLocaleLowerCase().includes(expected.toLocaleLowerCase());
}
