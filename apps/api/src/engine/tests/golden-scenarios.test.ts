import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GOLDEN_SCENARIO_ROOT,
  loadGoldenScenarioDefinitions,
  runAllGoldenScenarios
} from "../../golden-scenario-harness.js";

test("golden lab: five product scenarios run through real Assessment and report builders", async () => {
  const runs = await runAllGoldenScenarios();
  assert.deepEqual(runs.map((run) => run.definition.id).sort(), [
    "assessment-only-inventory",
    "database-safe-migration",
    "docker-compose-app",
    "legacy-vps",
    "post-migration-verification"
  ]);
  for (const run of runs) {
    assert.ok(run.assertions.includes("assessment-generated"));
    assert.ok(run.assertions.includes("service-stacks"));
    assert.ok(run.assertions.includes("reports-and-redaction"));
    assert.ok(run.assertions.includes("read-only-security-boundary"));
  }
  assert.equal(runs.find((run) => run.definition.id === "assessment-only-inventory")?.planOnly, undefined);
  assert.equal(runs.find((run) => run.definition.id === "post-migration-verification")?.planOnly, undefined);
});

test("golden lab: database fixtures require safe stateful decisions rather than raw config copy", async () => {
  const runs = await runAllGoldenScenarios();
  const database = runs.find((run) => run.definition.id === "database-safe-migration");
  assert.ok(database);
  const stacks = database.assessment.serviceStacks.filter((stack) => stack.category === "database");
  assert.ok(stacks.length >= 2);
  assert.ok(stacks.every((stack) => stack.statefulness === "stateful"));
  assert.ok(stacks.every((stack) => stack.risk === "high" || stack.risk === "medium"));
  assert.ok(stacks.some((stack) => /pg_dump\/pg_restore/i.test(stack.recommendedStrategy ?? "")));
  assert.ok(stacks.every((stack) => !/raw config copy/i.test(stack.recommendedStrategy ?? "")));
  assert.ok(database.assessment.requiredDecisions.every((decision) =>
    decision.options.some((option) => option.id === "record-only")
    && decision.options.some((option) => option.id === "manual")
  ));
});

test("golden lab: Docker secret and volume evidence is reviewed and redacted", async () => {
  const runs = await runAllGoldenScenarios();
  const docker = runs.find((run) => run.definition.id === "docker-compose-app");
  assert.ok(docker);
  const stack = docker.assessment.serviceStacks.find((item) => item.category === "app-runtime");
  assert.ok(stack);
  assert.equal(stack.statefulness, "mixed");
  assert.match(stack.recommendedStrategy ?? "", /Compose\/config artifacts/i);
  assert.ok(docker.reviewItems.some((item) => /secret config/i.test(item.reason)));
  assert.doesNotMatch(docker.jsonReport, /compose-super-secret/);
  assert.doesNotMatch(docker.markdownReport, /compose-super-secret/);
});

test("golden lab: collector absence remains distinct from failed verification evidence", async () => {
  const runs = await runAllGoldenScenarios();
  const inventory = runs.find((run) => run.definition.id === "assessment-only-inventory");
  const verification = runs.find((run) => run.definition.id === "post-migration-verification");
  assert.equal(inventory?.assessment.evidenceQuality.collectors.find((collector) => collector.name === "docker-images")?.status, "ok");
  assert.equal(inventory?.assessment.serviceStacks.some((stack) => /docker/i.test(stack.name)), false);
  assert.equal(verification?.assessment.evidenceQuality.collectors.find((collector) => collector.name === "docker-health")?.status, "failed");
  assert.ok(verification?.assessment.evidenceQuality.notes.some((note) => /does not mean the component is absent/i.test(note)));
});

test("golden lab: harness is read-only by construction and fixtures document limitations", async () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = await fs.readFile(path.resolve(here, "../../golden-scenario-harness.js"), "utf8");
  for (const forbidden of ["claimPlanForApply", "executeEnvironmentPlan", "approveEnvironmentPlan", "appendActionRunRecord", "writeConfigFile"]) {
    assert.doesNotMatch(source, new RegExp(forbidden), `golden Assessment harness must not call ${forbidden}`);
  }
  const definitions = await loadGoldenScenarioDefinitions();
  for (const definition of definitions) {
    await fs.access(path.join(GOLDEN_SCENARIO_ROOT, definition.id, "README.md"));
    await fs.access(path.join(GOLDEN_SCENARIO_ROOT, definition.id, definition.source.file));
  }
  assert.ok(definitions.every((definition) => definition.limitations.length > 0));
  assert.ok(definitions.every((definition) => !definition.security.readOnlyAssessmentCreatesPlan));
  assert.ok(definitions.every((definition) => !definition.security.readOnlyAssessmentCreatesApproval));
  assert.ok(definitions.every((definition) => !definition.security.readOnlyAssessmentCreatesApplyRun));
  assert.ok(definitions.every((definition) => !definition.security.reviewDecisionApprovesPlan));
  assert.ok(definitions.every((definition) => !definition.security.reviewDecisionCreatesApplyRun));
  assert.equal(GOLDEN_SCENARIO_ROOT.endsWith(path.join("fixtures", "golden-scenarios")), true);
});
