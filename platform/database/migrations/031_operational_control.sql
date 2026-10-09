CREATE TABLE operational_controls (
  domain text PRIMARY KEY CHECK (domain IN ('global', 'marketplace', 'payments', 'logistics', 'donations', 'premium')),
  paused boolean NOT NULL DEFAULT false,
  reason text,
  changed_by uuid REFERENCES users(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK ((paused AND reason IS NOT NULL AND length(trim(reason)) >= 10) OR (NOT paused))
);

INSERT INTO operational_controls (domain, paused)
VALUES ('global', false), ('marketplace', false), ('payments', false),
       ('logistics', false), ('donations', false), ('premium', false);
