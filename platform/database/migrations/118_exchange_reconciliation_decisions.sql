CREATE TABLE exchange_settlement_reconciliation_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id uuid NOT NULL UNIQUE REFERENCES exchange_difference_settlement_commands(id),
  proposed_by uuid NOT NULL REFERENCES users(id),
  proposer_access_level smallint NOT NULL CHECK (proposer_access_level=3),
  proposed_action text NOT NULL CHECK (proposed_action IN ('confirm_with_provider','retry_same_idempotency','manual_refund')),
  evidence_reference text NOT NULL CHECK (char_length(evidence_reference) BETWEEN 3 AND 200),
  proposal_note text NOT NULL CHECK (char_length(proposal_note) BETWEEN 10 AND 1000),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','authorized')),
  authorized_by uuid REFERENCES users(id),
  authorizer_access_level smallint CHECK (authorizer_access_level IS NULL OR authorizer_access_level IN (4,5)),
  authorization_note text CHECK (authorization_note IS NULL OR char_length(authorization_note) BETWEEN 10 AND 1000),
  authorized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (proposed_by IS DISTINCT FROM authorized_by),
  CHECK ((status='authorized') = (authorized_by IS NOT NULL AND authorizer_access_level IS NOT NULL AND authorization_note IS NOT NULL AND authorized_at IS NOT NULL))
);

COMMENT ON TABLE exchange_settlement_reconciliation_decisions IS
  'Nível 3 propõe com evidência; nível 4 ou 5 autoriza por pessoa distinta. Autorização não executa dinheiro.';
