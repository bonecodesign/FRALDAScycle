CREATE TYPE shipment_mode AS ENUM ('pickup', 'partner', 'postal', 'express');
CREATE TYPE shipment_status AS ENUM ('provider_pending', 'awaiting_pickup', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled');

CREATE TABLE shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL UNIQUE REFERENCES transactions(id),
  buyer_id uuid NOT NULL REFERENCES users(id),
  seller_id uuid NOT NULL REFERENCES users(id),
  courier_id uuid REFERENCES users(id),
  mode shipment_mode NOT NULL,
  insured boolean NOT NULL DEFAULT false,
  idempotency_key text NOT NULL UNIQUE,
  provider_reference text UNIQUE,
  status shipment_status NOT NULL DEFAULT 'provider_pending',
  estimated_delivery_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shipments_courier_idx ON shipments (courier_id, status) WHERE courier_id IS NOT NULL;

CREATE TABLE shipment_events (
  id bigserial PRIMARY KEY,
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status shipment_status NOT NULL,
  latitude numeric(9,6),
  longitude numeric(9,6),
  description text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shipment_events_timeline_idx ON shipment_events (shipment_id, occurred_at DESC, id DESC);

CREATE TABLE delivery_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL UNIQUE REFERENCES shipments(id),
  courier_id uuid NOT NULL REFERENCES users(id),
  media_key text NOT NULL,
  recipient_name text NOT NULL,
  latitude numeric(9,6) NOT NULL,
  longitude numeric(9,6) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
