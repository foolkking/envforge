import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { sha256 } from "./foundation.js";

export async function createPostgresBackup(databaseUrl: string, output: string): Promise<{ path: string; bytes: number; sha256: string }> {
  await fs.mkdir(path.dirname(output), { recursive: true });
  const result = spawnSync("pg_dump", ["--dbname", databaseUrl, "--format=custom", "--no-owner", "--no-privileges", "--file", output], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`pg_dump failed: ${result.stderr || "unknown error"}`);
  const content = await fs.readFile(output);
  return { path: output, bytes: content.length, sha256: sha256(content) };
}

export async function restorePostgresBackup(databaseUrl: string, input: string): Promise<void> {
  const parsed = new URL(databaseUrl);
  if (!parsed.pathname.toLowerCase().includes("envforge_phase0_restore")) throw new Error("Restore target must be an explicit disposable envforge_phase0_restore database.");
  const result = spawnSync("pg_restore", ["--dbname", databaseUrl, "--no-owner", "--no-privileges", "--exit-on-error", input], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`pg_restore failed: ${result.stderr || "unknown error"}`);
}
