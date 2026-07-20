import type { PoolClient } from "pg";
import { PlatformDatabase } from "./postgres.js";
import { assertNoSensitiveKeys, canonicalHash, PROJECT_TYPES, uuidV7, type ProjectType } from "./foundation.js";

export class PlatformConflictError extends Error {}
export class PlatformPreconditionError extends Error {}
export class PlatformNotFoundError extends Error {}
export class PlatformAuthorizationError extends Error {}

export interface FoundationProject {
  id: string;
  workspaceId: string;
  type: ProjectType;
  name: string;
  status: "draft" | "discovering" | "reviewing" | "planning" | "ready" | "executing" | "attention-required" | "completed" | "archived";
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface FoundationEndpoint {
  id: string; workspaceId: string; kind: "linux-host" | "storage-host" | "external-service" | "drill-target";
  displayName: string; status: "unvalidated" | "available" | "degraded" | "unavailable" | "retired";
  hostIdentity: Record<string, unknown>; version: number;
}

export interface FoundationOperation {
  id: string;
  workspaceId: string;
  operationType: string;
  state: string;
  inputHash: string;
  resultHash?: string;
  errorCode?: string;
  errorSummary?: string;
  version: number;
  availableAt: string;
  createdAt: string;
  updatedAt: string;
}

interface CommandContext {
  actorId: string;
  workspaceId: string;
  requestId: string;
  correlationId?: string;
  idempotencyKey: string;
}

export class FoundationService {
  constructor(readonly database: PlatformDatabase) {}

  async ensurePersonalWorkspace(actorId: string, displayName: string): Promise<string> {
    return this.database.transaction(async (client) => {
      const current = await client.query<{ workspace_id: string }>(
        "SELECT workspace_id FROM core.workspace_memberships WHERE actor_id=$1 ORDER BY created_at LIMIT 1 FOR UPDATE",
        [actorId]
      );
      if (current.rowCount) return current.rows[0].workspace_id;
      const workspaceId = uuidV7();
      const slug = `personal-${canonicalHash(actorId).slice(0, 20)}`;
      await client.query("INSERT INTO core.workspaces(id,slug,name,status) VALUES($1,$2,$3,'active')", [workspaceId, slug, `${displayName} workspace`]);
      await client.query("INSERT INTO core.workspace_memberships(workspace_id,actor_id,role) VALUES($1,$2,'owner')", [workspaceId, actorId]);
      return workspaceId;
    });
  }

  async requireWorkspace(actorId: string, workspaceId: string): Promise<void> {
    const result = await this.database.pool.query(
      "SELECT 1 FROM core.workspace_memberships WHERE actor_id=$1 AND workspace_id=$2",
      [actorId, workspaceId]
    );
    if (!result.rowCount) throw new PlatformAuthorizationError("Workspace access denied.");
  }

  async createProject(context: CommandContext, input: { type: ProjectType; name: string }): Promise<{ project: FoundationProject; replayed: boolean }> {
    if (!PROJECT_TYPES.includes(input.type)) throw new Error("Unsupported project type.");
    const name = input.name.trim();
    if (!name || name.length > 160) throw new Error("Project name must contain 1-160 characters.");
    assertNoSensitiveKeys(input);
    const requestHash = canonicalHash(input);
    return this.database.transaction(async (client) => {
      const replay = await this.claimIdempotency(client, context, "CreateProject", requestHash);
      if (replay) return { project: replay as FoundationProject, replayed: true };
      const project = await this.insertProject(client, context, input.type, name);
      await this.completeIdempotency(client, context, "CreateProject", 201, project, "project", project.id);
      return { project, replayed: false };
    });
  }

