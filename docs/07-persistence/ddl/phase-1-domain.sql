-- EnvForge Phase 1 domain and planning reference DDL v1.1 (PROPOSED)
BEGIN;
CREATE SCHEMA IF NOT EXISTS discovery;
CREATE SCHEMA IF NOT EXISTS workload;
CREATE SCHEMA IF NOT EXISTS planning;

CREATE TABLE discovery.snapshot_collection_runs (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  operation_id uuid NOT NULL,
  project_id uuid NOT NULL,
  endpoint_id uuid NOT NULL,
  phase text NOT NULL CHECK (phase IN ('collecting','normalizing','finalizing')),
  collector_policy jsonb NOT NULL,
  collector_version text NOT NULL,
  result_snapshot_id uuid,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id),
  UNIQUE(operation_id),
  FOREIGN KEY(workspace_id,operation_id) REFERENCES core.control_plane_operations(workspace_id,id),
  FOREIGN KEY(workspace_id,project_id) REFERENCES core.projects(workspace_id,id),
  FOREIGN KEY(workspace_id,endpoint_id) REFERENCES core.endpoints(workspace_id,id)
);

CREATE TABLE discovery.snapshots (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  endpoint_id uuid NOT NULL,
  collection_run_id uuid NOT NULL UNIQUE REFERENCES discovery.snapshot_collection_runs(id),
  schema_version text NOT NULL,
  snapshot_hash text NOT NULL,
  collector_completeness jsonb NOT NULL,
  captured_at timestamptz NOT NULL,
  finalized_at timestamptz NOT NULL,
  UNIQUE(workspace_id,id),
  UNIQUE(workspace_id,endpoint_id,snapshot_hash),
  FOREIGN KEY(workspace_id,endpoint_id) REFERENCES core.endpoints(workspace_id,id)
);

ALTER TABLE discovery.snapshot_collection_runs
  ADD CONSTRAINT snapshot_collection_result_fk
  FOREIGN KEY(result_snapshot_id) REFERENCES discovery.snapshots(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE discovery.snapshot_sections (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  snapshot_id uuid NOT NULL,
  section_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('complete','partial','failed','not-supported')),
  content jsonb,
  artifact_id uuid,
  content_hash text,
  UNIQUE(snapshot_id,section_key),
  FOREIGN KEY(workspace_id,snapshot_id) REFERENCES discovery.snapshots(workspace_id,id),
  FOREIGN KEY(workspace_id,artifact_id) REFERENCES artifact.artifacts(workspace_id,id)
);

CREATE TABLE discovery.evidence (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  snapshot_id uuid NOT NULL,
  kind text NOT NULL,
  identity_key text NOT NULL,
  attributes jsonb NOT NULL,
  source_surface text NOT NULL,
  confidence numeric(5,4) NOT NULL CHECK (confidence>=0 AND confidence<=1),
  UNIQUE(snapshot_id,kind,identity_key),
  UNIQUE(workspace_id,id),
  FOREIGN KEY(workspace_id,snapshot_id) REFERENCES discovery.snapshots(workspace_id,id)
);

CREATE TABLE discovery.evidence_relations (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  snapshot_id uuid NOT NULL,
  from_evidence_id uuid NOT NULL,
  to_evidence_id uuid NOT NULL,
  relation_type text NOT NULL,
  strength numeric(5,4) NOT NULL CHECK (strength>=0 AND strength<=1),
  explanation jsonb NOT NULL,
  PRIMARY KEY(snapshot_id,from_evidence_id,to_evidence_id,relation_type),
  FOREIGN KEY(workspace_id,snapshot_id) REFERENCES discovery.snapshots(workspace_id,id),
  FOREIGN KEY(workspace_id,from_evidence_id) REFERENCES discovery.evidence(workspace_id,id),
  FOREIGN KEY(workspace_id,to_evidence_id) REFERENCES discovery.evidence(workspace_id,id),
  CHECK(from_evidence_id<>to_evidence_id)
);

