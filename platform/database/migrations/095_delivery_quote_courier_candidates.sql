CREATE TABLE delivery_quote_courier_candidates (
  delivery_quote_id uuid NOT NULL REFERENCES delivery_quotes(id) ON DELETE CASCADE,
  courier_id uuid NOT NULL REFERENCES courier_profiles(user_id),
  priority integer NOT NULL CHECK(priority BETWEEN 1 AND 3),
  distance_to_recipient_km numeric(8,3) NOT NULL CHECK(distance_to_recipient_km>=0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(delivery_quote_id,courier_id),
  UNIQUE(delivery_quote_id,priority)
);

COMMENT ON TABLE delivery_quote_courier_candidates IS
  'Immutable top-three ranking for one quote. Stores courier identity and computed distance only, never coordinates.';
