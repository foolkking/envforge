import type { PoolClient } from "pg";
import { canonicalHash, uuidV7 } from "./foundation.js";
import { PlatformDatabase } from "./postgres.js";

interface ClaimedMessage { id: string; workspaceId: string; topic: string; payload: Record<string, unknown>; claimToken: string; attempt: number }

export async function dispatchOnce(database: PlatformDatabase, role: "operation" | "projection", workerId: string): Promise<number> {
  const topics = role === "operation" ? ["foundation.operation.requested"] : ["projection.project", "projection.endpoint"];
  const claimed = await claim(database, topics, workerId, 20);
  for (const message of claimed) {
    try {
      if (role === "operation") await processOperation(database, message, workerId);
      else await processProjection(database, message, workerId);
    } catch (error) {
      await fail(database, message, error);
    }
  }
  return claimed.length;
}

async function claim(database: PlatformDatabase, topics: string[], workerId: string, limit: number): Promise<ClaimedMessage[]> {
  return database.transaction(async (client) => {
    const rows = await client.query(`SELECT id,workspace_id,topic,payload,attempt_count FROM audit.outbox_messages
      WHERE topic=ANY($1::text[]) AND available_at<=now() AND (state='pending' OR (state='claimed' AND lease_expires_at<now()))
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $2`, [topics, limit]);
    const result: ClaimedMessage[] = [];
    for (const row of rows.rows) {
      const token = uuidV7();
      const attempt = Number(row.attempt_count) + 1;
      await client.query(`UPDATE audit.outbox_messages SET state='claimed',claimed_by=$2,claim_token=$3,lease_expires_at=now()+interval '30 seconds',attempt_count=$4,updated_at=now() WHERE id=$1`, [row.id, workerId, token, attempt]);
      await client.query(`INSERT INTO audit.outbox_attempts(id,message_id,attempt_number,worker_id,claim_token,outcome) VALUES($1,$2,$3,$4,$5,'started')`, [uuidV7(), row.id, attempt, workerId, token]);
      result.push({ id: row.id, workspaceId: row.workspace_id, topic: row.topic, payload: row.payload, claimToken: token, attempt });
    }
    return result;
  });
}

async function processProjection(database: PlatformDatabase, message: ClaimedMessage, workerId: string): Promise<void> {
  await database.transaction(async (client) => {
    if (Number(message.payload.schemaVersion) !== 1) throw new Error("Unsupported event schema version.");
    const consumer = message.topic === "projection.endpoint" ? "endpoint-summary" : "project-summary";
    if (!await beginInbox(client, message, consumer)) return completeOutbox(client, message, workerId);
    if (message.topic === "projection.endpoint") {
      await finishInbox(client, message, consumer, canonicalHash(message.payload.endpoint));
      return completeOutbox(client, message, workerId);
    }
    const project = message.payload.project as Record<string, unknown> | undefined;
    if (!project) throw new Error("Projection event has no project payload.");
    const current = await client.query<{ source_version: string }>("SELECT source_version FROM projection.project_summaries WHERE workspace_id=$1 AND project_id=$2 FOR UPDATE", [message.workspaceId, project.id]);
    if (current.rowCount && Number(project.version) > Number(current.rows[0].source_version) + 1) throw new Error("Projection aggregate version gap detected.");
    await client.query(`INSERT INTO projection.project_summaries(workspace_id,project_id,project_type,name,status,source_version)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(workspace_id,project_id) DO UPDATE SET
      project_type=excluded.project_type,name=excluded.name,status=excluded.status,source_version=excluded.source_version,updated_at=now()
      WHERE projection.project_summaries.source_version < excluded.source_version`, [message.workspaceId, project.id, project.type, project.name, project.status, project.version]);
    await finishInbox(client, message, consumer, canonicalHash(project));
    await completeOutbox(client, message, workerId);
  });
}

