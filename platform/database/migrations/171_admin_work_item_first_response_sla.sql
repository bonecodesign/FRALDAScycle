ALTER TABLE admin_work_items
  ADD COLUMN first_response_due_at timestamptz,
  ADD COLUMN first_responded_at timestamptz;

UPDATE admin_work_items
SET first_response_due_at = COALESCE(due_at, CASE priority
  WHEN 'critical' THEN created_at + interval '30 minutes'
  WHEN 'high' THEN created_at + interval '4 hours'
  WHEN 'normal' THEN created_at + interval '1 day'
  ELSE created_at + interval '2 days'
END);

ALTER TABLE admin_work_items
  ALTER COLUMN first_response_due_at SET NOT NULL,
  ADD CONSTRAINT admin_work_items_first_response_order_check
    CHECK(first_response_due_at >= created_at AND (first_responded_at IS NULL OR first_responded_at >= created_at));

CREATE INDEX admin_work_items_first_response_queue_idx
  ON admin_work_items(first_response_due_at,priority,created_at)
  WHERE first_responded_at IS NULL AND status NOT IN('resolved','closed','cancelled');
