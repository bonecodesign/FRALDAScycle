ALTER TABLE exchange_difference_obligations
  ADD COLUMN checkout_warning_at timestamptz,
  ADD COLUMN checkout_expires_at timestamptz,
  ADD COLUMN checkout_renewal_count smallint NOT NULL DEFAULT 0 CHECK (checkout_renewal_count BETWEEN 0 AND 1),
  ADD CONSTRAINT exchange_difference_checkout_window_consistency CHECK (
    (payment_method IS NULL AND checkout_warning_at IS NULL AND checkout_expires_at IS NULL AND checkout_renewal_count = 0)
    OR
    (payment_method IS NOT NULL AND checkout_warning_at = checkout_selected_at + interval '20 minutes'
      AND checkout_expires_at = checkout_selected_at + interval '30 minutes')
  );

CREATE INDEX exchange_difference_checkout_expiry_idx
  ON exchange_difference_obligations(checkout_expires_at)
  WHERE status = 'provider_pending' AND provider_reference IS NULL;

COMMENT ON COLUMN exchange_difference_obligations.checkout_renewal_count IS
  'No máximo uma renovação local de 30 minutos; não comprova nova cobrança no provedor.';
