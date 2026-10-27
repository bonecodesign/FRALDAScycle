CREATE TABLE premium_billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  provider text NOT NULL,
  provider_reference text NOT NULL,
  event_type text NOT NULL CHECK(event_type IN ('period_paid','renewal_failed')),
  amount_cents integer CHECK(amount_cents=1290),
  paid_period_start timestamptz,
  paid_period_end timestamptz,
  provider_checked_at timestamptz NOT NULL,
  evidence_sha256 text NOT NULL CHECK(evidence_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,provider_reference,event_type),
  CHECK(
    (event_type='period_paid' AND amount_cents=1290 AND paid_period_start IS NOT NULL AND paid_period_end IS NOT NULL AND paid_period_start<paid_period_end)
    OR
    (event_type='renewal_failed' AND amount_cents IS NULL AND paid_period_start IS NULL AND paid_period_end IS NULL)
  )
);

CREATE INDEX premium_billing_events_user_idx ON premium_billing_events(user_id,created_at DESC);

-- Only reconciled provider adapters may write these events. There is no public
-- HTTP route and this table never stores sensitive billing identity or provider payloads.
