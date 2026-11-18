-- FraldaCycle BR — security baseline for a clean, dedicated homologation project.
-- PostgreSQL backend-only access. No public Data API access to marketplace data.
-- Apply ONLY to the dedicated FRALDAScycle-BR Supabase project (sa-east-1),
-- never to Salva Motoca or an existing production deployment.
-- This does NOT deploy the application schema or create any data.

-- Revoke access from PostgREST roles while keeping database owner access.
REVOKE ALL ON SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- The app migrator connects as postgres. Remove Supabase default grants to
-- browser-exposed roles for future objects it creates in public.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- Defense-in-depth: all future public tables start with RLS enabled,
-- including tables introduced by platform/database/migrate.js.
CREATE SCHEMA IF NOT EXISTS fraldacycle_internal;
REVOKE ALL ON SCHEMA fraldacycle_internal FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION fraldacycle_internal.enforce_public_rls()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog
AS $function$
DECLARE
  cmd record;
  target_table name;
BEGIN
  FOR cmd IN
    SELECT *
      FROM pg_event_trigger_ddl_commands()
     WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
       AND object_type IN ('table', 'partitioned table')
       AND schema_name = 'public'
  LOOP
    SELECT c.relname INTO target_table
      FROM pg_catalog.pg_class c
     WHERE c.oid = cmd.objid;
    IF target_table IS NULL THEN
      RAISE EXCEPTION 'FraldaCycle: cannot identify new public table %', cmd.object_identity;
    END IF;
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
                   cmd.schema_name, target_table);
  END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION fraldacycle_internal.enforce_public_rls()
  FROM PUBLIC, anon, authenticated;

CREATE EVENT TRIGGER fraldacycle_enforce_public_rls
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION fraldacycle_internal.enforce_public_rls();
