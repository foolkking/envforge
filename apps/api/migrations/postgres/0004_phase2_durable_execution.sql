CREATE SCHEMA IF NOT EXISTS execution;

CREATE TABLE execution.execution_runs (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  project_id uuid NOT NULL,
  run_type text NOT NULL CHECK (run_type IN ('build','migration','capture','restore','verification','rollback')),
  operation_class text NOT NULL DEFAULT 'live' CHECK (operation_class IN ('live','dry-run','rehearsal','verification','rollback')),
  plan_revision_id uuid NOT NULL,
  plan_hash text NOT NULL CHECK (plan_hash ~ '^[0-9a-f]{64}$'),
  approval_id uuid NOT NULL,
  approval_hash text NOT NULL CHECK (approval_hash ~ '^[0-9a-f]{64}$'),
  binding_hash text NOT NULL CHECK (binding_hash ~ '^[0-9a-f]{64}$'),
  parent_run_id uuid,
  rollback_of_run_id uuid,
  retry_reason text,
  state text NOT NULL CHECK (state IN ('created','queued','claimed','running','waiting','pause-requested','pausing','paused','blocked','recovering','cancel-requested','cancelling','rollback-required','rolling-back','succeeded','failed','cancelled','rolled-back','partially-rolled-back','attention-required')),
  phase text,
  waiting_reason text,
  fencing_token bigint NOT NULL DEFAULT 0 CHECK (fencing_token >= 0),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  requested_by text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  UNIQUE(workspace_id,id),
  UNIQUE(workspace_id,requested_by,idempotency_key),
  FOREIGN KEY(workspace_id,project_id) REFERENCES core.projects(workspace_id,id),
  FOREIGN KEY(workspace_id,plan_revision_id) REFERENCES planning.plan_revisions(workspace_id,id),
  FOREIGN KEY(workspace_id,approval_id) REFERENCES planning.plan_approvals(workspace_id,id),
  FOREIGN KEY(workspace_id,parent_run_id) REFERENCES execution.execution_runs(workspace_id,id),
  FOREIGN KEY(workspace_id,rollback_of_run_id) REFERENCES execution.execution_runs(workspace_id,id),
  CHECK ((run_type='rollback') = (rollback_of_run_id IS NOT NULL)),
  CHECK (id <> coalesce(parent_run_id,'00000000-0000-0000-0000-000000000000'::uuid)),
  CHECK (id <> coalesce(rollback_of_run_id,'00000000-0000-0000-0000-000000000000'::uuid))
);
CREATE UNIQUE INDEX one_active_live_run_per_project ON execution.execution_runs(workspace_id,project_id,operation_class)
  WHERE operation_class='live' AND state NOT IN ('succeeded','failed','cancelled','rolled-back','partially-rolled-back');
CREATE UNIQUE INDEX one_active_live_run_per_plan ON execution.execution_runs(workspace_id,plan_revision_id,operation_class)
  WHERE operation_class='live' AND state NOT IN ('succeeded','failed','cancelled','rolled-back','partially-rolled-back');
CREATE INDEX execution_runs_state_idx ON execution.execution_runs(workspace_id,state,created_at,id);

CREATE TABLE execution.run_input_bindings (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id), run_id uuid NOT NULL,
  binding_type text NOT NULL, binding_key text NOT NULL, resource_hash text NOT NULL CHECK(resource_hash ~ '^[0-9a-f]{64}$'), metadata jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY(run_id,binding_type,binding_key), FOREIGN KEY(workspace_id,run_id) REFERENCES execution.execution_runs(workspace_id,id)
);

CREATE TABLE execution.stage_runs (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES core.workspaces(id), run_id uuid NOT NULL,
  stage_key text NOT NULL, state text NOT NULL CHECK(state IN ('pending','ready','running','waiting','paused','succeeded','failed','skipped','cancelled','blocked')),
  sequence integer NOT NULL, version bigint NOT NULL DEFAULT 0, started_at timestamptz, completed_at timestamptz,
  UNIQUE(workspace_id,id), UNIQUE(run_id,stage_key), FOREIGN KEY(workspace_id,run_id) REFERENCES execution.execution_runs(workspace_id,id)
);

