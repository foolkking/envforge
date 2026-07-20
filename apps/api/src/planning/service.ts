import type { PoolClient } from "pg";
import { PlatformDatabase } from "../platform/postgres.js";
import { canonicalHash, uuidV7 } from "../platform/foundation.js";
import { PlatformConflictError, PlatformNotFoundError, PlatformPreconditionError } from "../platform/service.js";
import { compilePlan, type CompilerInput } from "./compiler.js";
import {
  BLUEPRINT_SCHEMA_VERSION, COMPILER_VERSION, DECISION_SCHEMA_VERSION, evaluateReadiness, assertPlanningSafe, validateBlueprint,
  type BlueprintContent, type CanonicalPlan, type DecisionContent, type PlanningMode
} from "./model.js";

export interface PlanningContext { actorId: string; workspaceId: string; requestId: string; correlationId: string; idempotencyKey: string }
export interface WorkloadRecord { id: string; workspaceId: string; name: string; kind: string; lifecycleStatus: string; currentBlueprintRevisionId?: string; version: number }
export interface BlueprintRecord { id: string; workloadId: string; revision: number; status: string; origin: string; schemaVersion: string; content: BlueprintContent; contentHash: string; version: number }
export interface DecisionRecord { id: string; projectId: string; revision: number; schemaVersion: string; content: DecisionContent; contentHash: string }
export interface PlanRecord { id: string; projectId: string; revision: number; planType: PlanningMode; status: string; schemaVersion: string; canonicalContent: CanonicalPlan; planHash: string; version: number }
export interface ApprovalRecord { id: string; planRevisionId: string; approvedPlanHash: string; approvalHash: string; status: string; version: number; requestedBy: string; decidedBy?: string; expiresAt?: string }

const PROJECT_TRANSITIONS: Record<string, Record<string, string[]>> = {
  assessment: { created: ["collecting","closed"], collecting: ["reviewing"], reviewing: ["assessed"], assessed: ["closed"] },
  build: { created: ["defining"], defining: ["target-review"], "target-review": ["planning"], planning: ["approved"], approved: ["executable"], executable: ["completed"] },
  migration: { created: ["endpoints-bound"], "endpoints-bound": ["assessing"], assessing: ["workload-review"], "workload-review": ["target-review"], "target-review": ["planning"], planning: ["approved"], approved: ["executable"], executable: ["completed"] },
  capture: { created: ["assessing"], assessing: ["workload-review"], "workload-review": ["planning"], planning: ["approved"], approved: ["capturable"], capturable: ["archived"] },
  restore: { created: ["archive-bound"], "archive-bound": ["target-review"], "target-review": ["planning"], planning: ["approved"], approved: ["restorable"], restorable: ["restored"] }
};

export class PlanningService {
  constructor(readonly database: PlatformDatabase) {}

  async transitionProject(context: PlanningContext, projectId: string, expectedVersion: number, target: string) {
    return this.database.transaction(async (client) => {
      const replay = await claimIdempotency(client, context, "TransitionProject", canonicalHash({ projectId, expectedVersion, target }));
      if (replay) return replay;
      const result = await client.query("SELECT * FROM core.projects WHERE workspace_id=$1 AND id=$2 FOR UPDATE", [context.workspaceId, projectId]);
      if (!result.rowCount) throw new PlatformNotFoundError("Project not found.");
      const row = result.rows[0];
      if (Number(row.version) !== expectedVersion) throw new PlatformPreconditionError("Project version does not match If-Match.");
      const from = row.status === "draft" ? "created" : String(row.status);
      if (!(PROJECT_TRANSITIONS[String(row.project_type)]?.[from] ?? []).includes(target)) throw new PlatformConflictError(`Illegal ${row.project_type} project transition: ${from} -> ${target}.`);
      const updated = await client.query("UPDATE core.projects SET status=$3,version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2 RETURNING *", [context.workspaceId, projectId, target]);
      const project = mapProject(updated.rows[0]);
      await appendRecords(client, context, "project", project.id, project.version, "project.state-transitioned", { projectId, from, to: target });
      await completeIdempotency(client, context, "TransitionProject", project, "project", project.id);
      return project;
    });
  }

  async createProjectLink(context: PlanningContext, fromProjectId: string, toProjectId: string, linkType: "derived-from" | "restores-archive" | "retries" | "repairs") {
    return this.database.transaction(async (client) => {
      const input = { fromProjectId, toProjectId, linkType };
      const replay = await claimIdempotency(client, context, "CreateProjectLink", canonicalHash(input));
      if (replay) return replay;
      await client.query("INSERT INTO core.project_links(workspace_id,from_project_id,to_project_id,link_type) VALUES($1,$2,$3,$4)", [context.workspaceId, fromProjectId, toProjectId, linkType]);
      await appendRecords(client, context, "project", toProjectId, 0, "project.linked", input);
      await completeIdempotency(client, context, "CreateProjectLink", input, "project-link", toProjectId);
      return input;
    });
  }

