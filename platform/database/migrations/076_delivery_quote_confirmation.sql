CREATE TABLE delivery_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id),
  provider text NOT NULL CHECK(provider IN ('lalamove','fraldacycle_courier','loggi_express','uber_direct')),
  provider_quote_id text NOT NULL,
  request_fingerprint text NOT NULL,
  base_freight_cents integer NOT NULL CHECK(base_freight_cents>0),
  platform_fee_cents integer NOT NULL CHECK(platform_fee_cents>=0),
  customer_total_cents integer NOT NULL CHECK(customer_total_cents=base_freight_cents+platform_fee_cents),
  currency text NOT NULL CHECK(currency='BRL'),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'quoted' CHECK(status IN ('quoted','confirmed','locked','expired','superseded')),
  confirmed_by uuid REFERENCES users(id),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,provider_quote_id),
  CHECK(
    (status='quoted' AND confirmed_by IS NULL AND confirmed_at IS NULL)
    OR (status IN ('confirmed','locked') AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL)
    OR status IN ('expired','superseded')
  )
);
CREATE UNIQUE INDEX delivery_quotes_one_current ON delivery_quotes(transaction_id)
  WHERE status IN ('quoted','confirmed','locked');
CREATE INDEX delivery_quotes_expiration_idx ON delivery_quotes(expires_at) WHERE status='quoted';

-- Only a one-way request fingerprint and commercial quote fields are retained.
-- Existing paid transactions may only lock the confirmed quote, never switch it.
