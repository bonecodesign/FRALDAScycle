ALTER TABLE child_profiles
  ALTER COLUMN birth_date DROP NOT NULL;

ALTER TABLE child_profiles
  ADD COLUMN emoji text;

UPDATE child_profiles
SET emoji = choices.emoji
FROM (
  SELECT id, (ARRAY['🍼','🧸','⭐','🌙','🌈'])[row_number() OVER (PARTITION BY account_id ORDER BY created_at,id)] AS emoji
  FROM child_profiles
  WHERE deleted_at IS NULL
) AS choices
WHERE child_profiles.id = choices.id;

ALTER TABLE child_profiles
  ADD CONSTRAINT child_profile_emoji_active CHECK (
    (deleted_at IS NULL AND emoji IN ('🍼','🧸','⭐','🌙','🌈'))
    OR deleted_at IS NOT NULL
  );

CREATE UNIQUE INDEX child_profiles_account_active_emoji_idx
  ON child_profiles(account_id, emoji) WHERE deleted_at IS NULL;

UPDATE child_profiles
SET birth_date = NULL,
    personalization_enabled = false,
    updated_at = now()
WHERE deleted_at IS NOT NULL;

ALTER TABLE child_profiles
  ADD CONSTRAINT child_profile_birth_date_retention CHECK (
    (deleted_at IS NULL AND birth_date IS NOT NULL)
    OR
    (deleted_at IS NOT NULL AND birth_date IS NULL AND personalization_enabled = false)
  );

COMMENT ON COLUMN child_profiles.birth_date IS
  'Dado privado mantido somente enquanto o perfil está ativo; removido imediatamente do banco operacional na exclusão do perfil.';

COMMENT ON COLUMN child_profiles.emoji IS
  'Identificador visual obrigatório para perfil ativo; conjunto fixo e sem repetição por conta.';
