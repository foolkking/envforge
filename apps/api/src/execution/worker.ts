import { PlatformDatabase, platformDatabaseFromEnv } from "../platform/postgres.js";
import { SandboxTestAdapter } from "./test-adapter.js";
import { ExecutionService } from "./service.js";
import os from "node:os";

export async function runExecutionWorkerOnce(database:PlatformDatabase,workerId=`phase2-${os.hostname()}`):Promise<boolean>{const service=new ExecutionService(database);const claim=await service.claimNext(workerId);if(!claim)return false;await service.executeClaimed(claim,new SandboxTestAdapter(process.env.ENVFORGE_EXECUTION_SANDBOX??".envforge-execution-sandbox"));return true;}
if(import.meta.url===`file://${process.argv[1]}`){const database=platformDatabaseFromEnv();if(!database)throw new Error("ENVFORGE_POSTGRES_URL is required.");await database.migrate();await runExecutionWorkerOnce(database);await database.close();}
