ALTER TABLE data_export_requests
  ADD COLUMN processing_started_at timestamptz,
  ADD COLUMN failure_code text,
  ADD COLUMN last_downloaded_at timestamptz,
  ADD COLUMN download_count integer NOT NULL DEFAULT 0 CHECK(download_count>=0),
  ADD COLUMN expired_at timestamptz;

UPDATE data_export_requests
SET processing_started_at=updated_at
WHERE status='processing';

UPDATE data_export_requests
SET expired_at=COALESCE(expires_at,updated_at)
WHERE status='expired';

ALTER TABLE data_export_requests
  ADD CONSTRAINT data_export_processing_timestamp CHECK(
    (status='processing')=(processing_started_at IS NOT NULL)
  ),
  ADD CONSTRAINT data_export_expired_timestamp CHECK(
    (status='expired')=(expired_at IS NOT NULL)
  );

CREATE INDEX data_export_processing_recovery_idx
  ON data_export_requests(processing_started_at)
  WHERE status='processing';

CREATE INDEX data_export_expiration_maintenance_idx
  ON data_export_requests(expires_at)
  WHERE status='ready';
