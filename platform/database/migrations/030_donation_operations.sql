ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'donation_confirmed';
ALTER TABLE shipments ADD COLUMN logistics_payer_id uuid REFERENCES users(id);
CREATE TABLE donation_operations (
  transaction_id uuid PRIMARY KEY REFERENCES transactions(id),
  listing_id uuid NOT NULL REFERENCES listings(id),
  institution_id uuid NOT NULL REFERENCES institutions(id),
  donor_id uuid NOT NULL REFERENCES users(id),
  representative_id uuid NOT NULL REFERENCES users(id),
  idempotency_key text NOT NULL UNIQUE,
  donor_confirmed_at timestamptz NOT NULL DEFAULT now(),
  representative_confirmed_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK(version IN(1,2)),
  notice_version text NOT NULL CHECK(notice_version='FC-DONATION-1'),
  logistics_payer_id uuid NOT NULL REFERENCES users(id),
  CHECK(donor_id<>representative_id AND logistics_payer_id=donor_id),
  CHECK((version=1 AND representative_confirmed_at IS NULL) OR(version=2 AND representative_confirmed_at IS NOT NULL))
);
CREATE INDEX donation_participants_idx ON donation_operations(donor_id,representative_id);
