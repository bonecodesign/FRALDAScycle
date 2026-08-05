-- Preserva o histórico, mas impede novos pagamentos com cartão de débito.
ALTER TABLE payment_intents DROP CONSTRAINT IF EXISTS payment_intents_method_check;
ALTER TABLE payment_intents ADD CONSTRAINT payment_intents_method_check
  CHECK (method IN ('pix', 'credit')) NOT VALID;
