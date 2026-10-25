ALTER TABLE users
  ADD COLUMN legal_name text,
  ADD COLUMN cpf_fingerprint bytea,
  ADD COLUMN adult_birth_date date,
  ADD COLUMN responsible_truth_version text,
  ADD COLUMN responsible_truth_declared_at timestamptz,
  ADD COLUMN responsible_registration_completed_at timestamptz,
  ADD CONSTRAINT users_responsible_registration_consistency CHECK (
    (responsible_registration_completed_at IS NULL
      AND legal_name IS NULL
      AND cpf_fingerprint IS NULL
      AND adult_birth_date IS NULL
      AND responsible_truth_version IS NULL
      AND responsible_truth_declared_at IS NULL)
    OR
    (responsible_registration_completed_at IS NOT NULL
      AND length(trim(legal_name)) BETWEEN 3 AND 160
      AND octet_length(cpf_fingerprint) = 32
      AND adult_birth_date IS NOT NULL
      AND responsible_truth_version = 'FC-RESPONSIBLE-1'
      AND responsible_truth_declared_at IS NOT NULL)
  );

CREATE UNIQUE INDEX users_cpf_fingerprint_unique
  ON users (cpf_fingerprint)
  WHERE cpf_fingerprint IS NOT NULL;

ALTER TABLE addresses
  ADD COLUMN is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  ADD COLUMN postal_verification_fingerprint char(43),
  ADD COLUMN postal_verification_provider text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD CONSTRAINT addresses_primary_verification_required CHECK (
    NOT is_primary OR (
      postal_verification_fingerprint IS NOT NULL
      AND postal_verification_provider IN ('google-maps', 'viacep')
    )
  );

CREATE UNIQUE INDEX addresses_one_primary_per_user
  ON addresses (user_id)
  WHERE is_primary = true;

COMMENT ON COLUMN users.cpf_fingerprint IS
  'HMAC-SHA-256 produced by the application; the normalized CPF must never be stored here or in audit events.';
COMMENT ON COLUMN users.adult_birth_date IS
  'Private adult birth date. Do not include in telemetry, general listings, or audit metadata.';
COMMENT ON COLUMN addresses.postal_verification_fingerprint IS
  'Opaque evidence fingerprint bound to the current address version; it contains no raw address.';
