ALTER TABLE moderation_sanction_cases DROP CONSTRAINT moderation_sanction_cases_status_check;
ALTER TABLE moderation_sanction_cases ADD CONSTRAINT moderation_sanction_cases_status_check
  CHECK(status IN ('proposed','level4_approved','level5_authorized','executed','reversed','rejected'));

CREATE TABLE moderation_sanction_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL UNIQUE REFERENCES moderation_sanction_cases(id),
  ticket_id uuid NOT NULL UNIQUE REFERENCES support_tickets(id),
  requester_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'pending_level3'
    CHECK(status IN ('pending_level3','pending_level4','pending_level5','upheld','reversed')),
  level3_outcome text CHECK(level3_outcome IN ('uphold','reverse')),
  level3_note text CHECK(level3_note IS NULL OR length(level3_note) BETWEEN 10 AND 2000),
  level3_by uuid REFERENCES users(id),
  level3_at timestamptz,
  level4_outcome text CHECK(level4_outcome IN ('uphold','reverse')),
  level4_note text CHECK(level4_note IS NULL OR length(level4_note) BETWEEN 10 AND 2000),
  level4_by uuid REFERENCES users(id),
  level4_at timestamptz,
  level5_note text CHECK(level5_note IS NULL OR length(level5_note) BETWEEN 10 AND 2000),
  level5_by uuid REFERENCES users(id),
  level5_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE moderation_sanction_effects
  ADD COLUMN reversed_at timestamptz,
  ADD COLUMN reversed_by uuid REFERENCES users(id),
  ADD COLUMN reversal_reason text;

COMMENT ON TABLE moderation_sanction_appeals IS
  'Appeal chain with new independent level 3 and 4 reviewers, followed by the unique level 5 founder. History is retained when an active effect is reversed.';
