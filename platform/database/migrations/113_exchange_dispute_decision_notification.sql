ALTER TYPE auth_token_kind ADD VALUE IF NOT EXISTS 'exchange_dispute_decision';

ALTER TABLE account_notices DROP CONSTRAINT account_notices_kind_check;
ALTER TABLE account_notices ADD CONSTRAINT account_notices_kind_check
  CHECK (kind IN ('child_profile_age_limit','exchange_difference_payment','exchange_dispute_evidence','exchange_dispute_decision'));
