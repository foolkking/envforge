import path from "node:path";
import { createPostgresBackup } from "./platform/backup.js";
import { resolveFromRoot } from "./repo.js";

const databaseUrl = process.env.ENVFORGE_POSTGRES_URL?.trim();
if (!databaseUrl) throw new Error("ENVFORGE_POSTGRES_URL is required.");
const output = path.resolve(process.env.ENVFORGE_POSTGRES_BACKUP_PATH || resolveFromRoot("artifacts/generated/phase0/postgres.backup"));
console.log(JSON.stringify(await createPostgresBackup(databaseUrl, output), null, 2));
