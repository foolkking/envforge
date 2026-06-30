import fs from "node:fs/promises";
import path from "node:path";
import type { EnvironmentPlanArtifact } from "./environment-plan.js";
import { resolveFromRoot } from "./repo.js";
import { sha256Hex } from "./plan-hash.js";

export class ArtifactIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtifactIntegrityError";
  }
}

function artifactRoot(): string {
  if (process.env.ENVFORGE_ARTIFACT_DIR) return process.env.ENVFORGE_ARTIFACT_DIR;
  if (process.env.FOOL_DATA_DIR) return path.resolve(process.env.FOOL_DATA_DIR, "plan-artifacts");
  return resolveFromRoot("data", "plan-artifacts");
}

function planStorageKey(planId: string): string {
  return `plan-${sha256Hex(planId).slice(0, 24)}`;
}

function resolveStorageRef(storageRef: string): string {
  const root = path.resolve(artifactRoot());
  const resolved = path.resolve(root, storageRef);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new ArtifactIntegrityError("Artifact storage reference escapes the artifact store.");
  }
  return resolved;
}

export async function putPlanArtifact(input: {
  planId: string;
  kind: EnvironmentPlanArtifact["kind"];
  content: string | Buffer;
  canonicalJsonSha256?: string;
  redactedPreview?: string;
}): Promise<EnvironmentPlanArtifact> {
  const bytes = Buffer.isBuffer(input.content) ? input.content : Buffer.from(input.content, "utf8");
  const contentSha256 = sha256Hex(bytes);
  const id = `artifact-${input.kind}-${contentSha256.slice(0, 24)}`;
  const storageRef = `${planStorageKey(input.planId)}/${id}.bin`;
  const target = resolveStorageRef(storageRef);
  await fs.mkdir(path.dirname(target), { recursive: true });
  try {
    await fs.writeFile(target, bytes, { flag: "wx", mode: 0o600 });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") throw error;
    const existing = await fs.readFile(target);
    if (sha256Hex(existing) !== contentSha256) {
      throw new ArtifactIntegrityError("Existing content-addressed artifact has an unexpected hash.");
    }
  }
  return {
    id,
    kind: input.kind,
    contentSha256,
    canonicalJsonSha256: input.canonicalJsonSha256,
    storageRef,
    createdAt: new Date().toISOString(),
    redactedPreview: input.redactedPreview
  };
}

export async function getPlanArtifact(planId: string, artifact: EnvironmentPlanArtifact): Promise<Buffer> {
  const expectedPrefix = `${planStorageKey(planId)}/`;
  if (!artifact.storageRef.startsWith(expectedPrefix)) {
    throw new ArtifactIntegrityError("Artifact is not bound to this Environment Plan.");
  }
  const content = await fs.readFile(resolveStorageRef(artifact.storageRef));
  const actual = sha256Hex(content);
  if (actual !== artifact.contentSha256) {
    throw new ArtifactIntegrityError(`Artifact hash mismatch for ${artifact.id}.`);
  }
  return content;
}

export async function verifyPlanArtifact(planId: string, artifact: EnvironmentPlanArtifact): Promise<boolean> {
  try {
    await getPlanArtifact(planId, artifact);
    return true;
  } catch {
    return false;
  }
}
