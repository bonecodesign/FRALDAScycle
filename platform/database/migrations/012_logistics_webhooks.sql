CREATE TABLE logistics_webhook_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  provider_reference text NOT NULL,
  occurred_at timestamptz NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  payload_hash bytea NOT NULL
);
CREATE INDEX logistics_webhook_reference_idx ON logistics_webhook_events (provider_reference, processed_at DESC);
