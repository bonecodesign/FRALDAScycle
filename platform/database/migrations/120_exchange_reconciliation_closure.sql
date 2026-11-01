CREATE TABLE exchange_settlement_reconciliation_closures (
  command_id uuid PRIMARY KEY REFERENCES exchange_difference_settlement_commands(id),
  recovery_command_id uuid REFERENCES exchange_settlement_reconciliation_commands(id),
  confirmation_source text NOT NULL CHECK (confirmation_source IN ('webhook','poll')),
  evidence_sha256 text NOT NULL CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  final_status text NOT NULL CHECK (final_status IN ('released','refunded')),
  confirmed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE exchange_settlement_reconciliation_alerts
  ADD COLUMN resolved_at timestamptz,
  ADD COLUMN resolution_command_id uuid REFERENCES exchange_settlement_reconciliation_closures(command_id);

CREATE INDEX exchange_settlement_reconciliation_open_alert_idx
  ON exchange_settlement_reconciliation_alerts(command_id,created_at)
  WHERE resolved_at IS NULL;

COMMENT ON TABLE exchange_settlement_reconciliation_closures IS
  'Evidência imutável do encerramento: somente confirmação reconciliada do provedor cria uma linha.';

CREATE FUNCTION close_exchange_settlement_reconciliation_after_confirmation()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  inserted_rows integer;
  final_status_value text;
  closure_message text;
BEGIN
  IF NEW.action <> 'exchange.difference.settlement_confirmed' THEN
    RETURN NEW;
  END IF;

  SELECT CASE
    WHEN r.action='manual_refund' OR c.operation<>'release' THEN 'refunded'
    ELSE 'released'
  END
  INTO final_status_value
  FROM exchange_difference_settlement_commands c
  LEFT JOIN exchange_settlement_reconciliation_commands r
    ON r.settlement_command_id=c.id AND r.status='completed'
  WHERE c.id=NEW.entity_id::uuid
  ORDER BY r.completed_at DESC NULLS LAST
  LIMIT 1;

  INSERT INTO exchange_settlement_reconciliation_closures(
    command_id,recovery_command_id,confirmation_source,evidence_sha256,final_status
  )
  SELECT c.id,r.id,NEW.metadata->>'source',NEW.metadata->>'evidenceSha256',final_status_value
  FROM exchange_difference_settlement_commands c
  LEFT JOIN exchange_settlement_reconciliation_commands r
    ON r.settlement_command_id=c.id AND r.status='completed'
  WHERE c.id=NEW.entity_id::uuid
  ORDER BY r.completed_at DESC NULLS LAST
  LIMIT 1
  ON CONFLICT(command_id) DO NOTHING;

  GET DIAGNOSTICS inserted_rows = ROW_COUNT;
  IF inserted_rows = 0 THEN
    RETURN NEW;
  END IF;

  UPDATE exchange_settlement_reconciliation_alerts
  SET resolved_at=now(),resolution_command_id=NEW.entity_id::uuid
  WHERE command_id=NEW.entity_id::uuid AND resolved_at IS NULL;

  closure_message := CASE final_status_value
    WHEN 'released' THEN 'Conciliação encerrada após confirmação do provedor: liberação concluída.'
    ELSE 'Conciliação encerrada após confirmação do provedor: reembolso concluído.'
  END;

  INSERT INTO account_notices(user_id,kind,message,dedupe_key)
  SELECT u.id,'exchange_settlement_reconciliation',closure_message,
    'exchange-settlement-reconciliation:'||NEW.entity_id||':provider-confirmed:'||u.id
  FROM users u
  WHERE u.staff_access_level IN (3,4,5) AND u.disabled_at IS NULL
  ON CONFLICT(dedupe_key) DO NOTHING;

  INSERT INTO notification_outbox(kind,recipient,payload,recipient_user_id)
  SELECT 'exchange_settlement_reconciliation',u.email,
    jsonb_build_object(
      'channel','email',
      'message',closure_message,
      'transactionId',c.transaction_id,
      'commandId',c.id,
      'kind','provider_confirmed'
    ),u.id
  FROM exchange_difference_settlement_commands c
  JOIN users u ON u.staff_access_level IN (3,4,5) AND u.disabled_at IS NULL
  JOIN account_operational_preferences p ON p.user_id=u.id AND p.email=true
  WHERE c.id=NEW.entity_id::uuid
    AND u.email_verified_at IS NOT NULL
    AND u.email IS NOT NULL;

  RETURN NEW;
END;
$$;

CREATE TRIGGER exchange_settlement_reconciliation_confirmation_closure
AFTER INSERT ON audit_events
FOR EACH ROW
WHEN (NEW.action='exchange.difference.settlement_confirmed')
EXECUTE FUNCTION close_exchange_settlement_reconciliation_after_confirmation();

