ALTER TABLE exchange_settlement_reconciliation_alerts
  DROP CONSTRAINT exchange_settlement_reconciliation_a_resolution_command_id_fkey;

ALTER TABLE exchange_settlement_reconciliation_closures
  DROP CONSTRAINT exchange_settlement_reconciliation_closures_pkey,
  ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN confirmation_month date,
  ADD COLUMN anonymized_at timestamptz,
  ADD COLUMN retention_due_at timestamptz,
  ALTER COLUMN command_id DROP NOT NULL,
  ALTER COLUMN evidence_sha256 DROP NOT NULL,
  ALTER COLUMN confirmed_at DROP NOT NULL,
  ADD PRIMARY KEY(id),
  ADD UNIQUE(command_id),
  ADD CONSTRAINT exchange_reconciliation_closure_anonymized_check CHECK (
    (anonymized_at IS NULL AND command_id IS NOT NULL AND evidence_sha256 IS NOT NULL AND confirmed_at IS NOT NULL AND confirmation_month IS NULL)
    OR
    (anonymized_at IS NOT NULL AND command_id IS NULL AND recovery_command_id IS NULL AND evidence_sha256 IS NULL AND confirmed_at IS NULL AND confirmation_month IS NOT NULL)
  );

UPDATE exchange_settlement_reconciliation_closures
SET retention_due_at=confirmed_at+interval '5 years';

ALTER TABLE exchange_settlement_reconciliation_closures
  ALTER COLUMN retention_due_at SET DEFAULT (now()+interval '5 years'),
  ALTER COLUMN retention_due_at SET NOT NULL;

ALTER TABLE exchange_settlement_reconciliation_alerts
  ADD COLUMN resolution_closure_id uuid REFERENCES exchange_settlement_reconciliation_closures(id);

UPDATE exchange_settlement_reconciliation_alerts a
SET resolution_closure_id=c.id
FROM exchange_settlement_reconciliation_closures c
WHERE a.resolution_command_id=c.command_id;

ALTER TABLE exchange_settlement_reconciliation_alerts
  DROP COLUMN resolution_command_id;

CREATE INDEX exchange_reconciliation_retention_due_idx
  ON exchange_settlement_reconciliation_closures(retention_due_at,id)
  WHERE anonymized_at IS NULL;

COMMENT ON COLUMN exchange_settlement_reconciliation_closures.retention_due_at IS
  'Prazo técnico de cinco anos; a execução permanece bloqueada até aprovação jurídica e de privacidade.';

