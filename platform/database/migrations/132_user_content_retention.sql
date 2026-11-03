CREATE TABLE listing_content_retention (
  listing_id uuid PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  public_revoked_at timestamptz NOT NULL,
  party_access_until timestamptz,
  cdn_purge_due_at timestamptz NOT NULL,
  cdn_purge_queued_at timestamptz,
  cdn_purged_at timestamptz,
  backup_expire_by timestamptz NOT NULL,
  backup_expiry_queued_at timestamptz,
  content_delete_due_at timestamptz,
  content_deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cdn_purge_due_at=public_revoked_at+interval '24 hours'),
  CHECK (backup_expire_by=public_revoked_at+interval '30 days'),
  CHECK (party_access_until IS NULL OR party_access_until>=public_revoked_at),
  CHECK (cdn_purged_at IS NULL OR cdn_purged_at>=public_revoked_at),
  CHECK (content_deleted_at IS NULL OR (content_delete_due_at IS NOT NULL AND content_deleted_at>=content_delete_due_at))
);

CREATE INDEX listing_content_cdn_due_idx ON listing_content_retention(cdn_purge_due_at,listing_id)
  WHERE cdn_purged_at IS NULL;
CREATE INDEX listing_content_delete_due_idx ON listing_content_retention(content_delete_due_at,listing_id)
  WHERE content_deleted_at IS NULL AND content_delete_due_at IS NOT NULL;

CREATE TABLE listing_content_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id),
  case_reference text NOT NULL CHECK (case_reference ~ '^[A-Za-z0-9:_-]{3,200}$'),
  justification text NOT NULL CHECK (char_length(justification) BETWEEN 20 AND 2000),
  judicial_order boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending_level4' CHECK (status IN ('pending_level4','pending_level5','active','rejected','expired','released')),
  requested_by uuid NOT NULL REFERENCES users(id),
  requested_expires_at timestamptz NOT NULL,
  effective_expires_at timestamptz,
  activated_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requested_expires_at>created_at),
  CHECK ((status IN ('pending_level4','pending_level5','rejected') AND activated_at IS NULL AND effective_expires_at IS NULL)
    OR (status IN ('active','expired','released') AND activated_at IS NOT NULL AND effective_expires_at IS NOT NULL)),
  CHECK (effective_expires_at IS NULL OR effective_expires_at>=activated_at),
  CHECK (released_at IS NULL OR status IN ('expired','released'))
);

CREATE UNIQUE INDEX listing_content_single_open_hold_idx ON listing_content_holds(listing_id)
  WHERE status IN ('pending_level4','pending_level5','active');
CREATE INDEX listing_content_active_hold_idx ON listing_content_holds(effective_expires_at,id)
  WHERE status='active';

CREATE TABLE listing_content_hold_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_id uuid NOT NULL REFERENCES listing_content_holds(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  stage text NOT NULL CHECK (stage IN ('level4','level5')),
  approved boolean NOT NULL,
  note text NOT NULL CHECK (char_length(note) BETWEEN 10 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(hold_id,stage),
  UNIQUE(hold_id,actor_id)
);

COMMENT ON TABLE listing_content_retention IS
  'Metadados de expiração; não duplica fotos, textos ou chaves de armazenamento.';
COMMENT ON TABLE listing_content_holds IS
  'Retenção excepcional 3→4→5; nunca restabelece publicação ou acesso público.';

CREATE TABLE listing_content_storage_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES listing_media(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('purge_cdn','expire_backup','delete_source')),
  storage_key text NOT NULL,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 20),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(media_id,action),
  CHECK ((status='completed')=(completed_at IS NOT NULL))
);
CREATE INDEX listing_content_storage_due_idx ON listing_content_storage_outbox(status,due_at,id)
  WHERE status IN ('pending','failed');

COMMENT ON TABLE listing_content_storage_outbox IS
  'Comandos técnicos preparados para adaptador externo; nunca contém a imagem ou o texto do anúncio.';

CREATE FUNCTION schedule_removed_listing_content() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status='removed' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO listing_content_retention(listing_id,public_revoked_at,cdn_purge_due_at,backup_expire_by)
    VALUES(NEW.id,NEW.updated_at,NEW.updated_at+interval '24 hours',NEW.updated_at+interval '30 days')
    ON CONFLICT(listing_id) DO UPDATE SET public_revoked_at=EXCLUDED.public_revoked_at,
      cdn_purge_due_at=EXCLUDED.cdn_purge_due_at,cdn_purged_at=NULL,
      backup_expire_by=EXCLUDED.backup_expire_by,content_delete_due_at=NULL,content_deleted_at=NULL,updated_at=now();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER listings_content_removal_schedule
AFTER INSERT OR UPDATE OF status ON listings
FOR EACH ROW EXECUTE FUNCTION schedule_removed_listing_content();

INSERT INTO listing_content_retention(listing_id,public_revoked_at,cdn_purge_due_at,backup_expire_by)
SELECT id,updated_at,updated_at+interval '24 hours',updated_at+interval '30 days'
FROM listings WHERE status='removed'
ON CONFLICT(listing_id) DO NOTHING;
