CREATE TYPE courier_wallet_entry_kind AS ENUM ('delivery_credit','purchase_debit','withdrawal_reserve','withdrawal_release','withdrawal_return');
CREATE TYPE courier_wallet_withdrawal_status AS ENUM ('requested','level3_proposed','level4_approved','level5_authorized','provider_pending','completed','failed','returned');

CREATE TABLE courier_wallet_accounts (
  courier_id uuid PRIMARY KEY REFERENCES users(id),
  available_cents integer NOT NULL DEFAULT 0 CHECK(available_cents>=0),
  reserved_cents integer NOT NULL DEFAULT 0 CHECK(reserved_cents>=0),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE courier_wallet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES courier_wallet_accounts(courier_id),
  kind courier_wallet_entry_kind NOT NULL,
  amount_cents integer NOT NULL CHECK(amount_cents>0),
  available_after_cents integer NOT NULL CHECK(available_after_cents>=0),
  reserved_after_cents integer NOT NULL CHECK(reserved_after_cents>=0),
  source_type text NOT NULL CHECK(source_type IN ('courier_payout','marketplace_purchase','pix_withdrawal')),
  source_id uuid NOT NULL,
  provider_reference_hash text CHECK(provider_reference_hash IS NULL OR provider_reference_hash~'^[0-9a-f]{64}$'),
  evidence_sha256 text CHECK(evidence_sha256 IS NULL OR evidence_sha256~'^[0-9a-f]{64}$'),
  idempotency_key text NOT NULL UNIQUE CHECK(length(idempotency_key) BETWEEN 16 AND 128),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX courier_wallet_entries_statement_idx ON courier_wallet_entries(courier_id,created_at DESC,id DESC);

CREATE TABLE courier_wallet_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES courier_wallet_accounts(courier_id),
  amount_cents integer NOT NULL CHECK(amount_cents>0),
  status courier_wallet_withdrawal_status NOT NULL DEFAULT 'requested',
  payout_destination_reference text NOT NULL CHECK(length(payout_destination_reference) BETWEEN 3 AND 128),
  requested_at timestamptz NOT NULL DEFAULT now(),
  proposed_by uuid REFERENCES users(id),
  proposed_at timestamptz,
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  authorized_by uuid REFERENCES users(id),
  authorized_at timestamptz,
  provider_reference_hash text CHECK(provider_reference_hash IS NULL OR provider_reference_hash~'^[0-9a-f]{64}$'),
  completed_at timestamptz,
  failure_code text CHECK(failure_code IS NULL OR length(failure_code) BETWEEN 3 AND 100),
  idempotency_key text NOT NULL UNIQUE CHECK(length(idempotency_key) BETWEEN 16 AND 128),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK((status='requested' AND proposed_at IS NULL AND approved_at IS NULL AND authorized_at IS NULL) OR status<>'requested'),
  CHECK(approved_at IS NULL OR proposed_at IS NOT NULL),
  CHECK(authorized_at IS NULL OR approved_at IS NOT NULL)
);

CREATE INDEX courier_wallet_withdrawals_window_idx ON courier_wallet_withdrawals(courier_id,requested_at DESC);

COMMENT ON TABLE courier_wallet_accounts IS 'Internal non-expiring courier balance; production use remains feature-gated.';
COMMENT ON TABLE courier_wallet_entries IS 'Append-only wallet ledger without raw PIX keys, CPF or bank data.';
COMMENT ON TABLE courier_wallet_withdrawals IS 'One PIX request per rolling seven days, subject to levels 3, 4 and 5 and external provider reconciliation.';
