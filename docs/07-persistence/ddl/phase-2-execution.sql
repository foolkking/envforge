-- EnvForge Phase 2 durable execution reference DDL v1.1 (PROPOSED)
BEGIN;
CREATE SCHEMA IF NOT EXISTS execution;

CREATE TABLE execution.runs (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  project_id uuid NOT NULL,
  run_type text NOT NULL CHECK (run_type IN ('build','migration','capture','restore','verification','rollback')),
  plan_revision_id uuid NOT NULL,
  plan_hash text NOT NULL,
  approval_id uuid,
  approval_hash text,
  rollback_of_run_id uuid,
  state text NOT NULL CHECK (state IN ('created','queued','claimed','running','waiting','pause-requested','pausing','paused','blocked','recovering','cancel-requested','cancelling','rollback-required','rolling-back','succeeded','failed','cancelled','rolled-back','partially-rolled-back')),
  phase text,
  waiting_reason text,
  fencing_token bigint NOT NULL DEFAULT 0 CHECK (fencing_token>=0),
  version bigint NOT NULL DEFAULT 0 CHECK (version>=0),
  outcome jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  UNIQUE(workspace_id,id),
  FOREIGN KEY(workspace_id,project_id) REFERENCES core.projects(workspace_id,id),
  FOREIGN KEY(workspace_id,plan_revision_id) REFERENCES planning.plan_revisions(workspace_id,id),
  FOREIGN KEY(workspace_id,approval_id) REFERENCES planning.plan_approvals(workspace_id,id),
  FOREIGN KEY(workspace_id,rollback_of_run_id) REFERENCES execution.runs(workspace_id,id),
  CHECK ((run_type='rollback') = (rollback_of_run_id IS NOT NULL))
);
CREATE INDEX runs_state_idx ON execution.runs(workspace_id,state,created_at);
CREATE UNIQUE INDEX one_active_root_run_per_plan ON execution.runs(plan_revision_id)
  WHERE rollback_of_run_id IS NULL AND state NOT IN ('succeeded','failed','cancelled','rolled-back','partially-rolled-back');
CREATE UNIQUE INDEX one_active_rollback_per_original ON execution.runs(rollback_of_run_id)
  WHERE rollback_of_run_id IS NOT NULL AND state NOT IN ('succeeded','failed','cancelled','rolled-back','partially-rolled-back');

CREATE TABLE execution.stage_runs (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  run_id uuid NOT NULL,
  stage_key text NOT NULL,
  state text NOT NULL CHECK (state IN ('pending','ready','running','waiting','paused','succeeded','failed','skipped','cancelled','blocked')),
  sequence integer NOT NULL,
  version bigint NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  UNIQUE(workspace_id,id),
  UNIQUE(run_id,stage_key),
  FOREIGN KEY(workspace_id,run_id) REFERENCES execution.runs(workspace_id,id)
);

