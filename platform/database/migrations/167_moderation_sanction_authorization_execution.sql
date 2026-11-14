ALTER TABLE moderation_sanction_cases
  ADD COLUMN level5_note text CHECK(level5_note IS NULL OR length(level5_note) BETWEEN 10 AND 2000);

CREATE TABLE moderation_sanction_effects (
  case_id uuid PRIMARY KEY REFERENCES moderation_sanction_cases(id),
  user_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL CHECK(action IN ('warning','functional_restriction','temporary_suspension','permanent_block')),
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  applied_at timestamptz NOT NULL DEFAULT now(),
  CHECK((action='temporary_suspension')=(ends_at IS NOT NULL))
);

CREATE INDEX moderation_sanction_effects_active_user_idx
  ON moderation_sanction_effects(user_id,action,ends_at) WHERE active;

ALTER TABLE account_notices DROP CONSTRAINT account_notices_kind_check;
ALTER TABLE account_notices ADD CONSTRAINT account_notices_kind_check
  CHECK (kind IN ('child_profile_age_limit','child_profile_change','child_profile_responsibility','child_data_emergency_access','authority_request','exchange_difference_payment','exchange_dispute_evidence','exchange_dispute_decision','exchange_settlement_status','exchange_settlement_reconciliation','moderation_sanction'));

COMMENT ON TABLE moderation_sanction_effects IS
  'Applied sanction scope; never disables login, support, history or existing obligations.';
