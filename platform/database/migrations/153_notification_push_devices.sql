CREATE TABLE notification_push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  provider_reference text NOT NULL UNIQUE
    CHECK(provider_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,255}$'),
  installation_hash bytea NOT NULL CHECK(octet_length(installation_hash)=32),
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  provider_verified_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK((status='revoked')=(revoked_at IS NOT NULL))
);

CREATE UNIQUE INDEX notification_push_device_active_installation
  ON notification_push_devices(user_id,installation_hash) WHERE status='active';

COMMENT ON TABLE notification_push_devices IS
  'Somente referência opaca verificada pelo futuro fornecedor; token push bruto não pertence ao banco FraldaCycle.';
