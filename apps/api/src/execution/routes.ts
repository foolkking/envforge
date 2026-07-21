import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getUserByToken } from "../auth/index.js";
import { PlatformDatabase } from "../platform/postgres.js";
import { ExecutionService } from "./service.js";

export async function registerExecutionRoutes(app:FastifyInstance,database:PlatformDatabase):Promise<void>{
  const service=new ExecutionService(database);
  if(!app.hasDecorator("executionService"))app.decorate("executionService",service);
  app.get("/api/v1/runs",async(request,reply)=>handle(reply,async()=>{const user=await auth(request);return{items:await service.listRuns(requiredWorkspace(request),(request.query as {projectId?:string})?.projectId)};}));
  app.get("/api/v1/runs/:runId",async(request,reply)=>handle(reply,async()=>{await auth(request);return service.getRun(requiredWorkspace(request),(request.params as {runId:string}).runId);}));
  for(const kind of ["stages","actions","events"] as const)app.get(`/api/v1/runs/:runId/${kind}`,async(request,reply)=>handle(reply,async()=>{await auth(request);return{items:await service.children(requiredWorkspace(request),(request.params as {runId:string}).runId,kind)};}));
  for(const command of ["pause","resume","cancel"] as const)app.post(`/api/v1/runs/:runId/${command}`,async(request,reply)=>handle(reply,async()=>{const user=await auth(request);const body=request.body as {reason?:string}??{};const version=parseEtag(header(request,"if-match"));const run=await service.requestControl({actorId:user.id,workspaceId:requiredWorkspace(request),requestId:request.id,idempotencyKey:requiredHeader(request,"idempotency-key")},(request.params as {runId:string}).runId,command,version,body.reason??command);reply.code(202);return run;}));
  app.post("/api/v1/runs/:runId/rollback",async(request,reply)=>handle(reply,async()=>{const user=await auth(request);const workspaceId=requiredWorkspace(request);const rollback=await service.createRollbackRun({actorId:user.id,workspaceId,requestId:request.id,idempotencyKey:requiredHeader(request,"idempotency-key")},(request.params as {runId:string}).runId);reply.code(202).header("Location",`/api/v1/runs/${rollback.id}`);return rollback;}));
  app.get("/api/v1/runs/:runId/report",async(request,reply)=>handle(reply,async()=>{await auth(request);const runId=(request.params as {runId:string}).runId;const row=(await database.pool.query("SELECT content,report_hash FROM execution.report_artifacts WHERE workspace_id=$1 AND run_id=$2 ORDER BY created_at DESC LIMIT 1",[requiredWorkspace(request),runId])).rows[0];if(!row)return fail(reply,404,"REPORT_NOT_READY","Report is not ready.");return row;}));
}
async function auth(request:FastifyRequest){const token=header(request,"authorization")?.replace(/^Bearer\s+/i,"");const user=await getUserByToken(token);if(!user)throw Object.assign(new Error("Authentication required."),{statusCode:401,code:"AUTHENTICATION_REQUIRED"});return user;}
function requiredWorkspace(request:FastifyRequest){const value=header(request,"x-workspace-id");if(!value)throw Object.assign(new Error("Workspace context is required."),{statusCode:422,code:"VALIDATION_FAILED"});return value;}
function requiredHeader(request:FastifyRequest,name:string){const value=header(request,name);if(!value)throw Object.assign(new Error(`${name} header is required.`),{statusCode:422,code:"VALIDATION_FAILED"});return value;}
function parseEtag(value:string|undefined){if(!value)throw Object.assign(new Error("If-Match header is required."),{statusCode:422,code:"VALIDATION_FAILED"});const match=/^"?(\d+)"?$/.exec(value);if(!match)throw Object.assign(new Error("If-Match must contain a numeric version."),{statusCode:422,code:"VALIDATION_FAILED"});return Number(match[1]);}
function header(request:FastifyRequest,name:string){const value=request.headers[name];return Array.isArray(value)?value[0]:value;}
async function handle(reply:FastifyReply,fn:()=>Promise<unknown>){try{return await fn();}catch(error){const e=error as {statusCode?:number;code?:string;message?:string};return fail(reply,e.statusCode??422,e.code??"REQUEST_FAILED",e.message??"Request failed.");}}
function fail(reply:FastifyReply,status:number,code:string,detail:string){reply.code(status).type("application/problem+json");return{type:"about:blank",title:"Execution request failed",status,code,detail:detail.replace(/(?:password|secret|token)\S*/gi,"[REDACTED]")};}
