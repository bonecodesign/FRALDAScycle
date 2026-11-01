CREATE TABLE exchange_settlement_reconciliation_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid NOT NULL UNIQUE REFERENCES exchange_settlement_reconciliation_decisions(id),
  settlement_command_id uuid NOT NULL REFERENCES exchange_difference_settlement_commands(id),
  action text NOT NULL CHECK (action IN ('confirm_with_provider','retry_same_idempotency','manual_refund')),
  idempotency_key text NOT NULL UNIQUE CHECK (char_length(idempotency_key) BETWEEN 16 AND 128),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','submitted','completed','reconciliation_required')),
  attempt_count smallint NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  provider_reference text,
  failure_code text,
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status='completed') = (completed_at IS NOT NULL))
);

CREATE INDEX exchange_settlement_recovery_queued_idx
  ON exchange_settlement_reconciliation_commands(created_at,id) WHERE status='queued';

COMMENT ON TABLE exchange_settlement_reconciliation_commands IS
  'Outbox idempotente da ação de recuperação autorizada; submissão não comprova conclusão financeira.';
