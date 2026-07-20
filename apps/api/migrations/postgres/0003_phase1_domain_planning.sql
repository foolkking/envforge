CREATE SCHEMA IF NOT EXISTS workload;
CREATE SCHEMA IF NOT EXISTS planning;

ALTER TABLE core.projects DROP CONSTRAINT projects_status_check;
ALTER TABLE core.projects ADD CONSTRAINT projects_status_check CHECK (status IN (
  'draft','created','collecting','reviewing','assessed','closed','defining',
  'target-review','planning','approved','executable','completed',
  'endpoints-bound','assessing','workload-review','capturable','archived',
  'archive-bound','restorable','restored','attention-required'
));
ALTER TABLE core.projects
  ADD COLUMN current_snapshot_id uuid,
  ADD COLUMN current_blueprint_revision_id uuid,
  ADD COLUMN current_decision_set_revision_id uuid,
  ADD COLUMN current_plan_revision_id uuid,
  ADD COLUMN current_report_artifact_id uuid;

CREATE TABLE core.project_mode_readiness (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  project_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('assessment','build','migration','capture','restore')),
  status text NOT NULL CHECK (status IN ('ready','review-required','blocked')),
  input_hash text NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  result jsonb NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id,id),
  UNIQUE (project_id,mode,input_hash),
  FOREIGN KEY (workspace_id,project_id) REFERENCES core.projects(workspace_id,id)
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
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id,id),
  UNIQUE (workspace_id,name)
);

CREATE TABLE workload.project_workloads (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  project_id uuid NOT NULL,
  workload_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id,project_id,workload_id),
  FOREIGN KEY (workspace_id,project_id) REFERENCES core.projects(workspace_id,id),
  FOREIGN KEY (workspace_id,workload_id) REFERENCES workload.workloads(workspace_id,id)
);

CREATE TABLE workload.workload_placements (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  workload_id uuid NOT NULL,
  project_id uuid,
  endpoint_id uuid,
  archive_ref_id uuid,
  placement_type text NOT NULL CHECK (placement_type IN ('source','target','active','standby','archived','restored')),
  authority_state text NOT NULL CHECK (authority_state IN ('none','source','target','committed','historical')),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id,id),
  FOREIGN KEY (workspace_id,workload_id) REFERENCES workload.workloads(workspace_id,id),
  FOREIGN KEY (workspace_id,project_id) REFERENCES core.projects(workspace_id,id),
  FOREIGN KEY (workspace_id,endpoint_id) REFERENCES core.endpoints(workspace_id,id),
  CHECK (endpoint_id IS NOT NULL OR archive_ref_id IS NOT NULL)
);

CREATE TABLE workload.blueprint_revisions (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  workload_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  status text NOT NULL CHECK (status IN ('draft','confirmed','superseded','retired')),
  origin text NOT NULL CHECK (origin IN ('manual','legacy-import','candidate-review','update-proposal')),
  schema_version text NOT NULL,
  content jsonb NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  UNIQUE (workspace_id,id),
  UNIQUE (workload_id,revision),
  UNIQUE (workload_id,content_hash),
  FOREIGN KEY (workspace_id,workload_id) REFERENCES workload.workloads(workspace_id,id)
);
ALTER TABLE workload.workloads ADD CONSTRAINT workloads_current_blueprint_fk
  FOREIGN KEY (workspace_id,current_blueprint_revision_id)
  REFERENCES workload.blueprint_revisions(workspace_id,id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE workload.blueprint_readiness_results (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  blueprint_revision_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('build','migration','capture','restore')),
  status text NOT NULL CHECK (status IN ('planner-ready','review-required','blocked')),
  evaluated_input_hash text NOT NULL CHECK (evaluated_input_hash ~ '^[0-9a-f]{64}$'),
  result jsonb NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id,id),
  UNIQUE (blueprint_revision_id,mode,evaluated_input_hash),
  FOREIGN KEY (workspace_id,blueprint_revision_id) REFERENCES workload.blueprint_revisions(workspace_id,id)
);

CREATE TABLE planning.decision_set_revisions (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  project_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  schema_version text NOT NULL,
  content jsonb NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id,id),
  UNIQUE (project_id,revision),
  UNIQUE (project_id,content_hash),
  FOREIGN KEY (workspace_id,project_id) REFERENCES core.projects(workspace_id,id)
);

CREATE TABLE planning.migration_estimates (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  project_id uuid NOT NULL,
  version bigint NOT NULL CHECK (version > 0),
  input_hash text NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  estimate jsonb NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('low','medium','high')),
  calculated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  actual_result jsonb,
  UNIQUE (workspace_id,id),
  UNIQUE (project_id,version),
  FOREIGN KEY (workspace_id,project_id) REFERENCES core.projects(workspace_id,id),
  CHECK (expires_at > calculated_at)
);

