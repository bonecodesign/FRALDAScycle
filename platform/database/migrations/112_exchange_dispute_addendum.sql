CREATE TABLE exchange_difference_dispute_addenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id uuid NOT NULL UNIQUE REFERENCES exchange_difference_dispute_evidence(id),
  recorded_by uuid NOT NULL REFERENCES users(id),
  recorder_access_level smallint NOT NULL CHECK (recorder_access_level=2),
  analysis_reference text NOT NULL CHECK (char_length(analysis_reference) BETWEEN 3 AND 200),
  response_deadline_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (response_deadline_at >= created_at + interval '24 hours')
);

CREATE TABLE exchange_difference_dispute_addendum_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  addendum_id uuid NOT NULL REFERENCES exchange_difference_dispute_addenda(id),
  user_id uuid NOT NULL REFERENCES users(id),
  response text NOT NULL CHECK (response IN ('agree','contest')),
  statement_reference text NOT NULL CHECK (char_length(statement_reference) BETWEEN 3 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(addendum_id,user_id)
);

COMMENT ON TABLE exchange_difference_dispute_addenda IS
  'Complemento imutável obrigatório após contestação, com nova janela fixa de 24 horas para ambas as partes.';
