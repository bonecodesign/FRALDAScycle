ALTER TABLE exchange_difference_obligations DROP CONSTRAINT exchange_difference_obligations_status_check;
ALTER TABLE exchange_difference_obligations ADD CONSTRAINT exchange_difference_obligations_status_check
  CHECK (status IN ('not_charged','provider_pending','paid','release_pending','released','refund_pending','disputed','cancelled','refunded'));
ALTER TABLE exchange_difference_obligations DROP CONSTRAINT exchange_difference_paid_at_consistency;
ALTER TABLE exchange_difference_obligations ADD CONSTRAINT exchange_difference_paid_at_consistency
  CHECK ((status IN ('paid','release_pending','released','refund_pending','disputed','refunded')) = (paid_at IS NOT NULL));

CREATE TABLE exchange_difference_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL UNIQUE REFERENCES exchange_difference_obligations(transaction_id),
  support_ticket_id uuid NOT NULL UNIQUE REFERENCES support_tickets(id),
  opened_by uuid NOT NULL REFERENCES users(id),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','resolved')),
  resolution text CHECK (resolution IS NULL OR resolution IN ('release','refund_full','refund_with_proven_fee')),
  resolved_by uuid REFERENCES users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status='resolved') = (resolution IS NOT NULL AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL))
);

COMMENT ON TABLE exchange_difference_disputes IS
  'Disputa pós-coleta congela a diferença; resolução humana posterior é obrigatória e não movimenta dinheiro por si só.';