CREATE TABLE planning.plan_compilation_runs (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  operation_id uuid NOT NULL,
  project_id uuid NOT NULL,
  phase text NOT NULL CHECK (phase IN ('validating-inputs','resolving-graph','compiling-contracts','finalizing')),
  outcome text CHECK (outcome IN ('compiled','review-required','blocked')),
  input_hash text NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  compiler_version text NOT NULL,
  result_plan_revision_id uuid,
  diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (workspace_id,id),
  UNIQUE (operation_id),
  FOREIGN KEY (workspace_id,operation_id) REFERENCES core.control_plane_operations(workspace_id,id),
  FOREIGN KEY (workspace_id,project_id) REFERENCES core.projects(workspace_id,id)
);

CREATE TABLE planning.plan_revisions (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  project_id uuid NOT NULL,
  compilation_run_id uuid NOT NULL UNIQUE,
  revision integer NOT NULL CHECK (revision > 0),
  plan_type text NOT NULL CHECK (plan_type IN ('build','migration','capture','restore')),
  status text NOT NULL CHECK (status IN ('compiled','review-required','approval-pending','approved','rejected','superseded','revoked','expired','archived')),
  schema_version text NOT NULL,
  canonical_content jsonb NOT NULL,
  plan_hash text NOT NULL CHECK (plan_hash ~ '^[0-9a-f]{64}$'),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id,id),
  UNIQUE (project_id,revision),
  UNIQUE (project_id,plan_hash),
  FOREIGN KEY (workspace_id,project_id) REFERENCES core.projects(workspace_id,id),
  FOREIGN KEY (workspace_id,compilation_run_id) REFERENCES planning.plan_compilation_runs(workspace_id,id)
);
ALTER TABLE planning.plan_compilation_runs ADD CONSTRAINT compilation_result_plan_fk
  FOREIGN KEY (workspace_id,result_plan_revision_id)
  REFERENCES planning.plan_revisions(workspace_id,id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE planning.plan_input_bindings (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  plan_revision_id uuid NOT NULL,
  binding_type text NOT NULL CHECK (binding_type IN ('blueprint','decision-set','source-snapshot','target-snapshot','archive-version','compatibility-result','capability','policy','artifact')),
  binding_key text NOT NULL,
  resource_id uuid,
  resource_hash text NOT NULL CHECK (resource_hash ~ '^[0-9a-f]{64}$'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (plan_revision_id,binding_type,binding_key),
  FOREIGN KEY (workspace_id,plan_revision_id) REFERENCES planning.plan_revisions(workspace_id,id)
);

CREATE TABLE planning.plan_stages (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  plan_revision_id uuid NOT NULL,
  stage_key text NOT NULL,
  sequence integer NOT NULL CHECK (sequence >= 0),
  required boolean NOT NULL DEFAULT true,
  gate_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (workspace_id,id),
  UNIQUE (plan_revision_id,stage_key),
  UNIQUE (plan_revision_id,sequence),
  FOREIGN KEY (workspace_id,plan_revision_id) REFERENCES planning.plan_revisions(workspace_id,id)
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
  implementation_hash text NOT NULL CHECK (implementation_hash ~ '^[0-9a-f]{64}$'),
  inputs jsonb NOT NULL,
  preconditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  postconditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  resource_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  verification_check_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  retry_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  recovery_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  rollback_definition jsonb,
  resumability text NOT NULL CHECK (resumability IN ('idempotent','byte-resumable','step-resumable','restart-required','manual')),
  risk_level text NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
  trace jsonb NOT NULL,
  UNIQUE (workspace_id,id),
  UNIQUE (plan_revision_id,id),
  UNIQUE (plan_revision_id,action_key),
  FOREIGN KEY (workspace_id,plan_revision_id) REFERENCES planning.plan_revisions(workspace_id,id),
  FOREIGN KEY (workspace_id,stage_id) REFERENCES planning.plan_stages(workspace_id,id)
);

CREATE TABLE planning.plan_action_dependencies (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  plan_revision_id uuid NOT NULL,
  from_action_id uuid NOT NULL,
  to_action_id uuid NOT NULL,
  dependency_type text NOT NULL CHECK (dependency_type IN ('must-complete-before','must-succeed-before','same-checkpoint','rollback-after','exclusive-resource-lock')),
  PRIMARY KEY (plan_revision_id,from_action_id,to_action_id,dependency_type),
  FOREIGN KEY (plan_revision_id,from_action_id) REFERENCES planning.plan_actions(plan_revision_id,id),
  FOREIGN KEY (plan_revision_id,to_action_id) REFERENCES planning.plan_actions(plan_revision_id,id),
  CHECK (from_action_id <> to_action_id)
);

CREATE TABLE planning.plan_contracts (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  plan_revision_id uuid NOT NULL,
  contract_type text NOT NULL CHECK (contract_type IN ('dataset','secret','cutover','verification','rollback','runtime','deployment','config','ephemeral-state')),
  contract_key text NOT NULL,
  content jsonb NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  UNIQUE (plan_revision_id,contract_type,contract_key),
  FOREIGN KEY (workspace_id,plan_revision_id) REFERENCES planning.plan_revisions(workspace_id,id)
);

CREATE TABLE planning.plan_gates (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  plan_revision_id uuid NOT NULL,
  gate_key text NOT NULL,
  gate_type text NOT NULL,
  required boolean NOT NULL,
  definition jsonb NOT NULL,
  UNIQUE (plan_revision_id,gate_key),
  FOREIGN KEY (workspace_id,plan_revision_id) REFERENCES planning.plan_revisions(workspace_id,id)
);

CREATE TABLE planning.plan_risks (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  plan_revision_id uuid NOT NULL,
  risk_key text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  hard_blocker boolean NOT NULL DEFAULT false,
  content jsonb NOT NULL,
  UNIQUE (plan_revision_id,risk_key),
  FOREIGN KEY (workspace_id,plan_revision_id) REFERENCES planning.plan_revisions(workspace_id,id)
);

CREATE TABLE planning.plan_approvals (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  plan_revision_id uuid NOT NULL,
  approved_plan_hash text NOT NULL CHECK (approved_plan_hash ~ '^[0-9a-f]{64}$'),
  approval_hash text NOT NULL CHECK (approval_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('pending','approved','rejected','revoked','expired')),
  approval_policy_id text NOT NULL,
  accepted_risk_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  requested_by text NOT NULL,
  decided_by text,
  reason text,
  expires_at timestamptz,
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  UNIQUE (workspace_id,id),
  FOREIGN KEY (workspace_id,plan_revision_id) REFERENCES planning.plan_revisions(workspace_id,id)
);
CREATE UNIQUE INDEX one_active_approval_per_plan ON planning.plan_approvals(plan_revision_id)
  WHERE status='approved';

ALTER TABLE core.projects
  ADD CONSTRAINT project_current_blueprint_fk FOREIGN KEY (workspace_id,current_blueprint_revision_id) REFERENCES workload.blueprint_revisions(workspace_id,id) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT project_current_decision_fk FOREIGN KEY (workspace_id,current_decision_set_revision_id) REFERENCES planning.decision_set_revisions(workspace_id,id) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT project_current_plan_fk FOREIGN KEY (workspace_id,current_plan_revision_id) REFERENCES planning.plan_revisions(workspace_id,id) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT project_current_report_fk FOREIGN KEY (workspace_id,current_report_artifact_id) REFERENCES artifact.artifacts(workspace_id,id) DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION planning.reject_immutable_content_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='blueprint_revisions' AND (to_jsonb(OLD)->>'status') <> 'draft' AND
     ((to_jsonb(NEW)->'content') IS DISTINCT FROM (to_jsonb(OLD)->'content') OR (to_jsonb(NEW)->>'content_hash') <> (to_jsonb(OLD)->>'content_hash')) THEN
    RAISE EXCEPTION 'confirmed blueprint content is immutable';
  ELSIF TG_TABLE_NAME='decision_set_revisions' THEN
    RAISE EXCEPTION 'decision set revisions are immutable';
  ELSIF TG_TABLE_NAME='plan_revisions' AND
     ((to_jsonb(NEW)->'canonical_content') IS DISTINCT FROM (to_jsonb(OLD)->'canonical_content') OR (to_jsonb(NEW)->>'plan_hash') <> (to_jsonb(OLD)->>'plan_hash') OR (to_jsonb(NEW)->>'project_id') <> (to_jsonb(OLD)->>'project_id')) THEN
    RAISE EXCEPTION 'plan revision content is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER blueprint_content_immutable BEFORE UPDATE ON workload.blueprint_revisions
  FOR EACH ROW EXECUTE FUNCTION planning.reject_immutable_content_change();
CREATE TRIGGER decision_set_immutable BEFORE UPDATE OR DELETE ON planning.decision_set_revisions
  FOR EACH ROW EXECUTE FUNCTION planning.reject_immutable_content_change();
CREATE TRIGGER plan_content_immutable BEFORE UPDATE ON planning.plan_revisions
  FOR EACH ROW EXECUTE FUNCTION planning.reject_immutable_content_change();

INSERT INTO platform.feature_flags(name,enabled,description) VALUES
  ('workload-domain-v1',true,'Use PostgreSQL Workload and Blueprint revisions'),
  ('planner-readiness-v1',true,'Evaluate mode-specific planner readiness'),
  ('decision-set-v1',true,'Use immutable DecisionSet revisions'),
  ('plan-compiler-v1',true,'Use deterministic Phase 1 plan compiler'),
  ('plan-approval-v1',true,'Use exact-hash planning approval')
ON CONFLICT(name) DO NOTHING;

INSERT INTO platform.authority_transitions
  (resource_type,current_authority,target_authority,write_authority,cutover_state,rollback_gate,retirement_phase)
VALUES
  ('workload-blueprint','ServiceStack/runtime documents','PostgreSQL workload schema','PostgreSQL','active','disable Phase 1 reads; preserve rows','phase-10'),
  ('planning-plan','legacy EnvironmentPlan','PostgreSQL planning schema','PostgreSQL','active','retain read-only legacy adapter','phase-10'),
  ('planning-approval','legacy Plan approval','PostgreSQL exact-hash approval','PostgreSQL','active','old approvals remain invalid','phase-10')
ON CONFLICT(resource_type) DO NOTHING;
