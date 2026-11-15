ALTER TABLE account_notices DROP CONSTRAINT account_notices_kind_check;
ALTER TABLE account_notices ADD CONSTRAINT account_notices_kind_check
  CHECK (kind IN (
    'child_profile_age_limit','child_profile_change','child_profile_responsibility',
    'child_data_emergency_access','authority_request','exchange_difference_payment',
    'exchange_dispute_evidence','exchange_dispute_decision','exchange_settlement_status',
    'exchange_settlement_reconciliation','moderation_sanction',
    'operational_payment','operational_delivery','operational_approval'
  ));

COMMENT ON CONSTRAINT account_notices_kind_check ON account_notices IS
  'Necessary in-app notices are transactional and must never contain promotional content.';
