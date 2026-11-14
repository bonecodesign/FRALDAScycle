CREATE TABLE moderation_sanction_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'proposed'
    CHECK(status IN ('proposed','level4_approved','level5_authorized','executed','rejected')),
  proposed_action text NOT NULL
    CHECK(proposed_action IN ('warning','functional_restriction','temporary_suspension','permanent_block')),
  proposed_until timestamptz,
  proposal_reason text NOT NULL CHECK(length(proposal_reason) BETWEEN 10 AND 2000),
  proposed_by uuid NOT NULL REFERENCES users(id),
  proposed_at timestamptz NOT NULL DEFAULT now(),
  level4_action text CHECK(level4_action IN ('warning','functional_restriction','temporary_suspension','permanent_block')),
  level4_until timestamptz,
  level4_reason text CHECK(level4_reason IS NULL OR length(level4_reason) BETWEEN 10 AND 2000),
  level4_by uuid REFERENCES users(id),
  level4_at timestamptz,
  level5_by uuid REFERENCES users(id),
  level5_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK((proposed_action='temporary_suspension')=(proposed_until IS NOT NULL)),
  CHECK(level4_action IS NULL OR (level4_action='temporary_suspension')=(level4_until IS NOT NULL))
);

CREATE UNIQUE INDEX moderation_sanction_cases_open_user_idx
  ON moderation_sanction_cases(user_id)
  WHERE status IN ('proposed','level4_approved','level5_authorized');

COMMENT ON TABLE moderation_sanction_cases IS
  'Governed sanction intent. Proposal and level-4 review do not restrict the account or apply an irreversible action.';
