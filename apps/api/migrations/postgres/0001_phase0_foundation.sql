CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS artifact;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS projection;

CREATE TABLE core.workspaces (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('active','suspended','archived')),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, version)
);

CREATE TABLE core.workspace_memberships (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  actor_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','admin','member','reader')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, actor_id)
);
CREATE INDEX workspace_memberships_actor_idx ON core.workspace_memberships(actor_id, workspace_id);

CREATE TABLE core.projects (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  project_type text NOT NULL CHECK (project_type IN ('assessment','build','migration','capture','restore')),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','discovering','reviewing','planning','ready','executing','attention-required','completed','archived')),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  legacy_source_type text,
  legacy_source_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, name)
);
CREATE INDEX projects_workspace_status_idx ON core.projects(workspace_id, status, created_at, id);

CREATE TABLE core.connection_refs (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  provider_type text NOT NULL,
  provider_reference text NOT NULL,
  non_secret_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('unvalidated','available','unavailable','revoked')),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, provider_type, provider_reference)
);

CREATE TABLE core.endpoints (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  kind text NOT NULL CHECK (kind IN ('linux-host','storage-host','external-service','drill-target')),
  display_name text NOT NULL,
  connection_ref_id uuid,
  host_identity jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('unvalidated','available','degraded','unavailable','retired')),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, connection_ref_id) REFERENCES core.connection_refs(workspace_id, id)
);

CREATE TABLE core.project_endpoints (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  project_id uuid NOT NULL,
  endpoint_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('source','target','storage','drill-target')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, project_id, endpoint_id, role),
  FOREIGN KEY (workspace_id, project_id) REFERENCES core.projects(workspace_id, id),
  FOREIGN KEY (workspace_id, endpoint_id) REFERENCES core.endpoints(workspace_id, id)
);

CREATE TABLE core.project_links (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  from_project_id uuid NOT NULL,
  to_project_id uuid NOT NULL,
  link_type text NOT NULL CHECK (link_type IN ('derived-from','restores-archive','retries','repairs')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, from_project_id, to_project_id, link_type),
  FOREIGN KEY (workspace_id, from_project_id) REFERENCES core.projects(workspace_id, id),
  FOREIGN KEY (workspace_id, to_project_id) REFERENCES core.projects(workspace_id, id),
  CHECK (from_project_id <> to_project_id)
);

CREATE TABLE core.revision_identity_reservations (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  owner_type text NOT NULL CHECK (owner_type IN ('project','workload','archive')),
  owner_id uuid NOT NULL,
  revision_type text NOT NULL CHECK (revision_type IN ('snapshot','blueprint','decision','plan','archive')),
  revision_number bigint NOT NULL CHECK (revision_number > 0),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, owner_type, owner_id, revision_type, revision_number),
  UNIQUE (workspace_id, revision_type, content_hash)
);

CREATE TABLE core.control_plane_operations (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  project_id uuid,
  operation_type text NOT NULL CHECK (operation_type IN ('snapshot-collection','candidate-generation','plan-compilation','archive-scrub','archive-repair','archive-import','projection-rebuild','internal-test','hash-verification','artifact-integrity-check')),
  state text NOT NULL CHECK (state IN ('created','queued','running','waiting','finalizing','succeeded','failed','cancelled')),
  input_hash text NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_hash text,
  error_code text,
  error_summary text,
  available_at timestamptz NOT NULL DEFAULT now(),
  scheduled_operation_key text,
  deduplication_key text NOT NULL,
  cancel_requested_at timestamptz,
  revoked_at timestamptz,
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, deduplication_key),
  FOREIGN KEY (workspace_id, project_id) REFERENCES core.projects(workspace_id, id)
);
CREATE INDEX control_ops_available_idx ON core.control_plane_operations(state, available_at, created_at)
  WHERE state IN ('created','queued','waiting','running');

