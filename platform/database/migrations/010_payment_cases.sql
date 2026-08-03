CREATE TYPE payment_case_kind AS ENUM ('refund', 'dispute');
CREATE TYPE payment_case_status AS ENUM ('provider_pending', 'submitted', 'under_review', 'approved', 'rejected', 'completed', 'failed');

CREATE TABLE payment_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id uuid NOT NULL REFERENCES payment_intents(id),
  requester_id uuid NOT NULL REFERENCES users(id),
  kind payment_case_kind NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  reason text NOT NULL,
  details text NOT NULL,
  provider_reference text UNIQUE,
  status payment_case_status NOT NULL DEFAULT 'provider_pending',
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_case_reason_length CHECK (char_length(reason) BETWEEN 2 AND 80),
  CONSTRAINT payment_case_details_length CHECK (char_length(details) BETWEEN 10 AND 2000)
);
CREATE INDEX payment_cases_intent_idx ON payment_cases (payment_intent_id, created_at DESC);
