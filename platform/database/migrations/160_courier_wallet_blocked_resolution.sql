CREATE TABLE courier_wallet_blocked_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id uuid NOT NULL REFERENCES courier_wallet_provider_commands(id),
  proposed_action text NOT NULL CHECK(proposed_action IN ('retry','return_to_wallet')),
  status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','level4_approved','level5_authorized','executed','rejected')),
  proposed_by uuid NOT NULL REFERENCES users(id),
  proposal_note text NOT NULL CHECK(length(proposal_note) BETWEEN 10 AND 1000),
  proposed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX courier_wallet_blocked_resolution_active_idx
  ON courier_wallet_blocked_resolutions(command_id)
  WHERE status IN ('proposed','level4_approved','level5_authorized');

COMMENT ON TABLE courier_wallet_blocked_resolutions IS
  'Human resolution chain for blocked PIX commands. A proposal never moves funds or calls a provider.';
