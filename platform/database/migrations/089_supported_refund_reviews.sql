CREATE TABLE supported_refund_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supported_cancellation_id uuid NOT NULL REFERENCES supported_cancellations(id),
  actor_user_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL CHECK(action IN ('provider_follow_up','support_reanalysis')),
  note text NOT NULL CHECK(char_length(note) BETWEEN 10 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX supported_refund_reviews_history_idx
  ON supported_refund_reviews(supported_cancellation_id,created_at DESC);
