-- The operational control version is BIGINT (031_operational_control.sql).
-- Keep the proposal snapshot in the same type to avoid range mismatches.
ALTER TABLE operational_resume_requests
  ALTER COLUMN expected_version TYPE bigint;
