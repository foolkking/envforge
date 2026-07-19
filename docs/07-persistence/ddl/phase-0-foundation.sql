-- EnvForge Phase 0 foundation reference DDL v1.1 (PROPOSED)
-- Application generates UUIDv7. Run in a disposable PostgreSQL database before adoption.
BEGIN;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS artifact;
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE core.workspaces (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('active','suspended','archived')),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE core.projects (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  project_type text NOT NULL CHECK (project_type IN ('assessment','build','migration','capture','restore')),
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','discovering','reviewing','planning','ready','executing','attention-required','completed','archived')),
  current_blueprint_revision_id uuid,
  current_decision_set_revision_id uuid,
  current_plan_revision_id uuid,
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  legacy_source_type text,
  legacy_source_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id,id),
  UNIQUE (workspace_id,name)
);
CREATE INDEX projects_workspace_status_idx ON core.projects(workspace_id,status,created_at);

CREATE TABLE core.endpoints (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  kind text NOT NULL CHECK (kind IN ('linux-host','storage-host','external-service','drill-target')),
  display_name text NOT NULL,
  connection_provider_ref text NOT NULL,
  host_identity jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('unvalidated','available','degraded','unavailable','retired')),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id,id)
);
CREATE INDEX endpoints_workspace_status_idx ON core.endpoints(workspace_id,status);

CREATE TABLE core.connection_refs (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  provider_type text NOT NULL,
  provider_reference text NOT NULL,
  non_secret_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('unvalidated','available','unavailable','revoked')),
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id),
  UNIQUE(workspace_id,provider_type,provider_reference)
);

CREATE TABLE core.project_endpoints (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  project_id uuid NOT NULL,
  endpoint_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('source','target','storage','drill-target')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,project_id,endpoint_id,role),
  FOREIGN KEY(workspace_id,project_id) REFERENCES core.projects(workspace_id,id),
  FOREIGN KEY(workspace_id,endpoint_id) REFERENCES core.endpoints(workspace_id,id)
);

CREATE TABLE core.project_links (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  from_project_id uuid NOT NULL,
  to_project_id uuid NOT NULL,
  link_type text NOT NULL CHECK (link_type IN ('derived-from','restore-from-archive','assessment-source')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,from_project_id,to_project_id,link_type),
  FOREIGN KEY(workspace_id,from_project_id) REFERENCES core.projects(workspace_id,id),
  FOREIGN KEY(workspace_id,to_project_id) REFERENCES core.projects(workspace_id,id),
  CHECK (from_project_id <> to_project_id)
);

CREATE TABLE core.control_plane_operations (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  project_id uuid,
  operation_type text NOT NULL CHECK (operation_type IN ('snapshot-collection','candidate-generation','plan-compilation','archive-scrub','archive-repair','archive-import','projection-rebuild','internal-test')),
  state text NOT NULL CHECK (state IN ('created','queued','running','waiting','finalizing','succeeded','failed','cancelled')),
  result_status text,
  input_hash text NOT NULL,
  result_resource_type text,
  result_resource_id uuid,
  error_code text,
  error_summary text,
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  FOREIGN KEY(workspace_id,project_id) REFERENCES core.projects(workspace_id,id),
  UNIQUE(workspace_id,id)
);
CREATE INDEX control_ops_claim_idx ON core.control_plane_operations(state,created_at) WHERE state IN ('queued','running');

CREATE TABLE artifact.artifacts (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  kind text NOT NULL,
  storage_provider_id text NOT NULL,
  object_key text NOT NULL,
  content_hash text NOT NULL,
  stored_hash text,
  bytes bigint NOT NULL CHECK (bytes >= 0),
  content_type text NOT NULL,
  encryption_envelope_id uuid,
  state text NOT NULL CHECK (state IN ('pending','stored','available','corrupt','deletion-pending','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id),
  UNIQUE(workspace_id,storage_provider_id,object_key)
);
CREATE INDEX artifacts_hash_idx ON artifact.artifacts(workspace_id,content_hash);

CREATE TABLE audit.domain_events (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version >= 0),
  event_type text NOT NULL,
  event_version integer NOT NULL DEFAULT 1,
  correlation_id uuid NOT NULL,
  causation_id uuid,
  actor_type text NOT NULL CHECK (actor_type IN ('user','worker','system')),
  actor_id text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,aggregate_type,aggregate_id,aggregate_version,event_type)
);
CREATE INDEX domain_events_aggregate_idx ON audit.domain_events(workspace_id,aggregate_type,aggregate_id,occurred_at);

CREATE TABLE audit.outbox_messages (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  event_id uuid NOT NULL REFERENCES audit.domain_events(id),
  topic text NOT NULL,
  payload jsonb NOT NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_pending_idx ON audit.outbox_messages(available_at,created_at) WHERE published_at IS NULL;

CREATE TABLE audit.inbox_messages (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  consumer_name text NOT NULL,
  message_id uuid NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  result_hash text,
  PRIMARY KEY(workspace_id,consumer_name,message_id)
);

CREATE TABLE audit.idempotency_keys (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  actor_id text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response_status integer,
  response_body jsonb,
  resource_type text,
  resource_id uuid,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,actor_id,idempotency_key)
);

CREATE TABLE audit.audit_records (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  actor_type text NOT NULL CHECK (actor_type IN ('user','worker','system')),
  actor_id text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  request_id text,
  idempotency_key text,
  before_state_hash text,
  after_state_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_records_resource_idx ON audit.audit_records(workspace_id,resource_type,resource_id,occurred_at);
COMMIT;
