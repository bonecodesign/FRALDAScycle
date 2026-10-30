ALTER TABLE operational_controls DROP CONSTRAINT operational_controls_domain_check;
ALTER TABLE operational_controls ADD CONSTRAINT operational_controls_domain_check
  CHECK (domain IN ('global','marketplace','payments','refunds','payouts','logistics','donations','premium'));

INSERT INTO operational_controls(domain,paused) VALUES ('refunds',false),('payouts',false)
ON CONFLICT (domain) DO NOTHING;

CREATE TABLE operational_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  idempotency_key uuid NOT NULL UNIQUE,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 10 AND 160),
  summary text NOT NULL CHECK (length(trim(summary)) BETWEEN 20 AND 2000),
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  domain text NOT NULL CHECK (domain IN ('global','marketplace','payments','refunds','payouts','logistics','donations','premium')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','contained','monitoring','resolved')),
  created_by uuid NOT NULL REFERENCES users(id),
  assigned_to uuid REFERENCES users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK ((status='resolved' AND resolved_at IS NOT NULL) OR (status<>'resolved' AND resolved_at IS NULL))
);

CREATE INDEX operational_incidents_queue_idx
  ON operational_incidents(status,severity,updated_at DESC);

CREATE TABLE operational_incident_events (
  id bigserial PRIMARY KEY,
  incident_id uuid NOT NULL REFERENCES operational_incidents(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL CHECK (action IN ('created','claimed','released','contained','monitoring','resolved','reopened','note')),
  note text CHECK (note IS NULL OR length(trim(note)) BETWEEN 10 AND 2000),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX operational_incident_events_timeline_idx
  ON operational_incident_events(incident_id,id);
