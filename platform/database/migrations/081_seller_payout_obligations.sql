CREATE TABLE seller_payout_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL UNIQUE REFERENCES shipments(id),
  transaction_id uuid NOT NULL UNIQUE REFERENCES transactions(id),
  payment_intent_id uuid NOT NULL UNIQUE REFERENCES payment_intents(id),
  seller_id uuid NOT NULL REFERENCES users(id),
  gross_product_cents integer NOT NULL CHECK (gross_product_cents > 0),
  platform_fee_cents integer NOT NULL CHECK (platform_fee_cents >= 0),
  seller_amount_cents integer NOT NULL CHECK (seller_amount_cents >= 0),
  eligibility_snapshot jsonb NOT NULL,
  status text NOT NULL DEFAULT 'provider_pending' CHECK (status IN ('provider_pending','processing','paid','failed','cancelled','refunded')),
  provider_reference text,
  prepared_by uuid NOT NULL REFERENCES users(id),
  prepared_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (platform_fee_cents + seller_amount_cents = gross_product_cents),
  CHECK ((status='paid' AND provider_reference IS NOT NULL) OR status<>'paid')
);

COMMENT ON TABLE seller_payout_obligations IS
  'Obrigação local preparada após elegibilidade; não autoriza nem executa transferência externa.';
