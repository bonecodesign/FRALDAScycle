ALTER TABLE manufacturer_availability_sources
  ADD COLUMN origin text NOT NULL DEFAULT 'manual'
    CHECK(origin IN ('fixed_config','manual','discovered')),
  ADD COLUMN review_status text NOT NULL DEFAULT 'pending'
    CHECK(review_status IN ('pending','approved','rejected')),
  ADD COLUMN discovered_at timestamptz;

CREATE TABLE manufacturer_availability_discovery_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url text NOT NULL UNIQUE CHECK(source_url LIKE 'https://%'),
  discovered_from text NOT NULL CHECK(discovered_from LIKE 'https://%'),
  discovered_at timestamptz NOT NULL DEFAULT now(),
  review_status text NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  rejection_reason text
);
COMMENT ON TABLE manufacturer_availability_discovery_candidates IS
  'Descoberta automática nunca habilita uma fonte; exige revisão administrativa independente.';
