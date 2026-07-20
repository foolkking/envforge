import { dispatchOnce } from "./platform/dispatcher.js";
import { platformDatabaseFromEnv } from "./platform/postgres.js";

const database = platformDatabaseFromEnv();
if (!database) throw new Error("ENVFORGE_POSTGRES_URL is required.");
await database.migrate();
let stopping = false;
process.once("SIGTERM", () => { stopping = true; });
process.once("SIGINT", () => { stopping = true; });
while (!stopping) {
  const count = await dispatchOnce(database, "operation", `operation-worker-${process.pid}`);
  if (!count) await new Promise((resolve) => setTimeout(resolve, 500));
}
await database.close();
