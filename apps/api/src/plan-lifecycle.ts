import { putPlanArtifact } from "./artifact-store.js";
import { safePreview } from "./action-runs.js";
import {
  attachConflictsAndApprovalAggregate,
  type EnvironmentPlan,
  type EnvironmentPlanArtifact
} from "./environment-plan.js";
import { freezeEnvironmentPlan } from "./plan-hash.js";

/**
 * Finish a planner-produced draft before it enters the create-only Plan store.
 * Artifact metadata and generic approval gates are part of the frozen hash.
 */
export async function prepareEnvironmentPlanForCreation(
  draft: EnvironmentPlan,
  input: { configContent?: string; recipeYaml?: string } = {}
): Promise<EnvironmentPlan> {
  let plan = attachConflictsAndApprovalAggregate({ ...draft, artifacts: [] });
  const artifacts: EnvironmentPlanArtifact[] = [];

  if (input.configContent !== undefined) {
    const preview = safePreview(input.configContent, 512).text;
    const artifact = await putPlanArtifact({
      planId: plan.id,
      kind: "config",
      content: input.configContent,
      redactedPreview: preview
    });
    artifacts.push(artifact);
    plan = {
      ...plan,
      items: plan.items.map((item) => ({
        ...item,
        actions: item.actions.map((action) => action.kind === "writeConfig"
          ? {
              ...action,
              applySpec: {
                ...action.applySpec,
                path: action.applySpec?.path ?? action.path,
                requiresSudo: action.requiresSudo,
                artifactId: artifact.id
              }
            }
          : action)
      }))
    };
  }

  const recipeYaml = input.recipeYaml ?? plan.export?.yaml;
  if (recipeYaml) {
    const artifact = await putPlanArtifact({
      planId: plan.id,
      kind: "recipe",
      content: recipeYaml,
      redactedPreview: safePreview(recipeYaml, 512).text
    });
    artifacts.push(artifact);
    if (plan.type === "imported-recipe") {
      plan = {
        ...plan,
        items: plan.items.map((item) => ({
          ...item,
          actions: item.actions.map((action) => action.id === "recipe:apply"
            ? { ...action, applySpec: { ...action.applySpec, artifactId: artifact.id } }
            : action)
        }))
      };
    }
  }

  if (plan.type === "change" && !artifacts.some((artifact) => artifact.kind === "config")) {
    throw new Error("Config Change Plan requires a frozen config artifact.");
  }
  if (plan.type === "imported-recipe" && !artifacts.some((artifact) => artifact.kind === "recipe")) {
    throw new Error("Imported Recipe Plan requires a frozen recipe artifact.");
  }

  return freezeEnvironmentPlan({ ...plan, artifacts });
}
