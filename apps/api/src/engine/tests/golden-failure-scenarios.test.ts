import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GOLDEN_FAILURE_ROOT,
  loadGoldenFailureDefinitions,
  runAllGoldenFailureScenarios
} from "../../golden-failure-harness.js";

test("golden failure lab covers five diagnostic and Support Bundle scenarios", async () => {
  const runs = await runAllGoldenFailureScenarios();
  assert.deepEqual(runs.map((run) => run.definition.id).sort(), [
    "collector-partial",
    "docker-secret-missing",
    "nginx-config-validation",
    "postgres-backup-unknown",
    "verification-service-unhealthy"
  ]);
  for (const run of runs) {
    assert.ok(run.assertions.includes("diagnostic-taxonomy"));
    assert.ok(run.assertions.includes("support-bundle-json-markdown"));
    assert.ok(run.assertions.includes("redaction"));
    assert.ok(run.assertions.includes("read-only-security-boundary"));
  }
});

test("golden failure lab keeps repair, rollback, Plan approval, and Apply out of the harness", async () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = await fs.readFile(path.resolve(here, "../../golden-failure-harness.js"), "utf8");
  for (const forbidden of ["claimPlanForApply", "executeEnvironmentPlan", "approveEnvironmentPlan", "appendActionRunRecord", "writeConfigFile", "rollbackPlanAndPersist"]) {
    assert.doesNotMatch(source, new RegExp(forbidden), `golden failure harness must not call ${forbidden}`);
  }
  const definitions = await loadGoldenFailureDefinitions();
  for (const definition of definitions) {
    const directory = path.join(GOLDEN_FAILURE_ROOT, definition.id);
    await fs.access(path.join(directory, "README.md"));
    await fs.access(path.join(directory, definition.evidenceFile));
    await fs.access(path.join(directory, definition.expectedDiagnosticFile));
    await fs.access(path.join(directory, definition.expectedSupportBundleFile));
    assert.ok(definition.limitations.length > 0);
    assert.equal(definition.security.createsPlan, false);
    assert.equal(definition.security.createsApproval, false);
    assert.equal(definition.security.createsApplyRun, false);
    assert.equal(definition.security.createsActionRun, false);
    assert.equal(definition.security.executesRepair, false);
    assert.equal(definition.security.executesRollback, false);
  }
});

test("golden failure lab covers required failure taxonomy and recovery boundaries", async () => {
  const runs = await runAllGoldenFailureScenarios();
  const byId = new Map(runs.map((run) => [run.definition.id, run]));
  assert.equal(byId.get("nginx-config-validation")?.diagnostic.category, "config-invalid");
  assert.equal(byId.get("nginx-config-validation")?.diagnostic.rollback.required, false);
  assert.equal(byId.get("docker-secret-missing")?.diagnostic.category, "secret-missing");
  assert.equal(byId.get("postgres-backup-unknown")?.diagnostic.category, "data-risk");
  assert.equal(byId.get("collector-partial")?.diagnostic.category, "collector-failed");
  assert.equal(byId.get("verification-service-unhealthy")?.diagnostic.category, "verification-failed");
  assert.ok(byId.get("nginx-config-validation")?.diagnostic.repairPlanDraft?.proposedSteps.every((step) => step.requiresReview));
  assert.match(byId.get("verification-service-unhealthy")?.diagnostic.rollback.boundary ?? "", /does not assume or execute rollback/i);
});
