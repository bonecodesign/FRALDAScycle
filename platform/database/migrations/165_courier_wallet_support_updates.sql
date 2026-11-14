CREATE TABLE courier_wallet_support_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id uuid NOT NULL REFERENCES courier_wallet_provider_commands(id),
  actor_user_id uuid NOT NULL REFERENCES users(id),
  kind text NOT NULL CHECK(kind IN ('note','escalated')),
  note text NOT NULL CHECK(length(note) BETWEEN 10 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX courier_wallet_support_updates_command_idx
  ON courier_wallet_support_updates(command_id,created_at DESC,id DESC);

COMMENT ON TABLE courier_wallet_support_updates IS
  'Level 2 support notes and escalation state; contains no amount, bank destination or provider failure detail.';

COMMENT ON COLUMN courier_wallet_support_updates.note IS
  'Operational support text only; must not contain amounts, bank data or provider failure detail.';
