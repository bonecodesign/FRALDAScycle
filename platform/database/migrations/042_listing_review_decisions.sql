CREATE TABLE listing_review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES users(id),
  outcome listing_status NOT NULL CHECK (outcome IN ('published', 'removed')),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX listing_review_decisions_listing_idx
  ON listing_review_decisions (listing_id, created_at DESC);
