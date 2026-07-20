import { platformDatabaseFromEnv } from "./platform/postgres.js";
const database = platformDatabaseFromEnv();
if (!database) throw new Error("ENVFORGE_POSTGRES_URL is required.");
console.log(JSON.stringify(await database.migrate(), null, 2));
await database.close();
