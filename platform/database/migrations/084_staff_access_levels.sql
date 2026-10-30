ALTER TABLE users ADD COLUMN staff_access_level smallint;

UPDATE users SET staff_access_level=4 WHERE role='admin';
UPDATE users SET staff_access_level=1 WHERE role='moderator';

ALTER TABLE users ADD CONSTRAINT users_staff_access_level_check CHECK (
  (role IN ('admin','moderator') AND staff_access_level BETWEEN 1 AND 5)
  OR (role NOT IN ('admin','moderator') AND staff_access_level IS NULL)
);

CREATE UNIQUE INDEX users_single_founder_access_idx ON users(staff_access_level)
  WHERE staff_access_level=5 AND disabled_at IS NULL;

ALTER TABLE admin_invitations ADD COLUMN staff_access_level smallint;
UPDATE admin_invitations SET staff_access_level=CASE WHEN role='admin' THEN 4 WHEN role='moderator' THEN 1 ELSE NULL END;
ALTER TABLE admin_invitations ADD CONSTRAINT admin_invitations_staff_access_level_check CHECK (
  (role IN ('admin','moderator') AND staff_access_level BETWEEN 1 AND 4)
  OR (role NOT IN ('admin','moderator') AND staff_access_level IS NULL)
);
