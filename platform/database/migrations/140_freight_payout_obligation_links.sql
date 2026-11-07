-- Nullable references preserve previously prepared legacy obligations.
-- New freight-linked obligations are tied to the exact local quote plan.
ALTER TABLE seller_payout_obligations
  ADD COLUMN freight_settlement_plan_id uuid REFERENCES freight_settlement_plans(id);
ALTER TABLE courier_payout_obligations
  ADD COLUMN freight_settlement_plan_id uuid REFERENCES freight_settlement_plans(id);

CREATE UNIQUE INDEX seller_payout_freight_plan_unique
  ON seller_payout_obligations(freight_settlement_plan_id)
  WHERE freight_settlement_plan_id IS NOT NULL;
CREATE UNIQUE INDEX courier_payout_freight_plan_unique
  ON courier_payout_obligations(freight_settlement_plan_id)
  WHERE freight_settlement_plan_id IS NOT NULL;

COMMENT ON COLUMN seller_payout_obligations.freight_settlement_plan_id
  IS 'Local accounting provenance only; never authorizes a transfer.';
COMMENT ON COLUMN courier_payout_obligations.freight_settlement_plan_id
  IS 'Local accounting provenance only; never authorizes a transfer.';
