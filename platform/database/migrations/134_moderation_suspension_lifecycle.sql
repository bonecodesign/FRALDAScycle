CREATE TABLE moderation_listing_pauses (
  decision_id uuid NOT NULL REFERENCES moderation_decisions(id),
  listing_id uuid NOT NULL REFERENCES listings(id),
  restored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(decision_id,listing_id)
);

CREATE TABLE moderation_suspension_releases (
  decision_id uuid PRIMARY KEY REFERENCES moderation_decisions(id),
  reason text NOT NULL CHECK(reason IN ('expired','overturned')),
  restored_listings integer NOT NULL DEFAULT 0 CHECK(restored_listings>=0),
  released_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE moderation_listing_pauses IS
  'Vínculo mínimo para restaurar somente anúncios pausados pela suspensão correspondente.';
COMMENT ON TABLE moderation_suspension_releases IS
  'Finalização idempotente de suspensão temporária; não representa banimento permanente.';
