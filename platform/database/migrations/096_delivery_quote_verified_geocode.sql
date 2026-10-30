ALTER TABLE addresses
  ADD COLUMN geocode_verified_at timestamptz,
  ADD COLUMN geocode_provider text,
  ADD CONSTRAINT addresses_geocode_pair_required CHECK (
    (latitude IS NULL AND longitude IS NULL AND geocode_verified_at IS NULL AND geocode_provider IS NULL)
    OR
    (latitude IS NOT NULL AND longitude IS NOT NULL AND geocode_verified_at IS NOT NULL
      AND geocode_provider IN ('google-maps','contracted-geocoder'))
  ) NOT VALID;

COMMENT ON COLUMN addresses.geocode_verified_at IS
  'Timestamp of provider verification for the current address version; required before automatic delivery quotation.';
