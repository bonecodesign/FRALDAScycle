ALTER TABLE exchange_difference_settlement_commands DROP CONSTRAINT exchange_difference_settlement_commands_status_check;
ALTER TABLE exchange_difference_settlement_commands ADD CONSTRAINT exchange_difference_settlement_commands_status_check
  CHECK (status IN ('queued','processing','submitted','completed','reconciliation_required'));
ALTER TABLE exchange_difference_settlement_commands DROP CONSTRAINT exchange_difference_settlement_commands_check;
ALTER TABLE exchange_difference_settlement_commands ADD CONSTRAINT exchange_difference_settlement_completion_check
  CHECK ((status='completed' AND provider_reference IS NOT NULL AND completed_at IS NOT NULL) OR (status<>'completed' AND completed_at IS NULL));

CREATE TABLE exchange_difference_settlement_webhook_events (
  event_id text PRIMARY KEY CHECK (char_length(event_id) BETWEEN 3 AND 128),
  provider_reference text NOT NULL CHECK (char_length(provider_reference) BETWEEN 3 AND 128),
  observed_status text NOT NULL CHECK (observed_status IN ('completed','failed')),
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  received_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE exchange_difference_settlement_webhook_events IS
  'Inbox idempotente de confirmações assinadas; o payload bruto não é armazenado.';
