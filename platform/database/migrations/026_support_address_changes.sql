CREATE TABLE shipment_address_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES shipment_address_shares(id),
  requester_id uuid NOT NULL REFERENCES users(id),
  requested_address_id uuid NOT NULL REFERENCES addresses(id),
  requested_snapshot jsonb NOT NULL,
  expected_revision integer NOT NULL CHECK(expected_revision>=0),
  notice_version text NOT NULL CHECK(notice_version='FC-ADDRESS-1'),
  reason text NOT NULL CHECK(char_length(reason) BETWEEN 10 AND 1000),
  idempotency_key text NOT NULL UNIQUE,
  ticket_id uuid NOT NULL UNIQUE REFERENCES support_tickets(id),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')),
  reviewed_by uuid REFERENCES users(id),
  review_reason text CHECK(char_length(review_reason) BETWEEN 10 AND 1000),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND review_reason IS NULL)
    OR(status<>'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_reason IS NOT NULL))
);
CREATE INDEX address_change_request_owner_idx ON shipment_address_change_requests(requester_id,created_at DESC);
CREATE TABLE shipment_address_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES shipment_address_shares(id),
  revision integer NOT NULL CHECK(revision>0),
  request_id uuid NOT NULL UNIQUE REFERENCES shipment_address_change_requests(id),
  address_id uuid NOT NULL REFERENCES addresses(id),
  address_snapshot jsonb NOT NULL,
  approved_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(share_id,revision)
);
