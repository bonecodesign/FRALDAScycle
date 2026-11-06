ALTER TABLE users ADD COLUMN staff_sector text;
ALTER TABLE admin_invitations ADD COLUMN staff_sector text;

UPDATE users SET staff_sector=CASE
  WHEN staff_access_level=5 THEN 'founder'
  WHEN staff_access_level=3 THEN 'finance'
  WHEN staff_access_level IN(1,2) THEN 'support'
  WHEN staff_access_level=4 THEN 'operations'
END WHERE staff_access_level IS NOT NULL;

ALTER TABLE users ADD CONSTRAINT users_staff_sector_check CHECK (
  (role NOT IN('admin','moderator') AND staff_sector IS NULL)
  OR (role IN('admin','moderator') AND staff_sector IS NOT NULL AND staff_access_level IS NOT NULL AND staff_sector IN(
    'support','finance','operations','logistics','institutions','moderation',
    'legal_privacy','security','communications','technical','founder'
  ) AND ((staff_access_level=5)=(staff_sector='founder')))
);

ALTER TABLE admin_invitations ADD CONSTRAINT admin_invitations_staff_sector_check CHECK (
  (role NOT IN('admin','moderator') AND staff_sector IS NULL)
  OR (role IN('admin','moderator') AND staff_sector IS NOT NULL AND staff_sector IN(
    'support','finance','operations','logistics','institutions','moderation',
    'legal_privacy','security','communications','technical'
  ))
);

CREATE TABLE admin_work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK(kind ~ '^[a-z][a-z0-9_]{2,49}$'),
  source_sector text NOT NULL,
  sector text NOT NULL,
  title text NOT NULL CHECK(char_length(title) BETWEEN 5 AND 120),
  minimized_context text CHECK(minimized_context IS NULL OR char_length(minimized_context)<=1000),
  status text NOT NULL DEFAULT 'new' CHECK(status IN(
    'new','triage','analysis','waiting_user','waiting_sector','waiting_approval',
    'resolved','closed','blocked','sla_breached','cancelled'
  )),
  priority text NOT NULL DEFAULT 'normal' CHECK(priority IN('low','normal','high','critical')),
  requested_by uuid NOT NULL REFERENCES users(id),
  assigned_to uuid REFERENCES users(id),
  due_at timestamptz,
  version integer NOT NULL DEFAULT 0 CHECK(version>=0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(source_sector IN('support','finance','operations','logistics','institutions','moderation','legal_privacy','security','communications','technical','founder')),
  CHECK(sector IN('support','finance','operations','logistics','institutions','moderation','legal_privacy','security','communications','technical','founder'))
);

CREATE INDEX admin_work_items_queue_idx ON admin_work_items(sector,status,priority,due_at,created_at);
CREATE INDEX admin_work_items_assignee_idx ON admin_work_items(assigned_to,status,updated_at);

CREATE TABLE admin_work_item_events (
  id bigserial PRIMARY KEY,
  work_item_id uuid NOT NULL REFERENCES admin_work_items(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  event_type text NOT NULL CHECK(event_type IN('created','claimed','reassigned','status_changed')),
  from_status text,
  to_status text,
  note text CHECK(note IS NULL OR char_length(note)<=500),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN admin_work_items.minimized_context IS
  'Contexto minimizado e mascarado antes da persistência; não aceita anexos ou dados de outro setor.';
