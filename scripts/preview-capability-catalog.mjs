import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runCapabilityCatalogPreview,
  writeCapabilityCatalogPreviewArtifacts
} from "../apps/api/dist/capability-catalog-preview.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const outputDir = path.join(repoRoot, "generated", "catalog-preview");

const summary = await runCapabilityCatalogPreview();
if (summary.previews.length === 0) {
  console.error("No capability catalog previews were generated.");
  process.exit(1);
}

const written = await writeCapabilityCatalogPreviewArtifacts(outputDir, summary.previews);

for (const preview of written) {
  const status = preview.targetCatalog.operation;
  console.log(
    [
      "[" + status + "]",
      preview.source.capabilityId,
      "level=" + preview.source.certificationLevel,
      "catalog=" + preview.targetCatalog.generatedCatalogId,
      "diff=" + preview.diff.length,
      "blockers=" + preview.blockers.length,
      "warnings=" + preview.warnings.length,
      "artifact=" + (preview.generatedArtifact?.path ?? "none"),
      "enabledByDefault=false"
    ].join(" ")
  );
  for (const blocker of preview.blockers) console.log("  blocker: " + blocker);
  for (const warning of preview.warnings) console.log("  warning: " + warning);
}

if (written.some((preview) => preview.targetCatalog.operation === "blocked")) {
  console.error("\nCapability catalog preview blocked. No runtime catalog was modified.");
  process.exit(1);
}

console.log(
  "\nCapability catalog preview generated: " +
    written.length +
    "/" +
    written.length +
    " review artifacts. Runtime catalog unchanged; configs/catalog unchanged; enabledByDefault=false."
);
