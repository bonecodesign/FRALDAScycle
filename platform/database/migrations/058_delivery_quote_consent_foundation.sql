CREATE TABLE delivery_quote_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address_id uuid REFERENCES addresses(id) ON DELETE SET NULL,
  notice_version text NOT NULL CHECK (notice_version = 'FC-DELIVERY-QUOTE-1'),
  consented_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (transaction_id, owner_id),
  CHECK (revoked_at IS NULL OR revoked_at >= consented_at)
);

CREATE INDEX delivery_quote_consents_active_idx
  ON delivery_quote_consents(transaction_id) WHERE revoked_at IS NULL;

COMMENT ON TABLE delivery_quote_consents IS 'Inactive foundation for a separate pre-quotation authorization; no public route or provider request until notice and privacy review are approved.';
