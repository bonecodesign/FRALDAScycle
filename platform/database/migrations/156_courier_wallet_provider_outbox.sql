CREATE TYPE courier_wallet_provider_command_status AS ENUM ('pending','processing','delivered','failed','cancelled');

CREATE TABLE courier_wallet_provider_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id uuid NOT NULL UNIQUE REFERENCES courier_wallet_withdrawals(id),
  operation text NOT NULL DEFAULT 'pix_withdrawal' CHECK(operation='pix_withdrawal'),
  status courier_wallet_provider_command_status NOT NULL DEFAULT 'pending',
  idempotency_key text NOT NULL UNIQUE CHECK(length(idempotency_key) BETWEEN 16 AND 128),
  claim_token uuid,
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  provider_reference_hash text CHECK(provider_reference_hash IS NULL OR provider_reference_hash~'^[0-9a-f]{64}$'),
  last_error_code text CHECK(last_error_code IS NULL OR length(last_error_code) BETWEEN 3 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK((status='processing' AND claim_token IS NOT NULL AND locked_at IS NOT NULL) OR status<>'processing')
);

CREATE INDEX courier_wallet_provider_commands_due_idx
  ON courier_wallet_provider_commands(status,available_at,id);

COMMENT ON TABLE courier_wallet_provider_commands IS
  'Provider-neutral PIX outbox. It references a verified destination indirectly and never stores a raw PIX key, CPF or bank account.';