  async createWorkload(context: PlanningContext, projectId: string, input: { name: string; kind: string; ownerRef?: string; tags?: string[] }): Promise<WorkloadRecord> {
    assertPlanningSafe(input);
    const name = input.name.trim(); if (!name || !input.kind.trim()) throw new Error("Workload name and kind are required.");
    return this.database.transaction(async (client) => {
      const replay = await claimIdempotency(client, context, "CreateWorkload", canonicalHash({ projectId, ...input }));
      if (replay) return replay as WorkloadRecord;
      await requireProject(client, context.workspaceId, projectId, true);
      const id = uuidV7();
      const result = await client.query(`INSERT INTO workload.workloads(id,workspace_id,name,kind,owner_ref,tags,lifecycle_status)
        VALUES($1,$2,$3,$4,$5,$6,'active') RETURNING *`, [id, context.workspaceId, name, input.kind.trim(), input.ownerRef ?? null, input.tags ?? []]);
      await client.query("INSERT INTO workload.project_workloads(workspace_id,project_id,workload_id) VALUES($1,$2,$3)", [context.workspaceId, projectId, id]);
      const workload = mapWorkload(result.rows[0]);
      await appendRecords(client, context, "workload", id, 0, "workload.created", { workload, projectId });
      await completeIdempotency(client, context, "CreateWorkload", workload, "workload", id);
      return workload;
    });
  }

  async listWorkloads(workspaceId: string, projectId?: string): Promise<WorkloadRecord[]> {
    const result = projectId
      ? await this.database.pool.query(`SELECT w.* FROM workload.workloads w JOIN workload.project_workloads pw ON pw.workspace_id=w.workspace_id AND pw.workload_id=w.id WHERE w.workspace_id=$1 AND pw.project_id=$2 ORDER BY w.created_at,w.id`, [workspaceId, projectId])
      : await this.database.pool.query("SELECT * FROM workload.workloads WHERE workspace_id=$1 ORDER BY created_at,id", [workspaceId]);
    return result.rows.map(mapWorkload);
  }

  async getWorkload(workspaceId: string, workloadId: string): Promise<WorkloadRecord> {
    const result = await this.database.pool.query("SELECT * FROM workload.workloads WHERE workspace_id=$1 AND id=$2", [workspaceId, workloadId]);
    if (!result.rowCount) throw new PlatformNotFoundError("Workload not found.");
    return mapWorkload(result.rows[0]);
  }

