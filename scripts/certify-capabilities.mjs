import { runCapabilityCertification } from "../apps/api/dist/capability-certification.js";

const summary = await runCapabilityCertification();
if (summary.results.length === 0) {
  console.error("No capability.yaml manifests found.");
  process.exit(1);
}

for (const result of summary.results) {
  const id = result.capability?.id ?? result.filePath;
  const status = result.passed ? "ok" : "failed";
  console.log(
    "[" +
      status +
      "] " +
      id +
      ": claimed=" +
      result.claimedLevel +
      "; effective=" +
      result.effectiveLevel +
      "; checks=" +
      result.checks.join(", ")
  );
  for (const issue of result.issues) {
    const location = issue.path ? " " + issue.path : "";
    console.log("  - " + issue.severity + ":" + issue.code + location + ": " + issue.message);
  }
}

if (!summary.passed) {
  console.error(
    "\nCapability certification failed: " +
      summary.results.filter((result) => !result.passed).length +
      "/" +
      summary.results.length +
      " failed."
  );
  process.exit(1);
}

console.log("\nCapability certification passed: " + summary.results.length + "/" + summary.results.length + " capability packages.");
