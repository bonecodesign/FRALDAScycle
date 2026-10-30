CREATE TABLE supported_refund_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supported_cancellation_id uuid NOT NULL REFERENCES supported_cancellations(id),
  kind text NOT NULL CHECK(kind IN ('provider_confirmation_overdue')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution text CHECK(resolution IS NULL OR char_length(resolution) BETWEEN 10 AND 500)
);

CREATE UNIQUE INDEX supported_refund_alert_open_unique
  ON supported_refund_alerts(supported_cancellation_id,kind) WHERE resolved_at IS NULL;
CREATE INDEX supported_refund_alert_open_queue
  ON supported_refund_alerts(created_at) WHERE resolved_at IS NULL;
