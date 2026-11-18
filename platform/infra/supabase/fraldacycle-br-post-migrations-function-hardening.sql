-- FC-318: hosted FraldaCycle-BR only — harden the 4 trigger functions identified
-- by the Supabase security advisor after applying the full app schema.
-- Functions are SECURITY INVOKER and are invoked by existing database triggers.
-- pg_temp is explicitly last, avoiding object-shadowing in a mutable search_path.
-- Do not alter business objects, data, users or backend auth.

ALTER FUNCTION public.publish_audit_realtime_event()
  SET search_path TO pg_catalog, public, pg_temp;
ALTER FUNCTION public.close_exchange_settlement_reconciliation_after_confirmation()
  SET search_path TO pg_catalog, public, pg_temp;
ALTER FUNCTION public.schedule_removed_listing_content()
  SET search_path TO pg_catalog, public, pg_temp;
ALTER FUNCTION public.enforce_exchange_single_courier_cycle()
  SET search_path TO pg_catalog, public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.publish_audit_realtime_event()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.close_exchange_settlement_reconciliation_after_confirmation()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.schedule_removed_listing_content()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_exchange_single_courier_cycle()
  FROM PUBLIC, anon, authenticated;
