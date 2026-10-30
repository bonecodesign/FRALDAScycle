ALTER TABLE account_step_up_requests DROP CONSTRAINT account_step_up_requests_purpose_check;
ALTER TABLE account_step_up_requests ADD CONSTRAINT account_step_up_requests_purpose_check
  CHECK(purpose IN ('data_export','account_closure','staff_access_change','refund_execution','operational_resume'));

CREATE TABLE operational_resume_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL REFERENCES operational_controls(domain),
  expected_version integer NOT NULL CHECK(expected_version>0),
  reason text NOT NULL CHECK(char_length(reason) BETWEEN 10 AND 500),
  proposed_by uuid NOT NULL REFERENCES users(id),
  proposal_step_up_id uuid NOT NULL UNIQUE REFERENCES account_step_up_requests(id),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','superseded')),
  decided_by uuid REFERENCES users(id),
  decision_step_up_id uuid UNIQUE REFERENCES account_step_up_requests(id),
  decision_reason text CHECK(decision_reason IS NULL OR char_length(decision_reason) BETWEEN 10 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CHECK((status='pending' AND decided_by IS NULL AND decision_step_up_id IS NULL AND decided_at IS NULL)
    OR (status<>'pending' AND decided_at IS NOT NULL))
);

CREATE UNIQUE INDEX operational_resume_one_pending_domain_idx ON operational_resume_requests(domain) WHERE status='pending';
CREATE INDEX operational_resume_queue_idx ON operational_resume_requests(status,created_at DESC);
