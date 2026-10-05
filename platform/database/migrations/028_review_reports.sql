ALTER TABLE transaction_reviews ADD COLUMN visibility text NOT NULL DEFAULT 'public' CHECK(visibility IN('public','under_review','removed'));
ALTER TABLE transaction_reviews ADD COLUMN visibility_version integer NOT NULL DEFAULT 0 CHECK(visibility_version>=0);
CREATE TABLE review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES transaction_reviews(id),
  reporter_id uuid NOT NULL REFERENCES users(id),
  category text NOT NULL CHECK(category IN('privacy','fraud','offensive')),
  details text NOT NULL CHECK(char_length(details) BETWEEN 10 AND 2000),
  ticket_id uuid NOT NULL UNIQUE REFERENCES support_tickets(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(review_id,reporter_id)
);
CREATE TABLE review_visibility_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES transaction_reviews(id),
  reviewer_id uuid NOT NULL REFERENCES users(id),
  version integer NOT NULL CHECK(version>0),
  outcome text NOT NULL CHECK(outcome IN('public','removed')),
  reason text NOT NULL CHECK(char_length(reason) BETWEEN 10 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(review_id,version)
);
CREATE TABLE review_visibility_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES transaction_reviews(id),
  version integer NOT NULL CHECK(version>=0),
  author_id uuid NOT NULL REFERENCES users(id),
  ticket_id uuid NOT NULL UNIQUE REFERENCES support_tickets(id),
  details text NOT NULL CHECK(char_length(details) BETWEEN 10 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(review_id,version)
);