CREATE TABLE execution.action_runs (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  run_id uuid NOT NULL,
  plan_action_id uuid NOT NULL,
  action_key text NOT NULL,
  state text NOT NULL CHECK (state IN ('pending','ready','blocked','claimed','running','waiting','pause-pending','paused','succeeded','failed','skipped','cancelled','rollback-pending','rolling-back','rolled-back','rollback-failed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count>=0),
  last_error_class text,
  current_attempt_id uuid,
  version bigint NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  UNIQUE(workspace_id,id),
  UNIQUE(run_id,action_key),
  FOREIGN KEY(workspace_id,run_id) REFERENCES execution.runs(workspace_id,id),
  FOREIGN KEY(workspace_id,plan_action_id) REFERENCES planning.plan_actions(workspace_id,id)
);
CREATE INDEX action_runs_ready_idx ON execution.action_runs(workspace_id,run_id,state);

CREATE TABLE execution.action_attempts (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  run_id uuid NOT NULL,
  action_run_id uuid NOT NULL,
  attempt_number integer NOT NULL CHECK(attempt_number>0),
  worker_id text NOT NULL,
  fencing_token bigint NOT NULL,
  state text NOT NULL CHECK (state IN ('created','running','succeeded','failed','outcome-unknown','cancelled')),
  execution_receipt jsonb,
  error_class text,
  error_summary text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(workspace_id,id),
  UNIQUE(action_run_id,attempt_number),
  FOREIGN KEY(workspace_id,run_id) REFERENCES execution.runs(workspace_id,id),
  FOREIGN KEY(workspace_id,action_run_id) REFERENCES execution.action_runs(workspace_id,id)
);
ALTER TABLE execution.action_runs ADD CONSTRAINT current_attempt_fk FOREIGN KEY(workspace_id,current_attempt_id) REFERENCES execution.action_attempts(workspace_id,id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE execution.run_queue (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  run_id uuid PRIMARY KEY,
  state text NOT NULL CHECK (state IN ('queued','claimed','done','cancelled')),
  priority integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  queued_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  claimed_by text,
  FOREIGN KEY(workspace_id,run_id) REFERENCES execution.runs(workspace_id,id)
);
CREATE INDEX run_queue_claim_idx ON execution.run_queue(state,available_at,priority DESC,queued_at);

CREATE TABLE execution.worker_leases (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  run_id uuid PRIMARY KEY,
  worker_id text NOT NULL,
  claim_token text NOT NULL,
  fencing_token bigint NOT NULL,
  claimed_at timestamptz NOT NULL,
  heartbeat_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  FOREIGN KEY(workspace_id,run_id) REFERENCES execution.runs(workspace_id,id),
  UNIQUE(worker_id,claim_token)
);
CREATE INDEX worker_leases_expired_idx ON execution.worker_leases(expires_at);

CREATE TABLE execution.resource_lock_heads (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  resource_key text NOT NULL,
  epoch bigint NOT NULL DEFAULT 0,
  version bigint NOT NULL DEFAULT 0,
  PRIMARY KEY(workspace_id,resource_key)
);

CREATE TABLE execution.resource_leases (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  resource_key text NOT NULL,
  run_id uuid NOT NULL,
  action_run_id uuid,
  mode text NOT NULL CHECK (mode IN ('read','write','exclusive')),
  priority integer NOT NULL DEFAULT 0,
  fencing_token bigint NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE(workspace_id,id),
  FOREIGN KEY(workspace_id,resource_key) REFERENCES execution.resource_lock_heads(workspace_id,resource_key),
  FOREIGN KEY(workspace_id,run_id) REFERENCES execution.runs(workspace_id,id),
  FOREIGN KEY(workspace_id,action_run_id) REFERENCES execution.action_runs(workspace_id,id)
);
CREATE INDEX resource_leases_key_idx ON execution.resource_leases(workspace_id,resource_key,expires_at);
CREATE UNIQUE INDEX one_write_holder_per_resource ON execution.resource_leases(workspace_id,resource_key)
  WHERE mode IN ('write','exclusive');
-- Acquisition must lock resource_lock_heads and reject read/write conflicts transactionally.

CREATE TABLE execution.checkpoints (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  run_id uuid NOT NULL,
  action_run_id uuid,
  checkpoint_type text NOT NULL CHECK (checkpoint_type IN ('action','transfer','dataset-consistency','stage','cutover','commit')),
  sequence bigint NOT NULL CHECK(sequence>0),
  plan_hash text NOT NULL,
  action_input_hash text,
  resume_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_state_hashes jsonb NOT NULL DEFAULT '{}'::jsonb,
  artifact_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  validity jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id),
  UNIQUE(run_id,sequence),
  FOREIGN KEY(workspace_id,run_id) REFERENCES execution.runs(workspace_id,id),
  FOREIGN KEY(workspace_id,action_run_id) REFERENCES execution.action_runs(workspace_id,id)
);

CREATE TABLE execution.run_events (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  run_id uuid NOT NULL,
  sequence bigint NOT NULL CHECK(sequence>0),
  event_type text NOT NULL,
  event_version integer NOT NULL DEFAULT 1,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id),
  UNIQUE(run_id,sequence),
  FOREIGN KEY(workspace_id,run_id) REFERENCES execution.runs(workspace_id,id)
);

CREATE TABLE execution.manual_gates (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  run_id uuid NOT NULL,
  gate_type text NOT NULL,
  state text NOT NULL CHECK (state IN ('pending','satisfied','failed','expired')),
  instructions jsonb NOT NULL,
  expected_evidence jsonb NOT NULL,
  completed_by text,
  completed_at timestamptz,
  UNIQUE(workspace_id,id),
  FOREIGN KEY(workspace_id,run_id) REFERENCES execution.runs(workspace_id,id)
);

CREATE TABLE execution.verification_results (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  run_id uuid NOT NULL,
  action_run_id uuid,
  check_id text NOT NULL,
  check_version text NOT NULL,
  required boolean NOT NULL,
  status text NOT NULL CHECK (status IN ('passed','failed','warning','skipped')),
  evidence_artifact_id uuid,
  summary jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id),
  FOREIGN KEY(workspace_id,run_id) REFERENCES execution.runs(workspace_id,id),
  FOREIGN KEY(workspace_id,action_run_id) REFERENCES execution.action_runs(workspace_id,id),
  FOREIGN KEY(workspace_id,evidence_artifact_id) REFERENCES artifact.artifacts(workspace_id,id)
);

CREATE TABLE execution.execution_commit_records (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  run_id uuid NOT NULL,
  commit_type text NOT NULL CHECK (commit_type IN ('build','restore')),
  plan_hash text NOT NULL,
  verification_snapshot_hash text NOT NULL,
  placement_refs jsonb NOT NULL,
  irreversible_action_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  committed_by_type text NOT NULL CHECK (committed_by_type IN ('user','policy')),
  committed_by_id text NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id),
  UNIQUE(workspace_id,id),
  FOREIGN KEY(workspace_id,run_id) REFERENCES execution.runs(workspace_id,id)
);

CREATE TABLE execution.report_artifacts (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  run_id uuid NOT NULL,
  artifact_id uuid NOT NULL,
  report_type text NOT NULL,
  renderer_version text NOT NULL,
  report_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id,report_type,report_hash),
  FOREIGN KEY(workspace_id,run_id) REFERENCES execution.runs(workspace_id,id),
  FOREIGN KEY(workspace_id,artifact_id) REFERENCES artifact.artifacts(workspace_id,id)
);
COMMIT;