CREATE TABLE execution.action_runs (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES core.workspaces(id), run_id uuid NOT NULL, stage_run_id uuid NOT NULL,
  plan_action_id uuid NOT NULL, action_key text NOT NULL, state text NOT NULL CHECK(state IN ('pending','ready','claimed','running','reconciling','unknown','waiting','pause-pending','paused','succeeded','failed','blocked','skipped','cancelled','rollback-pending','rolling-back','rolled-back','rollback-failed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count >= 0), current_attempt_id uuid, last_error_class text, version bigint NOT NULL DEFAULT 0,
  started_at timestamptz, completed_at timestamptz, UNIQUE(workspace_id,id), UNIQUE(run_id,plan_action_id), UNIQUE(run_id,action_key),
  FOREIGN KEY(workspace_id,run_id) REFERENCES execution.execution_runs(workspace_id,id),
  FOREIGN KEY(workspace_id,stage_run_id) REFERENCES execution.stage_runs(workspace_id,id),
  FOREIGN KEY(workspace_id,plan_action_id) REFERENCES planning.plan_actions(workspace_id,id)
);

CREATE TABLE execution.action_attempts (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES core.workspaces(id), run_id uuid NOT NULL, action_run_id uuid NOT NULL,
  attempt_number integer NOT NULL CHECK(attempt_number > 0), worker_id text NOT NULL, fencing_token bigint NOT NULL,
  state text NOT NULL CHECK(state IN ('created','running','succeeded','failed','outcome-unknown','cancelled')),
  idempotency_key text NOT NULL, execution_receipt jsonb, error_class text, error_summary text, started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
  UNIQUE(workspace_id,id), UNIQUE(action_run_id,attempt_number), UNIQUE(action_run_id,idempotency_key),
  FOREIGN KEY(workspace_id,run_id) REFERENCES execution.execution_runs(workspace_id,id), FOREIGN KEY(workspace_id,action_run_id) REFERENCES execution.action_runs(workspace_id,id)
);
ALTER TABLE execution.action_runs ADD CONSTRAINT execution_current_attempt_fk FOREIGN KEY(workspace_id,current_attempt_id) REFERENCES execution.action_attempts(workspace_id,id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE execution.queue_items (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES core.workspaces(id), run_id uuid NOT NULL, queue_type text NOT NULL DEFAULT 'execution',
  state text NOT NULL CHECK(state IN ('queued','claimed','done','cancelled','dead-letter')), priority integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(), attempt_count integer NOT NULL DEFAULT 0, max_attempts integer NOT NULL DEFAULT 8,
  claimed_by text, claim_token uuid, lease_generation bigint NOT NULL DEFAULT 0, lease_expires_at timestamptz, last_error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id), UNIQUE(run_id,queue_type), FOREIGN KEY(workspace_id,run_id) REFERENCES execution.execution_runs(workspace_id,id)
);
CREATE INDEX execution_queue_claim_idx ON execution.queue_items(state,available_at,priority DESC,created_at) WHERE state IN ('queued','claimed');

CREATE TABLE execution.worker_sessions (
  id uuid PRIMARY KEY, worker_id text NOT NULL, version text NOT NULL, state text NOT NULL CHECK(state IN ('active','draining','stopped')),
  started_at timestamptz NOT NULL DEFAULT now(), heartbeat_at timestamptz NOT NULL DEFAULT now(), stopped_at timestamptz, UNIQUE(worker_id,id)
);
CREATE TABLE execution.worker_leases (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id), run_id uuid PRIMARY KEY, worker_session_id uuid NOT NULL REFERENCES execution.worker_sessions(id),
  claim_token uuid NOT NULL, generation bigint NOT NULL CHECK(generation > 0), heartbeat_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  FOREIGN KEY(workspace_id,run_id) REFERENCES execution.execution_runs(workspace_id,id)
);

CREATE TABLE execution.resource_lock_heads (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id), resource_key text NOT NULL, epoch bigint NOT NULL DEFAULT 0, PRIMARY KEY(workspace_id,resource_key)
);
CREATE TABLE execution.resource_leases (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES core.workspaces(id), resource_key text NOT NULL, run_id uuid NOT NULL, action_run_id uuid,
  mode text NOT NULL CHECK(mode IN ('read','write','exclusive')), fencing_token bigint NOT NULL, acquired_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  UNIQUE(workspace_id,id), FOREIGN KEY(workspace_id,resource_key) REFERENCES execution.resource_lock_heads(workspace_id,resource_key),
  FOREIGN KEY(workspace_id,run_id) REFERENCES execution.execution_runs(workspace_id,id), FOREIGN KEY(workspace_id,action_run_id) REFERENCES execution.action_runs(workspace_id,id)
);
CREATE UNIQUE INDEX one_active_write_resource_lease ON execution.resource_leases(workspace_id,resource_key) WHERE mode IN ('write','exclusive');

