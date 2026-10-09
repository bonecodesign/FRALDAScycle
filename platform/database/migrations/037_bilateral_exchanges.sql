ALTER TABLE shipments DROP CONSTRAINT shipments_transaction_id_key;
ALTER TABLE shipments ADD COLUMN exchange_leg smallint CHECK (exchange_leg IN (1,2));
CREATE UNIQUE INDEX shipments_regular_transaction_unique ON shipments(transaction_id) WHERE exchange_leg IS NULL;
CREATE UNIQUE INDEX shipments_exchange_leg_unique ON shipments(transaction_id,exchange_leg) WHERE exchange_leg IS NOT NULL;

CREATE TABLE exchange_operations (
  transaction_id uuid PRIMARY KEY REFERENCES transactions(id),
  requested_listing_id uuid NOT NULL UNIQUE REFERENCES listings(id),
  offered_listing_id uuid NOT NULL UNIQUE REFERENCES listings(id),
  requester_id uuid NOT NULL REFERENCES users(id),
  owner_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','in_delivery','completed','refused','cancelled')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requested_listing_id<>offered_listing_id),
  CHECK (requester_id<>owner_id)
);

CREATE INDEX exchange_operations_parties_idx ON exchange_operations(requester_id,owner_id,status);
