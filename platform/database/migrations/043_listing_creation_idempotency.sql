ALTER TABLE listings ADD COLUMN creation_key uuid, ADD COLUMN creation_fingerprint char(64);
ALTER TABLE listings ADD CONSTRAINT listing_creation_identity CHECK (
  (creation_key IS NULL AND creation_fingerprint IS NULL) OR
  (creation_key IS NOT NULL AND creation_fingerprint IS NOT NULL AND creation_fingerprint ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX listings_seller_creation_key ON listings(seller_id,creation_key) WHERE creation_key IS NOT NULL;
