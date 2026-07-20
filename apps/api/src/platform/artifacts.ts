import fs from "node:fs/promises";
import path from "node:path";
import { canonicalHash, sha256, uuidV7 } from "./foundation.js";
import { PlatformDatabase } from "./postgres.js";

export interface ArtifactHead { key: string; bytes: number; sha256: string }
export interface ArtifactPutResult extends ArtifactHead { provider: string }
export interface ArtifactProvider {
  readonly id: string;
  put(workspaceId: string, content: Buffer): Promise<ArtifactPutResult>;
  head(workspaceId: string, key: string): Promise<ArtifactHead | undefined>;
  get(workspaceId: string, key: string, expectedHash: string): Promise<Buffer>;
  delete(workspaceId: string, key: string): Promise<void>;
  abort(workspaceId: string, key: string): Promise<void>;
}

export class ArtifactCorruptionError extends Error {}

export interface FoundationArtifactRecord {
  id: string;
  workspaceId: string;
  kind: string;
  provider: string;
  key: string;
  sha256: string;
  bytes: number;
  contentType: string;
  state: "pending" | "available" | "corrupt" | "deletion-pending" | "deleted";
}

export class ArtifactService {
  constructor(private readonly database: PlatformDatabase, private readonly provider: ArtifactProvider) {}

  async put(workspaceId: string, kind: string, contentType: string, content: Buffer): Promise<FoundationArtifactRecord> {
    const id = uuidV7();
    const digest = sha256(content);
    await this.database.pool.query(`INSERT INTO artifact.artifacts
      (id,workspace_id,kind,storage_provider_id,object_key,content_hash,bytes,content_type,state)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending')`, [id, workspaceId, kind, this.provider.id, `pending:${id}`, digest, content.length, contentType]);
    let published: ArtifactPutResult | undefined;
    try {
      published = await this.provider.put(workspaceId, content);
      const head = await this.provider.head(workspaceId, published.key);
      if (!head || head.sha256 !== digest || head.bytes !== content.length) throw new ArtifactCorruptionError("Published artifact failed reconciliation.");
      const result = await this.database.pool.query(`UPDATE artifact.artifacts SET object_key=$3,stored_hash=$4,state='available',updated_at=now()
        WHERE workspace_id=$1 AND id=$2 AND state='pending' RETURNING *`, [workspaceId, id, published.key, head.sha256]);
      if (!result.rowCount) throw new Error("Artifact publication state changed unexpectedly.");
      return mapArtifact(result.rows[0]);
    } catch (error) {
      if (published) await this.provider.delete(workspaceId, published.key).catch(() => undefined);
      await this.database.pool.query("UPDATE artifact.artifacts SET state=$3,updated_at=now() WHERE workspace_id=$1 AND id=$2 AND state='pending'", [workspaceId, id, error instanceof ArtifactCorruptionError ? "corrupt" : "pending"]);
      throw error;
    }
  }

  async get(workspaceId: string, artifactId: string): Promise<Buffer> {
    const result = await this.database.pool.query("SELECT * FROM artifact.artifacts WHERE workspace_id=$1 AND id=$2", [workspaceId, artifactId]);
    if (!result.rowCount || result.rows[0].state !== "available") throw new Error("Artifact is not available.");
    if (result.rows[0].storage_provider_id !== this.provider.id) throw new Error("Artifact provider is unavailable.");
    try {
      return await this.provider.get(workspaceId, result.rows[0].object_key, result.rows[0].content_hash);
    } catch (error) {
      if (error instanceof ArtifactCorruptionError) await this.database.pool.query("UPDATE artifact.artifacts SET state='corrupt',updated_at=now() WHERE workspace_id=$1 AND id=$2", [workspaceId, artifactId]);
      throw error;
    }
  }

  async delete(workspaceId: string, artifactId: string): Promise<void> {
    const claimed = await this.database.pool.query(`UPDATE artifact.artifacts SET state='deletion-pending',updated_at=now()
      WHERE workspace_id=$1 AND id=$2 AND state IN ('available','corrupt') RETURNING object_key,storage_provider_id`, [workspaceId, artifactId]);
    if (!claimed.rowCount) throw new Error("Artifact cannot be deleted from its current state.");
    if (claimed.rows[0].storage_provider_id !== this.provider.id) throw new Error("Artifact provider is unavailable.");
    await this.provider.delete(workspaceId, claimed.rows[0].object_key);
    await this.database.pool.query("UPDATE artifact.artifacts SET state='deleted',updated_at=now() WHERE workspace_id=$1 AND id=$2 AND state='deletion-pending'", [workspaceId, artifactId]);
  }
}

export class LocalArtifactProvider implements ArtifactProvider {
  readonly id = "local-v2";
  constructor(private readonly root: string) {}