CREATE TABLE discovery.candidate_generations (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  project_id uuid NOT NULL,
  snapshot_id uuid NOT NULL,
  builder_version text NOT NULL,
  ruleset_version text NOT NULL,
  graph_hash text NOT NULL,
  generation_hash text NOT NULL,
  state text NOT NULL CHECK (state IN ('generated','superseded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id),
  UNIQUE(snapshot_id,generation_hash),
  FOREIGN KEY(workspace_id,project_id) REFERENCES core.projects(workspace_id,id),
  FOREIGN KEY(workspace_id,snapshot_id) REFERENCES discovery.snapshots(workspace_id,id)
);

CREATE TABLE discovery.workload_candidates (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  generation_id uuid NOT NULL,
  proposed_identity jsonb NOT NULL,
  content jsonb NOT NULL,
  confidence jsonb NOT NULL,
  completeness jsonb NOT NULL,
  disposition text NOT NULL CHECK (disposition IN ('pending','confirmed','merged','split','dismissed','superseded')),
  candidate_hash text NOT NULL,
  UNIQUE(workspace_id,id),
  UNIQUE(generation_id,candidate_hash),
  FOREIGN KEY(workspace_id,generation_id) REFERENCES discovery.candidate_generations(workspace_id,id)
);

CREATE TABLE discovery.candidate_review_sessions (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  project_id uuid NOT NULL,
  generation_id uuid NOT NULL,
  state text NOT NULL CHECK (state IN ('open','reviewing','blocked','ready','promoted','closed')),
  version bigint NOT NULL DEFAULT 0,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(workspace_id,id),
  FOREIGN KEY(workspace_id,project_id) REFERENCES core.projects(workspace_id,id),
  FOREIGN KEY(workspace_id,generation_id) REFERENCES discovery.candidate_generations(workspace_id,id)
);

CREATE TABLE discovery.candidate_review_decisions (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  session_id uuid NOT NULL,
  sequence bigint NOT NULL,
  decision_type text NOT NULL,
  actor_id text NOT NULL,
  reason text,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id,sequence),
  FOREIGN KEY(workspace_id,session_id) REFERENCES discovery.candidate_review_sessions(workspace_id,id)
);

CREATE TABLE workload.workloads (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  name text NOT NULL,
  kind text NOT NULL,
  owner_ref text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  lifecycle_status text NOT NULL CHECK (lifecycle_status IN ('active','retired','archived')),
  current_blueprint_revision_id uuid,
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id),
  UNIQUE(workspace_id,name)
);

CREATE TABLE workload.blueprint_revisions (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  workload_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision>0),
  status text NOT NULL CHECK (status IN ('draft','confirmed','superseded','retired')),
  origin text NOT NULL CHECK (origin IN ('manual','legacy-import','candidate-review','update-proposal')),
  schema_version text NOT NULL,
  content jsonb NOT NULL,
  content_hash text NOT NULL,
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  UNIQUE(workspace_id,id),
  UNIQUE(workload_id,revision),
  UNIQUE(workload_id,content_hash),
  FOREIGN KEY(workspace_id,workload_id) REFERENCES workload.workloads(workspace_id,id)
);
ALTER TABLE workload.workloads
  ADD CONSTRAINT workloads_current_blueprint_fk
  FOREIGN KEY(workspace_id,current_blueprint_revision_id) REFERENCES workload.blueprint_revisions(workspace_id,id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE workload.blueprint_readiness_results (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  blueprint_revision_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('build','migration','capture','restore')),
  status text NOT NULL CHECK (status IN ('planner-ready','review-required','blocked')),
  evaluated_input_hash text NOT NULL,
  result jsonb NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(blueprint_revision_id,mode,evaluated_input_hash),
  FOREIGN KEY(workspace_id,blueprint_revision_id) REFERENCES workload.blueprint_revisions(workspace_id,id)
);

CREATE TABLE planning.decision_set_revisions (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  project_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision>0),
  content jsonb NOT NULL,
  content_hash text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id),
  UNIQUE(project_id,revision),
  UNIQUE(project_id,content_hash),
  FOREIGN KEY(workspace_id,project_id) REFERENCES core.projects(workspace_id,id)
);

CREATE TABLE planning.plan_compilation_runs (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  operation_id uuid NOT NULL,
  project_id uuid NOT NULL,
  phase text NOT NULL CHECK (phase IN ('validating-inputs','resolving-graph','compiling-contracts','finalizing')),
  outcome text CHECK (outcome IN ('compiled','review-required','blocked')),
  input_hash text NOT NULL,
  compiler_version text NOT NULL,
  result_plan_revision_id uuid,
  diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id),
  UNIQUE(operation_id),
  FOREIGN KEY(workspace_id,operation_id) REFERENCES core.control_plane_operations(workspace_id,id),
  FOREIGN KEY(workspace_id,project_id) REFERENCES core.projects(workspace_id,id)
);

