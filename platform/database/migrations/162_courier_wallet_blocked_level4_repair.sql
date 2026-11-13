ALTER TABLE courier_wallet_blocked_resolutions
  ADD COLUMN IF NOT EXISTS level4_action text,
  ADD COLUMN IF NOT EXISTS level4_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS level4_note text,
  ADD COLUMN IF NOT EXISTS level4_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='courier_wallet_blocked_level4_action') THEN
    ALTER TABLE courier_wallet_blocked_resolutions ADD CONSTRAINT courier_wallet_blocked_level4_action
      CHECK(level4_action IS NULL OR level4_action IN ('retry','return_to_wallet'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='courier_wallet_blocked_level4_note') THEN
    ALTER TABLE courier_wallet_blocked_resolutions ADD CONSTRAINT courier_wallet_blocked_level4_note
      CHECK(level4_note IS NULL OR length(level4_note) BETWEEN 10 AND 1000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='courier_wallet_blocked_level4_consistency') THEN
    ALTER TABLE courier_wallet_blocked_resolutions ADD CONSTRAINT courier_wallet_blocked_level4_consistency CHECK(
      (status='proposed' AND level4_action IS NULL AND level4_by IS NULL AND level4_note IS NULL AND level4_at IS NULL)
      OR (status<>'proposed' AND level4_action IS NOT NULL AND level4_by IS NOT NULL AND level4_note IS NOT NULL AND level4_at IS NOT NULL)
    );
  END IF;
END $$;

COMMENT ON COLUMN courier_wallet_blocked_resolutions.level4_action IS
  'Administrator level 4 may preserve or modify the proposed action; approval still moves no money.';
