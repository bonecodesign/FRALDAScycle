-- FC-325 — Supabase BR: consulta somente leitura para preativacao do suporte.
-- Executar manualmente no projeto FRALDAScycle-BR. Nao grava, altera, notifica ou cria objetos.
-- PASS significa somente que o esquema esta fechado e ainda sem dados de operacao.
-- NAO valida backup/restauracao, TLS, fornecedor, escala humana nem liberacao do piloto.
WITH
migration_state AS (
  SELECT count(*) AS recorded,
         count(DISTINCT name) AS distinct_names,
         count(*) FILTER (WHERE length(btrim(checksum::text)) = 64) AS sha256_length_64,
         count(*) FILTER (WHERE name = '173_support_priority_first_response.sql') AS has_173,
         count(*) FILTER (WHERE name = '174_support_duty_roster_preparation.sql') AS has_174,
         count(*) FILTER (WHERE name = '175_support_duty_founder_governance.sql') AS has_175
  FROM public.schema_migrations
),
table_state AS (
  SELECT count(*) AS total,
         count(*) FILTER (WHERE c.relrowsecurity) AS rls_enabled,
         count(*) FILTER (
           WHERE has_table_privilege('anon', c.oid,
             'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
         ) AS anon_granted,
         count(*) FILTER (
           WHERE has_table_privilege('authenticated', c.oid,
             'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
         ) AS authenticated_granted
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
),
activity_state AS (
  SELECT (SELECT count(*) FROM public.users) AS users,
         (SELECT count(*) FROM public.support_tickets) AS tickets,
         (SELECT count(*) FROM public.support_duty_assignments) AS duty_assignments,
         (SELECT count(*) FROM public.support_duty_proposals) AS duty_proposals,
         (SELECT count(*) FROM public.listings) AS listings,
         (SELECT count(*) FROM public.transactions) AS transactions,
         (SELECT count(*) FROM public.payment_intents) AS payment_intents,
         (SELECT count(*) FROM public.notification_outbox) AS notifications
),
guard_state AS (
  SELECT
    NOT has_schema_privilege('anon', 'public', 'USAGE')
      AND NOT has_schema_privilege('authenticated', 'public', 'USAGE')
      AND NOT has_schema_privilege('anon', 'public', 'CREATE')
      AND NOT has_schema_privilege('authenticated', 'public', 'CREATE')
      AND NOT has_schema_privilege('anon', 'fraldacycle_internal', 'USAGE')
      AS schema_closed,
    (SELECT evtenabled = 'O' FROM pg_event_trigger
      WHERE evtname = 'fraldacycle_enforce_public_rls') IS TRUE AS future_rls_trigger,
    (SELECT count(*) FROM pg_constraint
       WHERE conrelid IN ('public.support_tickets'::regclass,
                          'public.support_duty_assignments'::regclass)
         AND conname IN ('support_priority_classification_complete_check',
                         'support_duty_revocation_complete',
                         'support_assignment_pair_check')) = 3 AS required_checks,
    (SELECT count(*) FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname IN ('support_duty_current_role_idx',
                           'support_duty_current_person_idx',
                           'support_duty_proposal_pending_role_idx',
                           'support_duty_proposal_pending_target_idx')) = 4 AS role_uniqueness
)
SELECT
  clock_timestamp() AS checked_at,
  current_database() AS database_name,
  m.recorded AS applied_file_checkpoints,
  m.distinct_names AS distinct_file_checkpoints,
  t.total AS public_tables,
  t.rls_enabled AS rls_enabled_tables,
  t.anon_granted AS anon_privileged_tables,
  t.authenticated_granted AS authenticated_privileged_tables,
  a.users, a.tickets, a.duty_assignments, a.duty_proposals,
  a.listings, a.transactions, a.payment_intents, a.notifications,
  g.schema_closed, g.future_rls_trigger, g.required_checks, g.role_uniqueness,
  CASE WHEN
    m.recorded >= 170
    AND m.recorded = m.distinct_names
    AND m.recorded = m.sha256_length_64
    AND m.has_173 = 1 AND m.has_174 = 1 AND m.has_175 = 1
    AND t.total > 0 AND t.rls_enabled = t.total
    AND t.anon_granted = 0 AND t.authenticated_granted = 0
    AND a.users = 0 AND a.tickets = 0
    AND a.duty_assignments = 0 AND a.duty_proposals = 0
    AND a.listings = 0 AND a.transactions = 0
    AND a.payment_intents = 0 AND a.notifications = 0
    AND g.schema_closed AND g.future_rls_trigger
    AND g.required_checks AND g.role_uniqueness
  THEN 'PASS_PREACTIVATION_ONLY' ELSE 'NO_GO_REVIEW_REQUIRED' END AS preactivation_check
FROM migration_state m
CROSS JOIN table_state t
CROSS JOIN activity_state a
CROSS JOIN guard_state g;
