CREATE TABLE transaction_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_ticket_id uuid NOT NULL UNIQUE REFERENCES support_tickets(id),
  transaction_id uuid NOT NULL REFERENCES transactions(id),
  opened_by uuid NOT NULL REFERENCES users(id),
  kind text NOT NULL CHECK (kind IN ('incorrect_product','quantity_mismatch','damaged_package','not_received')),
  prior_transaction_status transaction_status NOT NULL,
  status text NOT NULL DEFAULT 'under_review' CHECK (status IN ('under_review','resolved')),
  outcome text CHECK (outcome IN ('dismissed','return_required','refund_required','replacement_agreed','other_resolution')),
  decision_reason text CHECK (decision_reason IS NULL OR char_length(decision_reason) BETWEEN 10 AND 1000),
  decided_by uuid REFERENCES users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transaction_occurrence_decision_consistent CHECK (
    (status='under_review' AND outcome IS NULL AND decision_reason IS NULL AND decided_by IS NULL AND decided_at IS NULL) OR
    (status='resolved' AND outcome IS NOT NULL AND decision_reason IS NOT NULL AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
  )
);

CREATE INDEX transaction_occurrences_transaction_idx ON transaction_occurrences(transaction_id,status);
