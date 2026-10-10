CREATE TABLE support_ticket_internal_notes (
  id bigserial PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES support_tickets(id),
  author_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL CHECK (char_length(body) BETWEEN 10 AND 2000),
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[0-9a-f-]{36}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (author_id,idempotency_key)
);

CREATE INDEX support_ticket_internal_notes_page_idx
  ON support_ticket_internal_notes (ticket_id,created_at,id);
