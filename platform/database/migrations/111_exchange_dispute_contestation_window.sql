ALTER TABLE account_notices DROP CONSTRAINT account_notices_kind_check;
ALTER TABLE account_notices ADD CONSTRAINT account_notices_kind_check
  CHECK (kind IN ('child_profile_age_limit','exchange_difference_payment','exchange_dispute_evidence'));

ALTER TABLE exchange_difference_dispute_evidence
  ADD COLUMN contest_deadline_at timestamptz;
UPDATE exchange_difference_dispute_evidence
  SET contest_deadline_at=created_at+interval '48 hours';
ALTER TABLE exchange_difference_dispute_evidence
  ALTER COLUMN contest_deadline_at SET NOT NULL;

CREATE TABLE exchange_difference_dispute_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id uuid NOT NULL REFERENCES exchange_difference_dispute_evidence(id),
  user_id uuid NOT NULL REFERENCES users(id),
  response text NOT NULL CHECK (response IN ('agree','contest')),
  statement_reference text NOT NULL CHECK (char_length(statement_reference) BETWEEN 3 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(evidence_id,user_id)
);

COMMENT ON TABLE exchange_difference_dispute_responses IS
  'Manifestação imutável de cada parte durante a janela fixa de 48 horas; o silêncio não equivale a concordância.';
