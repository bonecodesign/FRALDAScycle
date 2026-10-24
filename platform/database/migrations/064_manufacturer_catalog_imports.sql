CREATE TABLE manufacturer_catalog_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer text NOT NULL CHECK (char_length(manufacturer) BETWEEN 1 AND 120),
  source_url text NOT NULL CHECK (source_url LIKE 'https://%'),
  document_sha256 char(64) NOT NULL CHECK (document_sha256 ~ '^[0-9a-f]{64}$'),
  effective_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending_first_review'
    CHECK (status IN ('pending_first_review','pending_second_review','active','rejected','superseded')),
  imported_by uuid NOT NULL REFERENCES users(id),
  first_reviewer_id uuid REFERENCES users(id),
  second_reviewer_id uuid REFERENCES users(id),
  rejected_by uuid REFERENCES users(id),
  rejection_reason text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (first_reviewer_id IS NULL OR first_reviewer_id <> imported_by),
  CHECK (second_reviewer_id IS NULL OR second_reviewer_id <> imported_by),
  CHECK (second_reviewer_id IS NULL OR second_reviewer_id <> first_reviewer_id),
  CHECK ((status = 'active') = (activated_at IS NOT NULL))
);

CREATE UNIQUE INDEX manufacturer_catalog_one_active_idx
  ON manufacturer_catalog_batches(lower(manufacturer)) WHERE status = 'active';
CREATE UNIQUE INDEX manufacturer_catalog_document_idx
  ON manufacturer_catalog_batches(lower(manufacturer), document_sha256);

CREATE TABLE manufacturer_catalog_entries (
  batch_id uuid NOT NULL REFERENCES manufacturer_catalog_batches(id) ON DELETE CASCADE,
  product_key text NOT NULL CHECK (product_key ~ '^[A-Za-z0-9._-]{3,80}$'),
  category text NOT NULL CHECK (category IN ('infant','swim')),
  brand text NOT NULL,
  model text NOT NULL,
  size text NOT NULL,
  min_age_months integer,
  max_age_months integer,
  min_weight_kg numeric(6,2),
  max_weight_kg numeric(6,2),
  PRIMARY KEY (batch_id, product_key, size),
  CHECK ((min_age_months IS NULL) = (max_age_months IS NULL)),
  CHECK ((min_weight_kg IS NULL) = (max_weight_kg IS NULL)),
  CHECK (min_age_months IS NOT NULL OR min_weight_kg IS NOT NULL),
  CHECK (min_age_months IS NULL OR (min_age_months >= 0 AND min_age_months <= max_age_months AND max_age_months <= 156)),
  CHECK (min_weight_kg IS NULL OR (min_weight_kg >= 0 AND min_weight_kg <= max_weight_kg AND max_weight_kg <= 100))
);

CREATE INDEX manufacturer_catalog_entries_lookup_idx
  ON manufacturer_catalog_entries(brand, model, size);
