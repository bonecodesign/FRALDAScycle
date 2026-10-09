ALTER TYPE notification_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TABLE notification_outbox
  ADD COLUMN auth_token_id uuid REFERENCES auth_tokens(id) ON DELETE SET NULL;
CREATE INDEX notification_outbox_auth_token_idx ON notification_outbox(auth_token_id)
  WHERE auth_token_id IS NOT NULL;
