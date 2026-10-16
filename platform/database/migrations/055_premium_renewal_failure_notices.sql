-- Aviso interno e idempotente. Não envia mensagem nem solicita cobrança ao fornecedor.
CREATE TABLE premium_renewal_failure_notices (
  user_id uuid NOT NULL REFERENCES users(id),
  renewal_failed_at timestamptz NOT NULL,
  regularize_by timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,renewal_failed_at),
  CHECK (regularize_by = renewal_failed_at + interval '3 days')
);

CREATE INDEX premium_renewal_failure_notices_user_idx
  ON premium_renewal_failure_notices(user_id,created_at DESC);
