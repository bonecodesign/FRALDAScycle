-- FC-324: multi-person nomination is independent from incident/marketplace controls.
-- No employee, channel or on-call shift is created by this migration.
ALTER TABLE public.account_step_up_requests DROP CONSTRAINT account_step_up_requests_purpose_check;
ALTER TABLE public.account_step_up_requests ADD CONSTRAINT account_step_up_requests_purpose_check
 CHECK (purpose IN ('data_export','account_closure','staff_access_change','refund_execution',
  'operational_resume','incident_role_assignment','support_duty_assignment'));

CREATE TABLE public.support_duty_proposals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 role_kind text NOT NULL CHECK (role_kind IN ('primary','substitute')),
 target_user_id uuid NOT NULL REFERENCES public.users(id),
 proposed_by uuid NOT NULL REFERENCES public.users(id),
 proposal_step_up_id uuid NOT NULL UNIQUE REFERENCES public.account_step_up_requests(id),
 proposal_reason text NOT NULL CHECK (char_length(trim(proposal_reason)) BETWEEN 10 AND 500),
 status text NOT NULL DEFAULT 'pending_review'
  CHECK (status IN ('pending_review','pending_founder','approved','rejected')),
 reviewed_by uuid REFERENCES public.users(id),
 review_step_up_id uuid UNIQUE REFERENCES public.account_step_up_requests(id),
 review_reason text CHECK (review_reason IS NULL OR char_length(trim(review_reason)) BETWEEN 10 AND 500),
 review_approved boolean,
 reviewed_at timestamptz,
 decided_by uuid REFERENCES public.users(id),
 decision_step_up_id uuid UNIQUE REFERENCES public.account_step_up_requests(id),
 decision_reason text CHECK (decision_reason IS NULL OR char_length(trim(decision_reason)) BETWEEN 10 AND 500),
 decided_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (proposed_by<>target_user_id),
 CHECK (reviewed_by IS NULL OR (reviewed_by<>proposed_by AND reviewed_by<>target_user_id)),
 CHECK (decided_by IS NULL OR (decided_by<>proposed_by AND decided_by<>reviewed_by AND decided_by<>target_user_id)),
 CHECK (
  (status='pending_review' AND reviewed_by IS NULL AND review_step_up_id IS NULL AND review_reason IS NULL AND review_approved IS NULL AND reviewed_at IS NULL AND decided_by IS NULL AND decision_step_up_id IS NULL AND decided_at IS NULL)
  OR (status='pending_founder' AND reviewed_by IS NOT NULL AND review_step_up_id IS NOT NULL AND review_reason IS NOT NULL AND review_approved IS TRUE AND reviewed_at IS NOT NULL AND decided_by IS NULL AND decision_step_up_id IS NULL AND decided_at IS NULL)
  OR (status='approved' AND reviewed_by IS NOT NULL AND review_approved IS TRUE AND decided_by IS NOT NULL AND decision_step_up_id IS NOT NULL AND decision_reason IS NOT NULL AND decided_at IS NOT NULL)
  OR (status='rejected' AND (review_approved IS FALSE OR (review_approved IS TRUE AND decided_by IS NOT NULL AND decision_step_up_id IS NOT NULL AND decision_reason IS NOT NULL AND decided_at IS NOT NULL)))
 )
);
CREATE UNIQUE INDEX support_duty_proposal_pending_role_idx ON public.support_duty_proposals(role_kind)
 WHERE status IN ('pending_review','pending_founder');
CREATE UNIQUE INDEX support_duty_proposal_pending_target_idx ON public.support_duty_proposals(target_user_id)
 WHERE status IN ('pending_review','pending_founder');

ALTER TABLE public.support_duty_assignments
 ADD COLUMN proposal_id uuid NOT NULL UNIQUE REFERENCES public.support_duty_proposals(id),
 ADD COLUMN revoked_by uuid REFERENCES public.users(id),
 ADD COLUMN revoke_step_up_id uuid UNIQUE REFERENCES public.account_step_up_requests(id),
 ADD COLUMN revoked_at timestamptz,
 ADD COLUMN revoke_reason text CHECK (revoke_reason IS NULL OR char_length(trim(revoke_reason)) BETWEEN 10 AND 500),
 ADD CONSTRAINT support_duty_revocation_complete CHECK (
  (revoked_by IS NULL AND revoke_step_up_id IS NULL AND revoked_at IS NULL AND revoke_reason IS NULL)
  OR
  (status='revoked' AND revoked_by IS NOT NULL AND revoke_step_up_id IS NOT NULL AND revoked_at IS NOT NULL AND revoke_reason IS NOT NULL)
 );
COMMENT ON TABLE public.support_duty_proposals IS
 'Four-stage founder governance: level 3 proposal, independent level 4 review, final founder authorization, then nominee acceptance. No automatic shift coverage.';
