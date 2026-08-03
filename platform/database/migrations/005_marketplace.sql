CREATE TABLE listing_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image/jpeg', 'image/png', 'image/webp')),
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 7),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, position)
);

CREATE TABLE favorites (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);
CREATE INDEX favorites_listing_idx ON favorites (listing_id);

ALTER TABLE listings ADD COLUMN city text;
ALTER TABLE listings ADD COLUMN state char(2);
ALTER TABLE listings ADD COLUMN latitude numeric(9,6);
ALTER TABLE listings ADD COLUMN longitude numeric(9,6);
