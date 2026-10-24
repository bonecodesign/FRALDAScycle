ALTER TABLE child_profiles
  ADD COLUMN lifecycle_ended_reason text,
  ADD CONSTRAINT child_profile_lifecycle_end_reason CHECK (
    lifecycle_ended_reason IS NULL OR lifecycle_ended_reason = 'age_limit'
  );

CREATE TABLE child_profile_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('age_limit_warning','age_limit_closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id,event_type)
);

CREATE TABLE account_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind = 'child_profile_age_limit'),
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX account_notices_user_unread_idx
  ON account_notices(user_id,created_at DESC) WHERE read_at IS NULL;

COMMENT ON TABLE child_profile_lifecycle_events IS
  'Dedupe administrativo do ciclo etário; nunca armazena data de nascimento.';
