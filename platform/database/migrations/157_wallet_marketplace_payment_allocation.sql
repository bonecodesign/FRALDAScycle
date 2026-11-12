ALTER TYPE courier_wallet_entry_kind ADD VALUE 'purchase_reserve';
ALTER TYPE courier_wallet_entry_kind ADD VALUE 'purchase_release';
ALTER TYPE courier_wallet_entry_kind ADD VALUE 'purchase_refund';

ALTER TABLE payment_intents DROP CONSTRAINT payment_intents_method_check;
ALTER TABLE payment_intents ADD CONSTRAINT payment_intents_method_check
  CHECK(method IN ('pix','credit','wallet'));

ALTER TABLE payment_intents ADD COLUMN wallet_amount_cents integer NOT NULL DEFAULT 0;
ALTER TABLE payment_intents ADD COLUMN provider_charge_cents integer GENERATED ALWAYS AS (amount_cents-wallet_amount_cents) STORED;
ALTER TABLE payment_intents ADD CONSTRAINT payment_intent_funding_total
  CHECK(wallet_amount_cents>=0 AND provider_charge_cents>=0 AND wallet_amount_cents+provider_charge_cents=amount_cents);
ALTER TABLE payment_intents ADD CONSTRAINT payment_intent_wallet_method_consistency
  CHECK((method='wallet')=(wallet_amount_cents=amount_cents AND provider_charge_cents=0));

CREATE TABLE courier_wallet_purchase_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL UNIQUE REFERENCES transactions(id),
  payment_intent_id uuid NOT NULL UNIQUE REFERENCES payment_intents(id),
  courier_id uuid NOT NULL REFERENCES courier_wallet_accounts(courier_id),
  gross_cents integer NOT NULL CHECK(gross_cents>0),
  wallet_cents integer NOT NULL CHECK(wallet_cents>0),
  external_cents integer NOT NULL CHECK(external_cents>=0),
  wallet_refunded_cents integer NOT NULL DEFAULT 0 CHECK(wallet_refunded_cents>=0),
  external_refunded_cents integer NOT NULL DEFAULT 0 CHECK(external_refunded_cents>=0),
  status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','paid','released','partially_refunded','refunded')),
  idempotency_key text NOT NULL UNIQUE CHECK(length(idempotency_key) BETWEEN 16 AND 128),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(wallet_cents+external_cents=gross_cents),
  CHECK(wallet_refunded_cents<=wallet_cents),
  CHECK(external_refunded_cents<=external_cents)
);

ALTER TABLE transaction_contact_access ADD COLUMN wallet_purchase_allocation_id uuid UNIQUE
  REFERENCES courier_wallet_purchase_allocations(id);
ALTER TABLE transaction_contact_access ALTER COLUMN payment_intent_id DROP NOT NULL;
ALTER TABLE transaction_contact_access ADD CONSTRAINT transaction_contact_access_payment_origin
  CHECK(payment_intent_id IS NOT NULL OR wallet_purchase_allocation_id IS NOT NULL);

COMMENT ON TABLE courier_wallet_purchase_allocations IS
  'Immutable funding split for courier Marketplace purchases; real activation remains feature-gated.';
