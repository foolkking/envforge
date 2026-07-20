import { restorePostgresBackup } from "./platform/backup.js";

const databaseUrl = process.env.ENVFORGE_RESTORE_DATABASE_URL?.trim();
const input = process.env.ENVFORGE_POSTGRES_BACKUP_PATH?.trim();
if (!databaseUrl || !input) throw new Error("ENVFORGE_RESTORE_DATABASE_URL and ENVFORGE_POSTGRES_BACKUP_PATH are required.");
await restorePostgresBackup(databaseUrl, input);
console.log(JSON.stringify({ status: "restored", target: "explicit disposable envforge_phase0_restore database" }));
