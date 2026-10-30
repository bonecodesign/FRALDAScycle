CREATE TABLE account_closure_data_inventories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_request_id uuid NOT NULL UNIQUE REFERENCES account_closure_requests(id),
  user_id uuid NOT NULL REFERENCES users(id),
  inventory jsonb NOT NULL,
  policy_status text NOT NULL DEFAULT 'awaiting_legal_review' CHECK(policy_status='awaiting_legal_review'),
  automatic_erasure_allowed boolean NOT NULL DEFAULT false CHECK(automatic_erasure_allowed=false),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE account_closure_data_inventories IS
  'Inventário técnico sem autorização de exclusão; não substitui revisão jurídica, de privacidade ou humana.';
