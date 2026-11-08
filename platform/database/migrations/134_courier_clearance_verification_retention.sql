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
WHERE r.document_id = d.id AND r.status IN ('approved','rejected')
  AND r.decided_at IS NOT NULL
  AND (d.delete_at IS NULL OR d.delete_at > r.decided_at + interval '30 days');

-- A deleted record keeps only non-secret verification metadata, never storage pointers.
ALTER TABLE courier_clearance_documents
  ALTER COLUMN encrypted_object_reference DROP NOT NULL,
  ALTER COLUMN encryption_key_reference DROP NOT NULL;

ALTER TABLE courier_clearance_documents
  ADD CONSTRAINT courier_clearance_deleted_references_check
  CHECK (status <> 'deleted' OR (encrypted_object_reference IS NULL AND encryption_key_reference IS NULL));

-- No expiry-derived retention bound: the decision timestamp is the reference.
ALTER TABLE courier_clearance_documents
  ADD CONSTRAINT courier_clearance_review_retention_check
  CHECK (delete_at IS NULL OR delete_at > created_at);
