CREATE TABLE account_closure_retention_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_request_id uuid NOT NULL UNIQUE REFERENCES account_closure_requests(id),
  inventory_id uuid NOT NULL UNIQUE REFERENCES account_closure_data_inventories(id),
  user_id uuid NOT NULL REFERENCES users(id),
  policy_version text NOT NULL CHECK(policy_version='FC-CLOSURE-RETENTION-1'),
  policy_status text NOT NULL DEFAULT 'pending_professional_review'
    CHECK(policy_status='pending_professional_review'),
  plan jsonb NOT NULL,
  execution_allowed boolean NOT NULL DEFAULT false CHECK(execution_allowed=false),
  automatic_erasure_allowed boolean NOT NULL DEFAULT false CHECK(automatic_erasure_allowed=false),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE account_closure_retention_plans IS
  'Plano técnico classificado; não autoriza DELETE, anonimização, fornecedor ou encerramento da conta.';
