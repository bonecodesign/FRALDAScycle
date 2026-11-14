ALTER TABLE operational_resume_requests
  DROP CONSTRAINT IF EXISTS operational_resume_requests_status_check,
  DROP CONSTRAINT IF EXISTS operational_resume_requests_decision_reason_check,
  DROP CONSTRAINT IF EXISTS operational_resume_requests_check;

ALTER TABLE operational_resume_requests
  ADD COLUMN reviewed_by uuid REFERENCES users(id),
  ADD COLUMN review_step_up_id uuid UNIQUE REFERENCES account_step_up_requests(id),
  ADD COLUMN review_reason text,
  ADD COLUMN reviewed_at timestamptz;

UPDATE operational_resume_requests SET status = 'pending_level4' WHERE status = 'pending';

ALTER TABLE operational_resume_requests
  ALTER COLUMN status SET DEFAULT 'pending_level4',
  ADD CONSTRAINT operational_resume_requests_status_check
    CHECK (status IN ('pending_level4','pending_level5','approved','rejected','superseded')),
  ADD CONSTRAINT operational_resume_requests_review_reason_check
    CHECK (review_reason IS NULL OR length(review_reason) BETWEEN 10 AND 500),
  ADD CONSTRAINT operational_resume_requests_decision_reason_check
    CHECK (decision_reason IS NULL OR length(decision_reason) BETWEEN 10 AND 500),
  ADD CONSTRAINT operational_resume_requests_stage_check CHECK (
    (status = 'pending_level4' AND reviewed_at IS NULL AND decided_at IS NULL)
    OR (status = 'pending_level5' AND reviewed_at IS NOT NULL AND decided_at IS NULL)
    OR (status IN ('approved','superseded') AND reviewed_at IS NOT NULL AND decided_at IS NOT NULL)
    OR (status = 'rejected' AND (reviewed_at IS NOT NULL OR decided_at IS NOT NULL))
  );

DROP INDEX IF EXISTS operational_resume_requests_one_pending_domain;
DROP INDEX IF EXISTS operational_resume_one_pending_domain_idx;
CREATE UNIQUE INDEX operational_resume_requests_one_pending_domain
  ON operational_resume_requests(domain)
  WHERE status IN ('pending_level4','pending_level5');
