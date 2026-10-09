ALTER TABLE donation_operations DROP CONSTRAINT donation_operations_donor_decision_check;
ALTER TABLE donation_operations
  ADD CONSTRAINT donation_operations_donor_decision_check CHECK (donor_decision IN ('relist','redirect','close')),
  ADD COLUMN donor_decision_institution_id uuid REFERENCES institutions(id),
  ADD CONSTRAINT donation_redirect_consistency CHECK (
    (donor_decision = 'redirect' AND donor_decision_institution_id IS NOT NULL AND donor_decision_institution_id <> institution_id)
    OR
    (donor_decision IS DISTINCT FROM 'redirect' AND donor_decision_institution_id IS NULL)
  );
