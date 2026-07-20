import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getUserByToken } from "../auth/index.js";
import { PROJECT_TYPES, uuidV7 } from "./foundation.js";
import { FoundationService, PlatformAuthorizationError, PlatformConflictError, PlatformNotFoundError, PlatformPreconditionError } from "./service.js";
import type { PlatformDatabase } from "./postgres.js";

export async function registerPlatformRoutes(app: FastifyInstance, database: PlatformDatabase): Promise<void> {
  const service = new FoundationService(database);

  app.get("/api/v1/health/live", async () => ({ status: "ok", service: "envforge-api" }));
  app.get("/api/v1/health/ready", async (_request, reply) => {
    const health = await database.health();
    if (!health.ok) reply.code(503);
    return { status: health.ok ? "ready" : "not-ready", database: health.ok ? "available" : "unavailable", migrationVersion: health.migrationVersion };
  });

  app.post("/api/v1/projects", async (request, reply) => handle(reply, async () => {
    const user = await authenticate(request);
    const workspaceId = (await workspaceFor(request, service, user.id, user.username || user.email))!;
    const key = requiredHeader(request, "idempotency-key");
    const body = (request.body ?? {}) as { type?: string; name?: string };
    if (!PROJECT_TYPES.includes(body.type as never) || typeof body.name !== "string") return problem(reply, 422, "VALIDATION_FAILED", "Project type and name are required.");
    const result = await service.createProject({ actorId: user.id, workspaceId, requestId: request.id, correlationId: readHeader(request, "x-correlation-id") ?? uuidV7(), idempotencyKey: key }, { type: body.type as typeof PROJECT_TYPES[number], name: body.name });
    reply.code(result.replayed ? 200 : 201).header("ETag", etag(result.project.version)).header("X-Workspace-Id", workspaceId);
    return result.project;
  }));

  app.get("/api/v1/projects", async (request, reply) => handle(reply, async () => {
    const user = await authenticate(request);
    const workspaceId = await workspaceFor(request, service, user.id, user.username || user.email, false);
    if (!workspaceId) return { items: [], page: { limit: 50, nextCursor: null, total: 0 } };
    const items = await service.listProjects(workspaceId);
    return { items, page: { limit: 50, nextCursor: null, total: items.length } };
  }));

  app.get("/api/v1/projects/:projectId", async (request, reply) => handle(reply, async () => {
    const user = await authenticate(request);
    const workspaceId = await requiredWorkspace(request, service, user.id);
    const project = await service.getProject(workspaceId, (request.params as { projectId: string }).projectId);
    reply.header("ETag", etag(project.version));
    return project;
  }));

  app.patch("/api/v1/projects/:projectId", async (request, reply) => handle(reply, async () => {
    const user = await authenticate(request);
    const workspaceId = await requiredWorkspace(request, service, user.id);
    const key = requiredHeader(request, "idempotency-key");
    const expectedVersion = parseEtag(requiredHeader(request, "if-match"));
    const body = (request.body ?? {}) as { name?: string };
    if (typeof body.name !== "string") return problem(reply, 422, "VALIDATION_FAILED", "name is required.");
    const result = await service.updateProjectName({ actorId: user.id, workspaceId, requestId: request.id, correlationId: readHeader(request, "x-correlation-id") ?? uuidV7(), idempotencyKey: key }, (request.params as { projectId: string }).projectId, expectedVersion, body.name);
    reply.header("ETag", etag(result.project.version));
    return result.project;
  }));

  app.post("/api/v1/projects/:projectId/endpoints", async (request, reply) => handle(reply, async () => {
    const user = await authenticate(request);
    const workspaceId = await requiredWorkspace(request, service, user.id);
    const key = requiredHeader(request, "idempotency-key");
    const expectedVersion = parseEtag(requiredHeader(request, "if-match"));
    const body = (request.body ?? {}) as { endpointId?: string; role?: "source" | "target" | "storage" | "drill-target" };
    if (typeof body.endpointId !== "string" || !body.role) return problem(reply, 422, "VALIDATION_FAILED", "endpointId and role are required.");
    const endpoint = await service.bindEndpoint({ actorId: user.id, workspaceId, requestId: request.id, correlationId: uuidV7(), idempotencyKey: key }, (request.params as { projectId: string }).projectId, body.endpointId, body.role, expectedVersion);
    return endpoint;
  }));

  app.get("/api/v1/projects/:projectId/endpoints", async (request, reply) => handle(reply, async () => {
    const user = await authenticate(request);
    const workspaceId = await requiredWorkspace(request, service, user.id);
    const items = await service.listProjectEndpoints(workspaceId, (request.params as { projectId: string }).projectId);
    return { items, page: { limit: 50, nextCursor: null, total: items.length } };
  }));

  app.post("/api/v1/platform/operations/hash-verification", async (request, reply) => handle(reply, async () => {
    const user = await authenticate(request);
    requirePlatformAdmin(user.role);
    const workspaceId = await requiredWorkspace(request, service, user.id);
    const key = requiredHeader(request, "idempotency-key");
    const body = (request.body ?? {}) as { input?: Record<string, unknown>; notBefore?: string };
    if (!body.input || typeof body.input !== "object" || Array.isArray(body.input)) return problem(reply, 422, "VALIDATION_FAILED", "input must be an object.");
    const availableAt = body.notBefore ? new Date(body.notBefore) : new Date();
    if (Number.isNaN(availableAt.valueOf())) return problem(reply, 422, "VALIDATION_FAILED", "notBefore must be an ISO 8601 timestamp.");
    const operationId = await service.createHashVerificationOperation({ actorId: user.id, workspaceId, requestId: request.id, correlationId: readHeader(request, "x-correlation-id") ?? uuidV7(), idempotencyKey: key }, body.input, availableAt);
    reply.code(202).header("Location", `/api/v1/platform/operations/${operationId}`);
    return await service.getOperation(workspaceId, operationId);
  }));

  app.get("/api/v1/platform/operations/:operationId", async (request, reply) => handle(reply, async () => {
    const user = await authenticate(request);
    requirePlatformAdmin(user.role);
    const workspaceId = await requiredWorkspace(request, service, user.id);
    return service.getOperation(workspaceId, (request.params as { operationId: string }).operationId);
  }));

  app.get("/api/v1/platform/metrics", async (request, reply) => handle(reply, async () => {
    const user = await authenticate(request);
    requirePlatformAdmin(user.role);
    const workspaceId = await requiredWorkspace(request, service, user.id);
    return { workspaceId, ...(await service.getWorkspaceMetrics(workspaceId)) };
  }));

}

