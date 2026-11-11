DO $$
BEGIN
  IF EXISTS (
    SELECT transaction_id FROM shipments
    WHERE exchange_leg IS NOT NULL AND courier_id IS NOT NULL
    GROUP BY transaction_id HAVING count(DISTINCT courier_id) > 1
  ) THEN
    RAISE EXCEPTION 'existing exchange has more than one courier'
      USING ERRCODE = '23514', CONSTRAINT = 'exchange_single_courier_cycle';
  END IF;
END;
$$;

CREATE TABLE exchange_courier_cycles (
  transaction_id uuid PRIMARY KEY REFERENCES transactions(id),
  courier_id uuid NOT NULL REFERENCES users(id),
  assigned_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO exchange_courier_cycles(transaction_id,courier_id,assigned_at)
SELECT transaction_id,min(courier_id::text)::uuid,min(updated_at)
FROM shipments
WHERE exchange_leg IS NOT NULL AND courier_id IS NOT NULL
GROUP BY transaction_id;

CREATE OR REPLACE FUNCTION enforce_exchange_single_courier_cycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.exchange_leg IS NOT NULL AND NEW.courier_id IS NOT NULL THEN
    INSERT INTO exchange_courier_cycles(transaction_id,courier_id)
    VALUES(NEW.transaction_id,NEW.courier_id)
    ON CONFLICT(transaction_id) DO NOTHING;

    IF NOT EXISTS (
      SELECT 1 FROM exchange_courier_cycles cycle
      WHERE cycle.transaction_id=NEW.transaction_id AND cycle.courier_id=NEW.courier_id
    ) THEN
      RAISE EXCEPTION 'exchange legs must keep the same courier for the full cycle'
        USING ERRCODE = '23514', CONSTRAINT = 'exchange_single_courier_cycle';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER shipments_exchange_single_courier_cycle
BEFORE INSERT OR UPDATE OF courier_id, transaction_id, exchange_leg ON shipments
FOR EACH ROW EXECUTE FUNCTION enforce_exchange_single_courier_cycle();

COMMENT ON FUNCTION enforce_exchange_single_courier_cycle() IS
  'Fail-closed invariant: both legs of an exchange use one FraldaCycle courier from start to finish.';

COMMENT ON TABLE exchange_courier_cycles IS
  'One immutable courier identity per exchange cycle; separate leg quotes and receipts remain unchanged.';
