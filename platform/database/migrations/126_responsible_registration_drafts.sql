CREATE TABLE responsible_registration_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash)=32),
  encrypted_payload bytea NOT NULL,
  encryption_iv bytea NOT NULL CHECK (octet_length(encryption_iv)=12),
  authentication_tag bytea NOT NULL CHECK (octet_length(authentication_tag)=16),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at<=created_at+interval '24 hours')
);

CREATE INDEX responsible_registration_drafts_expiry_idx
  ON responsible_registration_drafts(expires_at);

COMMENT ON TABLE responsible_registration_drafts IS
  'Rascunho anônimo criptografado por no máximo 24 horas; proíbe senha, CPF, nascimento e convite no payload.';

