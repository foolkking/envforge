import { readRuntimeDatabase } from "./runtime-store.js";
import { applyLegacyFoundationBackfill, planLegacyFoundationBackfill, type LegacyFoundationSession } from "./platform/legacy-backfill.js";
import { platformDatabaseFromEnv } from "./platform/postgres.js";

const runtime = await readRuntimeDatabase();
const sessions = ((runtime as unknown as { migrationSessions?: LegacyFoundationSession[] }).migrationSessions ?? []);
const apply = process.argv.includes("--apply");
if (!apply) {
  console.log(JSON.stringify({ mode: "dry-run", sourceCount: sessions.length, items: planLegacyFoundationBackfill(sessions) }, null, 2));
} else {
  const database = platformDatabaseFromEnv();
  if (!database) throw new Error("ENVFORGE_POSTGRES_URL is required for --apply.");
  await database.migrate();
  console.log(JSON.stringify({ mode: "apply", sourceCount: sessions.length, items: await applyLegacyFoundationBackfill(database, sessions) }, null, 2));
  await database.close();
}
