CREATE TABLE pilot_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token_hash bytea NOT NULL UNIQUE,
  purpose text NOT NULL,
  issued_by uuid NOT NULL REFERENCES users(id),
  request_reference text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_by uuid REFERENCES users(id),
  consumed_at timestamptz,
  revoked_by uuid REFERENCES users(id),
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pilot_invitation_email_normalized CHECK (email=lower(trim(email))),
  CONSTRAINT pilot_invitation_purpose_length CHECK (char_length(purpose) BETWEEN 10 AND 240),
  CONSTRAINT pilot_invitation_expiry_after_issue CHECK (expires_at>created_at),
  CONSTRAINT pilot_invitation_consumption_complete CHECK (
    (consumed_by IS NULL AND consumed_at IS NULL) OR
    (consumed_by IS NOT NULL AND consumed_at IS NOT NULL)
  ),
  CONSTRAINT pilot_invitation_revocation_complete CHECK (
    (revoked_by IS NULL AND revoked_at IS NULL AND revocation_reason IS NULL) OR
    (revoked_by IS NOT NULL AND revoked_at IS NOT NULL AND
      char_length(revocation_reason) BETWEEN 10 AND 240)
  ),
  CONSTRAINT pilot_invitation_terminal_state_exclusive CHECK (
    consumed_at IS NULL OR revoked_at IS NULL
  )
);

CREATE UNIQUE INDEX pilot_invitations_one_open_email_idx
  ON pilot_invitations(email) WHERE consumed_at IS NULL AND revoked_at IS NULL;
CREATE INDEX pilot_invitations_operational_queue_idx
  ON pilot_invitations(expires_at,created_at,id)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;

COMMENT ON COLUMN pilot_invitations.token_hash IS
  'SHA-256 digest only; plaintext invitation tokens must never be persisted.';
COMMENT ON TABLE pilot_invitations IS
  'Local pilot admission control; persistence does not claim external invitation delivery.';
