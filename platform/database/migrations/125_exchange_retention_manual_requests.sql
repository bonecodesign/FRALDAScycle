CREATE TABLE exchange_reconciliation_retention_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES users(id),
  requested_limit smallint NOT NULL CHECK (requested_limit BETWEEN 1 AND 100),
  justification text NOT NULL CHECK (char_length(justification) BETWEEN 10 AND 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','changes_requested','executed','cancelled')),
  reviewed_by uuid REFERENCES users(id),
  approved_limit smallint CHECK (approved_limit BETWEEN 1 AND 100),
  review_note text CHECK (review_note IS NULL OR char_length(review_note) BETWEEN 10 AND 1000),
  reviewed_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reviewed_by IS NULL OR reviewed_by<>requested_by),
  CHECK ((status='pending')=(reviewed_at IS NULL)),
  CHECK (status='pending' OR (reviewed_by IS NOT NULL AND review_note IS NOT NULL)),
  CHECK ((status IN ('approved','executed'))=(approved_limit IS NOT NULL)),
  CHECK ((status='executed')=(executed_at IS NOT NULL))
);

CREATE UNIQUE INDEX exchange_reconciliation_retention_single_active_request_idx
  ON exchange_reconciliation_retention_requests((true)) WHERE status IN ('pending','approved');

COMMENT ON TABLE exchange_reconciliation_retention_requests IS
  'Nível exato 3 solicita; pessoa distinta de nível exato 4 revisa, ajusta o limite e autoriza. Aprovação não executa diretamente.';

