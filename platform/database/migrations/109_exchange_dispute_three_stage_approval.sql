CREATE TABLE exchange_difference_dispute_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES exchange_difference_disputes(id),
  stage text NOT NULL CHECK (stage IN ('support_analysis','finance_approval','founder_authorization')),
  actor_user_id uuid NOT NULL REFERENCES users(id),
  actor_access_level smallint NOT NULL CHECK (
    (stage='support_analysis' AND actor_access_level=2) OR
    (stage='finance_approval' AND actor_access_level=3) OR
    (stage='founder_authorization' AND actor_access_level=5)
  ),
  outcome text NOT NULL CHECK (outcome IN ('release','refund_full','refund_with_proven_fee')),
  note text NOT NULL CHECK (char_length(note) BETWEEN 10 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dispute_id,stage),
  UNIQUE(dispute_id,actor_user_id)
);

COMMENT ON TABLE exchange_difference_dispute_decisions IS
  'Sequência imutável: nível 2 recomenda, nível 3 aprova e nível 5 autoriza; pessoas distintas e mesmo resultado.';
