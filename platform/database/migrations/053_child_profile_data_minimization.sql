UPDATE child_profiles SET label = NULL WHERE label IS NOT NULL;

ALTER TABLE child_profiles DROP COLUMN label;

COMMENT ON TABLE child_profiles IS 'Fundação inativa por padrão; armazena somente data de nascimento e consentimento. Ativação exige revisão de privacidade e CHILD_PROFILES_ENABLED=true.';
