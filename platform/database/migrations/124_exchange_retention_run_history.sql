CREATE TABLE exchange_reconciliation_retention_runs (
  id bigserial PRIMARY KEY,
  ran_at timestamptz NOT NULL DEFAULT now(),
  result text NOT NULL CHECK (result IN ('success','failed')),
  anonymized_count integer NOT NULL DEFAULT 0 CHECK (anonymized_count>=0)
);

CREATE INDEX exchange_reconciliation_retention_runs_recent_idx
  ON exchange_reconciliation_retention_runs(ran_at DESC,id DESC);

COMMENT ON TABLE exchange_reconciliation_retention_runs IS
  'Histórico técnico limitado a 30 execuções; contém somente horário, resultado e quantidade anonimizada.';

