-- FC-323: a dormant roster for the support duty primary/substitute roles.
-- No appointment or acceptance API in this package: only human-approved governance
-- may nominate people later. No email/push/WhatsApp dispatch, no auto-pause.
CREATE TABLE public.support_duty_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_kind text NOT NULL CHECK (role_kind IN ('primary','substitute')),
  target_user_id uuid NOT NULL REFERENCES public.users(id),
  appointed_by uuid NOT NULL REFERENCES public.users(id),
  appointment_step_up_id uuid NOT NULL UNIQUE REFERENCES public.account_step_up_requests(id),
  reason text NOT NULL CHECK (char_length(trim(reason)) BETWEEN 10 AND 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','revoked')),
  accepted_by uuid REFERENCES public.users(id),
  acceptance_step_up_id uuid UNIQUE REFERENCES public.account_step_up_requests(id),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status='pending' AND accepted_by IS NULL AND acceptance_step_up_id IS NULL AND accepted_at IS NULL)
    OR
    (status='accepted' AND accepted_by=target_user_id AND acceptance_step_up_id IS NOT NULL AND accepted_at IS NOT NULL)
    OR status IN ('declined','revoked')
  )
);
CREATE UNIQUE INDEX support_duty_current_role_idx
  ON public.support_duty_assignments(role_kind) WHERE status IN ('pending','accepted');
CREATE UNIQUE INDEX support_duty_current_person_idx
  ON public.support_duty_assignments(target_user_id) WHERE status IN ('pending','accepted');
COMMENT ON TABLE public.support_duty_assignments IS
  'Unactivated human duty roster. Accepted role requires individual step-up; no automated alert dispatch or pause permitted.';