CREATE TABLE execution.execution_checkpoints (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES core.workspaces(id), run_id uuid NOT NULL, action_run_id uuid,
  checkpoint_type text NOT NULL CHECK(checkpoint_type IN ('action','stage','verification','commit','rollback')), sequence bigint NOT NULL CHECK(sequence > 0),
  schema_version text NOT NULL, fencing_token bigint NOT NULL, payload jsonb NOT NULL DEFAULT '{}', payload_hash text NOT NULL CHECK(payload_hash ~ '^[0-9a-f]{64}$'), artifact_ref text,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,id), UNIQUE(run_id,sequence),
  FOREIGN KEY(workspace_id,run_id) REFERENCES execution.execution_runs(workspace_id,id), FOREIGN KEY(workspace_id,action_run_id) REFERENCES execution.action_runs(workspace_id,id)
);
CREATE TABLE execution.reconciliation_records (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES core.workspaces(id), run_id uuid NOT NULL, action_run_id uuid NOT NULL, attempt_id uuid NOT NULL,
  outcome text NOT NULL CHECK(outcome IN ('effect-absent','effect-present-valid','effect-present-invalid','manual-intervention')), evidence jsonb NOT NULL,
  evidence_hash text NOT NULL CHECK(evidence_hash ~ '^[0-9a-f]{64}$'), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(attempt_id),
  FOREIGN KEY(workspace_id,run_id) REFERENCES execution.execution_runs(workspace_id,id), FOREIGN KEY(workspace_id,action_run_id) REFERENCES execution.action_runs(workspace_id,id), FOREIGN KEY(workspace_id,attempt_id) REFERENCES execution.action_attempts(workspace_id,id)
);

CREATE TABLE execution.run_events (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES core.workspaces(id), run_id uuid NOT NULL, sequence bigint NOT NULL CHECK(sequence > 0),
  event_type text NOT NULL, event_version integer NOT NULL DEFAULT 1, payload jsonb NOT NULL, payload_hash text NOT NULL CHECK(payload_hash ~ '^[0-9a-f]{64}$'), occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id), UNIQUE(run_id,sequence), FOREIGN KEY(workspace_id,run_id) REFERENCES execution.execution_runs(workspace_id,id)
);
CREATE TABLE execution.verification_results (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES core.workspaces(id), run_id uuid NOT NULL, action_run_id uuid, check_id text NOT NULL,
  required boolean NOT NULL, status text NOT NULL CHECK(status IN ('passed','failed','warning','skipped','error')), summary jsonb NOT NULL, evidence_hash text NOT NULL CHECK(evidence_hash ~ '^[0-9a-f]{64}$'), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id), FOREIGN KEY(workspace_id,run_id) REFERENCES execution.execution_runs(workspace_id,id), FOREIGN KEY(workspace_id,action_run_id) REFERENCES execution.action_runs(workspace_id,id)
);
CREATE TABLE execution.execution_commit_records (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES core.workspaces(id), run_id uuid NOT NULL UNIQUE, plan_hash text NOT NULL, approval_hash text NOT NULL,
  binding_hash text NOT NULL, verification_summary_hash text NOT NULL, action_result_summary_hash text NOT NULL, report_hash text,
  schema_version text NOT NULL, committed_by text NOT NULL, committed_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,id),
  FOREIGN KEY(workspace_id,run_id) REFERENCES execution.execution_runs(workspace_id,id)
);
CREATE TABLE execution.report_artifacts (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES core.workspaces(id), run_id uuid NOT NULL, report_type text NOT NULL,
  content jsonb NOT NULL, report_hash text NOT NULL CHECK(report_hash ~ '^[0-9a-f]{64}$'), schema_version text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id), UNIQUE(run_id,report_type,report_hash), FOREIGN KEY(workspace_id,run_id) REFERENCES execution.execution_runs(workspace_id,id)
);

