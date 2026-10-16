CREATE TABLE transaction_contact_authorizations (
  transaction_id uuid NOT NULL REFERENCES transactions(id),
  holder_id uuid NOT NULL REFERENCES users(id),
  email_allowed boolean NOT NULL DEFAULT false,
  phone_allowed boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  authorized_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (transaction_id,holder_id),
  CHECK (email_allowed OR phone_allowed OR revoked_at IS NOT NULL),
  CHECK (authorized_at IS NOT NULL OR revoked_at IS NOT NULL)
);

CREATE INDEX transaction_contact_authorizations_holder_idx
  ON transaction_contact_authorizations(holder_id,updated_at DESC);
