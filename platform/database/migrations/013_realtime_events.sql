CREATE TABLE realtime_events (
  id bigserial PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type ~ '^[a-z][a-z0-9_.-]{2,127}$'),
  source text NOT NULL CHECK (source IN ('site', 'app', 'admin', 'system')),
  entity_type text,
  entity_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX realtime_events_cursor_idx ON realtime_events (id);
CREATE INDEX realtime_events_type_time_idx ON realtime_events (event_type, occurred_at DESC);

CREATE OR REPLACE FUNCTION publish_audit_realtime_event()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO realtime_events (event_type, source, entity_type, entity_id, payload, occurred_at)
  VALUES (
    NEW.action,
    CASE
      WHEN NEW.action LIKE 'admin.%' OR NEW.action LIKE 'user.%' OR NEW.action LIKE 'sessions.%' THEN 'admin'
      WHEN NEW.action LIKE 'listing.%' OR NEW.action LIKE 'favorite.%' OR NEW.action LIKE 'reservation.%' THEN 'app'
      ELSE 'system'
    END,
    NEW.entity_type,
    NEW.entity_id,
    jsonb_build_object('auditEventId', NEW.id, 'actorUserId', NEW.actor_user_id) || COALESCE(NEW.metadata, '{}'::jsonb),
    NEW.occurred_at
  );
  PERFORM pg_notify('fraldacycle_realtime', currval('realtime_events_id_seq')::text);
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_events_realtime
AFTER INSERT ON audit_events
FOR EACH ROW EXECUTE FUNCTION publish_audit_realtime_event();
