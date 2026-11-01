ALTER TYPE auth_token_kind ADD VALUE IF NOT EXISTS 'exchange_settlement_reconciliation';

ALTER TABLE account_notices DROP CONSTRAINT account_notices_kind_check;
ALTER TABLE account_notices ADD CONSTRAINT account_notices_kind_check
  CHECK (kind IN ('child_profile_age_limit','exchange_difference_payment','exchange_dispute_evidence','exchange_dispute_decision','exchange_settlement_status','exchange_settlement_reconciliation'));

ALTER TABLE exchange_difference_settlement_commands
  ADD COLUMN reconciliation_started_at timestamptz,
  ADD COLUMN founder_escalated_at timestamptz;

CREATE TABLE exchange_settlement_reconciliation_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id uuid NOT NULL REFERENCES exchange_difference_settlement_commands(id),
  audience_access_level smallint NOT NULL CHECK (audience_access_level IN (3,5)),
  kind text NOT NULL CHECK (kind IN ('finance_immediate','founder_overdue')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(command_id,kind)
);

CREATE INDEX exchange_settlement_reconciliation_due_idx
  ON exchange_difference_settlement_commands(reconciliation_started_at,id)
  WHERE status='reconciliation_required' AND founder_escalated_at IS NULL;
