ALTER TABLE exchange_difference_obligations DROP CONSTRAINT exchange_difference_obligations_status_check;
ALTER TABLE exchange_difference_obligations ADD CONSTRAINT exchange_difference_obligations_status_check
  CHECK (status IN ('not_charged','provider_pending','paid','release_pending','released','refund_pending','cancelled','refunded'));
ALTER TABLE exchange_difference_obligations DROP CONSTRAINT exchange_difference_obligations_check1;
ALTER TABLE exchange_difference_obligations ADD CONSTRAINT exchange_difference_paid_at_consistency
  CHECK ((status IN ('paid','release_pending','released','refund_pending','refunded')) = (paid_at IS NOT NULL));

CREATE TABLE exchange_difference_refund_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL UNIQUE REFERENCES exchange_difference_obligations(transaction_id),
  payer_id uuid NOT NULL REFERENCES users(id),
  reviewed_by uuid NOT NULL REFERENCES users(id),
  gross_amount_cents integer NOT NULL CHECK (gross_amount_cents > 0),
  nonrecoverable_provider_fee_cents integer NOT NULL CHECK (nonrecoverable_provider_fee_cents >= 0),
  refund_amount_cents integer NOT NULL CHECK (refund_amount_cents >= 0),
  provider_fee_evidence_reference text NOT NULL CHECK (char_length(provider_fee_evidence_reference) BETWEEN 3 AND 128),
  payer_accepted_at timestamptz NOT NULL,
  destination text NOT NULL DEFAULT 'payment_origin' CHECK (destination = 'payment_origin'),
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','provider_pending','refunded','blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (nonrecoverable_provider_fee_cents <= gross_amount_cents),
  CHECK (refund_amount_cents = gross_amount_cents - nonrecoverable_provider_fee_cents)
);

COMMENT ON TABLE exchange_difference_refund_reviews IS
  'Memória local do reembolso assistido; tarifa exige evidência e a linha não comprova estorno no provedor.';
