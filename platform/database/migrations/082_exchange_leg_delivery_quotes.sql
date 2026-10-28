ALTER TABLE delivery_quotes
  ADD COLUMN shipment_id uuid REFERENCES shipments(id);

DROP INDEX delivery_quotes_one_current;

CREATE UNIQUE INDEX delivery_quotes_one_current_sale
  ON delivery_quotes(transaction_id)
  WHERE shipment_id IS NULL AND status IN ('quoted','confirmed','locked');

CREATE UNIQUE INDEX delivery_quotes_one_current_exchange_leg
  ON delivery_quotes(shipment_id)
  WHERE shipment_id IS NOT NULL AND status IN ('quoted','confirmed','locked');

CREATE INDEX delivery_quotes_exchange_transaction_idx
  ON delivery_quotes(transaction_id, shipment_id)
  WHERE shipment_id IS NOT NULL;

-- Exchange quotes are scoped to one shipment leg. The repository verifies that
-- the shipment belongs to the transaction and that only logistics_payer_id may
-- confirm it; no external charge or provider order is activated by this schema.
