ALTER TABLE supported_cancellations
  ADD COLUMN cancellation_phase text NOT NULL DEFAULT 'support_review'
  CHECK (cancellation_phase IN ('support_review','pre_collection','post_milestone'));
