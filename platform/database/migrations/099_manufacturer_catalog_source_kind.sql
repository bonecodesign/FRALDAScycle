ALTER TABLE manufacturer_catalog_batches
  ADD COLUMN source_kind text NOT NULL DEFAULT 'manufacturer_official'
    CHECK(source_kind IN ('manufacturer_official','public_web_reference','internal_curated'));

COMMENT ON COLUMN manufacturer_catalog_batches.source_kind IS
  'Official manufacturer data is authoritative. Public web references and internal curation are auxiliary evidence and require independent review.';
