CREATE TABLE premium_suspension_pauses (
  moderation_decision_id uuid PRIMARY KEY REFERENCES moderation_decisions(id),
  user_id uuid NOT NULL REFERENCES users(id),
  pause_start timestamptz NOT NULL,
  pause_end timestamptz NOT NULL,
  extension_seconds integer NOT NULL CHECK(extension_seconds>=0),
  applied_at timestamptz NOT NULL DEFAULT now(),
  CHECK(pause_start<=pause_end)
);
CREATE INDEX premium_suspension_pauses_user_idx ON premium_suspension_pauses(user_id,pause_start,pause_end);
