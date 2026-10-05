CREATE TABLE account_marketing_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  email boolean NOT NULL DEFAULT false,
  sms boolean NOT NULL DEFAULT false,
  push boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE marketing_preference_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  email boolean NOT NULL,
  sms boolean NOT NULL,
  push boolean NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  version text NOT NULL,
  content_hash char(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  document_snapshot jsonb NOT NULL CHECK (jsonb_typeof(document_snapshot)='array'),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,version,content_hash)
);
