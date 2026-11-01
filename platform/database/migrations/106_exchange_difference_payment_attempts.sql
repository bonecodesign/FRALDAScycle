ALTER TABLE exchange_difference_obligations
  ADD COLUMN checkout_attempt_count smallint NOT NULL DEFAULT 0 CHECK (checkout_attempt_count BETWEEN 0 AND 2);

CREATE TABLE exchange_difference_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES exchange_difference_obligations(transaction_id),
  attempt_number smallint NOT NULL CHECK (attempt_number BETWEEN 1 AND 2),
  payment_method text NOT NULL CHECK (payment_method IN ('pix','credit')),
  installments smallint NOT NULL CHECK (installments = 1),
  provider_reference text UNIQUE,
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved','provider_pending','expired','cancelled','paid')),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  UNIQUE(transaction_id,attempt_number),
  CHECK ((status IN ('expired','cancelled')) = (closed_at IS NOT NULL))
);

INSERT INTO exchange_difference_payment_attempts
  (transaction_id,attempt_number,payment_method,installments,provider_reference,status,closed_at)
SELECT transaction_id,1,payment_method,installments,provider_reference,
  CASE WHEN status IN ('paid','release_pending','released','refunded') THEN 'paid'
       WHEN provider_reference IS NOT NULL THEN 'provider_pending' ELSE 'reserved' END,
  NULL
FROM exchange_difference_obligations WHERE payment_method IS NOT NULL;

UPDATE exchange_difference_obligations SET checkout_attempt_count=1 WHERE payment_method IS NOT NULL;

ALTER TABLE exchange_difference_obligations ADD CONSTRAINT exchange_difference_attempt_count_consistency
  CHECK ((payment_method IS NULL AND checkout_attempt_count=0) OR (payment_method IS NOT NULL AND checkout_attempt_count BETWEEN 1 AND 2));

COMMENT ON TABLE exchange_difference_payment_attempts IS
  'Máximo de duas tentativas; nova tentativa exige encerramento confirmado da anterior e nunca armazena token ou cartão bruto.';
