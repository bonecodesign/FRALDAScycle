-- Immutable local breakdown per confirmed quote. No charge, split, escrow,
-- transfer or provider execution is initiated by this table.
CREATE TABLE freight_settlement_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_quote_id uuid NOT NULL UNIQUE REFERENCES delivery_quotes(id),
  transaction_id uuid NOT NULL REFERENCES transactions(id),
  shipment_id uuid REFERENCES shipments(id),
  payer_id uuid NOT NULL REFERENCES users(id),
  provider text NOT NULL,
  provider_amount_cents integer NOT NULL CHECK (provider_amount_cents > 0),
  platform_fee_cents integer NOT NULL CHECK (platform_fee_cents >= 0),
  customer_total_cents integer NOT NULL
    CHECK (customer_total_cents = provider_amount_cents + platform_fee_cents),
  currency text NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  prepared_by uuid NOT NULL REFERENCES users(id),
  prepared_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX freight_settlement_plans_transaction_idx
  ON freight_settlement_plans(transaction_id, prepared_at DESC);
COMMENT ON TABLE freight_settlement_plans IS
  'Local commercial plan only; no funds collected, held or released.';
