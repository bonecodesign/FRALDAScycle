CREATE TYPE notification_status AS ENUM ('pending', 'processing', 'delivered', 'failed');

CREATE TABLE notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind auth_token_kind NOT NULL,
  recipient text NOT NULL,
  payload jsonb NOT NULL,
  status notification_status NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notification_outbox_dispatch_idx
  ON notification_outbox (status, available_at, created_at)
  WHERE status IN ('pending', 'failed');
