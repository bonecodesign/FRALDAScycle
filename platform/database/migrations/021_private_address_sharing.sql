CREATE TABLE shipment_address_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id),
  owner_id uuid NOT NULL REFERENCES users(id),
  recipient_id uuid NOT NULL REFERENCES users(id),
  address_id uuid REFERENCES addresses(id) ON DELETE SET NULL,
  address_snapshot jsonb NOT NULL,
  notice_version text NOT NULL CHECK (notice_version='FC-ADDRESS-1'),
  shared_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shipment_id,owner_id,recipient_id)
);
