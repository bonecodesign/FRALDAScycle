CREATE TABLE exchange_difference_obligations (
  transaction_id uuid PRIMARY KEY REFERENCES exchange_operations(transaction_id),
  payer_id uuid NOT NULL REFERENCES users(id),
  recipient_id uuid NOT NULL REFERENCES users(id),
  lower_value_cents integer NOT NULL CHECK (lower_value_cents > 0),
  higher_value_cents integer NOT NULL CHECK (higher_value_cents > lower_value_cents),
  amount_cents integer NOT NULL CHECK (amount_cents = higher_value_cents - lower_value_cents),
  status text NOT NULL DEFAULT 'not_charged'
    CHECK (status IN ('not_charged','provider_pending','paid','release_pending','released','cancelled','refunded')),
  provider_reference text UNIQUE,
  paid_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (payer_id <> recipient_id),
  CHECK ((status IN ('paid','release_pending','released','refunded')) = (paid_at IS NOT NULL)),
  CHECK ((status = 'released') = (released_at IS NOT NULL))
);

COMMENT ON TABLE exchange_difference_obligations IS
  'Obrigação local da diferença bilateral; não representa cobrança, retenção ou repasse no provedor.';
