import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { Pool, type PoolClient, type PoolConfig } from "pg";
import { resolveFromRoot } from "../repo.js";

export interface MigrationRecord { version: string; checksum: string; appliedAt: string }

export class PlatformDatabase {
  readonly pool: Pool;

  constructor(config: string | PoolConfig) {
    this.pool = new Pool(typeof config === "string" ? { connectionString: config, max: 10 } : config);
  }

  async migrate(directory = resolveFromRoot("apps/api/migrations/postgres")): Promise<MigrationRecord[]> {
    const client = await this.pool.connect();
    try {
      await client.query("CREATE SCHEMA IF NOT EXISTS platform");
      await client.query(`CREATE TABLE IF NOT EXISTS platform.schema_migrations (
        version text PRIMARY KEY,
        description text NOT NULL,
        checksum text NOT NULL,
        transactional boolean NOT NULL DEFAULT true,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);
      const files = (await fs.readdir(directory)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
      for (const file of files) {
        const sql = await fs.readFile(path.join(directory, file), "utf8");
        const checksum = createHash("sha256").update(sql).digest("hex");
        const version = file.split("_", 1)[0];
        const applied = await client.query<{ checksum: string }>("SELECT checksum FROM platform.schema_migrations WHERE version=$1", [version]);
        if (applied.rowCount) {
          if (applied.rows[0].checksum !== checksum) throw new Error(`Migration checksum mismatch for ${file}`);
          continue;
        }
        await client.query("BEGIN");
        try {
          await client.query(sql);
          await client.query("INSERT INTO platform.schema_migrations(version,description,checksum) VALUES($1,$2,$3)", [version, file, checksum]);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
      return this.listMigrations(client);
    } finally {
      client.release();
    }
  }

  async transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await run(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async health(): Promise<{ ok: boolean; migrationVersion?: string }> {
    try {
      const result = await this.pool.query<{ version: string }>("SELECT version FROM platform.schema_migrations ORDER BY version DESC LIMIT 1");
      return { ok: true, migrationVersion: result.rows[0]?.version };
    } catch {
      return { ok: false };
    }
  }

  async close(): Promise<void> { await this.pool.end(); }

  private async listMigrations(client: PoolClient): Promise<MigrationRecord[]> {
    const result = await client.query<{ version: string; checksum: string; applied_at: Date }>("SELECT version,checksum,applied_at FROM platform.schema_migrations ORDER BY version");
    return result.rows.map((row) => ({ version: row.version, checksum: row.checksum, appliedAt: row.applied_at.toISOString() }));
  }
}

export function platformDatabaseFromEnv(): PlatformDatabase | undefined {
  const url = process.env.ENVFORGE_POSTGRES_URL?.trim();
  return url ? new PlatformDatabase(url) : undefined;
}
