-- Address sharing is not enabled yet; its future implementation must set this
-- timestamp in the same transaction that grants access to the full address.
ALTER TABLE transactions ADD COLUMN address_shared_at timestamptz;

CREATE TABLE support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol bigserial UNIQUE NOT NULL,
  requester_id uuid NOT NULL REFERENCES users(id),
  transaction_id uuid REFERENCES transactions(id),
  category text NOT NULL CHECK (category IN ('general','cancellation','receipt_problem','privacy','account')),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 5 AND 120),
  details text NOT NULL CHECK (char_length(details) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','resolved')),
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_tickets_requester_idx ON support_tickets(requester_id,created_at DESC);
CREATE INDEX support_tickets_transaction_idx ON support_tickets(transaction_id,status);

CREATE TABLE support_ticket_messages (
  id bigserial PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES support_tickets(id),
  author_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL CHECK (char_length(body) BETWEEN 10 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
