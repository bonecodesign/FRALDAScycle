ALTER TABLE courier_wallet_blocked_resolutions
  ADD COLUMN execution_result text CHECK(execution_result IS NULL OR execution_result IN ('retry_queued','wallet_returned')),
  ADD COLUMN executed_at timestamptz;

ALTER TABLE courier_wallet_blocked_resolutions ADD CONSTRAINT courier_wallet_blocked_execution_consistency CHECK(
  (status='executed' AND execution_result IS NOT NULL AND executed_at IS NOT NULL)
  OR (status<>'executed' AND execution_result IS NULL AND executed_at IS NULL)
);

COMMENT ON COLUMN courier_wallet_blocked_resolutions.execution_result IS
  'System execution result after independent levels 3, 4 and 5; exactly one retry queueing or wallet return.';