  async updateProjectName(context: CommandContext, projectId: string, expectedVersion: number, name: string): Promise<{ project: FoundationProject; replayed: boolean }> {
    const normalized = name.trim();
    if (!normalized || normalized.length > 160) throw new Error("Project name must contain 1-160 characters.");
    const request = { projectId, expectedVersion, name: normalized };
    const requestHash = canonicalHash(request);
    return this.database.transaction(async (client) => {
      const replay = await this.claimIdempotency(client, context, "UpdateProject", requestHash);
      if (replay) return { project: replay as FoundationProject, replayed: true };
      const before = await client.query("SELECT * FROM core.projects WHERE workspace_id=$1 AND id=$2 FOR UPDATE", [context.workspaceId, projectId]);
      if (!before.rowCount) throw new PlatformNotFoundError("Project not found.");
      if (Number(before.rows[0].version) !== expectedVersion) throw new PlatformPreconditionError("Project version does not match If-Match.");
      const updated = await client.query("UPDATE core.projects SET name=$3,version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2 RETURNING *", [context.workspaceId, projectId, normalized]);
      const project = mapProject(updated.rows[0]);
      await this.appendRecords(client, context, project, "project.updated", { project });
      await this.completeIdempotency(client, context, "UpdateProject", 200, project, "project", project.id);
      return { project, replayed: false };
    });
  }

  async getProject(workspaceId: string, projectId: string): Promise<FoundationProject> {
    const result = await this.database.pool.query("SELECT * FROM core.projects WHERE workspace_id=$1 AND id=$2", [workspaceId, projectId]);
    if (!result.rowCount) throw new PlatformNotFoundError("Project not found.");
    return mapProject(result.rows[0]);
  }

  async listProjects(workspaceId: string, limit = 50): Promise<FoundationProject[]> {
    const result = await this.database.pool.query("SELECT * FROM core.projects WHERE workspace_id=$1 ORDER BY created_at,id LIMIT $2", [workspaceId, Math.min(Math.max(limit, 1), 100)]);
    return result.rows.map(mapProject);
  }

  async createEndpoint(context: CommandContext, input: { kind: FoundationEndpoint["kind"]; displayName: string; hostIdentity?: Record<string, unknown> }): Promise<FoundationEndpoint> {
    assertNoSensitiveKeys(input);
    const displayName = input.displayName.trim();
    if (!displayName || displayName.length > 160) throw new Error("Endpoint display name must contain 1-160 characters.");
    return this.database.transaction(async (client) => {
      const replay = await this.claimIdempotency(client, context, "CreateEndpoint", canonicalHash(input));
      if (replay) return replay as FoundationEndpoint;
      const id = uuidV7();
      const result = await client.query(`INSERT INTO core.endpoints(id,workspace_id,kind,display_name,host_identity,status)
        VALUES($1,$2,$3,$4,$5,'unvalidated') RETURNING *`, [id, context.workspaceId, input.kind, displayName, input.hostIdentity ?? {}]);
      const endpoint = mapEndpoint(result.rows[0]);
      await this.appendRecords(client, context, endpoint, "endpoint.created", { endpoint }, "projection.endpoint");
      await this.completeIdempotency(client, context, "CreateEndpoint", 201, endpoint, "endpoint", endpoint.id);
      return endpoint;
    });
  }

