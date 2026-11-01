CREATE TABLE exchange_difference_settlement_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL UNIQUE REFERENCES exchange_difference_disputes(id),
  transaction_id uuid NOT NULL UNIQUE REFERENCES transactions(id),
  operation text NOT NULL CHECK (operation IN ('release','refund_full','refund_with_proven_fee')),
  idempotency_key text NOT NULL UNIQUE CHECK (char_length(idempotency_key) BETWEEN 16 AND 128),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','reconciliation_required')),
  attempt_count smallint NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  locked_at timestamptz,
  provider_reference text,
  failure_code text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status='completed') = (provider_reference IS NOT NULL AND completed_at IS NOT NULL))
);

CREATE INDEX exchange_difference_settlement_queued_idx
  ON exchange_difference_settlement_commands(created_at,id)
  WHERE status='queued';

COMMENT ON TABLE exchange_difference_settlement_commands IS
  'Outbox financeiro idempotente criado após autorização nível 5; não comprova execução no provedor.';
