-- Referências mensais de preço e ciclo de 30 dias dos anúncios.
-- Esta migration não executa coleta externa nem altera transações já confirmadas.

ALTER TABLE listings
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN price_reference_key text,
  ADD COLUMN pause_reason text,
  ADD CONSTRAINT listings_expiry_after_publication
    CHECK (expires_at IS NULL OR (published_at IS NOT NULL AND expires_at > published_at)),
  ADD CONSTRAINT listings_pause_reason_requires_paused
    CHECK (pause_reason IS NULL OR status = 'paused');

UPDATE listings
SET expires_at = published_at + interval '30 days'
WHERE published_at IS NOT NULL AND expires_at IS NULL;

CREATE INDEX listings_price_reference_idx
  ON listings (price_reference_key)
  WHERE kind='sale' AND price_reference_key IS NOT NULL;

CREATE INDEX listings_expiry_idx
  ON listings (expires_at)
  WHERE status IN ('published', 'paused') AND expires_at IS NOT NULL;

CREATE TABLE market_price_reference_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_key text NOT NULL,
  valid_from date NOT NULL,
  valid_until date NOT NULL,
  prm_cents integer NOT NULL CHECK (prm_cents > 0),
  lowest_retail_cents integer NOT NULL CHECK (lowest_retail_cents > 0),
  effective_ceiling_cents integer NOT NULL CHECK (effective_ceiling_cents > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded','extended','invalid')),
  collected_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until > valid_from),
  CHECK (extract(day FROM valid_from) = 1),
  CHECK (extract(day FROM valid_until) = 1),
  CHECK (effective_ceiling_cents <= lowest_retail_cents),
  UNIQUE (reference_key, valid_from)
);
CREATE INDEX market_price_reference_active_idx
  ON market_price_reference_cycles (reference_key, valid_from DESC)
  WHERE status IN ('active','extended');

CREATE TABLE listing_price_history (
  id bigserial PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reference_cycle_id uuid REFERENCES market_price_reference_cycles(id),
  previous_price_cents integer CHECK (previous_price_cents IS NULL OR previous_price_cents >= 0),
  new_price_cents integer CHECK (new_price_cents IS NULL OR new_price_cents >= 0),
  prm_cents integer CHECK (prm_cents IS NULL OR prm_cents > 0),
  lowest_retail_cents integer CHECK (lowest_retail_cents IS NULL OR lowest_retail_cents > 0),
  economy_basis_points integer,
  reason text NOT NULL,
  actor_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listing_price_history_listing_idx
  ON listing_price_history (listing_id, created_at DESC);
