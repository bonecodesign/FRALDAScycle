CREATE TABLE transaction_contact_access (
  transaction_id uuid PRIMARY KEY REFERENCES transactions(id),
  payment_intent_id uuid NOT NULL UNIQUE REFERENCES payment_intents(id),
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES users(id),
  revocation_reason text,
  CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))
);

CREATE TABLE supported_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL UNIQUE REFERENCES transactions(id),
  support_ticket_id uuid NOT NULL UNIQUE REFERENCES support_tickets(id),
  payment_intent_id uuid NOT NULL UNIQUE REFERENCES payment_intents(id),
  decided_by uuid NOT NULL REFERENCES users(id),
  gross_amount_cents integer NOT NULL CHECK (gross_amount_cents > 0),
  retained_platform_fee_cents integer NOT NULL CHECK (retained_platform_fee_cents >= 0),
  retained_delivery_fee_cents integer NOT NULL CHECK (retained_delivery_fee_cents >= 0),
  refund_amount_cents integer NOT NULL CHECK (refund_amount_cents >= 0),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 1000),
  status text NOT NULL DEFAULT 'provider_pending' CHECK (status IN ('provider_pending','submitted','completed','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (retained_platform_fee_cents + retained_delivery_fee_cents + refund_amount_cents = gross_amount_cents)
);

CREATE INDEX supported_cancellations_status_idx ON supported_cancellations(status,created_at);

-- Existing paid operations become eligible without depending on a new webhook replay.
INSERT INTO transaction_contact_access(transaction_id,payment_intent_id,unlocked_at)
SELECT DISTINCT ON (p.transaction_id) p.transaction_id,p.id,p.updated_at
FROM payment_intents p JOIN transactions t ON t.id=p.transaction_id
JOIN listings l ON l.id=t.listing_id
WHERE p.status='paid' AND l.kind='sale'
ORDER BY p.transaction_id,p.updated_at DESC;
