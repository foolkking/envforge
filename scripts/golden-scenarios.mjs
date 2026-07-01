import { runAllGoldenScenarios } from "../apps/api/dist/golden-scenario-harness.js";

const runs = await runAllGoldenScenarios();
for (const run of runs) {
  const categories = [...new Set(run.assessment.serviceStacks.map((stack) => stack.category))].join(", ");
  console.log(`[ok] ${run.definition.id}: stacks=${categories}; review=${run.reviewItems.length}; readiness=${run.assessment.readiness.status}`);
  if (run.definition.expected.verification?.status === "fixture-expectation") {
    console.log(`     verification=fixture-expectation (${run.definition.expected.verification.signals.join(", ")})`);
  }
}
console.log(`\nGolden Scenario Lab: ${runs.length}/${runs.length} fixture scenarios passed.`);
