ALTER TABLE institutions
  ADD COLUMN accepting_donations boolean NOT NULL DEFAULT true,
  ADD COLUMN capacity_version integer NOT NULL DEFAULT 1 CHECK (capacity_version > 0),
  ADD COLUMN capacity_reason text,
  ADD COLUMN capacity_changed_at timestamptz,
  ADD COLUMN capacity_changed_by uuid REFERENCES users(id);

CREATE TABLE institution_capacity_events (
  id bigserial PRIMARY KEY,
  institution_id uuid NOT NULL REFERENCES institutions(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  accepting_donations boolean NOT NULL,
  version integer NOT NULL CHECK (version > 1),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 1000),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, version)
);

CREATE INDEX institution_capacity_events_institution_idx
  ON institution_capacity_events(institution_id, occurred_at DESC);
