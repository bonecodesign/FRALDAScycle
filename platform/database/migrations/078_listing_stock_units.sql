ALTER TABLE listings
  ADD COLUMN stock_units smallint NOT NULL DEFAULT 1,
  ADD CONSTRAINT listings_stock_units_range CHECK (stock_units BETWEEN 1 AND 5);

ALTER TABLE transactions
  ADD COLUMN item_units smallint NOT NULL DEFAULT 1,
  ADD CONSTRAINT transactions_item_units_range CHECK (item_units BETWEEN 1 AND 5);

COMMENT ON COLUMN listings.quantity IS
  'Quantidade de fraldas contida em cada pacote/unidade anunciada.';
COMMENT ON COLUMN listings.stock_units IS
  'Quantidade de pacotes/unidades idênticas oferecidas no mesmo anúncio (gratuito: 1 a 3; Premium: 1 a 5).';
COMMENT ON COLUMN transactions.item_units IS
  'Quantidade de pacotes/unidades idênticas reservadas por esta transação.';
