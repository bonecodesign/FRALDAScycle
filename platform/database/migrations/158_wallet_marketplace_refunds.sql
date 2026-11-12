ALTER TABLE supported_cancellations
  ADD COLUMN wallet_refund_cents integer NOT NULL DEFAULT 0 CHECK(wallet_refund_cents>=0),
  ADD COLUMN provider_refund_cents integer NOT NULL DEFAULT 0 CHECK(provider_refund_cents>=0);

UPDATE supported_cancellations SET provider_refund_cents=refund_amount_cents;

ALTER TABLE supported_cancellations ADD CONSTRAINT supported_cancellation_refund_origin_total
  CHECK(status='provider_pending' OR wallet_refund_cents+provider_refund_cents=refund_amount_cents);

ALTER TABLE supported_cancellations DROP CONSTRAINT supported_cancellations_completion_source_check;
ALTER TABLE supported_cancellations ADD CONSTRAINT supported_cancellations_completion_source_check
  CHECK(completion_source IN ('webhook','reconciliation','local_wallet','legacy'));

ALTER TABLE supported_cancellations DROP CONSTRAINT supported_cancellation_completion_check;
ALTER TABLE supported_cancellations ADD CONSTRAINT supported_cancellation_completion_check CHECK (
  (status='completed' AND completed_at IS NOT NULL AND completion_source IS NOT NULL
    AND ((completion_source='webhook' AND completion_webhook_event_id IS NOT NULL)
      OR (completion_source IN ('reconciliation','local_wallet','legacy') AND completion_webhook_event_id IS NULL)))
  OR (status<>'completed' AND completed_at IS NULL AND completion_source IS NULL AND completion_webhook_event_id IS NULL)
);

COMMENT ON COLUMN supported_cancellations.wallet_refund_cents IS
  'Exact portion returned to the internal courier wallet after provider confirmation, or locally for wallet-only purchases.';
COMMENT ON COLUMN supported_cancellations.provider_refund_cents IS
  'Exact portion returned by the original external payment provider.';
