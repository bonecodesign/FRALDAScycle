ALTER TYPE courier_wallet_provider_command_status ADD VALUE 'blocked';

COMMENT ON TYPE courier_wallet_provider_command_status IS
  'Provider payout command lifecycle; blocked requires human resolution and never proves a transfer.';
