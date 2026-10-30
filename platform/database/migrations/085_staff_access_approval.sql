ALTER TABLE account_step_up_requests DROP CONSTRAINT account_step_up_requests_purpose_check;
ALTER TABLE account_step_up_requests ADD CONSTRAINT account_step_up_requests_purpose_check
  CHECK(purpose IN ('data_export','account_closure','staff_access_change'));

CREATE TABLE staff_access_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES users(id),
  previous_level smallint NOT NULL CHECK(previous_level BETWEEN 1 AND 4),
  requested_level smallint NOT NULL CHECK(requested_level BETWEEN 1 AND 4),
  reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 1000),
  proposed_by uuid NOT NULL REFERENCES users(id),
  proposal_step_up_id uuid NOT NULL UNIQUE REFERENCES account_step_up_requests(id),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  decided_by uuid REFERENCES users(id),
  decision_step_up_id uuid UNIQUE REFERENCES account_step_up_requests(id),
  decision_reason text CHECK(decision_reason IS NULL OR length(trim(decision_reason)) BETWEEN 10 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CHECK(previous_level<>requested_level),
  CHECK((status='pending' AND decided_by IS NULL AND decision_step_up_id IS NULL AND decided_at IS NULL)
    OR (status<>'pending' AND decided_by IS NOT NULL AND decision_step_up_id IS NOT NULL AND decided_at IS NOT NULL))
);

CREATE UNIQUE INDEX staff_access_one_pending_target_idx ON staff_access_change_requests(target_user_id)
  WHERE status='pending';
CREATE INDEX staff_access_change_queue_idx ON staff_access_change_requests(status,created_at);
