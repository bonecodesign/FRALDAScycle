ALTER TABLE account_notices DROP CONSTRAINT account_notices_kind_check;
ALTER TABLE account_notices ADD CONSTRAINT account_notices_kind_check
  CHECK (kind IN ('child_profile_age_limit','child_profile_change','exchange_difference_payment','exchange_dispute_evidence','exchange_dispute_decision','exchange_settlement_status','exchange_settlement_reconciliation'));

ALTER TABLE account_notices ADD COLUMN expires_at timestamptz;
ALTER TABLE account_notices ADD CONSTRAINT account_notices_change_expiry_required
  CHECK (kind<>'child_profile_change' OR expires_at IS NOT NULL);

CREATE INDEX account_notices_expiry_idx ON account_notices(expires_at)
  WHERE expires_at IS NOT NULL;

COMMENT ON COLUMN account_notices.expires_at IS
  'Avisos de alteração de perfil expiram em 12 meses; mensagem nunca contém data de nascimento.';

