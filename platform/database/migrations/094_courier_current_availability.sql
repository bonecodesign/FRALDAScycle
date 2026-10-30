CREATE TABLE courier_current_availability (
  courier_id uuid PRIMARY KEY REFERENCES courier_profiles(user_id) ON DELETE CASCADE,
  available boolean NOT NULL DEFAULT false,
  latitude numeric(9,6),
  longitude numeric(9,6),
  location_verified_at timestamptz,
  location_consent_version text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CHECK (NOT available OR (latitude IS NOT NULL AND location_verified_at IS NOT NULL
    AND location_consent_version = 'FC-COURIER-LOCATION-1'))
);

COMMENT ON TABLE courier_current_availability IS
  'Current courier availability only. Each update replaces the previous point; location history is not retained.';

CREATE INDEX courier_current_availability_active_idx
  ON courier_current_availability(location_verified_at DESC) WHERE available;