CREATE TABLE execution.run_control_requests (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES core.workspaces(id), run_id uuid NOT NULL, command text NOT NULL CHECK(command IN ('pause','resume','cancel','retry')),
  state text NOT NULL CHECK(state IN ('pending','acknowledged','completed','rejected')), reason text NOT NULL, requested_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
  UNIQUE(workspace_id,id), FOREIGN KEY(workspace_id,run_id) REFERENCES execution.execution_runs(workspace_id,id)
);
CREATE TABLE execution.scheduled_operations (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES core.workspaces(id), project_id uuid NOT NULL, run_id uuid, operation_type text NOT NULL,
  binding_hash text NOT NULL CHECK(binding_hash ~ '^[0-9a-f]{64}$'), deduplication_key text NOT NULL, not_before timestamptz NOT NULL,
  state text NOT NULL CHECK(state IN ('scheduled','claimed','completed','cancelled','revoked','missed','attention-required')), cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,deduplication_key),
  FOREIGN KEY(workspace_id,project_id) REFERENCES core.projects(workspace_id,id), FOREIGN KEY(workspace_id,run_id) REFERENCES execution.execution_runs(workspace_id,id)
);
CREATE INDEX scheduled_operations_due_idx ON execution.scheduled_operations(state,not_before) WHERE state IN ('scheduled','missed');
CREATE TABLE execution.manual_actions (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES core.workspaces(id), run_id uuid NOT NULL, action_run_id uuid NOT NULL,
  instruction text NOT NULL, required_permission text NOT NULL, expected_external_state jsonb NOT NULL, attestation jsonb,
  machine_verification jsonb, state text NOT NULL CHECK(state IN ('pending','attested','verified','manual-unverified','expired','failed')), expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,id), FOREIGN KEY(workspace_id,run_id) REFERENCES execution.execution_runs(workspace_id,id), FOREIGN KEY(workspace_id,action_run_id) REFERENCES execution.action_runs(workspace_id,id)
);
CREATE TABLE execution.attention_records (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES core.workspaces(id), project_id uuid NOT NULL, run_id uuid NOT NULL, commit_record_id uuid,
  reason_code text NOT NULL, state text NOT NULL CHECK(state IN ('attention-required','investigating','resolved','rollback-requested')), source_release_blocked boolean NOT NULL DEFAULT true,
  evidence jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz, UNIQUE(workspace_id,id),
  FOREIGN KEY(workspace_id,project_id) REFERENCES core.projects(workspace_id,id), FOREIGN KEY(workspace_id,run_id) REFERENCES execution.execution_runs(workspace_id,id), FOREIGN KEY(workspace_id,commit_record_id) REFERENCES execution.execution_commit_records(workspace_id,id)
);

INSERT INTO platform.feature_flags(name,enabled,description) VALUES
 ('execution-run-v1',true,'PostgreSQL-authoritative durable execution runs'),('durable-queue-v1',true,'Atomic durable execution queue'),
 ('worker-lease-v1',true,'Worker leases and fencing'),('scheduled-verification-v1',true,'Durable delayed verification') ON CONFLICT(name) DO NOTHING;
