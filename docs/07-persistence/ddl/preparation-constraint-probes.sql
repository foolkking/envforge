-- Preparation-only reference DDL probes. This is not a production migration.
\set ON_ERROR_STOP on

DO $$
DECLARE
  definition text;
  columns_count integer;
BEGIN
  IF to_regclass('planning.plan_input_bindings') IS NULL THEN
    RAISE EXCEPTION 'plan_input_bindings missing';
  END IF;
  SELECT count(*) INTO columns_count
    FROM information_schema.columns
    WHERE table_schema='planning' AND table_name='plan_input_bindings'
      AND column_name IN ('plan_revision_id','binding_type','binding_key','resource_hash');
  IF columns_count <> 4 THEN
    RAISE EXCEPTION 'multi-input binding contract incomplete';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='discovery' AND table_name='snapshots' AND column_name='failed'
  ) THEN
    RAISE EXCEPTION 'failed state must not be stored on finalized snapshots';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='discovery' AND table_name='snapshot_collection_runs' AND column_name='error_code'
  ) THEN
    RAISE EXCEPTION 'snapshot collection failure boundary missing';
  END IF;

  SELECT indexdef INTO definition FROM pg_indexes
    WHERE schemaname='execution' AND indexname='one_active_root_run_per_plan';
  IF definition IS NULL OR definition NOT ILIKE '%rollback_of_run_id IS NULL%' THEN
    RAISE EXCEPTION 'root run uniqueness does not exclude rollback runs';
  END IF;
  SELECT indexdef INTO definition FROM pg_indexes
    WHERE schemaname='execution' AND indexname='one_active_rollback_per_original';
  IF definition IS NULL OR definition NOT ILIKE '%rollback_of_run_id IS NOT NULL%' THEN
    RAISE EXCEPTION 'independent rollback run uniqueness missing';
  END IF;

  IF to_regclass('execution.worker_leases') IS NULL OR NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='execution' AND table_name='worker_leases' AND constraint_type='PRIMARY KEY'
  ) THEN
    RAISE EXCEPTION 'WorkerLease authority constraint missing';
  END IF;
  IF to_regclass('execution.resource_lock_heads') IS NULL OR to_regclass('execution.resource_leases') IS NULL THEN
    RAISE EXCEPTION 'resource lock head/holder model missing';
  END IF;
  SELECT indexdef INTO definition FROM pg_indexes
    WHERE schemaname='execution' AND indexname='one_write_holder_per_resource';
  IF definition IS NULL OR definition NOT ILIKE '%write%' OR definition NOT ILIKE '%exclusive%' THEN
    RAISE EXCEPTION 'single writer resource index missing';
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO core.workspaces(id,slug,name,status)
      VALUES ('00000000-0000-4000-8000-000000000001','prep-invalid','invalid','unknown');
    RAISE EXCEPTION 'workspace status check did not fire';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END $$;

INSERT INTO core.workspaces(id,slug,name,status)
  VALUES ('00000000-0000-4000-8000-000000000002','prep-unique','first','active');
DO $$
BEGIN
  BEGIN
    INSERT INTO core.workspaces(id,slug,name,status)
      VALUES ('00000000-0000-4000-8000-000000000003','prep-unique','second','active');
    RAISE EXCEPTION 'workspace unique constraint did not fire';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END $$;
DELETE FROM core.workspaces WHERE slug='prep-unique';

SELECT count(*) AS preparation_table_count
FROM information_schema.tables
WHERE table_schema IN ('core','artifact','audit','discovery','workload','planning','execution');
