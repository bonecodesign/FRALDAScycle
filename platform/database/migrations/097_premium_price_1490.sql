ALTER TABLE premium_billing_events ADD COLUMN price_version text;

UPDATE premium_billing_events SET price_version='FC-PREMIUM-1290-LEGACY'
WHERE price_version IS NULL;

ALTER TABLE premium_billing_events
  ALTER COLUMN price_version SET DEFAULT 'FC-PREMIUM-1490-1',
  ALTER COLUMN price_version SET NOT NULL,
  DROP CONSTRAINT premium_billing_events_amount_cents_check,
  DROP CONSTRAINT premium_billing_events_check;

ALTER TABLE premium_billing_events
  ADD CONSTRAINT premium_billing_events_price_version_check CHECK (
    (price_version='FC-PREMIUM-1290-LEGACY' AND amount_cents=1290)
    OR (price_version='FC-PREMIUM-1490-1' AND (amount_cents=1490 OR amount_cents IS NULL))
  ),
  ADD CONSTRAINT premium_billing_events_current_cycle_check CHECK (
    (event_type='period_paid' AND amount_cents IS NOT NULL AND paid_period_start IS NOT NULL
      AND paid_period_end IS NOT NULL AND paid_period_start<paid_period_end)
    OR (event_type='renewal_failed' AND amount_cents IS NULL
      AND paid_period_start IS NULL AND paid_period_end IS NULL)
  );

COMMENT ON COLUMN premium_billing_events.price_version IS
  'Immutable price version. Legacy 1290 events remain historical; new reconciliations use FC-PREMIUM-1490-1.';
