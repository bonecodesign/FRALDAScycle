CREATE TABLE account_step_up_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  auth_token_id uuid NOT NULL UNIQUE REFERENCES auth_tokens(id) ON DELETE CASCADE,
  challenge_hash bytea NOT NULL UNIQUE,
  purpose text NOT NULL CHECK(purpose IN ('data_export','account_closure')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  grant_consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(grant_consumed_at IS NULL OR confirmed_at IS NOT NULL)
);

CREATE UNIQUE INDEX account_step_up_one_pending_per_purpose
  ON account_step_up_requests(user_id,purpose)
  WHERE confirmed_at IS NULL AND attempts<5;

CREATE INDEX account_step_up_active_grant_idx
  ON account_step_up_requests(id,user_id,purpose,expires_at)
  WHERE confirmed_at IS NOT NULL AND grant_consumed_at IS NULL;
