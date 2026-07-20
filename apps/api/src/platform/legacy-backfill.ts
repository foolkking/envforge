import type { PoolClient } from "pg";
import { assertNoSensitiveKeys, canonicalHash, uuidV7 } from "./foundation.js";
import { PlatformDatabase } from "./postgres.js";

export interface LegacyFoundationSession { id: string; userId?: string; name?: string; status?: string }
export interface BackfillItem { sourceId: string; sourceHash: string; state: "ready" | "imported" | "existing" | "rejected"; targetId?: string; reason?: string }

export function planLegacyFoundationBackfill(sessions: LegacyFoundationSession[]): BackfillItem[] {
  return [...sessions].sort((a, b) => a.id.localeCompare(b.id)).map((session) => {
    const normalized = { id: session.id, userId: session.userId, name: session.name, status: session.status };
    if (!session.id) return { sourceId: "<missing>", sourceHash: canonicalHash(normalized), state: "rejected", reason: "missing source id" };
    if (!session.userId) return { sourceId: session.id, sourceHash: canonicalHash(normalized), state: "rejected", reason: "missing user owner" };
    assertNoSensitiveKeys(normalized);
    return { sourceId: session.id, sourceHash: canonicalHash(normalized), state: "ready" };
  });
}

export async function applyLegacyFoundationBackfill(database: PlatformDatabase, sessions: LegacyFoundationSession[]): Promise<BackfillItem[]> {
  const planned = planLegacyFoundationBackfill(sessions);
  const byId = new Map(sessions.map((session) => [session.id, session]));
  const results: BackfillItem[] = [];
  for (const item of planned) {
    if (item.state === "rejected") { results.push(item); continue; }
    const session = byId.get(item.sourceId)!;
    results.push(await database.transaction((client) => importOne(client, session, item.sourceHash)));
  }
  return results;
}

async function importOne(client: PoolClient, session: LegacyFoundationSession, sourceHash: string): Promise<BackfillItem> {
  const existing = await client.query<{ source_hash: string; target_id: string }>("SELECT source_hash,target_id FROM platform.legacy_backfill_items WHERE source_type='migration-session' AND source_id=$1 FOR UPDATE", [session.id]);
  if (existing.rowCount) {
    if (existing.rows[0].source_hash !== sourceHash) return { sourceId: session.id, sourceHash, state: "rejected", reason: "source changed after import" };
    return { sourceId: session.id, sourceHash, state: "existing", targetId: existing.rows[0].target_id };
  }
  const membership = await client.query<{ workspace_id: string }>("SELECT workspace_id FROM core.workspace_memberships WHERE actor_id=$1 ORDER BY created_at LIMIT 1", [session.userId]);
  let workspaceId = membership.rows[0]?.workspace_id;
  if (!workspaceId) {
    workspaceId = uuidV7();
    await client.query("INSERT INTO core.workspaces(id,slug,name,status) VALUES($1,$2,$3,'active')", [workspaceId, `legacy-${canonicalHash(session.userId).slice(0, 20)}`, "Imported workspace"]);
    await client.query("INSERT INTO core.workspace_memberships(workspace_id,actor_id,role) VALUES($1,$2,'owner')", [workspaceId, session.userId]);
  }
  const projectId = uuidV7();
  await client.query(`INSERT INTO core.projects(id,workspace_id,project_type,name,status,legacy_source_type,legacy_source_id)
    VALUES($1,$2,'migration',$3,'draft','migration-session',$4)`, [projectId, workspaceId, session.name?.trim() || `Imported migration ${session.id}`, session.id]);
  await client.query(`INSERT INTO platform.legacy_backfill_items(source_type,source_id,source_hash,workspace_id,target_type,target_id,state)
    VALUES('migration-session',$1,$2,$3,'project',$4,'imported')`, [session.id, sourceHash, workspaceId, projectId]);
  await client.query(`INSERT INTO audit.audit_records(id,workspace_id,actor_type,actor_id,action,resource_type,resource_id,request_id,correlation_id,after_state_hash,metadata)
    VALUES($1,$2,'system','legacy-backfill','legacy.project.imported','project',$3,$4,$5,$6,$7)`, [uuidV7(), workspaceId, projectId, `backfill:${session.id}`, uuidV7(), sourceHash, { sourceType: "migration-session", sourceId: session.id }]);
  return { sourceId: session.id, sourceHash, state: "imported", targetId: projectId };
}
