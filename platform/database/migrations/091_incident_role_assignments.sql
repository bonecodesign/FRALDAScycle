ALTER TABLE account_step_up_requests DROP CONSTRAINT account_step_up_requests_purpose_check;
ALTER TABLE account_step_up_requests ADD CONSTRAINT account_step_up_requests_purpose_check
  CHECK(purpose IN ('data_export','account_closure','staff_access_change','refund_execution','operational_resume','incident_role_assignment'));

CREATE TABLE incident_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_kind text NOT NULL CHECK(role_kind IN ('technical_lead','technical_substitute','independent_observer')),
  target_user_id uuid NOT NULL REFERENCES users(id),
  appointed_by uuid NOT NULL REFERENCES users(id),
  appointment_step_up_id uuid NOT NULL UNIQUE REFERENCES account_step_up_requests(id),
  reason text NOT NULL CHECK(char_length(reason) BETWEEN 10 AND 500),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','revoked')),
  decision_step_up_id uuid UNIQUE REFERENCES account_step_up_requests(id),
  decision_reason text CHECK(decision_reason IS NULL OR char_length(decision_reason) BETWEEN 10 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CHECK((status='pending' AND decision_step_up_id IS NULL AND decided_at IS NULL)
    OR (status IN ('accepted','declined') AND decision_step_up_id IS NOT NULL AND decided_at IS NOT NULL)
    OR status='revoked')
);

CREATE UNIQUE INDEX incident_role_one_current_kind_idx ON incident_role_assignments(role_kind) WHERE status IN ('pending','accepted');
CREATE UNIQUE INDEX incident_role_one_current_person_idx ON incident_role_assignments(target_user_id) WHERE status IN ('pending','accepted');
