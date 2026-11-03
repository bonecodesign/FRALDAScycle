ALTER TABLE child_profiles
  ADD COLUMN responsibility_suspended_at timestamptz,
  ADD COLUMN responsibility_previous_personalization boolean,
  ADD COLUMN responsibility_ended_reason text,
  ADD CONSTRAINT child_profile_responsibility_suspension_consistency CHECK (
    (responsibility_suspended_at IS NULL AND responsibility_previous_personalization IS NULL)
    OR (responsibility_suspended_at IS NOT NULL AND responsibility_previous_personalization IS NOT NULL AND personalization_enabled=false)
  ),
  ADD CONSTRAINT child_profile_responsibility_end_reason CHECK (
    responsibility_ended_reason IS NULL OR responsibility_ended_reason='dispute_confirmed'
  );

CREATE TABLE child_profile_responsibility_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES child_profiles(id),
  account_id uuid NOT NULL REFERENCES users(id),
  support_ticket_id uuid NOT NULL UNIQUE REFERENCES support_tickets(id),
  reason_code text NOT NULL CHECK (reason_code IN ('responsibility_contested','judicial_notice','account_takeover')),
  evidence_reference text CHECK (evidence_reference IS NULL OR evidence_reference ~ '^[A-Za-z0-9:_-]{16,200}$'),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','verified','rejected','resolved')),
  opened_by uuid NOT NULL REFERENCES users(id),
  verified_by uuid REFERENCES users(id),
  plausible boolean,
  verification_note text,
  verified_at timestamptz,
  decided_by uuid REFERENCES users(id),
  outcome text CHECK (outcome IN ('restore','remove')),
  decision_note text,
  decided_at timestamptz,
  evidence_delete_by timestamptz,
  evidence_deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((verified_at IS NULL AND verified_by IS NULL AND plausible IS NULL)
    OR (verified_at IS NOT NULL AND verified_by IS NOT NULL AND plausible IS NOT NULL)),
  CHECK ((decided_at IS NULL AND decided_by IS NULL AND outcome IS NULL)
    OR (decided_at IS NOT NULL AND decided_by IS NOT NULL AND outcome IS NOT NULL)),
  CHECK ((status='rejected' AND plausible=false AND evidence_delete_by=verified_at+interval '30 days')
    OR (status='resolved' AND evidence_delete_by=decided_at+interval '30 days')
    OR (status IN ('submitted','verified') AND evidence_delete_by IS NULL)),
  CHECK (evidence_deleted_at IS NULL OR (decided_at IS NOT NULL AND evidence_deleted_at>=decided_at))
);

CREATE UNIQUE INDEX child_profile_responsibility_active_idx
  ON child_profile_responsibility_disputes(profile_id)
  WHERE status IN ('submitted','verified');

CREATE INDEX child_profile_responsibility_review_idx
  ON child_profile_responsibility_disputes(status,created_at,id);

ALTER TABLE account_notices DROP CONSTRAINT account_notices_kind_check;
ALTER TABLE account_notices ADD CONSTRAINT account_notices_kind_check
  CHECK (kind IN ('child_profile_age_limit','child_profile_change','child_profile_responsibility','exchange_difference_payment','exchange_dispute_evidence','exchange_dispute_decision','exchange_settlement_status','exchange_settlement_reconciliation'));

COMMENT ON TABLE child_profile_responsibility_disputes IS
  'Análise restrita de responsabilidade; não armazena nascimento, emoji nem conteúdo de documentos. Referências de evidência expiram em até 30 dias após decisão.';
