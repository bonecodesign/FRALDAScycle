ALTER TABLE supported_cancellations
  ADD COLUMN completed_at timestamptz,
  ADD COLUMN completion_source text CHECK(completion_source IN ('webhook','reconciliation','legacy')),
  ADD COLUMN completion_webhook_event_id text REFERENCES payment_webhook_events(id);

UPDATE supported_cancellations SET completed_at=updated_at,completion_source='legacy'
WHERE status='completed' AND completed_at IS NULL;

ALTER TABLE supported_cancellations ADD CONSTRAINT supported_cancellation_completion_check CHECK (
  (status='completed' AND completed_at IS NOT NULL AND completion_source IS NOT NULL
    AND ((completion_source='webhook' AND completion_webhook_event_id IS NOT NULL)
      OR (completion_source='reconciliation' AND completion_webhook_event_id IS NULL)
      OR (completion_source='legacy' AND completion_webhook_event_id IS NULL)))
  OR (status<>'completed' AND completed_at IS NULL AND completion_source IS NULL AND completion_webhook_event_id IS NULL)
);

CREATE INDEX supported_cancellations_submitted_idx
  ON supported_cancellations(submitted_at) WHERE status='submitted';

CREATE TABLE supported_refund_reconciliation_checks (
  id bigserial PRIMARY KEY,
  supported_cancellation_id uuid NOT NULL REFERENCES supported_cancellations(id),
  provider_case_reference text NOT NULL,
  observed_status text NOT NULL CHECK(observed_status IN ('submitted','under_review','completed','failed','unknown')),
  observed_amount_cents integer CHECK(observed_amount_cents>=0),
  matched boolean NOT NULL,
  failure_code text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX supported_refund_reconciliation_history_idx
  ON supported_refund_reconciliation_checks(supported_cancellation_id,checked_at DESC);
