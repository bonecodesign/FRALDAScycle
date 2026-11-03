CREATE TABLE child_profile_consent_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES users(id),
  child_profile_id uuid NOT NULL,
  consent_version text NOT NULL CHECK (consent_version='FC-CHILD-PROFILE-1'),
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  account_closed_at timestamptz,
  retention_due_at timestamptz,
  deleted_at timestamptz,
  UNIQUE(child_profile_id,consent_version),
  CHECK ((account_closed_at IS NULL AND retention_due_at IS NULL)
    OR retention_due_at=account_closed_at+interval '5 years'),
  CHECK (deleted_at IS NULL OR (retention_due_at IS NOT NULL AND deleted_at>=retention_due_at))
);

CREATE INDEX child_profile_consent_evidence_retention_idx
  ON child_profile_consent_evidence(retention_due_at,id)
  WHERE deleted_at IS NULL AND retention_due_at IS NOT NULL;

COMMENT ON TABLE child_profile_consent_evidence IS
  'Evidência minimizada do aceite: não copia data de nascimento, emoji nem atributos infantis; permanece durante a conta e por cinco anos após seu encerramento.';
