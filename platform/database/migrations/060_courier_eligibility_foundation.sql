CREATE TABLE courier_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  account_status text NOT NULL DEFAULT 'onboarding'
    CHECK (account_status IN ('onboarding','active','suspended','closed')),
  identity_status text NOT NULL DEFAULT 'pending'
    CHECK (identity_status IN ('pending','verified','rejected')),
  adult_confirmed_at timestamptz,
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  payout_status text NOT NULL DEFAULT 'pending'
    CHECK (payout_status IN ('pending','verified','rejected')),
  payout_provider_reference text,
  terms_version text,
  terms_accepted_at timestamptz,
  admin_approval_status text NOT NULL DEFAULT 'pending'
    CHECK (admin_approval_status IN ('pending','approved','rejected')),
  admin_reviewer_id uuid REFERENCES users(id),
  admin_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((payout_status = 'verified') = (payout_provider_reference IS NOT NULL)),
  CHECK ((admin_approval_status = 'approved') =
    (admin_reviewer_id IS NOT NULL AND admin_reviewed_at IS NOT NULL))
);

CREATE TABLE courier_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES courier_profiles(user_id) ON DELETE CASCADE,
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('motorcycle','bicycle')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','inactive')),
  driver_license_status text CHECK (driver_license_status IN ('pending','verified','rejected','expired')),
  driver_license_expires_at timestamptz,
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (vehicle_type <> 'motorcycle' OR driver_license_status IS NOT NULL),
  CHECK (driver_license_status <> 'verified' OR driver_license_expires_at IS NOT NULL),
  CHECK ((status = 'approved') = (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

CREATE UNIQUE INDEX courier_vehicles_one_current_idx
  ON courier_vehicles(courier_id) WHERE status IN ('pending','approved');

CREATE TABLE courier_clearance_reviewers (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE TABLE courier_clearance_support_supervisors (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE TABLE courier_clearance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES courier_profiles(user_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','verified','rejected','expired','deleted')),
  issuer text NOT NULL CHECK (issuer = 'police_civil'),
  validity_source text CHECK (validity_source = 'issuer_document'),
  issuer_verification_reference text,
  issued_at timestamptz,
  expires_at timestamptz,
  encrypted_object_reference text NOT NULL UNIQUE,
  encryption_key_reference text NOT NULL,
  access_scope text NOT NULL CHECK (access_scope = 'courier_clearance_reviewers'),
  access_logging_enabled boolean NOT NULL DEFAULT true CHECK (access_logging_enabled),
  retention_policy_version text NOT NULL,
  retention_legal_approver_id uuid NOT NULL REFERENCES users(id),
  delete_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (expires_at IS NULL OR issued_at IS NULL OR expires_at > issued_at),
  CHECK (expires_at IS NULL OR delete_at = expires_at + interval '30 days'),
  CHECK (status <> 'verified' OR
    (validity_source = 'issuer_document' AND issuer_verification_reference IS NOT NULL AND
     issued_at IS NOT NULL AND expires_at IS NOT NULL AND delete_at IS NOT NULL)),
  CHECK ((status = 'deleted') = (deleted_at IS NOT NULL))
);

CREATE INDEX courier_clearance_documents_review_idx
  ON courier_clearance_documents(status, created_at);
CREATE INDEX courier_clearance_documents_expiry_idx
  ON courier_clearance_documents(expires_at) WHERE status = 'verified';
CREATE INDEX courier_clearance_documents_deletion_idx
  ON courier_clearance_documents(delete_at) WHERE status <> 'deleted';

CREATE TABLE courier_clearance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES courier_clearance_documents(id) ON DELETE CASCADE,
  review_kind text NOT NULL CHECK (review_kind IN ('initial','renewal','correction')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  method text NOT NULL CHECK (method = 'official_police_civil_channel'),
  submission_reference text NOT NULL UNIQUE,
  submitted_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  reviewer_id uuid REFERENCES users(id),
  decided_at timestamptz,
  audit_reference text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (due_at = submitted_at + interval '24 hours'),
  CHECK ((status = 'pending') =
    (reviewer_id IS NULL AND decided_at IS NULL AND audit_reference IS NULL)),
  CHECK (status = 'pending' OR
    (reviewer_id IS NOT NULL AND decided_at IS NOT NULL AND audit_reference IS NOT NULL)),
  CHECK (decided_at IS NULL OR decided_at >= submitted_at)
);

CREATE UNIQUE INDEX courier_clearance_reviews_one_pending_idx
  ON courier_clearance_reviews(document_id) WHERE status = 'pending';

CREATE TABLE courier_clearance_suspensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES courier_profiles(user_id) ON DELETE CASCADE,
  rejected_review_id uuid NOT NULL REFERENCES courier_clearance_reviews(id),
  status text NOT NULL DEFAULT 'suspended'
    CHECK (status IN ('suspended','released','closed_sla_expired')),
  support_request_reference text UNIQUE,
  support_opened_at timestamptz,
  support_due_at timestamptz,
  supervisor_due_at timestamptz,
  released_by uuid REFERENCES users(id),
  release_reviewer_role text CHECK (release_reviewer_role IN ('support','support_supervisor')),
  released_at timestamptz,
  release_audit_reference text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((support_request_reference IS NULL AND support_opened_at IS NULL AND
          support_due_at IS NULL AND supervisor_due_at IS NULL) OR
         (support_request_reference IS NOT NULL AND support_opened_at IS NOT NULL AND
          support_due_at = support_opened_at + interval '24 hours' AND
          supervisor_due_at = support_due_at + interval '24 hours')),
  CHECK ((status = 'released') =
    (released_by IS NOT NULL AND release_reviewer_role IS NOT NULL AND
     released_at IS NOT NULL AND release_audit_reference IS NOT NULL)),
  CHECK (status <> 'released' OR support_request_reference IS NOT NULL),
  CHECK (status <> 'released' OR
    (release_reviewer_role = 'support' AND released_at <= support_due_at) OR
    (release_reviewer_role = 'support_supervisor' AND
     released_at > support_due_at AND released_at <= supervisor_due_at))
);

CREATE UNIQUE INDEX courier_clearance_suspensions_one_open_idx
  ON courier_clearance_suspensions(courier_id) WHERE status = 'suspended';

CREATE TABLE courier_clearance_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES courier_clearance_documents(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  purpose text NOT NULL CHECK (purpose IN ('verification','support_review','legal_audit','deletion')),
  accessed_at timestamptz NOT NULL DEFAULT now(),
  request_reference text NOT NULL UNIQUE
);

CREATE TABLE courier_eligibility_maintenance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key text NOT NULL UNIQUE,
  task_kind text NOT NULL CHECK (task_kind IN
    ('renewal_notice','support_escalation','support_sla_close','clearance_copy_delete')),
  courier_id uuid NOT NULL REFERENCES courier_profiles(user_id) ON DELETE CASCADE,
  document_id uuid REFERENCES courier_clearance_documents(id),
  suspension_id uuid REFERENCES courier_clearance_suspensions(id),
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 8),
  locked_at timestamptz,
  claim_token uuid,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((task_kind IN ('renewal_notice','clearance_copy_delete')) = (document_id IS NOT NULL)),
  CHECK ((task_kind IN ('support_escalation','support_sla_close')) = (suspension_id IS NOT NULL))
);

CREATE INDEX courier_eligibility_maintenance_dispatch_idx
  ON courier_eligibility_maintenance_tasks(status,scheduled_for,created_at)
  WHERE status IN ('pending','failed');

COMMENT ON TABLE courier_profiles IS 'Inactive normalized foundation for registered courier eligibility; no public onboarding route until privacy and operational activation.';
COMMENT ON TABLE courier_clearance_reviewers IS 'Explicit least-privilege membership; the admin role alone never grants police-clearance object access.';
COMMENT ON TABLE courier_clearance_support_supervisors IS 'Explicit membership required for release decisions during the supervisor SLA.';
COMMENT ON COLUMN courier_clearance_documents.encrypted_object_reference IS 'Opaque reference only; document bytes and access URL must not be stored in this table.';
COMMENT ON TABLE courier_clearance_access_audit IS 'Append-only application audit for every attempted access to a restricted police-clearance object.';
COMMENT ON TABLE courier_eligibility_maintenance_tasks IS 'Idempotent obligations only; scheduling never sends a message or deletes a provider object directly.';
