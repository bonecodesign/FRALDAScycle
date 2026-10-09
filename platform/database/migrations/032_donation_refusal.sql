ALTER TABLE donation_operations
  DROP CONSTRAINT donation_operations_version_check;

ALTER TABLE donation_operations
  ADD CONSTRAINT donation_operations_version_check CHECK (version IN (1, 2, 3)),
  ADD COLUMN refused_at timestamptz,
  ADD COLUMN refused_by uuid REFERENCES users(id),
  ADD COLUMN refusal_reason text CHECK (refusal_reason IN (
    'sanitary_condition', 'outside_scope', 'insufficient_expiry',
    'institution_capacity', 'listing_mismatch', 'other'
  )),
  ADD COLUMN refusal_note text,
  ADD COLUMN refusal_evidence_key text,
  ADD COLUMN refusal_idempotency_key text UNIQUE,
  ADD CONSTRAINT donation_refusal_consistency CHECK (
    (refused_at IS NULL AND refused_by IS NULL AND refusal_reason IS NULL
      AND refusal_note IS NULL AND refusal_evidence_key IS NULL AND refusal_idempotency_key IS NULL)
    OR
    (version = 3 AND refused_at IS NOT NULL AND refused_by = representative_id
      AND refusal_reason IS NOT NULL AND refusal_idempotency_key IS NOT NULL
      AND (refusal_reason <> 'other' OR length(trim(refusal_note)) >= 10))
  );
