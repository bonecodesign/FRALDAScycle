CREATE TABLE authority_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow text NOT NULL CHECK (flow IN ('ordinary','judicial_exception')),
  authority_name text NOT NULL CHECK (char_length(authority_name) BETWEEN 3 AND 200),
  authority_reference text NOT NULL CHECK (char_length(authority_reference) BETWEEN 3 AND 200),
  requested_scope text NOT NULL CHECK (char_length(requested_scope) BETWEEN 10 AND 2000),
  legal_basis text NOT NULL CHECK (char_length(legal_basis) BETWEEN 10 AND 2000),
  judicial_order_reference text,
  status text NOT NULL DEFAULT 'pending_validation' CHECK (status IN
    ('pending_validation','pending_authorization','pending_legal','pending_level3','pending_level4','pending_level5','authorized','rejected')),
  protocolled_by uuid NOT NULL REFERENCES users(id),
  validated_by uuid REFERENCES users(id),
  validated_at timestamptz,
  authorized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((flow='ordinary' AND judicial_order_reference IS NULL) OR
    (flow='judicial_exception' AND char_length(judicial_order_reference) BETWEEN 3 AND 200))
);

CREATE TABLE authority_request_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES authority_requests(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  stage text NOT NULL CHECK (stage IN ('validation','authorize','legal','level3','level4','level5')),
  approved boolean NOT NULL,
  note text NOT NULL CHECK (char_length(note) BETWEEN 10 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id,stage)
);

CREATE INDEX authority_requests_queue_idx ON authority_requests(status,created_at,id);

ALTER TABLE account_notices DROP CONSTRAINT account_notices_kind_check;
ALTER TABLE account_notices ADD CONSTRAINT account_notices_kind_check
  CHECK (kind IN ('child_profile_age_limit','child_profile_change','child_profile_responsibility','child_data_emergency_access','authority_request','exchange_difference_payment','exchange_dispute_evidence','exchange_dispute_decision','exchange_settlement_status','exchange_settlement_reconciliation'));

COMMENT ON TABLE authority_requests IS
  'Protocolos internos minimizados; não armazena documentos, conteúdo divulgado ou dados do titular.';
