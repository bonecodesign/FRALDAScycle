CREATE TABLE courier_payout_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL UNIQUE REFERENCES shipments(id),
  transaction_id uuid NOT NULL UNIQUE REFERENCES transactions(id),
  payment_intent_id uuid NOT NULL UNIQUE REFERENCES payment_intents(id),
  courier_id uuid NOT NULL REFERENCES users(id),
  freight_cents integer NOT NULL CHECK (freight_cents > 0),
  platform_fee_cents integer NOT NULL CHECK (platform_fee_cents >= 0),
  courier_amount_cents integer NOT NULL CHECK (courier_amount_cents > 0),
  status text NOT NULL DEFAULT 'provider_pending' CHECK (status IN ('provider_pending','submitted','paid','blocked','failed')),
  eligibility_snapshot jsonb NOT NULL,
  prepared_by uuid NOT NULL REFERENCES users(id),
  prepared_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  provider_reference text UNIQUE,
  failure_code text,
  CHECK (platform_fee_cents + courier_amount_cents = freight_cents)
);

CREATE INDEX courier_payout_status_idx ON courier_payout_obligations(status,prepared_at);