CREATE TABLE core.control_plane_operation_attempts (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  state text NOT NULL CHECK (state IN ('started','succeeded','failed','abandoned')),
  error_code text,
  error_summary text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (workspace_id, operation_id, attempt_number),
  FOREIGN KEY (workspace_id, operation_id) REFERENCES core.control_plane_operations(workspace_id, id)
);

CREATE TABLE artifact.artifacts (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  kind text NOT NULL,
  storage_provider_id text NOT NULL,
  object_key text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  stored_hash text CHECK (stored_hash IS NULL OR stored_hash ~ '^[0-9a-f]{64}$'),
  bytes bigint NOT NULL CHECK (bytes >= 0),
  content_type text NOT NULL,
  encryption_envelope_ref text,
  state text NOT NULL CHECK (state IN ('pending','available','corrupt','deletion-pending','deleted')),
  retention_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, storage_provider_id, object_key)
);
CREATE INDEX artifacts_hash_idx ON artifact.artifacts(workspace_id, content_hash);

CREATE TABLE audit.domain_events (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version >= 0),
  event_type text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  correlation_id uuid NOT NULL,
  causation_id uuid,
  actor_type text NOT NULL CHECK (actor_type IN ('user','worker','system')),
  actor_id text NOT NULL,
  payload jsonb NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, aggregate_type, aggregate_id, aggregate_version, event_type)
);
CREATE INDEX domain_events_aggregate_idx ON audit.domain_events(workspace_id, aggregate_type, aggregate_id, aggregate_version);

CREATE TABLE audit.outbox_messages (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  event_id uuid NOT NULL REFERENCES audit.domain_events(id),
  topic text NOT NULL,
  partition_key text NOT NULL,
  payload jsonb NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','claimed','published','dead-letter')),
  available_at timestamptz NOT NULL DEFAULT now(),
  claimed_by text,
  claim_token uuid,
  lease_expires_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_claim_idx ON audit.outbox_messages(topic, available_at, created_at)
  WHERE state IN ('pending','claimed');

CREATE TABLE audit.outbox_attempts (
  id uuid PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES audit.outbox_messages(id),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  worker_id text NOT NULL,
  claim_token uuid NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('started','published','failed','abandoned')),
  error_summary text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (message_id, attempt_number)
);

CREATE TABLE audit.inbox_messages (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  consumer_name text NOT NULL,
  message_id uuid NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processing_state text NOT NULL CHECK (processing_state IN ('processing','completed','failed','unsupported')),
  result_hash text,
  completed_at timestamptz,
  PRIMARY KEY (workspace_id, consumer_name, message_id)
);

CREATE TABLE audit.idempotency_keys (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  actor_id text NOT NULL,
  operation_id text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  state text NOT NULL CHECK (state IN ('processing','completed','failed')),
  response_status integer,
  response_body jsonb,
  resource_type text,
  resource_id uuid,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (workspace_id, actor_id, operation_id, idempotency_key)
);
CREATE INDEX idempotency_expiry_idx ON audit.idempotency_keys(expires_at);

CREATE TABLE audit.audit_records (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  actor_type text NOT NULL CHECK (actor_type IN ('user','worker','system')),
  actor_id text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  request_id text NOT NULL,
  correlation_id uuid NOT NULL,
  causation_id uuid,
  idempotency_key text,
  before_state_hash text,
  after_state_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_records_resource_idx ON audit.audit_records(workspace_id, resource_type, resource_id, occurred_at);

CREATE TABLE projection.project_summaries (
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  project_id uuid NOT NULL,
  project_type text NOT NULL,
  name text NOT NULL,
  status text NOT NULL,
  source_version bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, project_id)
);

CREATE OR REPLACE FUNCTION audit.reject_immutable_change() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'immutable audit/event row'; END $$;
CREATE TRIGGER domain_events_immutable BEFORE UPDATE OR DELETE ON audit.domain_events
  FOR EACH ROW EXECUTE FUNCTION audit.reject_immutable_change();
CREATE TRIGGER audit_records_immutable BEFORE UPDATE OR DELETE ON audit.audit_records
  FOR EACH ROW EXECUTE FUNCTION audit.reject_immutable_change();
