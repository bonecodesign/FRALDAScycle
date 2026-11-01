CREATE TABLE exchange_difference_dispute_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL UNIQUE REFERENCES exchange_difference_disputes(id),
  recorded_by uuid NOT NULL REFERENCES users(id),
  recorder_access_level smallint NOT NULL CHECK (recorder_access_level=2),
  delivery_proof_reference text NOT NULL CHECK (char_length(delivery_proof_reference) BETWEEN 3 AND 200),
  support_history_reference text NOT NULL CHECK (char_length(support_history_reference) BETWEEN 3 AND 200),
  payment_status_reference text NOT NULL CHECK (char_length(payment_status_reference) BETWEEN 3 AND 200),
  logistics_status_reference text NOT NULL CHECK (char_length(logistics_status_reference) BETWEEN 3 AND 200),
  requester_statement_reference text NOT NULL CHECK (char_length(requester_statement_reference) BETWEEN 3 AND 200),
  owner_statement_reference text NOT NULL CHECK (char_length(owner_statement_reference) BETWEEN 3 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE exchange_difference_dispute_evidence IS
  'Checklist imutável de referências: entrega, suporte, pagamento, logística e manifestação das duas partes; não copia arquivos sensíveis.';
