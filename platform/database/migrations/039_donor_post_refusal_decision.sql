ALTER TABLE donation_operations DROP CONSTRAINT donation_operations_version_check;
ALTER TABLE donation_operations DROP CONSTRAINT donation_refusal_consistency;
ALTER TABLE donation_operations
  ADD CONSTRAINT donation_operations_version_check CHECK (version IN (1,2,3,4)),
  ADD COLUMN donor_decision text CHECK (donor_decision IN ('relist','close')),
  ADD COLUMN donor_decided_at timestamptz,
  ADD COLUMN donor_decision_idempotency_key text UNIQUE,
  ADD CONSTRAINT donation_refusal_consistency CHECK (
    (refused_at IS NULL AND refused_by IS NULL AND refusal_reason IS NULL
      AND refusal_note IS NULL AND refusal_evidence_key IS NULL AND refusal_idempotency_key IS NULL)
    OR
    (version IN (3,4) AND refused_at IS NOT NULL AND refused_by = representative_id
      AND refusal_reason IS NOT NULL AND refusal_idempotency_key IS NOT NULL
      AND (refusal_reason <> 'other' OR length(trim(refusal_note)) >= 10))
  ),
  ADD CONSTRAINT donation_donor_decision_consistency CHECK (
    (version < 4 AND donor_decision IS NULL AND donor_decided_at IS NULL AND donor_decision_idempotency_key IS NULL)
    OR
    (version = 4 AND donor_decision IS NOT NULL AND donor_decided_at IS NOT NULL AND donor_decision_idempotency_key IS NOT NULL)
  );
