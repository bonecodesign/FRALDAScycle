CREATE TABLE institution_brand_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id),
  representative_id uuid NOT NULL REFERENCES users(id),
  purpose text NOT NULL CHECK (char_length(purpose) BETWEEN 10 AND 500),
  channels text[] NOT NULL,
  assets text[] NOT NULL,
  notice_version text NOT NULL CHECK (char_length(notice_version) BETWEEN 3 AND 50),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES users(id),
  revocation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until > valid_from),
  CHECK (cardinality(channels) > 0 AND channels <@ ARRAY['marketplace','website','app','promotional_materials']::text[]),
  CHECK (cardinality(assets) > 0 AND assets <@ ARRAY['public_name','logo','photos','stories']::text[]),
  CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))
);

CREATE UNIQUE INDEX institution_brand_one_active_idx
  ON institution_brand_authorizations(institution_id) WHERE revoked_at IS NULL;
CREATE INDEX institution_brand_validity_idx
  ON institution_brand_authorizations(institution_id,valid_until) WHERE revoked_at IS NULL;

CREATE TABLE institution_brand_authorization_events (
  id bigserial PRIMARY KEY,
  authorization_id uuid NOT NULL REFERENCES institution_brand_authorizations(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL CHECK (action IN ('authorized','revoked')),
  version integer NOT NULL,
  reason text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
