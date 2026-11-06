CREATE TABLE staff_sector_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES users(id),
  target_access_level smallint NOT NULL CHECK(target_access_level BETWEEN 1 AND 4),
  requested_sector text NOT NULL CHECK(requested_sector IN(
    'support','finance','operations','logistics','institutions','moderation',
    'legal_privacy','security','communications','technical'
  )),
  reason text NOT NULL CHECK(char_length(reason) BETWEEN 10 AND 1000),
  proposed_by uuid NOT NULL REFERENCES users(id),
  proposal_step_up_id uuid NOT NULL UNIQUE REFERENCES account_step_up_requests(id),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')),
  decided_by uuid REFERENCES users(id),
  decision_step_up_id uuid UNIQUE REFERENCES account_step_up_requests(id),
  decision_reason text CHECK(decision_reason IS NULL OR char_length(decision_reason) BETWEEN 10 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CHECK((status='pending' AND decided_by IS NULL AND decision_step_up_id IS NULL AND decided_at IS NULL)
    OR (status IN('approved','rejected') AND decided_by IS NOT NULL AND decision_step_up_id IS NOT NULL AND decided_at IS NOT NULL))
);

CREATE UNIQUE INDEX staff_sector_one_pending_target_idx ON staff_sector_change_requests(target_user_id)
  WHERE status='pending';
CREATE INDEX staff_sector_change_queue_idx ON staff_sector_change_requests(status,created_at);

COMMENT ON TABLE staff_sector_change_requests IS
  'Regularização gradual: nível 4/5 propõe setor para conta legada sem setor e nível 5 decide por último.';
