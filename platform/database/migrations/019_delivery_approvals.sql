CREATE TABLE delivery_receipt_approvals (
  proof_id uuid PRIMARY KEY REFERENCES delivery_proofs(id),
  approver_id uuid NOT NULL REFERENCES users(id),
  approved_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE delivery_proof_validations (
  proof_id uuid PRIMARY KEY REFERENCES delivery_proofs(id),
  validator_id uuid NOT NULL REFERENCES users(id),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 1000),
  validated_at timestamptz NOT NULL DEFAULT now()
);
