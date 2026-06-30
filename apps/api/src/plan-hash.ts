import { createHash } from "node:crypto";
import type { EnvironmentPlan, EnvironmentPlanArtifact } from "./environment-plan.js";

/** Runtime/review fields are deliberately absent from this immutable spec. */
export interface EnvironmentPlanHashSpec {
  schemaVersion: 1;
  id: string;
  type: EnvironmentPlan["type"];
  name: string;
  sourceHost?: string;
  targetConnectionId?: string;
  generatedAt: string;
  summary: EnvironmentPlan["summary"];
  review: EnvironmentPlan["review"];
  items: EnvironmentPlan["items"];
  export?: EnvironmentPlan["export"];
  artifacts: Array<Pick<EnvironmentPlanArtifact, "id" | "kind" | "contentSha256" | "canonicalJsonSha256" | "storageRef">>;
}

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => canonicalizeValue(entry));
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (source[key] !== undefined) result[key] = canonicalizeValue(source[key]);
    }
    return result;
  }
  return value;
}

/** Stable JSON encoding with recursively sorted object keys. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalizeValue(value));
}

export function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function environmentPlanHashSpec(plan: EnvironmentPlan): EnvironmentPlanHashSpec {
  return {
    schemaVersion: 1,
    id: plan.id,
    type: plan.type,
    name: plan.name,
    sourceHost: plan.sourceHost,
    targetConnectionId: plan.targetConnectionId,
    generatedAt: plan.generatedAt,
    summary: plan.summary,
    review: plan.review,
    items: plan.items,
    export: plan.export,
    artifacts: (plan.artifacts ?? []).map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind,
      contentSha256: artifact.contentSha256,
      canonicalJsonSha256: artifact.canonicalJsonSha256,
      storageRef: artifact.storageRef
    }))
  };
}

export function computeEnvironmentPlanHash(plan: EnvironmentPlan): string {
  return sha256Hex(canonicalJson(environmentPlanHashSpec(plan)));
}

export function freezeEnvironmentPlan(plan: EnvironmentPlan): EnvironmentPlan {
  const frozen: EnvironmentPlan = {
    ...plan,
    immutable: true,
    artifacts: [...(plan.artifacts ?? [])]
  };
  return { ...frozen, planHash: computeEnvironmentPlanHash(frozen) };
}

export function verifyEnvironmentPlanHash(plan: EnvironmentPlan): boolean {
  return Boolean(plan.immutable && plan.planHash && plan.planHash === computeEnvironmentPlanHash(plan));
}
