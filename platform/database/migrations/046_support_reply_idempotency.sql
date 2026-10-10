-- Legacy messages remain readable; new replies persist their original intent.
ALTER TABLE support_ticket_messages ADD COLUMN idempotency_key text;
ALTER TABLE support_ticket_messages ADD COLUMN requested_status text;
ALTER TABLE support_ticket_messages ADD CONSTRAINT support_reply_intent_check CHECK (
  (idempotency_key IS NULL AND requested_status IS NULL) OR
  (idempotency_key IS NOT NULL AND char_length(idempotency_key) BETWEEN 16 AND 128
    AND requested_status IS NOT NULL AND requested_status IN ('open','under_review','resolved'))
);
ALTER TABLE support_ticket_messages ADD CONSTRAINT support_reply_actor_key_unique UNIQUE(author_id,idempotency_key);
CREATE INDEX support_tickets_page_idx ON support_tickets(created_at DESC,id DESC);
CREATE INDEX support_tickets_requester_page_idx ON support_tickets(requester_id,created_at DESC,id DESC);
