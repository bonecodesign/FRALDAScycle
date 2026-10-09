ALTER TABLE exchange_operations ADD COLUMN refused_at timestamptz;
ALTER TABLE exchange_operations ADD COLUMN refused_by uuid REFERENCES users(id);
ALTER TABLE exchange_operations ADD COLUMN refusal_reason text;

CREATE TABLE exchange_cancellation_confirmations (
  transaction_id uuid NOT NULL REFERENCES exchange_operations(transaction_id),
  user_id uuid NOT NULL REFERENCES users(id),
  expected_version integer NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 1000),
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(transaction_id,user_id)
);
