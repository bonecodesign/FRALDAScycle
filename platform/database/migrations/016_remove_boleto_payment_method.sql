-- Preserva pagamentos históricos em boleto, mas impede qualquer nova criação.
ALTER TABLE payment_intents DROP CONSTRAINT IF EXISTS payment_intents_method_check;
ALTER TABLE payment_intents ADD CONSTRAINT payment_intents_method_check
  CHECK (method IN ('pix', 'credit', 'debit')) NOT VALID;