async function processOperation(database: PlatformDatabase, message: ClaimedMessage, workerId: string): Promise<void> {
  await database.transaction(async (client) => {
    if (Number(message.payload.schemaVersion) !== 1) throw new Error("Unsupported event schema version.");
    if (!await beginInbox(client, message, "foundation-operation")) return completeOutbox(client, message, workerId);
    const operationId = String(message.payload.operationId ?? "");
    const result = await client.query("SELECT * FROM core.control_plane_operations WHERE workspace_id=$1 AND id=$2 FOR UPDATE", [message.workspaceId, operationId]);
    if (!result.rowCount) throw new Error("Control-plane operation not found.");
    const operation = result.rows[0];
    const attemptId = uuidV7();
    await client.query("INSERT INTO core.control_plane_operation_attempts(id,workspace_id,operation_id,attempt_number,state) VALUES($1,$2,$3,$4,'started')", [attemptId, message.workspaceId, operationId, message.attempt]);
    await client.query("UPDATE core.control_plane_operations SET state='running',started_at=coalesce(started_at,now()),version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2", [message.workspaceId, operationId]);
    const actualHash = canonicalHash(operation.input_payload);
    if (actualHash !== operation.input_hash) throw new Error("Control-plane operation input hash mismatch.");
    await client.query("UPDATE core.control_plane_operations SET state='succeeded',result_hash=$3,completed_at=now(),version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2", [message.workspaceId, operationId, actualHash]);
    await client.query("UPDATE core.control_plane_operation_attempts SET state='succeeded',completed_at=now() WHERE id=$1", [attemptId]);
    await client.query(`INSERT INTO audit.audit_records(id,workspace_id,actor_type,actor_id,action,resource_type,resource_id,request_id,correlation_id,after_state_hash,metadata)
      VALUES($1,$2,'worker',$3,'control-plane-operation.succeeded','control-plane-operation',$4,$5,$6,$7,'{}')`, [uuidV7(), message.workspaceId, workerId, operationId, message.id, uuidV7(), actualHash]);
    await finishInbox(client, message, "foundation-operation", actualHash);
    await completeOutbox(client, message, workerId);
  });
}

async function beginInbox(client: PoolClient, message: ClaimedMessage, consumer: string): Promise<boolean> {
  const inserted = await client.query(`INSERT INTO audit.inbox_messages(workspace_id,consumer_name,message_id,processing_state)
    VALUES($1,$2,$3,'processing') ON CONFLICT DO NOTHING`, [message.workspaceId, consumer, message.id]);
  if (inserted.rowCount) return true;
  const existing = await client.query<{ processing_state: string }>("SELECT processing_state FROM audit.inbox_messages WHERE workspace_id=$1 AND consumer_name=$2 AND message_id=$3", [message.workspaceId, consumer, message.id]);
  return existing.rows[0]?.processing_state !== "completed";
}

async function finishInbox(client: PoolClient, message: ClaimedMessage, consumer: string, resultHash: string): Promise<void> {
  await client.query("UPDATE audit.inbox_messages SET processing_state='completed',result_hash=$4,completed_at=now() WHERE workspace_id=$1 AND consumer_name=$2 AND message_id=$3", [message.workspaceId, consumer, message.id, resultHash]);
}

async function completeOutbox(client: PoolClient, message: ClaimedMessage, workerId: string): Promise<void> {
  const updated = await client.query("UPDATE audit.outbox_messages SET state='published',published_at=now(),lease_expires_at=NULL,updated_at=now() WHERE id=$1 AND claim_token=$2 AND claimed_by=$3", [message.id, message.claimToken, workerId]);
  if (!updated.rowCount) throw new Error("Outbox claim was fenced by a newer worker.");
  await client.query("UPDATE audit.outbox_attempts SET outcome='published',completed_at=now() WHERE message_id=$1 AND claim_token=$2", [message.id, message.claimToken]);
}

async function fail(database: PlatformDatabase, message: ClaimedMessage, error: unknown): Promise<void> {
  const summary = error instanceof Error ? error.message.slice(0, 500) : "Unknown dispatcher error";
  await database.transaction(async (client) => {
    const dead = message.attempt >= 8;
    await client.query(`UPDATE audit.outbox_messages SET state=$3,available_at=now()+($4::text||' seconds')::interval,last_error=$5,lease_expires_at=NULL,updated_at=now()
      WHERE id=$1 AND claim_token=$2`, [message.id, message.claimToken, dead ? "dead-letter" : "pending", Math.min(300, 2 ** message.attempt), summary]);
    await client.query("UPDATE audit.outbox_attempts SET outcome='failed',error_summary=$3,completed_at=now() WHERE message_id=$1 AND claim_token=$2", [message.id, message.claimToken, summary]);
  });
}
