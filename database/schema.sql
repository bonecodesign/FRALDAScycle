CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE listing_type AS ENUM ('buy', 'sell', 'donate');
CREATE TYPE listing_status AS ENUM ('pending', 'active', 'closed', 'blocked');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type listing_type NOT NULL,
  status listing_status NOT NULL DEFAULT 'pending',
  brand TEXT NOT NULL,
  diaper_size TEXT NOT NULL,
  units INTEGER NOT NULL CHECK (units > 0),
  price_cents INTEGER CHECK (price_cents > 0),
  city TEXT NOT NULL,
  state CHAR(2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  CHECK (
    (type = 'sell' AND price_cents IS NOT NULL)
    OR (type IN ('buy', 'donate') AND price_cents IS NULL)
  )
);

CREATE INDEX listings_public_search_idx
  ON listings (status, state, city, type);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX notifications_user_created_idx
  ON notifications (user_id, created_at DESC);