CREATE TABLE planning.plan_revisions (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  project_id uuid NOT NULL,
  compilation_run_id uuid NOT NULL UNIQUE,
  revision integer NOT NULL CHECK (revision>0),
  plan_type text NOT NULL CHECK (plan_type IN ('build','migration','capture','restore')),
  status text NOT NULL CHECK (status IN ('compiled','review-required','approval-pending','approved','rejected','superseded','revoked','expired','archived')),
  schema_version text NOT NULL,
  canonical_content jsonb NOT NULL,
  plan_hash text NOT NULL,
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id),
  UNIQUE(project_id,revision),
  UNIQUE(project_id,plan_hash),
  FOREIGN KEY(workspace_id,project_id) REFERENCES core.projects(workspace_id,id),
  FOREIGN KEY(compilation_run_id) REFERENCES planning.plan_compilation_runs(id)
);
ALTER TABLE planning.plan_compilation_runs ADD CONSTRAINT compilation_result_plan_fk FOREIGN KEY(result_plan_revision_id) REFERENCES planning.plan_revisions(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE planning.plan_input_bindings (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  plan_revision_id uuid NOT NULL,
  binding_type text NOT NULL CHECK (binding_type IN ('blueprint','decision-set','source-snapshot','target-snapshot','archive-version','compatibility-result','capability','policy','artifact')),
  binding_key text NOT NULL,
  resource_id uuid,
  resource_hash text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY(plan_revision_id,binding_type,binding_key),
  FOREIGN KEY(workspace_id,plan_revision_id) REFERENCES planning.plan_revisions(workspace_id,id)
);

CREATE TABLE planning.plan_stages (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  plan_revision_id uuid NOT NULL,
  stage_key text NOT NULL,
  sequence integer NOT NULL,
  required boolean NOT NULL DEFAULT true,
  gate_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(workspace_id,id),
  UNIQUE(plan_revision_id,stage_key),
  UNIQUE(plan_revision_id,sequence),
  FOREIGN KEY(workspace_id,plan_revision_id) REFERENCES planning.plan_revisions(workspace_id,id)
);

CREATE TABLE planning.plan_actions (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  plan_revision_id uuid NOT NULL,
  stage_id uuid NOT NULL,
  action_key text NOT NULL,
  action_type text NOT NULL,
  adapter_id text NOT NULL,
  adapter_version text NOT NULL,
  implementation_hash text NOT NULL,
  inputs jsonb NOT NULL,
  preconditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  postconditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  retry_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  recovery_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  rollback_definition jsonb,
  resumability text NOT NULL CHECK (resumability IN ('idempotent','byte-resumable','step-resumable','restart-required','manual')),
  risk_level text NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
  trace jsonb NOT NULL,
  UNIQUE(workspace_id,id),
  UNIQUE(plan_revision_id,id),
  UNIQUE(plan_revision_id,action_key),
  FOREIGN KEY(workspace_id,plan_revision_id) REFERENCES planning.plan_revisions(workspace_id,id),
  FOREIGN KEY(workspace_id,stage_id) REFERENCES planning.plan_stages(workspace_id,id)
);

CREATE TABLE planning.plan_action_dependencies (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  plan_revision_id uuid NOT NULL,
  from_action_id uuid NOT NULL,
  to_action_id uuid NOT NULL,
  dependency_type text NOT NULL CHECK (dependency_type IN ('must-complete-before','must-succeed-before','same-checkpoint','rollback-after','exclusive-resource-lock')),
  PRIMARY KEY(plan_revision_id,from_action_id,to_action_id,dependency_type),
  FOREIGN KEY(plan_revision_id,from_action_id) REFERENCES planning.plan_actions(plan_revision_id,id),
  FOREIGN KEY(plan_revision_id,to_action_id) REFERENCES planning.plan_actions(plan_revision_id,id),
  CHECK(from_action_id<>to_action_id)
);

CREATE TABLE planning.plan_contracts (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  plan_revision_id uuid NOT NULL,
  contract_type text NOT NULL CHECK (contract_type IN ('dataset','secret','cutover','verification','rollback')),
  contract_key text NOT NULL,
  content jsonb NOT NULL,
  content_hash text NOT NULL,
  UNIQUE(plan_revision_id,contract_type,contract_key),
  FOREIGN KEY(workspace_id,plan_revision_id) REFERENCES planning.plan_revisions(workspace_id,id)
);

CREATE TABLE planning.plan_gates (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  plan_revision_id uuid NOT NULL,
  gate_key text NOT NULL,
  gate_type text NOT NULL,
  required boolean NOT NULL,
  definition jsonb NOT NULL,
  UNIQUE(plan_revision_id,gate_key),
  FOREIGN KEY(workspace_id,plan_revision_id) REFERENCES planning.plan_revisions(workspace_id,id)
);

CREATE TABLE planning.plan_risks (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  plan_revision_id uuid NOT NULL,
  risk_key text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  accepted boolean NOT NULL DEFAULT false,
  content jsonb NOT NULL,
  UNIQUE(plan_revision_id,risk_key),
  FOREIGN KEY(workspace_id,plan_revision_id) REFERENCES planning.plan_revisions(workspace_id,id)
);

CREATE TABLE planning.plan_approvals (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  plan_revision_id uuid NOT NULL,
  approved_plan_hash text NOT NULL,
  approval_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','approved','rejected','revoked','expired')),
  approval_policy_id text NOT NULL,
  accepted_risk_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  approved_by text,
  approved_at timestamptz,
  expires_at timestamptz,
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id),
  FOREIGN KEY(workspace_id,plan_revision_id) REFERENCES planning.plan_revisions(workspace_id,id)
);
CREATE UNIQUE INDEX one_active_approval_per_plan ON planning.plan_approvals(plan_revision_id) WHERE status='approved';

ALTER TABLE core.projects
  ADD CONSTRAINT project_current_blueprint_fk FOREIGN KEY(workspace_id,current_blueprint_revision_id) REFERENCES workload.blueprint_revisions(workspace_id,id) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT project_current_decision_fk FOREIGN KEY(workspace_id,current_decision_set_revision_id) REFERENCES planning.decision_set_revisions(workspace_id,id) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT project_current_plan_fk FOREIGN KEY(workspace_id,current_plan_revision_id) REFERENCES planning.plan_revisions(workspace_id,id) DEFERRABLE INITIALLY DEFERRED;
COMMIT;
