ALTER TYPE auth_token_kind ADD VALUE IF NOT EXISTS 'responsible_profile_change';

CREATE TABLE responsible_profile_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  auth_token_id uuid NOT NULL UNIQUE REFERENCES auth_tokens(id) ON DELETE CASCADE,
  challenge_hash bytea NOT NULL UNIQUE CHECK (octet_length(challenge_hash) = 32),
  change_hash bytea NOT NULL CHECK (octet_length(change_hash) = 32),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX responsible_profile_change_one_active_per_user
  ON responsible_profile_change_requests(user_id) WHERE consumed_at IS NULL;

COMMENT ON TABLE responsible_profile_change_requests IS
  'Short-lived authorization records containing only a digest of the proposed adult profile change.';
