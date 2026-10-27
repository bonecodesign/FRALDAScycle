CREATE TABLE asaas_webhook_inbox (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  payment_id text NOT NULL,
  candidate text NOT NULL,
  payload_sha256 text NOT NULL CHECK(payload_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','reconciled','blocked')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
  processing_started_at timestamptz,
  reconciliation_evidence jsonb,
  failure_code text,
  received_at timestamptz NOT NULL DEFAULT now(),
  reconciled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK((status='processing')=(processing_started_at IS NOT NULL)),
  CHECK((status IN ('reconciled','blocked'))=(reconciled_at IS NOT NULL))
);

CREATE INDEX asaas_webhook_pending_idx ON asaas_webhook_inbox(received_at)
  WHERE status='pending';
CREATE INDEX asaas_webhook_payment_idx ON asaas_webhook_inbox(payment_id,received_at DESC);

-- No trigger updates payment_intents or transactions. Native events remain
-- reconciliation evidence until the financial activation is approved.
