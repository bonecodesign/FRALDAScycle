CREATE TABLE premium_provider_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  provider text NOT NULL CHECK(provider='asaas'),
  local_reference text NOT NULL UNIQUE,
  idempotency_key text NOT NULL UNIQUE,
  provider_customer_id text,
  provider_subscription_id text UNIQUE,
  amount_cents integer NOT NULL CHECK(amount_cents=1490),
  price_version text NOT NULL CHECK(price_version='FC-PREMIUM-1490-1'),
  status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','provider_pending','payment_failed','active','renewal_failed','cancellation_pending','cancelled','failed')),
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX premium_provider_subscriptions_open_user_idx
  ON premium_provider_subscriptions(user_id) WHERE status IN ('reserved','provider_pending','active','renewal_failed','cancellation_pending');
COMMENT ON TABLE premium_provider_subscriptions IS
  'Metadados da recorrência Premium; nunca armazena token, PAN ou CVV. Benefícios dependem de evento pago reconciliado.';
