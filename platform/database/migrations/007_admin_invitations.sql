ALTER TYPE auth_token_kind ADD VALUE IF NOT EXISTS 'admin_invitation';

CREATE TABLE admin_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  display_name text NOT NULL,
  role user_role NOT NULL,
  token_hash bytea NOT NULL UNIQUE,
  invited_by uuid NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_invitations_email_normalized CHECK (email = lower(trim(email)))
);

CREATE UNIQUE INDEX admin_invitations_active_email_idx
  ON admin_invitations (email)
  WHERE consumed_at IS NULL;

CREATE INDEX admin_invitations_expiry_idx
  ON admin_invitations (expires_at)
  WHERE consumed_at IS NULL;
