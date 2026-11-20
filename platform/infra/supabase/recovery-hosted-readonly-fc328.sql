-- FC-328: consulta somente leitura; executar exclusivamente no projeto Supabase BR de homologacao.
-- Este inventario NAO demonstra backup, restauracao, obrigatoriedade TLS, cofre ou capacidade de recuperacao.
-- Nunca marcar o requisito 57 como concluido apenas com estes resultados.
WITH public_tables AS (
 SELECT count(*) AS total,
        count(*) FILTER (WHERE c.relrowsecurity) AS rls_enabled,
        count(*) FILTER (WHERE has_table_privilege('anon', c.oid, 'SELECT')) AS readable_anon,
        count(*) FILTER (WHERE has_table_privilege('authenticated', c.oid, 'SELECT')) AS readable_authenticated
 FROM pg_class c
 JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'r'
), checkpoints AS (
 SELECT count(*) AS total,
        count(DISTINCT name) AS distinct_names,
        count(*) FILTER (WHERE length(btrim(checksum::text)) = 64) AS sha256_length_64,
        count(*) FILTER (WHERE name = '176_required_operational_notification_kind.sql') AS includes_176
 FROM public.schema_migrations
), operational AS (
 SELECT (SELECT count(*) FROM public.users) AS users,
        (SELECT count(*) FROM public.listings) AS listings,
        (SELECT count(*) FROM public.transactions) AS transactions,
        (SELECT count(*) FROM public.support_duty_assignments) AS support_assignments
)
SELECT current_timestamp AS observed_at,
       current_database() AS database_name,
       c.total AS migration_checkpoints,
       c.distinct_names AS distinct_migration_names,
       c.sha256_length_64 AS checkpoints_sha256_length_64,
       c.includes_176 AS migration_176_present,
       t.total AS public_tables,
       t.rls_enabled AS rls_tables,
       t.readable_anon AS public_anon_readable,
       t.readable_authenticated AS public_authenticated_readable,
       NOT has_schema_privilege('anon', 'public', 'USAGE') AS anon_schema_closed,
       NOT has_schema_privilege('authenticated', 'public', 'USAGE') AS authenticated_schema_closed,
       o.users, o.listings, o.transactions, o.support_assignments,
       (SELECT setting FROM pg_settings WHERE name = 'ssl') AS pg_ssl_capability,
       'NOT_VERIFIED_BY_THIS_QUERY'::text AS tls_enforcement_and_client_certificate,
       'NOT_VERIFIED_BY_THIS_QUERY'::text AS remote_backup_and_retention,
       'NOT_VERIFIED_BY_THIS_QUERY'::text AS isolated_hosted_restore_rpo_rto,
       'NO_GO_RECOVERY'::text AS activation_result
FROM public_tables t CROSS JOIN checkpoints c CROSS JOIN operational o;
