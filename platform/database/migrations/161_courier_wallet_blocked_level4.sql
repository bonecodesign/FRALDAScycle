ALTER TABLE courier_wallet_blocked_resolutions
  ADD COLUMN level4_action text CHECK(level4_action IS NULL OR level4_action IN ('retry','return_to_wallet')),
  ADD COLUMN level4_by uuid REFERENCES users(id),
  ADD COLUMN level4_note text CHECK(level4_note IS NULL OR length(level4_note) BETWEEN 10 AND 1000),
  ADD COLUMN level4_at timestamptz;

ALTER TABLE courier_wallet_blocked_resolutions ADD CONSTRAINT courier_wallet_blocked_level4_consistency CHECK(
  (status='proposed' AND level4_action IS NULL AND level4_by IS NULL AND level4_note IS NULL AND level4_at IS NULL)
  OR (status<>'proposed' AND level4_action IS NOT NULL AND level4_by IS NOT NULL AND level4_note IS NOT NULL AND level4_at IS NOT NULL)
);

COMMENT ON COLUMN courier_wallet_blocked_resolutions.level4_action IS
  'Administrator level 4 may preserve or modify the proposed action; approval still moves no money.';
