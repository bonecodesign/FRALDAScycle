DO $$
DECLARE constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'donation_operations'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%representative_confirmed_at%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE donation_operations DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE donation_operations
  ADD CONSTRAINT donation_confirmation_version_consistency CHECK (
    (version = 1 AND representative_confirmed_at IS NULL)
    OR
    (version IN (2, 3, 4) AND representative_confirmed_at IS NOT NULL)
  );
