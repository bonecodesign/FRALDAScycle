BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('customer', 'courier', 'moderator', 'admin');
CREATE TYPE listing_status AS ENUM ('draft', 'review', 'published', 'reserved', 'completed', 'paused', 'removed');
CREATE TYPE transaction_kind AS ENUM ('sale', 'exchange', 'donation');
CREATE TYPE transaction_status AS ENUM ('proposed', 'reserved', 'payment_pending', 'paid', 'in_delivery', 'completed', 'cancelled', 'disputed', 'refunded');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  phone text,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'customer',
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_normalized CHECK (email = lower(trim(email)))
);
CREATE UNIQUE INDEX users_email_unique ON users (email);
CREATE UNIQUE INDEX users_phone_unique ON users (phone) WHERE phone IS NOT NULL;

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip_hash bytea,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_active_idx ON sessions (user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label text NOT NULL,
  postal_code text NOT NULL,
  street text NOT NULL,
  number text NOT NULL,
  complement text,
  district text NOT NULL,
  city text NOT NULL,
  state char(2) NOT NULL,
  latitude numeric(9,6),
  longitude numeric(9,6),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL,
  description text NOT NULL,
  brand text,
  size text,
  quantity integer NOT NULL CHECK (quantity > 0),
  kind transaction_kind NOT NULL,
  price_cents integer CHECK (price_cents IS NULL OR price_cents >= 0),
  status listing_status NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_price_policy CHECK (
    (kind = 'sale' AND price_cents IS NOT NULL) OR
    (kind IN ('exchange', 'donation') AND price_cents IS NULL)
  )
);
CREATE INDEX listings_marketplace_idx ON listings (status, created_at DESC);
CREATE INDEX listings_seller_idx ON listings (seller_id, status);

CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id),
  buyer_id uuid NOT NULL REFERENCES users(id),
  seller_id uuid NOT NULL REFERENCES users(id),
  status transaction_status NOT NULL DEFAULT 'proposed',
  amount_cents integer CHECK (amount_cents IS NULL OR amount_cents >= 0),
  reserved_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transaction_parties_differ CHECK (buyer_id <> seller_id)
);
CREATE INDEX transactions_buyer_idx ON transactions (buyer_id, created_at DESC);
CREATE INDEX transactions_seller_idx ON transactions (seller_id, created_at DESC);

CREATE TABLE audit_events (
  id bigserial PRIMARY KEY,
  actor_user_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_entity_idx ON audit_events (entity_type, entity_id, occurred_at DESC);

COMMIT;
