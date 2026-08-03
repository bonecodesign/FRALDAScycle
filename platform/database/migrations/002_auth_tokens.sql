BEGIN;

CREATE TYPE auth_token_kind AS ENUM ('email_verification', 'password_recovery');

CREATE TABLE auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind auth_token_kind NOT NULL,
  token_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_tokens_active_idx
  ON auth_tokens (user_id, kind, expires_at)
  WHERE consumed_at IS NULL;

CREATE TABLE login_attempts (
  id bigserial PRIMARY KEY,
  email_hash bytea NOT NULL,
  ip_hash bytea,
  succeeded boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_rate_limit_idx
  ON login_attempts (email_hash, attempted_at DESC);

COMMIT;
