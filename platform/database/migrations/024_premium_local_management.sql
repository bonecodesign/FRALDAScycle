-- Registros de período pago somente por fonte homologada futura ou fixtures isoladas.
-- Não existe endpoint para conceder período, registrar pagamento ou executar cobrança.
CREATE TABLE premium_subscriptions (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  paid_period_start timestamptz NOT NULL,
  paid_period_end timestamptz NOT NULL,
  renewal_enabled boolean NOT NULL,
  renewal_failed_at timestamptz,
  renewal_cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (paid_period_start < paid_period_end),
  CHECK (renewal_failed_at IS NULL OR renewal_failed_at >= paid_period_end)
);
CREATE TABLE premium_listing_choices (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  paid_period_end timestamptz NOT NULL,
  selected_ids uuid[] NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  applied_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(selected_ids) <= 3)
);
CREATE TABLE premium_listing_adjustments (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  kept_ids uuid[] NOT NULL,
  paused_ids uuid[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
