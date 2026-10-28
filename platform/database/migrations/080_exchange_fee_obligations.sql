ALTER TABLE exchange_operations
  ADD COLUMN requester_declared_value_cents integer CHECK (requester_declared_value_cents > 0),
  ADD COLUMN owner_declared_value_cents integer CHECK (owner_declared_value_cents > 0);

CREATE TABLE exchange_fee_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES exchange_operations(transaction_id),
  participant_id uuid NOT NULL REFERENCES users(id),
  offered_listing_id uuid NOT NULL REFERENCES listings(id),
  declared_value_cents integer NOT NULL CHECK (declared_value_cents > 0),
  fee_basis_points integer NOT NULL DEFAULT 250 CHECK (fee_basis_points = 250),
  fee_cents integer NOT NULL CHECK (fee_cents >= 0),
  status text NOT NULL DEFAULT 'not_charged' CHECK (status IN ('not_charged','provider_pending','paid','cancelled','refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, participant_id),
  UNIQUE (transaction_id, offered_listing_id),
  CHECK (fee_cents = ((declared_value_cents::bigint * fee_basis_points + 5000) / 10000)::integer)
);

COMMENT ON TABLE exchange_fee_obligations IS
  'Snapshots locais de 2,5% por participante; não representam cobrança nem autorização do provedor.';
