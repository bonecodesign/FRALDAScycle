ALTER TABLE support_tickets
  ADD COLUMN assignee_id uuid REFERENCES users(id),
  ADD COLUMN assigned_at timestamptz;

ALTER TABLE support_tickets ADD CONSTRAINT support_assignment_pair_check
  CHECK ((assignee_id IS NULL) = (assigned_at IS NULL));

CREATE INDEX support_tickets_assignee_page_idx
  ON support_tickets (assignee_id, created_at DESC, id DESC)
  WHERE assignee_id IS NOT NULL;
