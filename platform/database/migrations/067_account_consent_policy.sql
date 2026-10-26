ALTER TABLE account_marketing_preferences
  ADD COLUMN notice_version text NOT NULL DEFAULT 'FC-CONSENT-1';

-- Never broaden an older channel-specific consent. Only an existing unanimous
-- opt-in survives; every mixed state migrates to the safer disabled state.
UPDATE account_marketing_preferences
SET email=(email AND sms AND push),sms=(email AND sms AND push),push=(email AND sms AND push);

ALTER TABLE account_marketing_preferences
  ADD CONSTRAINT account_marketing_all_or_nothing CHECK(email=sms AND sms=push);

ALTER TABLE marketing_preference_events
  ADD COLUMN notice_version text NOT NULL DEFAULT 'FC-CONSENT-1';

CREATE TABLE account_cookie_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  analytics boolean NOT NULL DEFAULT false,
  marketing boolean NOT NULL DEFAULT false,
  policy_version text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE account_cookie_preference_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  analytics boolean NOT NULL,
  marketing boolean NOT NULL,
  policy_version text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX account_cookie_preference_events_owner_idx
  ON account_cookie_preference_events(user_id,recorded_at DESC);

-- Consent records are append-only evidence. Retention and final legal wording
-- remain subject to professional approval before production activation.
