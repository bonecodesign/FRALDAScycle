CREATE TABLE institution_representatives (
  institution_id uuid PRIMARY KEY REFERENCES institutions(id),
  user_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL CHECK(status IN('pending','accepted','verified','revoked')),
  version integer NOT NULL CHECK(version>0),
  invited_by uuid NOT NULL REFERENCES users(id),
  grant_reason text NOT NULL CHECK(char_length(grant_reason) BETWEEN 10 AND 1000),
  accepted_at timestamptz,
  verified_by uuid REFERENCES users(id),
  verification_reason text CHECK(char_length(verification_reason) BETWEEN 10 AND 1000),
  verified_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(status<>'verified' OR(accepted_at IS NOT NULL AND verified_by IS NOT NULL AND verified_at IS NOT NULL AND verification_reason IS NOT NULL))
);
CREATE TABLE institution_representative_events (
  id bigserial PRIMARY KEY,
  institution_id uuid NOT NULL REFERENCES institutions(id),
  user_id uuid NOT NULL REFERENCES users(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  version integer NOT NULL CHECK(version>0),
  status text NOT NULL CHECK(status IN('pending','accepted','verified','revoked')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(institution_id,version)
);
