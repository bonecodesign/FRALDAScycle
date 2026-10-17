-- Venda: o comprador responde pelo frete, que continua separado do produto.
-- Não existe cotação ou cobrança sem fornecedor homologado.
UPDATE shipments s
SET logistics_payer_id=s.buyer_id
FROM transactions t JOIN listings l ON l.id=t.listing_id
WHERE s.transaction_id=t.id AND l.kind='sale' AND s.logistics_payer_id IS NULL;
