-- Persistent local accounting discrepancies; not proof of provider reconciliation.
CREATE TABLE freight_reconciliation_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_settlement_plan_id uuid NOT NULL REFERENCES freight_settlement_plans(id),
  code text NOT NULL CHECK (code IN (
    'plan_allocation_invalid','quote_changed_or_unconfirmed','transaction_invalid',
    'exchange_leg_payment_not_configured','payment_not_confirmed',
    'payment_cardinality_invalid','financial_case_pending','product_amount_invalid',
    'payment_split_mismatch'
  )),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  detected_by uuid NOT NULL REFERENCES users(id),
  resolved_by uuid REFERENCES users(id),
  CHECK ((status='resolved')=(resolved_at IS NOT NULL AND resolved_by IS NOT NULL))
);
CREATE UNIQUE INDEX freight_reconciliation_incidents_open_unique
  ON freight_reconciliation_incidents(freight_settlement_plan_id,code)
  WHERE status='open';
CREATE INDEX freight_reconciliation_incidents_plan_idx
  ON freight_reconciliation_incidents(freight_settlement_plan_id,first_detected_at DESC);
COMMENT ON TABLE freight_reconciliation_incidents IS
  'Audit of local accounting inconsistencies only; no external payment or payout approval.';