async function authenticate(request: FastifyRequest) {
  const token = readHeader(request, "authorization")?.replace(/^Bearer\s+/i, "");
  const user = await getUserByToken(token);
  if (!user) throw Object.assign(new Error("Authentication required."), { statusCode: 401, code: "AUTHENTICATION_REQUIRED" });
  return user;
}

function requirePlatformAdmin(role: string): void {
  if (role !== "admin") throw Object.assign(new Error("Platform administration permission is required."), { statusCode: 403, code: "FORBIDDEN" });
}

async function workspaceFor(request: FastifyRequest, service: FoundationService, actorId: string, displayName: string, create = true): Promise<string | undefined> {
  const requested = readHeader(request, "x-workspace-id");
  if (requested) { await service.requireWorkspace(actorId, requested); return requested; }
  if (!create) {
    const result = await service.database.pool.query<{ workspace_id: string }>("SELECT workspace_id FROM core.workspace_memberships WHERE actor_id=$1 ORDER BY created_at LIMIT 1", [actorId]);
    return result.rows[0]?.workspace_id;
  }
  return service.ensurePersonalWorkspace(actorId, displayName);
}

async function requiredWorkspace(request: FastifyRequest, service: FoundationService, actorId: string): Promise<string> {
  const value = await workspaceFor(request, service, actorId, "", false);
  if (!value) throw new PlatformAuthorizationError("Workspace context is required.");
  return value;
}

async function handle(reply: FastifyReply, run: () => Promise<unknown>): Promise<unknown> {
  try { return await run(); } catch (error) {
    if (error instanceof PlatformConflictError) return problem(reply, 409, "IDEMPOTENCY_CONFLICT", error.message);
    if (error instanceof PlatformPreconditionError) return problem(reply, 412, "PRECONDITION_FAILED", error.message);
    if (error instanceof PlatformNotFoundError) return problem(reply, 404, "NOT_FOUND", "Resource not found.");
    if (error instanceof PlatformAuthorizationError) return problem(reply, 404, "NOT_FOUND", "Resource not found.");
    const typed = error as { statusCode?: number; code?: string; message?: string };
    if (typed.statusCode) return problem(reply, typed.statusCode, typed.code ?? "REQUEST_FAILED", typed.message ?? "Request failed.");
    return problem(reply, 422, "VALIDATION_FAILED", typed.message?.replace(/(?:password|secret|token)\S*/gi, "[REDACTED]") ?? "Validation failed.");
  }
}

function problem(reply: FastifyReply, status: number, code: string, detail: string) {
  reply.code(status).type("application/problem+json");
  return { type: "about:blank", title: status === 422 ? "Validation failed" : "Request failed", status, code, detail };
}
function readHeader(request: FastifyRequest, name: string): string | undefined { const value = request.headers[name]; return Array.isArray(value) ? value[0] : value; }
function requiredHeader(request: FastifyRequest, name: string): string { const value = readHeader(request, name); if (!value) throw Object.assign(new Error(`${name} header is required.`), { statusCode: 422, code: "VALIDATION_FAILED" }); return value; }
function etag(version: number): string { return `"${version}"`; }
function parseEtag(value: string): number { const match = /^"?(\d+)"?$/.exec(value.trim()); if (!match) throw Object.assign(new Error("If-Match must contain a numeric version."), { statusCode: 422, code: "VALIDATION_FAILED" }); return Number(match[1]); }
