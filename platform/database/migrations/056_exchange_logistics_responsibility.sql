-- Na troca, cada participante responde pelo frete do pacote que receberá.
-- A migração não calcula preço, cria cobrança ou atribui a tarifa do item 12.
UPDATE shipments
SET logistics_payer_id=buyer_id
WHERE exchange_leg IS NOT NULL AND logistics_payer_id IS NULL;

ALTER TABLE shipments ADD CONSTRAINT exchange_logistics_payer_is_receiver
  CHECK (exchange_leg IS NULL OR logistics_payer_id=buyer_id);
