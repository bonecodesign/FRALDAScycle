CREATE TYPE institution_status AS ENUM (
  'pending', 'under_review', 'active', 'suspended',
  'documents_expired', 'rejected', 'closed'
);

CREATE TABLE institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by_user_id uuid NOT NULL REFERENCES users(id),
  legal_name text NOT NULL,
  public_name text NOT NULL,
  tax_id char(14) NOT NULL,
  representative_name text NOT NULL,
  representative_email text NOT NULL,
  city text NOT NULL,
  state char(2) NOT NULL,
  address_line text NOT NULL,
  postal_code text NOT NULL,
  open_packages_accepted boolean NOT NULL DEFAULT false,
  document_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  status institution_status NOT NULL DEFAULT 'pending',
  review_reason text,
  verified_at timestamptz,
  activated_at timestamptz,
  suspended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT institutions_tax_id_digits CHECK (tax_id ~ '^[0-9]{14}$'),
  CONSTRAINT institutions_documents_array CHECK (jsonb_typeof(document_keys) = 'array')
);
CREATE UNIQUE INDEX institutions_tax_id_unique ON institutions (tax_id);
CREATE INDEX institutions_public_active_idx ON institutions (state, city, public_name) WHERE status = 'active';
CREATE INDEX institutions_review_queue_idx ON institutions (status, created_at);

ALTER TABLE listings ADD COLUMN institution_id uuid REFERENCES institutions(id);
ALTER TABLE listings ADD CONSTRAINT listing_institution_policy CHECK (
  (kind = 'donation' AND institution_id IS NOT NULL) OR
  (kind <> 'donation' AND institution_id IS NULL)
) NOT VALID;
CREATE INDEX listings_institution_idx ON listings (institution_id, status) WHERE institution_id IS NOT NULL;
