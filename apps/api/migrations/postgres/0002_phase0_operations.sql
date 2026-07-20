CREATE TABLE platform.feature_flags (
  name text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  description text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO platform.feature_flags(name,enabled,description) VALUES
  ('postgres-foundation-write',true,'PostgreSQL is authoritative for Phase 0 foundation resources'),
  ('postgres-foundation-read',true,'Read Phase 0 foundation resources from PostgreSQL'),
  ('artifact-store-v2',true,'Use the provider-based Artifact Store for new Phase 0 artifacts'),
  ('outbox-dispatcher',true,'Enable the foundation outbox dispatcher role'),
  ('projection-consumer',true,'Enable the foundation projection consumer role'),
  ('legacy-read-adapter',true,'Allow explicitly bounded legacy reads during migration')
ON CONFLICT(name) DO NOTHING;

CREATE TABLE platform.authority_transitions (
  resource_type text PRIMARY KEY,
  current_authority text NOT NULL,
  target_authority text NOT NULL,
  write_authority text NOT NULL,
  cutover_state text NOT NULL CHECK (cutover_state IN ('planned','active','complete','rolled-back')),
  rollback_gate text NOT NULL,
  retirement_phase text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO platform.authority_transitions
  (resource_type,current_authority,target_authority,write_authority,cutover_state,rollback_gate,retirement_phase)
VALUES
  ('foundation-project','SQLite/session document','PostgreSQL core.projects','PostgreSQL','active','disable postgres-foundation-read; preserve PostgreSQL rows','phase-10'),
  ('foundation-artifact-metadata','local plan metadata','PostgreSQL artifact.artifacts','PostgreSQL','active','retain legacy read adapter','phase-10'),
  ('foundation-event-audit','partial logs','PostgreSQL audit schemas','PostgreSQL','active','append-only; no destructive rollback','phase-10')
ON CONFLICT(resource_type) DO NOTHING;

CREATE TABLE platform.legacy_backfill_items (
  source_type text NOT NULL,
  source_id text NOT NULL,
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  workspace_id uuid NOT NULL REFERENCES core.workspaces(id),
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  state text NOT NULL CHECK (state IN ('imported','rejected')),
  rejected_reason text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_type, source_id),
  UNIQUE (target_type, target_id)
);

CREATE OR REPLACE FUNCTION core.reject_project_type_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.project_type <> OLD.project_type THEN
    RAISE EXCEPTION 'project_type is immutable';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER projects_type_immutable BEFORE UPDATE OF project_type ON core.projects
  FOR EACH ROW EXECUTE FUNCTION core.reject_project_type_change();
