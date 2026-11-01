ALTER TABLE account_notices DROP CONSTRAINT account_notices_kind_check;
ALTER TABLE account_notices ADD CONSTRAINT account_notices_kind_check
  CHECK (kind IN ('child_profile_age_limit','exchange_difference_payment'));
ALTER TABLE account_notices ADD COLUMN dedupe_key text UNIQUE;

ALTER TABLE exchange_difference_obligations
  ADD COLUMN checkout_warning_sent_at timestamptz;

CREATE INDEX exchange_difference_warning_due_idx
  ON exchange_difference_obligations(checkout_warning_at)
  WHERE status = 'provider_pending' AND checkout_warning_sent_at IS NULL;

COMMENT ON COLUMN exchange_difference_obligations.checkout_warning_sent_at IS
  'Marca idempotente do aviso interno/e-mail agendado; não comprova entrega externa.';
