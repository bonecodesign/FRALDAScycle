ALTER TABLE account_step_up_requests DROP CONSTRAINT account_step_up_requests_purpose_check;
ALTER TABLE account_step_up_requests ADD CONSTRAINT account_step_up_requests_purpose_check
  CHECK(purpose IN ('data_export','account_closure','staff_access_change','refund_execution'));

ALTER TABLE supported_cancellations
  ADD COLUMN execution_idempotency_key uuid UNIQUE,
  ADD COLUMN executed_by uuid REFERENCES users(id),
  ADD COLUMN provider_case_reference text,
  ADD COLUMN execution_failure_code text,
  ADD COLUMN submitted_at timestamptz;

ALTER TABLE supported_cancellations ADD CONSTRAINT supported_cancellation_execution_check CHECK (
  (status='provider_pending' AND execution_idempotency_key IS NULL AND executed_by IS NULL AND submitted_at IS NULL)
  OR (status IN ('submitted','completed','failed') AND execution_idempotency_key IS NOT NULL AND executed_by IS NOT NULL AND submitted_at IS NOT NULL)
  OR (status IN ('completed','failed') AND execution_idempotency_key IS NULL AND executed_by IS NULL AND submitted_at IS NULL)
);
