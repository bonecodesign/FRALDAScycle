CREATE TABLE account_operational_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  email boolean NOT NULL,
  sms boolean NOT NULL,
  push boolean NOT NULL,
  quiet_enabled boolean NOT NULL,
  quiet_start text,
  quiet_end text,
  time_zone text NOT NULL CHECK (length(time_zone) BETWEEN 1 AND 64),
  version integer NOT NULL CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((NOT quiet_enabled AND quiet_start IS NULL AND quiet_end IS NULL) OR
    (quiet_enabled AND quiet_start IS NOT NULL AND quiet_end IS NOT NULL AND
     quiet_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND
     quiet_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND quiet_start <> quiet_end))
);
CREATE TABLE operational_preference_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  version integer NOT NULL CHECK (version > 0),
  preferences jsonb NOT NULL CHECK (jsonb_typeof(preferences)='object'),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,version)
);
