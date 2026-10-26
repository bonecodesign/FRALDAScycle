CREATE TABLE account_closure_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  idempotency_key text NOT NULL UNIQUE CHECK(char_length(idempotency_key) BETWEEN 16 AND 128),
  notice_version text NOT NULL,
  status text NOT NULL DEFAULT 'cooling_off'
    CHECK(status IN ('cooling_off','awaiting_obligations','ready_for_review','cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  cancel_until timestamptz NOT NULL,
  cancelled_at timestamptz,
  version integer NOT NULL DEFAULT 0 CHECK(version>=0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(cancel_until=requested_at+interval '7 days'),
  CHECK((status='cancelled')=(cancelled_at IS NOT NULL))
);

CREATE UNIQUE INDEX account_closure_one_active_per_user
  ON account_closure_requests(user_id) WHERE status<>'cancelled';

CREATE TABLE account_operation_restrictions (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  reason text NOT NULL CHECK(reason='closure_pending'),
  closure_request_id uuid NOT NULL UNIQUE REFERENCES account_closure_requests(id),
  restricted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX account_closure_due_idx
  ON account_closure_requests(cancel_until) WHERE status='cooling_off';

-- This migration deliberately does not erase or anonymize user data. Final
-- execution remains blocked by obligations, retention policy and legal review.