  async put(workspaceId: string, content: Buffer): Promise<ArtifactPutResult> {
    const digest = sha256(content);
    const key = `${opaqueWorkspace(workspaceId)}/${digest.slice(0, 2)}/${digest}`;
    const target = this.resolveKey(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.pending-${uuidV7()}`;
    const handle = await fs.open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(content);
      await handle.sync();
    } catch (error) {
      await fs.rm(temporary, { force: true });
      throw error;
    } finally {
      await handle.close();
    }
    try {
      await fs.rename(temporary, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await fs.rm(temporary, { force: true });
    }
    await syncDirectory(path.dirname(target));
    const verified = await this.get(workspaceId, key, digest);
    return { provider: this.id, key, bytes: verified.length, sha256: digest };
  }

  async head(workspaceId: string, key: string): Promise<ArtifactHead | undefined> {
    ensureWorkspaceKey(workspaceId, key);
    try {
      const bytes = await fs.readFile(this.resolveKey(key));
      return { key, bytes: bytes.length, sha256: sha256(bytes) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async get(workspaceId: string, key: string, expectedHash: string): Promise<Buffer> {
    ensureWorkspaceKey(workspaceId, key);
    const content = await fs.readFile(this.resolveKey(key));
    if (sha256(content) !== expectedHash) throw new ArtifactCorruptionError("Artifact hash verification failed.");
    return content;
  }

  async delete(workspaceId: string, key: string): Promise<void> {
    ensureWorkspaceKey(workspaceId, key);
    await fs.rm(this.resolveKey(key), { force: true });
  }

  async abort(workspaceId: string, key: string): Promise<void> {
    ensureWorkspaceKey(workspaceId, key);
    const directory = path.dirname(this.resolveKey(key));
    try {
      const files = await fs.readdir(directory);
      await Promise.all(files.filter((name) => name.includes(".pending-")).map((name) => fs.rm(path.join(directory, name), { force: true })));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  private resolveKey(key: string): string {
    if (!/^[a-f0-9]{32}\/[a-f0-9]{2}\/[a-f0-9]{64}$/.test(key)) throw new Error("Invalid opaque artifact key.");
    const root = path.resolve(this.root);
    const target = path.resolve(root, key);
    if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Artifact key escapes provider root.");
    return target;
  }
}

export interface S3CompatibleClient {
  putObject(input: { bucket: string; key: string; body: Buffer; metadata: Record<string, string> }): Promise<void>;
  headObject(input: { bucket: string; key: string }): Promise<{ bytes: number; metadata?: Record<string, string> } | undefined>;
  getObject(input: { bucket: string; key: string }): Promise<Buffer>;
  copyObject(input: { bucket: string; sourceKey: string; targetKey: string; ifNoneMatch?: string }): Promise<void>;
  deleteObject(input: { bucket: string; key: string }): Promise<void>;
}

export class S3ArtifactProvider implements ArtifactProvider {
  readonly id = "s3-compatible-v1";
  constructor(private readonly client: S3CompatibleClient, private readonly bucket: string, private readonly prefix = "envforge") {}

  async put(workspaceId: string, content: Buffer): Promise<ArtifactPutResult> {
    const digest = sha256(content);
    const key = `${opaqueWorkspace(workspaceId)}/${digest.slice(0, 2)}/${digest}`;
    const finalKey = `${this.prefix}/${key}`;
    const stagingKey = `${this.prefix}/staging/${uuidV7()}`;
    try {
      await this.client.putObject({ bucket: this.bucket, key: stagingKey, body: content, metadata: { sha256: digest } });
      const staged = await this.client.headObject({ bucket: this.bucket, key: stagingKey });
      if (!staged || staged.bytes !== content.length || staged.metadata?.sha256 !== digest) throw new ArtifactCorruptionError("S3 staging verification failed.");
      await this.client.copyObject({ bucket: this.bucket, sourceKey: stagingKey, targetKey: finalKey, ifNoneMatch: "*" });
      const published = await this.client.headObject({ bucket: this.bucket, key: finalKey });
      if (!published || published.bytes !== content.length || published.metadata?.sha256 !== digest) throw new ArtifactCorruptionError("S3 publish reconciliation failed.");
    } finally {
      await this.client.deleteObject({ bucket: this.bucket, key: stagingKey }).catch(() => undefined);
    }
    return { provider: this.id, key, bytes: content.length, sha256: digest };
  }

  async head(workspaceId: string, key: string): Promise<ArtifactHead | undefined> {
    ensureWorkspaceKey(workspaceId, key);
    const result = await this.client.headObject({ bucket: this.bucket, key: `${this.prefix}/${key}` });
    return result ? { key, bytes: result.bytes, sha256: result.metadata?.sha256 ?? "" } : undefined;
  }

  async get(workspaceId: string, key: string, expectedHash: string): Promise<Buffer> {
    ensureWorkspaceKey(workspaceId, key);
    const result = await this.client.getObject({ bucket: this.bucket, key: `${this.prefix}/${key}` });
    if (sha256(result) !== expectedHash) throw new ArtifactCorruptionError("S3 artifact hash verification failed.");
    return result;
  }

  async delete(workspaceId: string, key: string): Promise<void> {
    ensureWorkspaceKey(workspaceId, key);
    await this.client.deleteObject({ bucket: this.bucket, key: `${this.prefix}/${key}` });
  }

  async abort(_workspaceId: string, key: string): Promise<void> {
    if (key.includes("..")) throw new Error("Invalid staging key.");
    await this.client.deleteObject({ bucket: this.bucket, key: `${this.prefix}/staging/${key}` });
  }
}

function opaqueWorkspace(workspaceId: string): string { return canonicalHash({ workspaceId }).slice(0, 32); }
function ensureWorkspaceKey(workspaceId: string, key: string): void {
  if (!key.startsWith(`${opaqueWorkspace(workspaceId)}/`)) throw new Error("Artifact workspace access denied.");
}
async function syncDirectory(directory: string): Promise<void> {
  try { const handle = await fs.open(directory, "r"); try { await handle.sync(); } finally { await handle.close(); } } catch {}
}

function mapArtifact(row: Record<string, unknown>): FoundationArtifactRecord {
  return {
    id: String(row.id), workspaceId: String(row.workspace_id), kind: String(row.kind), provider: String(row.storage_provider_id),
    key: String(row.object_key), sha256: String(row.content_hash), bytes: Number(row.bytes), contentType: String(row.content_type),
    state: row.state as FoundationArtifactRecord["state"]
  };
}
