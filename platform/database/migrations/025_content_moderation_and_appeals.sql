CREATE TABLE moderation_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id),
  surface text NOT NULL CHECK(surface IN ('listing','chat','review','account')),
  transaction_id uuid REFERENCES transactions(id),
  rule_version text NOT NULL,
  content_hash text,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'blocked' CHECK(status IN ('blocked','upheld','overturned')),
  decided_by uuid REFERENCES users(id),
  suspended_until timestamptz,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((surface='account' AND suspended_until IS NOT NULL AND content_hash IS NULL AND idempotency_key IS NOT NULL) OR (surface<>'account' AND suspended_until IS NULL AND content_hash IS NOT NULL))
);
CREATE UNIQUE INDEX moderation_content_retry ON moderation_decisions(owner_id,surface,rule_version,content_hash,COALESCE(transaction_id,'00000000-0000-0000-0000-000000000000'::uuid)) WHERE surface<>'account';
CREATE TABLE moderation_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid NOT NULL UNIQUE REFERENCES moderation_decisions(id),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id),
  requester_id uuid NOT NULL REFERENCES users(id),
  review_reason text,
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  outcome text CHECK(outcome IN ('upheld','overturned')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE transaction_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id),
  author_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 2000),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(transaction_id,author_id,idempotency_key)
);
CREATE TABLE transaction_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id),
  author_id uuid NOT NULL REFERENCES users(id),
  subject_id uuid NOT NULL REFERENCES users(id),
  rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment text NOT NULL CHECK(char_length(comment) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(transaction_id,author_id)
);
