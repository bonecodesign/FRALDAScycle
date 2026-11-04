ALTER TABLE account_closure_data_inventories
  ADD COLUMN classification_version text NOT NULL DEFAULT 'FC-CLOSURE-INVENTORY-2',
  ADD CONSTRAINT account_closure_inventory_classification_version
    CHECK (classification_version='FC-CLOSURE-INVENTORY-2');

COMMENT ON COLUMN account_closure_data_inventories.classification_version IS
  'Versão técnica do inventário; não representa aprovação jurídica nem autorização de apagamento.';
