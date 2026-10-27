CREATE TABLE data_export_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  format text NOT NULL CHECK(format IN ('json','csv')),
  status text NOT NULL DEFAULT 'pending_storage'
    CHECK(status IN ('pending_storage','processing','ready','expired','failed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz,
  expires_at timestamptz,
  storage_reference text,
  artifact_sha256 char(64),
  version integer NOT NULL DEFAULT 0 CHECK(version>=0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK((status='ready')=(ready_at IS NOT NULL AND expires_at IS NOT NULL
    AND storage_reference IS NOT NULL AND artifact_sha256 IS NOT NULL)),
  CHECK(expires_at IS NULL OR expires_at=ready_at+interval '7 days'),
  CHECK(artifact_sha256 IS NULL OR artifact_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE INDEX data_export_requests_owner_idx
  ON data_export_requests(user_id,requested_at DESC);

CREATE UNIQUE INDEX data_export_one_active_per_user
  ON data_export_requests(user_id)
  WHERE status IN ('pending_storage','processing','ready');

-- Passwords, password-derived keys, plaintext payloads and download tokens are
-- intentionally absent. A storage/KMS adapter must be approved before workers
-- can move a request beyond pending_storage.
