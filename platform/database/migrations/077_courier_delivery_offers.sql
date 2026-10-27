CREATE TABLE courier_delivery_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id),
  courier_id uuid NOT NULL REFERENCES courier_profiles(user_id),
  delivery_quote_id uuid REFERENCES delivery_quotes(id),
  priority integer NOT NULL CHECK(priority BETWEEN 1 AND 3),
  distance_to_recipient_km numeric(8,3) NOT NULL CHECK(distance_to_recipient_km>=0),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','expired')),
  offered_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shipment_id,courier_id),
  CHECK(expires_at=offered_at+interval '3 minutes'),
  CHECK((status='pending')=(responded_at IS NULL))
);
CREATE UNIQUE INDEX courier_delivery_offers_one_pending ON courier_delivery_offers(shipment_id)
  WHERE status='pending';
CREATE INDEX courier_delivery_offers_courier_idx ON courier_delivery_offers(courier_id,status,expires_at);
