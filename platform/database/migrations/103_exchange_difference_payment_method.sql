ALTER TABLE exchange_difference_obligations
  ADD COLUMN payment_method text CHECK (payment_method IN ('pix','credit')),
  ADD COLUMN installments smallint CHECK (installments = 1),
  ADD COLUMN checkout_selected_at timestamptz;

ALTER TABLE exchange_difference_obligations ADD CONSTRAINT exchange_difference_checkout_consistency
  CHECK (
    (payment_method IS NULL AND installments IS NULL AND checkout_selected_at IS NULL AND status IN ('not_charged','cancelled'))
    OR
    (payment_method IS NOT NULL AND installments = 1 AND checkout_selected_at IS NOT NULL AND status <> 'not_charged')
  );

COMMENT ON COLUMN exchange_difference_obligations.payment_method IS
  'Somente PIX ou cartão tokenizado à vista; token, PAN e CVV nunca são persistidos nesta tabela.';
