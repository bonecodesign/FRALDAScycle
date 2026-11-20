-- FC-PRIV: inventario agregado e somente de leitura de residuos historicos.
-- Executar apenas em ambiente isolado autorizado, com perfil somente leitura.
-- Contagens NAO autorizam apagar linhas nem coletar dados infantis reais.
-- Zero ocorrencias NAO prova limpeza integral (variantes e outros destinos podem existir).
BEGIN TRANSACTION READ ONLY;

WITH audit_check AS (
  SELECT
    count(*)::bigint AS records_examined,
    count(*) FILTER (
      WHERE metadata::text ~* '"(emoji|birth[_-]?date|date[_-]?of[_-]?birth|child[_-]?profile[_-]?id)"[[:space:]]*:'
    )::bigint AS records_needing_review
  FROM audit_events
  WHERE action LIKE 'child_profile.%'
     OR action = 'account.responsible.registration.completed'
), outbox_check AS (
  SELECT
    count(*)::bigint AS records_examined,
    count(*) FILTER (
      WHERE payload::text ~* '"(emoji|birth[_-]?date|date[_-]?of[_-]?birth|child[_-]?profile[_-]?id)"[[:space:]]*:'
    )::bigint AS records_needing_review
  FROM notification_outbox
  WHERE kind::text = 'account_lifecycle_notice'
), notices_check AS (
  SELECT
    count(*)::bigint AS records_examined,
    count(*)::bigint AS records_needing_review
  FROM account_notices
  WHERE kind IN ('child_profile_age_limit', 'child_profile_change', 'child_profile_responsibility')
), inventory AS (
  SELECT 'audit_events'::text AS source, records_examined, records_needing_review,
    'JSON key patterns only; nested/encoded variants may be missed'::text AS limitation
  FROM audit_check
  UNION ALL
  SELECT 'notification_outbox', records_examined, records_needing_review,
    'Lifecycle notices only; pending and delivered messages counted'
  FROM outbox_check
  UNION ALL
  SELECT 'account_notices', records_examined, records_needing_review,
    'All child-profile notices listed for private review; not proof of exposure'
  FROM notices_check
)
SELECT source, records_examined, records_needing_review, limitation
FROM inventory
ORDER BY source;

COMMIT;
