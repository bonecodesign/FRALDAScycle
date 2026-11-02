CREATE TABLE exchange_reconciliation_retention_runtime_status (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  last_run_at timestamptz NOT NULL,
  last_status text NOT NULL CHECK (last_status IN ('success','failed')),
  last_anonymized_count integer NOT NULL DEFAULT 0 CHECK (last_anonymized_count>=0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE exchange_reconciliation_retention_runtime_status IS
  'Heartbeat técnico singleton; não contém transação, usuário, hash, payload ou valor financeiro.';

