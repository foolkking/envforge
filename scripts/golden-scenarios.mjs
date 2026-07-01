import { runAllGoldenScenarios } from "../apps/api/dist/golden-scenario-harness.js";
import { runAllGoldenFailureScenarios } from "../apps/api/dist/golden-failure-harness.js";

const runs = await runAllGoldenScenarios();
for (const run of runs) {
  const categories = [...new Set(run.assessment.serviceStacks.map((stack) => stack.category))].join(", ");
  console.log(`[ok] ${run.definition.id}: stacks=${categories}; review=${run.reviewItems.length}; readiness=${run.assessment.readiness.status}`);
  if (run.definition.expected.verification?.status === "fixture-expectation") {
    console.log(`     verification=fixture-expectation (${run.definition.expected.verification.signals.join(", ")})`);
  }
}
const failureRuns = await runAllGoldenFailureScenarios();
for (const run of failureRuns) {
  console.log(`[ok] failure/${run.definition.id}: category=${run.diagnostic.category}; repair=${run.diagnostic.repairPlanDraft?.status ?? "not-available"}`);
}
console.log(`\nGolden Scenario Lab: ${runs.length}/${runs.length} product scenarios and ${failureRuns.length}/${failureRuns.length} failure scenarios passed.`);
