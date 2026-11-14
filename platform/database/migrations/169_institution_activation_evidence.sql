CREATE TABLE institution_activation_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id),
  actor_user_id uuid NOT NULL REFERENCES users(id),
  previous_status institution_status NOT NULL,
  document_evidence_reference text NOT NULL CHECK(length(document_evidence_reference) BETWEEN 12 AND 256),
  representative_evidence_reference text NOT NULL CHECK(length(representative_evidence_reference) BETWEEN 12 AND 256),
  capacity_evidence_reference text NOT NULL CHECK(length(capacity_evidence_reference) BETWEEN 12 AND 256),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX institution_activation_reviews_institution_created_idx
  ON institution_activation_reviews(institution_id,created_at DESC);

COMMENT ON TABLE institution_activation_reviews IS
  'Minimal references for an individual activation review. Raw institutional documents are never copied into this table or audit metadata.';
