ALTER TABLE users
  ADD COLUMN adult_declaration_version text,
  ADD COLUMN adult_declared_at timestamptz,
  ADD CONSTRAINT adult_declaration_consistency CHECK (
    (adult_declaration_version IS NULL AND adult_declared_at IS NULL)
    OR
    (adult_declaration_version = 'FC-AGE-1' AND adult_declared_at IS NOT NULL)
  );

CREATE TABLE child_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label text,
  birth_date date NOT NULL,
  consent_version text NOT NULL CHECK (consent_version = 'FC-CHILD-PROFILE-1'),
  consented_at timestamptz NOT NULL,
  personalization_enabled boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (label IS NULL OR length(trim(label)) BETWEEN 1 AND 50),
  CHECK (deleted_at IS NULL OR personalization_enabled = false)
);

CREATE INDEX child_profiles_account_active_idx
  ON child_profiles(account_id, created_at DESC) WHERE deleted_at IS NULL;

COMMENT ON TABLE child_profiles IS 'Fundação inativa por padrão; ativação exige revisão de privacidade e CHILD_PROFILES_ENABLED=true.';
COMMENT ON COLUMN child_profiles.birth_date IS 'Dado privado; nunca expor a parceiros ou respostas de personalização. Derivar somente faixa etária.';