  async bindEndpoint(context: CommandContext, projectId: string, endpointId: string, role: "source" | "target" | "storage" | "drill-target", expectedVersion: number): Promise<FoundationEndpoint> {
    const input = { projectId, endpointId, role, expectedVersion };
    return this.database.transaction(async (client) => {
      const replay = await this.claimIdempotency(client, context, "BindEndpointToProject", canonicalHash(input));
      if (replay) return replay as FoundationEndpoint;
      const projectResult = await client.query("SELECT * FROM core.projects WHERE workspace_id=$1 AND id=$2 FOR UPDATE", [context.workspaceId, projectId]);
      if (!projectResult.rowCount) throw new PlatformNotFoundError("Project not found.");
      if (Number(projectResult.rows[0].version) !== expectedVersion) throw new PlatformPreconditionError("Project version does not match If-Match.");
      const endpointResult = await client.query("SELECT * FROM core.endpoints WHERE workspace_id=$1 AND id=$2", [context.workspaceId, endpointId]);
      if (!endpointResult.rowCount) throw new PlatformNotFoundError("Endpoint not found.");
      const inserted = await client.query(`INSERT INTO core.project_endpoints(workspace_id,project_id,endpoint_id,role)
        VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [context.workspaceId, projectId, endpointId, role]);
      if (inserted.rowCount) {
        const updated = await client.query("UPDATE core.projects SET version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2 RETURNING *", [context.workspaceId, projectId]);
        const project = mapProject(updated.rows[0]);
        await this.appendRecords(client, context, project, "project.endpoint-bound", { project, endpointId, role });
      }
      const endpoint = mapEndpoint(endpointResult.rows[0]);
      await this.completeIdempotency(client, context, "BindEndpointToProject", 200, endpoint, "endpoint", endpoint.id);
      return endpoint;
    });
  }

  async listProjectEndpoints(workspaceId: string, projectId: string): Promise<Array<FoundationEndpoint & { role: string }>> {
    const result = await this.database.pool.query(`SELECT e.*,pe.role FROM core.project_endpoints pe
      JOIN core.endpoints e ON e.workspace_id=pe.workspace_id AND e.id=pe.endpoint_id
      WHERE pe.workspace_id=$1 AND pe.project_id=$2 ORDER BY pe.created_at,e.id`, [workspaceId, projectId]);
    return result.rows.map((row) => ({ ...mapEndpoint(row), role: String(row.role) }));
  }

  async createHashVerificationOperation(context: CommandContext, input: Record<string, unknown>, availableAt = new Date()): Promise<string> {
    assertNoSensitiveKeys(input);
    const inputHash = canonicalHash(input);
    const deduplicationKey = `${context.idempotencyKey}:${inputHash}`;
    return this.database.transaction(async (client) => {
      const existing = await client.query<{ id: string }>("SELECT id FROM core.control_plane_operations WHERE workspace_id=$1 AND deduplication_key=$2", [context.workspaceId, deduplicationKey]);
      if (existing.rowCount) return existing.rows[0].id;
      const id = uuidV7();
      await client.query(`INSERT INTO core.control_plane_operations
        (id,workspace_id,operation_type,state,input_hash,input_payload,available_at,deduplication_key)
        VALUES($1,$2,'hash-verification','queued',$3,$4,$5,$6)`, [id, context.workspaceId, inputHash, input, availableAt, deduplicationKey]);
      const operation = { id, workspaceId: context.workspaceId, operationType: "hash-verification", state: "queued", version: 0 };
      await this.appendRecords(client, context, operation, "control-plane-operation.queued", { operationId: id }, "foundation.operation.requested");
      return id;
    });
  }

  async getOperation(workspaceId: string, operationId: string): Promise<FoundationOperation> {
    const result = await this.database.pool.query("SELECT * FROM core.control_plane_operations WHERE workspace_id=$1 AND id=$2", [workspaceId, operationId]);
    if (!result.rowCount) throw new PlatformNotFoundError("Control-plane operation not found.");
    const row = result.rows[0];
    return {
      id: String(row.id), workspaceId: String(row.workspace_id), operationType: String(row.operation_type), state: String(row.state),
      inputHash: String(row.input_hash), resultHash: row.result_hash ? String(row.result_hash) : undefined,
      errorCode: row.error_code ? String(row.error_code) : undefined, errorSummary: row.error_summary ? String(row.error_summary) : undefined,
      version: Number(row.version), availableAt: new Date(row.available_at).toISOString(), createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString()
    };
  }

  async getWorkspaceMetrics(workspaceId: string): Promise<Record<string, number>> {
    const result = await this.database.pool.query(`SELECT
      (SELECT count(*) FROM core.projects WHERE workspace_id=$1) projects,
      (SELECT count(*) FROM core.control_plane_operations WHERE workspace_id=$1 AND state IN ('created','queued','running','waiting','finalizing')) operations_pending,
      (SELECT count(*) FROM audit.outbox_messages WHERE workspace_id=$1 AND state='pending') outbox_pending,
      (SELECT count(*) FROM audit.outbox_messages WHERE workspace_id=$1 AND state='dead-letter') outbox_dead_letter,
      (SELECT count(*) FROM audit.inbox_messages WHERE workspace_id=$1 AND processing_state='completed') inbox_completed,
      (SELECT count(*) FROM artifact.artifacts WHERE workspace_id=$1 AND state='corrupt') artifacts_corrupt`, [workspaceId]);
    return Object.fromEntries(Object.entries(result.rows[0]).map(([key, value]) => [key, Number(value)]));
  }

  private async insertProject(client: PoolClient, context: CommandContext, type: ProjectType, name: string): Promise<FoundationProject> {
    const id = uuidV7();
    const result = await client.query("INSERT INTO core.projects(id,workspace_id,project_type,name,status) VALUES($1,$2,$3,$4,'draft') RETURNING *", [id, context.workspaceId, type, name]);
    const project = mapProject(result.rows[0]);
    await this.appendRecords(client, context, project, "project.created", { project }, "projection.project");
    return project;
  }

  private async appendRecords(client: PoolClient, context: CommandContext, aggregate: { id: string; version: number }, eventType: string, payload: unknown, topic = "projection.project"): Promise<void> {
    assertNoSensitiveKeys(payload);
    const aggregateType = eventType.split(".", 1)[0];
    const eventId = uuidV7();
    const outboxId = uuidV7();
    const auditId = uuidV7();
    const correlationId = context.correlationId ?? uuidV7();
    const payloadHash = canonicalHash(payload);
    await client.query(`INSERT INTO audit.domain_events
      (id,workspace_id,aggregate_type,aggregate_id,aggregate_version,event_type,schema_version,correlation_id,actor_type,actor_id,payload,payload_hash)
      VALUES($1,$2,$3,$4,$5,$6,1,$7,'user',$8,$9,$10)`, [eventId, context.workspaceId, aggregateType, aggregate.id, aggregate.version, eventType, correlationId, context.actorId, payload, payloadHash]);
    await client.query(`INSERT INTO audit.outbox_messages
      (id,workspace_id,event_id,topic,partition_key,payload) VALUES($1,$2,$3,$4,$5,$6)`, [outboxId, context.workspaceId, eventId, topic, aggregate.id, { eventId, eventType, schemaVersion: 1, ...payload as object }]);
    await client.query(`INSERT INTO audit.audit_records
      (id,workspace_id,actor_type,actor_id,action,resource_type,resource_id,request_id,correlation_id,idempotency_key,after_state_hash,metadata)
      VALUES($1,$2,'user',$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [auditId, context.workspaceId, context.actorId, eventType, aggregateType, aggregate.id, context.requestId, correlationId, context.idempotencyKey, canonicalHash(aggregate), { eventId }]);
  }

  private async claimIdempotency(client: PoolClient, context: CommandContext, operationId: string, requestHash: string): Promise<unknown | undefined> {
    await client.query(`INSERT INTO audit.idempotency_keys
      (workspace_id,actor_id,operation_id,idempotency_key,request_hash,state,expires_at)
      VALUES($1,$2,$3,$4,$5,'processing',now()+interval '24 hours') ON CONFLICT DO NOTHING`, [context.workspaceId, context.actorId, operationId, context.idempotencyKey, requestHash]);
    const result = await client.query<{ request_hash: string; state: string; response_body: unknown }>(`SELECT request_hash,state,response_body FROM audit.idempotency_keys
      WHERE workspace_id=$1 AND actor_id=$2 AND operation_id=$3 AND idempotency_key=$4 FOR UPDATE`, [context.workspaceId, context.actorId, operationId, context.idempotencyKey]);
    const row = result.rows[0];
    if (row.request_hash !== requestHash) throw new PlatformConflictError("Idempotency key was already used with a different request.");
    return row.state === "completed" ? row.response_body : undefined;
  }

  private async completeIdempotency(client: PoolClient, context: CommandContext, operationId: string, status: number, body: unknown, resourceType: string, resourceId: string): Promise<void> {
    await client.query(`UPDATE audit.idempotency_keys SET state='completed',response_status=$5,response_body=$6,resource_type=$7,resource_id=$8,completed_at=now()
      WHERE workspace_id=$1 AND actor_id=$2 AND operation_id=$3 AND idempotency_key=$4`, [context.workspaceId, context.actorId, operationId, context.idempotencyKey, status, body, resourceType, resourceId]);
  }
}

function mapProject(row: Record<string, unknown>): FoundationProject {
  return {
    id: String(row.id), workspaceId: String(row.workspace_id), type: row.project_type as ProjectType,
    name: String(row.name), status: row.status as FoundationProject["status"], version: Number(row.version),
    createdAt: new Date(row.created_at as string | Date).toISOString(), updatedAt: new Date(row.updated_at as string | Date).toISOString()
  };
}

function mapEndpoint(row: Record<string, unknown>): FoundationEndpoint {
  return { id: String(row.id), workspaceId: String(row.workspace_id), kind: row.kind as FoundationEndpoint["kind"], displayName: String(row.display_name), status: row.status as FoundationEndpoint["status"], hostIdentity: (row.host_identity ?? {}) as Record<string, unknown>, version: Number(row.version) };
}
