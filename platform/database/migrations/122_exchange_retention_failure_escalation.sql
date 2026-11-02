CREATE TABLE exchange_reconciliation_retention_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  consecutive_failures smallint NOT NULL CHECK (consecutive_failures BETWEEN 1 AND 32767),
  highest_notified_level smallint NOT NULL CHECK (highest_notified_level IN (3,4,5)),
  last_failure_code text NOT NULL CHECK (last_failure_code ~ '^[a-z0-9_:-]{3,80}$'),
  started_at timestamptz NOT NULL DEFAULT now(),
  last_failed_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK ((status='resolved')=(resolved_at IS NOT NULL))
);

CREATE UNIQUE INDEX exchange_reconciliation_retention_single_open_incident_idx
  ON exchange_reconciliation_retention_incidents((status)) WHERE status='open';

COMMENT ON TABLE exchange_reconciliation_retention_incidents IS
  'Escalonamento sequencial da rotina diária: nível 3, depois 4 e somente então 5; sem payload financeiro.';

