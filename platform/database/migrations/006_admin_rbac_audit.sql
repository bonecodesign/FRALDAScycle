CREATE INDEX audit_events_occurred_idx
  ON audit_events (occurred_at DESC, id DESC);

CREATE INDEX users_role_active_idx
  ON users (role, created_at DESC)
  WHERE disabled_at IS NULL;
