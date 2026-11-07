-- P-01: the encrypted police-clearance copy is deleted within 30 days of human verification,
-- independently of the issuer's document expiry. Existing migration 060 remains immutable.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'courier_clearance_documents'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%delete_at%'
      AND pg_get_constraintdef(oid) LIKE '%expires_at%'
  LOOP
    EXECUTE format('ALTER TABLE courier_clearance_documents DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- For existing verified documents use the review decision timestamp when available.
-- Never silently extend an earlier deletion deadline.
UPDATE courier_clearance_documents d
SET delete_at = LEAST(d.delete_at, r.decided_at + interval '30 days')
FROM courier_clearance_reviews r
WHERE r.document_id = d.id AND r.status = 'approved'
  AND r.decided_at IS NOT NULL AND d.delete_at IS NOT NULL
  AND d.delete_at > r.decided_at + interval '30 days';

ALTER TABLE courier_clearance_documents
  ADD CONSTRAINT courier_clearance_delete_after_review_check
  CHECK (delete_at IS NULL OR expires_at IS NULL OR delete_at <= expires_at + interval '30 days');
