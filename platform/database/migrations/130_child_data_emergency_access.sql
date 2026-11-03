CREATE TABLE child_data_emergency_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES child_profiles(id),
  account_id uuid NOT NULL REFERENCES users(id),
  requested_by uuid NOT NULL REFERENCES users(id),
  justification text NOT NULL CHECK (char_length(justification) BETWEEN 20 AND 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CHECK ((status='pending' AND decided_at IS NULL) OR (status<>'pending' AND decided_at IS NOT NULL))
);

CREATE UNIQUE INDEX child_data_emergency_profile_pending_idx
  ON child_data_emergency_access_requests(profile_id) WHERE status='pending';

CREATE TABLE child_data_emergency_access_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES child_data_emergency_access_requests(id),
  approver_id uuid NOT NULL REFERENCES users(id),
  approval_domain text NOT NULL CHECK (approval_domain IN ('security','privacy')),
  approved boolean NOT NULL,
  note text NOT NULL CHECK (char_length(note) BETWEEN 10 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id,approval_domain),
  UNIQUE(request_id,approver_id)
);

CREATE TABLE child_data_emergency_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES child_data_emergency_access_requests(id),
  grantee_id uuid NOT NULL REFERENCES users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now()+interval '15 minutes'),
  revoked_at timestamptz,
  CHECK (expires_at=granted_at+interval '15 minutes'),
  CHECK (revoked_at IS NULL OR revoked_at>=granted_at)
);

CREATE INDEX child_data_emergency_grant_active_idx
  ON child_data_emergency_access_grants(grantee_id,expires_at) WHERE revoked_at IS NULL;

CREATE TABLE child_data_emergency_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES child_data_emergency_access_requests(id),
  grant_id uuid NOT NULL REFERENCES child_data_emergency_access_grants(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  profile_id uuid NOT NULL REFERENCES child_profiles(id),
  watermark text NOT NULL CHECK (char_length(watermark) BETWEEN 20 AND 300),
  accessed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE child_data_emergency_access_logs IS
  'Auditoria por cinco anos conforme política; nunca armazena nem copia a data de nascimento infantil.';

ALTER TABLE account_notices DROP CONSTRAINT account_notices_kind_check;
ALTER TABLE account_notices ADD CONSTRAINT account_notices_kind_check
  CHECK (kind IN ('child_profile_age_limit','child_profile_change','child_profile_responsibility','child_data_emergency_access','exchange_difference_payment','exchange_dispute_evidence','exchange_dispute_decision','exchange_settlement_status','exchange_settlement_reconciliation'));
