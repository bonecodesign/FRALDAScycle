CREATE TABLE privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES users(id),
  kind text NOT NULL CHECK(kind IN('access','correction','deletion')),
  ticket_id uuid NOT NULL UNIQUE REFERENCES support_tickets(id),
  idempotency_key text NOT NULL UNIQUE,
  details text NOT NULL CHECK(char_length(details) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK(status IN('open','under_review')),
  version integer NOT NULL DEFAULT 0 CHECK(version>=0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX privacy_requests_owner_idx ON privacy_requests(requester_id,created_at DESC);
CREATE TABLE privacy_request_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES privacy_requests(id),
  reviewer_id uuid NOT NULL REFERENCES users(id),
  version integer NOT NULL CHECK(version>0),
  reason text NOT NULL CHECK(char_length(reason) BETWEEN 10 AND 2000),
  obligations_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id,version)
);
-- No retention period, erasure authorization, account closure or legal activation is introduced.
