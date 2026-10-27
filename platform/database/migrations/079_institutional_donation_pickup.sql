ALTER TABLE donation_operations
  DROP CONSTRAINT donation_operations_notice_version_check,
  DROP CONSTRAINT donation_operations_check;

ALTER TABLE donation_operations
  ADD CONSTRAINT donation_operations_notice_version_check
    CHECK (notice_version IN ('FC-DONATION-1', 'FC-DONATION-2')),
  ADD CONSTRAINT donation_operations_logistics_responsibility_check
    CHECK (
      donor_id <> representative_id
      AND (
        (notice_version = 'FC-DONATION-1' AND logistics_payer_id = donor_id)
        OR
        (notice_version = 'FC-DONATION-2' AND logistics_payer_id = representative_id)
      )
    );
