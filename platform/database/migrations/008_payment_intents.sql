CREATE TYPE payment_intent_status AS ENUM ('provider_pending', 'pending', 'authorized', 'paid', 'failed', 'cancelled', 'refunded');

CREATE TABLE payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id),
  buyer_id uuid NOT NULL REFERENCES users(id),
  idempotency_key text NOT NULL UNIQUE,
  method text NOT NULL CHECK (method IN ('pix', 'credit', 'debit', 'boleto')),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  platform_fee_cents integer NOT NULL CHECK (platform_fee_cents >= 0),
  delivery_fee_cents integer NOT NULL CHECK (delivery_fee_cents >= 0),
  seller_amount_cents integer NOT NULL CHECK (seller_amount_cents >= 0),
  provider_reference text UNIQUE,
  status payment_intent_status NOT NULL DEFAULT 'provider_pending',
  checkout_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_split_total CHECK (
    platform_fee_cents + delivery_fee_cents + seller_amount_cents = amount_cents
  )
);
CREATE INDEX payment_intents_transaction_idx ON payment_intents (transaction_id, created_at DESC);
CREATE INDEX payment_intents_provider_idx ON payment_intents (provider_reference) WHERE provider_reference IS NOT NULL;
