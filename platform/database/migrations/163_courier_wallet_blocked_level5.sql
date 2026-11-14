ALTER TABLE courier_wallet_blocked_resolutions
  ADD COLUMN level5_by uuid REFERENCES users(id),
  ADD COLUMN level5_note text CHECK(level5_note IS NULL OR length(level5_note) BETWEEN 10 AND 1000),
  ADD COLUMN level5_at timestamptz;

ALTER TABLE courier_wallet_blocked_resolutions ADD CONSTRAINT courier_wallet_blocked_level5_consistency CHECK(
  (status IN ('proposed','level4_approved') AND level5_by IS NULL AND level5_note IS NULL AND level5_at IS NULL)
  OR (status IN ('level5_authorized','executed','rejected') AND level5_by IS NOT NULL AND level5_note IS NOT NULL AND level5_at IS NOT NULL)
);

COMMENT ON COLUMN courier_wallet_blocked_resolutions.level5_by IS
  'Founder authorization is a third independent decision and does not itself execute money movement.';
