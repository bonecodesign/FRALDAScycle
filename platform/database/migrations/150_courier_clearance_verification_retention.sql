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

-- Do not invent a verification/decision date for historical records. A
-- missing decision requires supervised privacy remediation before migration.
-- A failure here rolls back this whole migration, including the DO block above.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM courier_clearance_documents d
    WHERE d.status IN ('verified','rejected','expired')
      AND NOT EXISTS (
        SELECT 1 FROM courier_clearance_reviews r
        WHERE r.document_id=d.id AND r.status IN ('approved','rejected')
          AND r.decided_at IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'P-01 legacy clearance review decision missing: manual privacy review required';
  END IF;
END $$;

-- A document may have multiple historical decisions. Use the earliest known
-- decision deterministically and never extend an already-earlier deadline.
-- Past-due dates stay past-due and are handled by the restricted deletion task.
WITH earliest_review AS (
  SELECT document_id, MIN(decided_at) AS first_decided_at
  FROM courier_clearance_reviews
  WHERE status IN ('approved','rejected') AND decided_at IS NOT NULL
  GROUP BY document_id
)
UPDATE courier_clearance_documents d
SET delete_at = LEAST(d.delete_at, r.first_decided_at + interval '30 days')
FROM earliest_review r
WHERE r.document_id = d.id AND d.status <> 'deleted'
  AND (d.delete_at IS NULL OR d.delete_at > r.first_decided_at + interval '30 days');

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