  async createPlacement(context: PlanningContext, input: { workloadId: string; projectId?: string; endpointId?: string; archiveRefId?: string; placementType: "source"|"target"|"active"|"standby"|"archived"|"restored"; authorityState: "none"|"source"|"target"|"committed"|"historical" }) {
    if (!input.endpointId && !input.archiveRefId) throw new Error("Placement requires an endpoint or archive reference.");
    return this.database.transaction(async (client) => {
      const replay = await claimIdempotency(client, context, "CreatePlacement", canonicalHash(input)); if (replay) return replay;
      await client.query("SELECT id FROM workload.workloads WHERE workspace_id=$1 AND id=$2 FOR UPDATE", [context.workspaceId, input.workloadId]).then((result) => { if (!result.rowCount) throw new PlatformNotFoundError("Workload not found."); });
      const result = await client.query(`INSERT INTO workload.workload_placements(id,workspace_id,workload_id,project_id,endpoint_id,archive_ref_id,placement_type,authority_state)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [uuidV7(), context.workspaceId, input.workloadId, input.projectId ?? null, input.endpointId ?? null, input.archiveRefId ?? null, input.placementType, input.authorityState]);
      const placement = mapPlacement(result.rows[0]); await appendRecords(client, context, "workload", input.workloadId, 0, "workload.placement-created", placement); await completeIdempotency(client, context, "CreatePlacement", placement, "workload-placement", placement.id); return placement;
    });
  }

  async createMigrationEstimate(context: PlanningContext, input: { projectId: string; estimate: Record<string, unknown>; confidence: "low"|"medium"|"high"; calculatedAt: string; expiresAt: string }) {
    assertPlanningSafe(input); const calculatedAt = new Date(input.calculatedAt); const expiresAt = new Date(input.expiresAt); if (!(expiresAt > calculatedAt)) throw new Error("Migration estimate must expire after calculation.");
    return this.database.transaction(async (client) => {
      const contentHash = canonicalHash(input.estimate); const replay = await claimIdempotency(client, context, "CreateMigrationEstimate", canonicalHash({ ...input, contentHash })); if (replay) return replay;
      await requireProject(client, context.workspaceId, input.projectId, true); const revision = await client.query<{value:number}>("SELECT coalesce(max(version),0)+1 value FROM planning.migration_estimates WHERE project_id=$1", [input.projectId]); const result = await client.query(`INSERT INTO planning.migration_estimates(id,workspace_id,project_id,version,input_hash,estimate,confidence,calculated_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [uuidV7(),context.workspaceId,input.projectId,revision.rows[0].value,contentHash,input.estimate,input.confidence,calculatedAt,expiresAt]); const estimate=mapEstimate(result.rows[0]); await appendRecords(client,context,"project",input.projectId,0,"migration-estimate.created",estimate); await completeIdempotency(client,context,"CreateMigrationEstimate",estimate,"migration-estimate",estimate.id); return estimate;
    });
  }

  async createBlueprintDraft(context: PlanningContext, workloadId: string, content: BlueprintContent, origin: "manual" | "legacy-import" | "update-proposal" = "manual"): Promise<BlueprintRecord> {
    validateBlueprint(content);
    const contentHash = canonicalHash(content);
    return this.database.transaction(async (client) => {
      const replay = await claimIdempotency(client, context, "CreateBlueprintDraft", canonicalHash({ workloadId, contentHash, origin }));
      if (replay) return replay as BlueprintRecord;
      await client.query("SELECT id FROM workload.workloads WHERE workspace_id=$1 AND id=$2 FOR UPDATE", [context.workspaceId, workloadId]).then((result) => { if (!result.rowCount) throw new PlatformNotFoundError("Workload not found."); });
      const revisionResult = await client.query<{ revision: number }>("SELECT coalesce(max(revision),0)+1 revision FROM workload.blueprint_revisions WHERE workload_id=$1", [workloadId]);
      const id = uuidV7();
      const result = await client.query(`INSERT INTO workload.blueprint_revisions
        (id,workspace_id,workload_id,revision,status,origin,schema_version,content,content_hash,created_by)
        VALUES($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9) RETURNING *`, [id, context.workspaceId, workloadId, revisionResult.rows[0].revision, origin, BLUEPRINT_SCHEMA_VERSION, content, contentHash, context.actorId]);
      const blueprint = mapBlueprint(result.rows[0]);
      await appendRecords(client, context, "blueprint", id, 0, "blueprint.draft-created", { blueprintId: id, workloadId, revision: blueprint.revision, contentHash });
      await completeIdempotency(client, context, "CreateBlueprintDraft", blueprint, "blueprint-revision", id);
      return blueprint;
    });
  }

  async confirmBlueprint(context: PlanningContext, blueprintId: string, expectedVersion: number): Promise<BlueprintRecord> {
    return this.database.transaction(async (client) => {
      const replay = await claimIdempotency(client, context, "ConfirmBlueprint", canonicalHash({ blueprintId, expectedVersion }));
      if (replay) return replay as BlueprintRecord;
      const result = await client.query("SELECT * FROM workload.blueprint_revisions WHERE workspace_id=$1 AND id=$2 FOR UPDATE", [context.workspaceId, blueprintId]);
      if (!result.rowCount) throw new PlatformNotFoundError("Blueprint not found.");
      const row = result.rows[0];
      if (row.status !== "draft") throw new PlatformConflictError("Only draft Blueprint revisions can be confirmed.");
      if (Number(row.version) !== expectedVersion) throw new PlatformPreconditionError("Blueprint version does not match If-Match.");
      validateBlueprint(row.content);
      await client.query("UPDATE workload.blueprint_revisions SET status='superseded' WHERE workspace_id=$1 AND workload_id=$2 AND status='confirmed'", [context.workspaceId, row.workload_id]);
      const updated = await client.query("UPDATE workload.blueprint_revisions SET status='confirmed',confirmed_at=now(),version=version+1 WHERE workspace_id=$1 AND id=$2 RETURNING *", [context.workspaceId, blueprintId]);
      await client.query("UPDATE workload.workloads SET current_blueprint_revision_id=$3,version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2", [context.workspaceId, row.workload_id, blueprintId]);
      const blueprint = mapBlueprint(updated.rows[0]);
      await appendRecords(client, context, "blueprint", blueprintId, blueprint.version, "blueprint.confirmed", { blueprintId, workloadId: row.workload_id, contentHash: blueprint.contentHash });
      await completeIdempotency(client, context, "ConfirmBlueprint", blueprint, "blueprint-revision", blueprintId);
      return blueprint;
    });
  }

  async getBlueprint(workspaceId: string, blueprintId: string): Promise<BlueprintRecord> {
    const result = await this.database.pool.query("SELECT * FROM workload.blueprint_revisions WHERE workspace_id=$1 AND id=$2", [workspaceId, blueprintId]);
    if (!result.rowCount) throw new PlatformNotFoundError("Blueprint not found.");
    return mapBlueprint(result.rows[0]);
  }

  async listBlueprints(workspaceId: string, workloadId: string): Promise<BlueprintRecord[]> {
    const result = await this.database.pool.query("SELECT * FROM workload.blueprint_revisions WHERE workspace_id=$1 AND workload_id=$2 ORDER BY revision", [workspaceId, workloadId]);
    return result.rows.map(mapBlueprint);
  }

  async evaluateBlueprintReadiness(context: PlanningContext, blueprintId: string, mode: PlanningMode) {
    const blueprint = await this.getBlueprint(context.workspaceId, blueprintId);
    if (blueprint.status !== "confirmed") throw new PlatformConflictError("Planner consumes only confirmed Blueprint revisions.");
    const evaluated = evaluateReadiness(blueprint.content, mode);
    const inputHash = canonicalHash({ blueprintId, blueprintHash: blueprint.contentHash, mode });
    return this.database.transaction(async (client) => {
      const current = await client.query("SELECT * FROM workload.blueprint_readiness_results WHERE blueprint_revision_id=$1 AND mode=$2 AND evaluated_input_hash=$3", [blueprintId, mode, inputHash]);
      if (current.rowCount) return mapReadiness(current.rows[0]);
      const id = uuidV7();
      const result = await client.query(`INSERT INTO workload.blueprint_readiness_results(id,workspace_id,blueprint_revision_id,mode,status,evaluated_input_hash,result)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [id, context.workspaceId, blueprintId, mode, evaluated.status, inputHash, evaluated]);
      await appendRecords(client, context, "blueprint", blueprintId, blueprint.version, "blueprint.readiness-evaluated", { blueprintId, mode, ...evaluated, inputHash });
      return mapReadiness(result.rows[0]);
    });
  }

  async createDecisionSet(context: PlanningContext, projectId: string, content: DecisionContent): Promise<DecisionRecord> {
    assertPlanningSafe(content);
    for (const acceptance of content.riskAcceptances ?? []) if (acceptance.riskId.startsWith("hard-blocker:")) throw new PlatformConflictError("Hard blockers cannot be risk-accepted.");
    const contentHash = canonicalHash(content);
    return this.database.transaction(async (client) => {
      const replay = await claimIdempotency(client, context, "CreateDecisionSet", canonicalHash({ projectId, contentHash }));
      if (replay) return replay as DecisionRecord;
      await requireProject(client, context.workspaceId, projectId, true);
      const revision = await client.query<{ value: number }>("SELECT coalesce(max(revision),0)+1 value FROM planning.decision_set_revisions WHERE project_id=$1", [projectId]);
      const id = uuidV7();
      const result = await client.query(`INSERT INTO planning.decision_set_revisions(id,workspace_id,project_id,revision,schema_version,content,content_hash,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [id, context.workspaceId, projectId, revision.rows[0].value, DECISION_SCHEMA_VERSION, content, contentHash, context.actorId]);
      await client.query("UPDATE core.projects SET current_decision_set_revision_id=$3,version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2", [context.workspaceId, projectId, id]);
      const decision = mapDecision(result.rows[0]);
      await appendRecords(client, context, "decision-set", id, decision.revision, "decision-set.created", { decisionSetId: id, projectId, revision: decision.revision, contentHash });
      await completeIdempotency(client, context, "CreateDecisionSet", decision, "decision-set-revision", id);
      return decision;
    });
  }

  async getDecisionSet(workspaceId: string, id: string): Promise<DecisionRecord> {
    const result = await this.database.pool.query("SELECT * FROM planning.decision_set_revisions WHERE workspace_id=$1 AND id=$2", [workspaceId, id]);
    if (!result.rowCount) throw new PlatformNotFoundError("DecisionSet revision not found.");
    return mapDecision(result.rows[0]);
  }

  async listDecisionSets(workspaceId: string, projectId: string): Promise<DecisionRecord[]> {
    const result = await this.database.pool.query("SELECT * FROM planning.decision_set_revisions WHERE workspace_id=$1 AND project_id=$2 ORDER BY revision", [workspaceId, projectId]);
    return result.rows.map(mapDecision);
  }

  async requestCompilation(context: PlanningContext, input: Omit<CompilerInput, "blueprints" | "decision"> & { blueprintRevisionIds: string[]; decisionSetRevisionId: string }): Promise<string> {
    assertPlanningSafe(input);
    const normalized = { ...input, blueprintRevisionIds: [...new Set(input.blueprintRevisionIds)].sort() };
    const inputHash = canonicalHash(normalized);
    return this.database.transaction(async (client) => {
      await requireProject(client, context.workspaceId, input.projectId, true);
      const existing = await client.query<{ id: string }>("SELECT id FROM core.control_plane_operations WHERE workspace_id=$1 AND deduplication_key=$2", [context.workspaceId, `${context.idempotencyKey}:${inputHash}`]);
      if (existing.rowCount) return existing.rows[0].id;
      const operationId = uuidV7(); const runId = uuidV7();
      await client.query(`INSERT INTO core.control_plane_operations(id,workspace_id,project_id,operation_type,state,input_hash,input_payload,deduplication_key)
        VALUES($1,$2,$3,'plan-compilation','queued',$4,$5,$6)`, [operationId, context.workspaceId, input.projectId, inputHash, normalized, `${context.idempotencyKey}:${inputHash}`]);
      await client.query(`INSERT INTO planning.plan_compilation_runs(id,workspace_id,operation_id,project_id,phase,input_hash,compiler_version)
        VALUES($1,$2,$3,$4,'validating-inputs',$5,$6)`, [runId, context.workspaceId, operationId, input.projectId, inputHash, COMPILER_VERSION]);
      await appendRecords(client, context, "plan-compilation", operationId, 0, "plan-compilation.queued", { operationId, projectId: input.projectId }, "planning.compilation.requested");
      return operationId;
    });
  }

  async getCompilation(workspaceId: string, operationId: string) {
    const result = await this.database.pool.query(`SELECT o.id,o.state,o.version,o.error_code,o.error_summary,r.phase,r.outcome,r.diagnostics,r.result_plan_revision_id
      FROM core.control_plane_operations o JOIN planning.plan_compilation_runs r ON r.workspace_id=o.workspace_id AND r.operation_id=o.id
      WHERE o.workspace_id=$1 AND o.id=$2`, [workspaceId, operationId]);
    if (!result.rowCount) throw new PlatformNotFoundError("Plan compilation not found.");
    return mapCompilation(result.rows[0]);
  }

  async getPlan(workspaceId: string, planId: string): Promise<PlanRecord> {
    const result = await this.database.pool.query("SELECT * FROM planning.plan_revisions WHERE workspace_id=$1 AND id=$2", [workspaceId, planId]);
    if (!result.rowCount) throw new PlatformNotFoundError("Plan revision not found.");
    return mapPlan(result.rows[0]);
  }

  async listPlans(workspaceId: string, projectId: string): Promise<PlanRecord[]> {
    const result = await this.database.pool.query("SELECT * FROM planning.plan_revisions WHERE workspace_id=$1 AND project_id=$2 ORDER BY revision", [workspaceId, projectId]);
    return result.rows.map(mapPlan);
  }

  async submitForApproval(context: PlanningContext, planId: string, expectedVersion: number): Promise<ApprovalRecord> {
    return this.database.transaction(async (client) => {
      const replay = await claimIdempotency(client, context, "SubmitPlanApproval", canonicalHash({ planId, expectedVersion }));
      if (replay) return replay as ApprovalRecord;
      const result = await client.query("SELECT * FROM planning.plan_revisions WHERE workspace_id=$1 AND id=$2 FOR UPDATE", [context.workspaceId, planId]);
      if (!result.rowCount) throw new PlatformNotFoundError("Plan not found.");
      const plan = result.rows[0];
      if (plan.status !== "compiled") throw new PlatformConflictError("Only compiled Plans can be submitted for approval.");
      if (Number(plan.version) !== expectedVersion) throw new PlatformPreconditionError("Plan version does not match If-Match.");
      const hard = await client.query("SELECT 1 FROM planning.plan_risks WHERE workspace_id=$1 AND plan_revision_id=$2 AND hard_blocker", [context.workspaceId, planId]);
      if (hard.rowCount) throw new PlatformConflictError("Hard blockers prevent approval.");
      const approvalId = uuidV7();
      const approvalHash = canonicalHash({ planId, planHash: plan.plan_hash, policy: "planning-approval-v1", requestedBy: context.actorId });
      const approval = await client.query(`INSERT INTO planning.plan_approvals
        (id,workspace_id,plan_revision_id,approved_plan_hash,approval_hash,status,approval_policy_id,requested_by,expires_at)
        VALUES($1,$2,$3,$4,$5,'pending','planning-approval-v1',$6,now()+interval '24 hours') RETURNING *`, [approvalId, context.workspaceId, planId, plan.plan_hash, approvalHash, context.actorId]);
      await client.query("UPDATE planning.plan_revisions SET status='approval-pending',version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2", [context.workspaceId, planId]);
      const record = mapApproval(approval.rows[0]);
      await appendRecords(client, context, "plan-approval", approvalId, 0, "plan-approval.submitted", { approvalId, planId, planHash: plan.plan_hash, approvalHash });
      await completeIdempotency(client, context, "SubmitPlanApproval", record, "plan-approval", approvalId);
      return record;
    });
  }

  async decideApproval(context: PlanningContext, approvalId: string, expectedVersion: number, decision: "approved" | "rejected" | "revoked", reason: string, acceptedRiskIds: string[] = []): Promise<ApprovalRecord> {
    assertPlanningSafe({ reason });
    return this.database.transaction(async (client) => {
      const replay = await claimIdempotency(client, context, `DecideApproval:${decision}`, canonicalHash({ approvalId, expectedVersion, decision, reason, acceptedRiskIds: [...acceptedRiskIds].sort() }));
      if (replay) return replay as ApprovalRecord;
      const result = await client.query(`SELECT a.*,p.plan_hash,p.status plan_status FROM planning.plan_approvals a JOIN planning.plan_revisions p ON p.workspace_id=a.workspace_id AND p.id=a.plan_revision_id
        WHERE a.workspace_id=$1 AND a.id=$2 FOR UPDATE OF a,p`, [context.workspaceId, approvalId]);
      if (!result.rowCount) throw new PlatformNotFoundError("Approval not found.");
      const row = result.rows[0];
      if (Number(row.version) !== expectedVersion) throw new PlatformPreconditionError("Approval version does not match If-Match.");
      if (decision === "approved") {
        if (row.status !== "pending" || row.plan_status !== "approval-pending") throw new PlatformConflictError("Approval is not pending.");
        if (row.requested_by === context.actorId) throw new PlatformConflictError("Separation of duties requires a different approver.");
        if (row.approved_plan_hash !== row.plan_hash) throw new PlatformConflictError("Plan hash no longer matches the approval request.");
        const risks = await client.query<{ risk_key: string; hard_blocker: boolean }>("SELECT risk_key,hard_blocker FROM planning.plan_risks WHERE workspace_id=$1 AND plan_revision_id=$2", [context.workspaceId, row.plan_revision_id]);
        if (risks.rows.some((risk) => risk.hard_blocker)) throw new PlatformConflictError("Hard blockers cannot be approved.");
        const required = risks.rows.filter((risk) => !risk.hard_blocker).map((risk) => risk.risk_key);
        if (required.some((risk) => !acceptedRiskIds.includes(risk))) throw new PlatformConflictError("All review risks must be explicitly accepted.");
      } else if (decision === "revoked" ? row.status !== "approved" : row.status !== "pending") throw new PlatformConflictError(`Approval cannot be ${decision} from ${row.status}.`);
      const updated = await client.query(`UPDATE planning.plan_approvals SET status=$3,accepted_risk_ids=$4::jsonb,decided_by=$5,reason=$6,decided_at=now(),version=version+1
        WHERE workspace_id=$1 AND id=$2 RETURNING *`, [context.workspaceId, approvalId, decision, JSON.stringify(acceptedRiskIds), context.actorId, reason]);
      const planStatus = decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "revoked";
      await client.query("UPDATE planning.plan_revisions SET status=$3,version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2", [context.workspaceId, row.plan_revision_id, planStatus]);
      const record = mapApproval(updated.rows[0]);
      await appendRecords(client, context, "plan-approval", approvalId, record.version, `plan-approval.${decision}`, { approvalId, planId: row.plan_revision_id, planHash: row.plan_hash, reason });
      await completeIdempotency(client, context, `DecideApproval:${decision}`, record, "plan-approval", approvalId);
      return record;
    });
  }

  async evaluateMaterialDrift(workspaceId: string, planId: string, currentBindings: Array<{ type: string; key: string; hash: string }>) {
    const stored = await this.database.pool.query("SELECT binding_type,binding_key,resource_hash FROM planning.plan_input_bindings WHERE workspace_id=$1 AND plan_revision_id=$2 ORDER BY binding_type,binding_key", [workspaceId, planId]);
    if (!stored.rowCount) throw new PlatformNotFoundError("Plan input bindings not found.");
    const expected = stored.rows.map((row) => ({ type: row.binding_type, key: row.binding_key, hash: row.resource_hash }));
    const actual = [...currentBindings].sort((a,b) => `${a.type}:${a.key}`.localeCompare(`${b.type}:${b.key}`));
    return { materialDrift: canonicalHash(expected) !== canonicalHash(actual), expectedHash: canonicalHash(expected), actualHash: canonicalHash(actual), recompileRequired: canonicalHash(expected) !== canonicalHash(actual) };
  }
}

export async function processPlanCompilation(database: PlatformDatabase, workspaceId: string, operationId: string, actorId = "plan-compiler-worker"): Promise<void> {
  await database.transaction(async (client) => {
    const operation = await client.query("SELECT * FROM core.control_plane_operations WHERE workspace_id=$1 AND id=$2 FOR UPDATE", [workspaceId, operationId]);
    if (!operation.rowCount) throw new PlatformNotFoundError("Plan compilation operation not found.");
    if (operation.rows[0].state === "succeeded") return;
    const payload = operation.rows[0].input_payload as Omit<CompilerInput,"blueprints"|"decision"> & { blueprintRevisionIds: string[]; decisionSetRevisionId: string };
    if (canonicalHash(payload) !== operation.rows[0].input_hash) throw new Error("Plan compilation input hash mismatch.");
    await client.query("UPDATE core.control_plane_operations SET state='running',started_at=coalesce(started_at,now()),version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2", [workspaceId, operationId]);
    await client.query("UPDATE planning.plan_compilation_runs SET phase='resolving-graph' WHERE workspace_id=$1 AND operation_id=$2", [workspaceId, operationId]);
    const blueprintsResult = await client.query("SELECT * FROM workload.blueprint_revisions WHERE workspace_id=$1 AND id=ANY($2::uuid[]) ORDER BY id", [workspaceId, payload.blueprintRevisionIds]);
    if (blueprintsResult.rowCount !== payload.blueprintRevisionIds.length || blueprintsResult.rows.some((row) => row.status !== "confirmed")) throw new Error("All bound Blueprint revisions must exist and be confirmed.");
    const decisionResult = await client.query("SELECT * FROM planning.decision_set_revisions WHERE workspace_id=$1 AND id=$2", [workspaceId, payload.decisionSetRevisionId]);
    if (!decisionResult.rowCount) throw new Error("Bound DecisionSet revision does not exist.");
    const input: CompilerInput = {
      ...payload,
      blueprints: blueprintsResult.rows.map((row) => ({ id: row.id, workloadId: row.workload_id, hash: row.content_hash, content: row.content })),
      decision: { id: decisionResult.rows[0].id, hash: decisionResult.rows[0].content_hash, content: decisionResult.rows[0].content }
    };
    await client.query("UPDATE planning.plan_compilation_runs SET phase='compiling-contracts' WHERE workspace_id=$1 AND operation_id=$2", [workspaceId, operationId]);
    const compiled = compilePlan(input);
    if (compiled.outcome === "blocked") {
      await client.query("UPDATE planning.plan_compilation_runs SET phase='finalizing',outcome='blocked',diagnostics=$3,completed_at=now() WHERE workspace_id=$1 AND operation_id=$2", [workspaceId, operationId, compiled.diagnostics]);
      await client.query("UPDATE core.control_plane_operations SET state='succeeded',result_hash=$3,completed_at=now(),version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2", [workspaceId, operationId, canonicalHash(compiled)]);
      return;
    }
    const revision = await client.query<{ value: number }>("SELECT coalesce(max(revision),0)+1 value FROM planning.plan_revisions WHERE project_id=$1", [payload.projectId]);
    const planId = uuidV7(); const run = await client.query<{ id: string }>("SELECT id FROM planning.plan_compilation_runs WHERE workspace_id=$1 AND operation_id=$2", [workspaceId, operationId]);
    await client.query(`INSERT INTO planning.plan_revisions(id,workspace_id,project_id,compilation_run_id,revision,plan_type,status,schema_version,canonical_content,plan_hash)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [planId, workspaceId, payload.projectId, run.rows[0].id, revision.rows[0].value, payload.mode, compiled.outcome, compiled.plan.schemaVersion, compiled.plan, compiled.hash]);
    const stageIds = new Map<string,string>();
    for (const stage of compiled.plan.stages) { const id=uuidV7(); stageIds.set(stage.key,id); await client.query("INSERT INTO planning.plan_stages(id,workspace_id,plan_revision_id,stage_key,sequence,required) VALUES($1,$2,$3,$4,$5,$6)",[id,workspaceId,planId,stage.key,stage.sequence,stage.required]); }
    for (const binding of compiled.plan.bindings) await client.query(`INSERT INTO planning.plan_input_bindings(workspace_id,plan_revision_id,binding_type,binding_key,resource_id,resource_hash,metadata)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,[workspaceId,planId,binding.type,binding.key,isUuid(binding.id)?binding.id:null,binding.hash,binding.metadata??{}]);
    for (const action of compiled.plan.actions) await client.query(`INSERT INTO planning.plan_actions
      (id,workspace_id,plan_revision_id,stage_id,action_key,action_type,adapter_id,adapter_version,implementation_hash,inputs,preconditions,postconditions,resource_keys,verification_check_ids,retry_policy,recovery_contract,rollback_definition,resumability,risk_level,trace)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,$17,$18,$19,$20)`,[action.id,workspaceId,planId,stageIds.get(action.stageKey),action.key,action.type,action.adapterId,action.adapterVersion,action.implementationHash,action.inputs,JSON.stringify(action.preconditions),JSON.stringify(action.postconditions),JSON.stringify(action.resourceKeys),JSON.stringify(action.verificationCheckIds),action.retryPolicy,action.recoveryContract,action.rollbackDefinition??null,action.resumability,action.riskLevel,action.trace]);
    for (const edge of compiled.plan.dependencies) await client.query("INSERT INTO planning.plan_action_dependencies(workspace_id,plan_revision_id,from_action_id,to_action_id,dependency_type) VALUES($1,$2,$3,$4,$5)",[workspaceId,planId,edge.fromActionId,edge.toActionId,edge.type]);
    for (const contract of compiled.plan.contracts) await client.query("INSERT INTO planning.plan_contracts(id,workspace_id,plan_revision_id,contract_type,contract_key,content,content_hash) VALUES($1,$2,$3,$4,$5,$6,$7)",[uuidV7(),workspaceId,planId,contract.type,contract.key,contract.content,contract.hash]);
    for (const gate of compiled.plan.gates) await client.query("INSERT INTO planning.plan_gates(id,workspace_id,plan_revision_id,gate_key,gate_type,required,definition) VALUES($1,$2,$3,$4,$5,$6,$7)",[uuidV7(),workspaceId,planId,gate.key,gate.type,gate.required,gate.definition]);
    for (const risk of compiled.plan.risks) await client.query("INSERT INTO planning.plan_risks(id,workspace_id,plan_revision_id,risk_key,severity,hard_blocker,content) VALUES($1,$2,$3,$4,$5,$6,$7)",[uuidV7(),workspaceId,planId,risk.key,risk.severity,risk.hardBlocker,risk.content]);
    await client.query("UPDATE planning.plan_compilation_runs SET phase='finalizing',outcome=$3,result_plan_revision_id=$4,diagnostics=$5,completed_at=now() WHERE workspace_id=$1 AND operation_id=$2",[workspaceId,operationId,compiled.outcome,planId,{ actionCount: compiled.plan.actions.length, planHash: compiled.hash }]);
    await client.query("UPDATE core.projects SET current_plan_revision_id=$3,version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2",[workspaceId,payload.projectId,planId]);
    await client.query("UPDATE core.control_plane_operations SET state='succeeded',result_hash=$3,completed_at=now(),version=version+1,updated_at=now() WHERE workspace_id=$1 AND id=$2",[workspaceId,operationId,compiled.hash]);
    const context: PlanningContext={actorId,workspaceId,requestId:operationId,correlationId:uuidV7(),idempotencyKey:`worker:${operationId}`};
    await appendRecords(client,context,"plan",planId,0,"plan.compiled",{planId,projectId:payload.projectId,planHash:compiled.hash,outcome:compiled.outcome});
  });
}

async function requireProject(client: PoolClient, workspaceId: string, projectId: string, lock=false) { const result=await client.query(`SELECT * FROM core.projects WHERE workspace_id=$1 AND id=$2${lock?" FOR UPDATE":""}`,[workspaceId,projectId]); if(!result.rowCount) throw new PlatformNotFoundError("Project not found."); return result.rows[0]; }
async function claimIdempotency(client: PoolClient, context: PlanningContext, operationId: string, requestHash: string): Promise<unknown|undefined> { await client.query(`INSERT INTO audit.idempotency_keys(workspace_id,actor_id,operation_id,idempotency_key,request_hash,state,expires_at) VALUES($1,$2,$3,$4,$5,'processing',now()+interval '24 hours') ON CONFLICT DO NOTHING`,[context.workspaceId,context.actorId,operationId,context.idempotencyKey,requestHash]); const result=await client.query("SELECT request_hash,state,response_body FROM audit.idempotency_keys WHERE workspace_id=$1 AND actor_id=$2 AND operation_id=$3 AND idempotency_key=$4 FOR UPDATE",[context.workspaceId,context.actorId,operationId,context.idempotencyKey]); const row=result.rows[0]; if(row.request_hash!==requestHash) throw new PlatformConflictError("Idempotency key was already used with a different request."); return row.state==="completed"?row.response_body:undefined; }
async function completeIdempotency(client: PoolClient, context: PlanningContext, operationId: string, body: unknown, resourceType: string, resourceId: string) { await client.query("UPDATE audit.idempotency_keys SET state='completed',response_status=200,response_body=$5,resource_type=$6,resource_id=$7,completed_at=now() WHERE workspace_id=$1 AND actor_id=$2 AND operation_id=$3 AND idempotency_key=$4",[context.workspaceId,context.actorId,operationId,context.idempotencyKey,body,resourceType,resourceId]); }
async function appendRecords(client: PoolClient, context: PlanningContext, aggregateType: string, aggregateId: string, version: number, eventType: string, payload: unknown, topic="projection.project") { assertPlanningSafe(payload); const eventId=uuidV7(); const payloadHash=canonicalHash(payload); await client.query(`INSERT INTO audit.domain_events(id,workspace_id,aggregate_type,aggregate_id,aggregate_version,event_type,schema_version,correlation_id,actor_type,actor_id,payload,payload_hash) VALUES($1,$2,$3,$4,$5,$6,1,$7,'user',$8,$9,$10)`,[eventId,context.workspaceId,aggregateType,aggregateId,version,eventType,context.correlationId,context.actorId,payload,payloadHash]); await client.query("INSERT INTO audit.outbox_messages(id,workspace_id,event_id,topic,partition_key,payload) VALUES($1,$2,$3,$4,$5,$6)",[uuidV7(),context.workspaceId,eventId,topic,aggregateId,{eventId,eventType,schemaVersion:1,...payload as object}]); await client.query(`INSERT INTO audit.audit_records(id,workspace_id,actor_type,actor_id,action,resource_type,resource_id,request_id,correlation_id,idempotency_key,after_state_hash,metadata) VALUES($1,$2,'user',$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[uuidV7(),context.workspaceId,context.actorId,eventType,aggregateType,aggregateId,context.requestId,context.correlationId,context.idempotencyKey,payloadHash,{eventId}]); }
function mapProject(row:Record<string,unknown>){return{id:String(row.id),workspaceId:String(row.workspace_id),type:String(row.project_type),name:String(row.name),status:String(row.status),version:Number(row.version)}}
function mapWorkload(row:Record<string,unknown>):WorkloadRecord{return{id:String(row.id),workspaceId:String(row.workspace_id),name:String(row.name),kind:String(row.kind),lifecycleStatus:String(row.lifecycle_status),currentBlueprintRevisionId:row.current_blueprint_revision_id?String(row.current_blueprint_revision_id):undefined,version:Number(row.version)}}
function mapBlueprint(row:Record<string,unknown>):BlueprintRecord{return{id:String(row.id),workloadId:String(row.workload_id),revision:Number(row.revision),status:String(row.status),origin:String(row.origin),schemaVersion:String(row.schema_version),content:row.content as BlueprintContent,contentHash:String(row.content_hash),version:Number(row.version)}}
function mapDecision(row:Record<string,unknown>):DecisionRecord{return{id:String(row.id),projectId:String(row.project_id),revision:Number(row.revision),schemaVersion:String(row.schema_version),content:row.content as DecisionContent,contentHash:String(row.content_hash)}}
function mapPlan(row:Record<string,unknown>):PlanRecord{return{id:String(row.id),projectId:String(row.project_id),revision:Number(row.revision),planType:row.plan_type as PlanningMode,status:String(row.status),schemaVersion:String(row.schema_version),canonicalContent:row.canonical_content as CanonicalPlan,planHash:String(row.plan_hash),version:Number(row.version)}}
function mapApproval(row:Record<string,unknown>):ApprovalRecord{return{id:String(row.id),planRevisionId:String(row.plan_revision_id),approvedPlanHash:String(row.approved_plan_hash),approvalHash:String(row.approval_hash),status:String(row.status),version:Number(row.version),requestedBy:String(row.requested_by),decidedBy:row.decided_by?String(row.decided_by):undefined,expiresAt:row.expires_at?new Date(row.expires_at as string|Date).toISOString():undefined}}
function mapReadiness(row:Record<string,unknown>){return{id:String(row.id),blueprintRevisionId:String(row.blueprint_revision_id),mode:String(row.mode),status:String(row.status),evaluatedInputHash:String(row.evaluated_input_hash),result:row.result,evaluatedAt:new Date(row.evaluated_at as string|Date).toISOString()}}
function mapCompilation(row:Record<string,unknown>){return{id:String(row.id),state:String(row.state),version:Number(row.version),phase:String(row.phase),outcome:row.outcome?String(row.outcome):undefined,diagnostics:row.diagnostics??{},resultPlanRevisionId:row.result_plan_revision_id?String(row.result_plan_revision_id):undefined,errorCode:row.error_code?String(row.error_code):undefined,errorSummary:row.error_summary?String(row.error_summary):undefined}}
function mapPlacement(row:Record<string,unknown>){return{id:String(row.id),workloadId:String(row.workload_id),projectId:row.project_id?String(row.project_id):undefined,endpointId:row.endpoint_id?String(row.endpoint_id):undefined,archiveRefId:row.archive_ref_id?String(row.archive_ref_id):undefined,placementType:String(row.placement_type),authorityState:String(row.authority_state),version:Number(row.version)}}
function mapEstimate(row:Record<string,unknown>){return{id:String(row.id),projectId:String(row.project_id),version:Number(row.version),inputHash:String(row.input_hash),estimate:row.estimate,confidence:String(row.confidence),calculatedAt:new Date(row.calculated_at as string|Date).toISOString(),expiresAt:new Date(row.expires_at as string|Date).toISOString(),actualResult:row.actual_result??undefined}}
function isUuid(value:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)}
