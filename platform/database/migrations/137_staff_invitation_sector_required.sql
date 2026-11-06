ALTER TABLE admin_invitations ADD CONSTRAINT admin_invitations_new_staff_sector_required_check CHECK (
  (role IN ('admin','moderator') AND staff_access_level IS NOT NULL AND staff_sector IS NOT NULL)
  OR (role NOT IN ('admin','moderator') AND staff_access_level IS NULL AND staff_sector IS NULL)
) NOT VALID;

COMMENT ON CONSTRAINT admin_invitations_new_staff_sector_required_check ON admin_invitations IS
  'Novos convites internos exigem nível e setor. NOT VALID preserva somente o histórico legado anterior à regularização.';
