ALTER TYPE auth_token_kind ADD VALUE IF NOT EXISTS 'payment_reminder';
ALTER TYPE auth_token_kind ADD VALUE IF NOT EXISTS 'delivery_reminder';
ALTER TYPE auth_token_kind ADD VALUE IF NOT EXISTS 'general_reminder';

ALTER TABLE notification_outbox
  ADD COLUMN recipient_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX notification_outbox_recipient_user_idx
  ON notification_outbox(recipient_user_id, status, available_at)
  WHERE recipient_user_id IS NOT NULL;
