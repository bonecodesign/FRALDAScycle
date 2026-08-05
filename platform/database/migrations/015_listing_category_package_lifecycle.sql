UPDATE listings SET status = 'unavailable' WHERE status = 'reserved';
UPDATE transactions SET status = 'initiated' WHERE status IN ('proposed', 'reserved');

ALTER TABLE listings ADD COLUMN category text;
ALTER TABLE listings ADD COLUMN model text;
ALTER TABLE listings ADD COLUMN package_condition text;
ALTER TABLE listings ADD COLUMN open_package_attested boolean NOT NULL DEFAULT false;

UPDATE listings SET category = 'infant', model = COALESCE(brand, 'Outro modelo'), package_condition = 'sealed';

ALTER TABLE listings ALTER COLUMN category SET NOT NULL;
ALTER TABLE listings ALTER COLUMN model SET NOT NULL;
ALTER TABLE listings ALTER COLUMN package_condition SET NOT NULL;
ALTER TABLE listings ADD CONSTRAINT listing_category_policy CHECK (category IN ('infant', 'swim'));
ALTER TABLE listings ADD CONSTRAINT listing_package_condition_policy CHECK (
  package_condition = 'sealed' OR
  (package_condition = 'open' AND kind = 'donation' AND open_package_attested)
);

ALTER TABLE transactions DROP COLUMN IF EXISTS reserved_until;
