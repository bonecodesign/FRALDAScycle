CREATE TABLE manufacturer_availability_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url text NOT NULL UNIQUE CHECK(source_url LIKE 'https://%'),
  approved boolean NOT NULL DEFAULT false,
  refresh_enabled boolean NOT NULL DEFAULT false,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE manufacturer_availability_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES manufacturer_availability_sources(id),
  product_key text NOT NULL CHECK(product_key ~ '^[A-Za-z0-9._-]{3,80}$'),
  state text NOT NULL CHECK(state IN ('available','unavailable','unknown')),
  checked_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id,product_key,checked_at)
);
CREATE INDEX manufacturer_availability_latest_idx ON manufacturer_availability_observations(source_id,product_key,checked_at DESC);
COMMENT ON TABLE manufacturer_availability_observations IS
  'Sinal auxiliar de disponibilidade pública; nunca substitui faixa oficial nem personalização etária.';
