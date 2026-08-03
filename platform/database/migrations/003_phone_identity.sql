ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
DROP INDEX users_email_unique;
CREATE UNIQUE INDEX users_email_unique ON users (email) WHERE email IS NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_contact_required CHECK (email IS NOT NULL OR phone IS NOT NULL);
