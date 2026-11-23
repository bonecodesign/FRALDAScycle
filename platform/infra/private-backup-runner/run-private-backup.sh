#!/usr/bin/env bash
# FC-341 — Executes ONLY on a private, manually approved GitHub Actions runner.
# Copy this script via the pinned, reviewed public source SHA. Never commit secrets.
set -Eeuo pipefail
umask 077

if [[ "${GITHUB_ACTIONS:-}" != "true" ||
      "${GITHUB_REPOSITORY:-}" != "bonecodesign/fraldacycle-backups-private" ||
      "${NODE_ENV:-}" == "production" ||
      "${PRIVATE_BACKUP_RUNNER_APPROVED:-}" != "MANUAL_HOMOLOGATION" ||
      "${OFFSITE_BACKUP_UPLOAD_APPROVED:-}" != "PRIVATE_RUNNER_MANUAL" ||
      "${FC_DROPBOX_ACCESS_POLICY:-}" != "APP_FOLDER_ONLY" ]]; then
  echo "PRIVATE_BACKUP_RUNNER_NOT_AUTHORIZED" >&2
  exit 1
fi

for variable in DATABASE_URL FC_DB_CA_PEM RECOVERY_ARCHIVE_KEY_B64 DROPBOX_APP_KEY DROPBOX_APP_SECRET DROPBOX_REFRESH_TOKEN; do
  if [[ -z "${!variable:-}" ]]; then
    echo "PRIVATE_BACKUP_MISSING_PROTECTED_CONFIGURATION" >&2
    exit 1
  fi
done

if [[ -z "${RUNNER_TEMP:-}" || -z "${GITHUB_RUN_ID:-}" || -z "${GITHUB_RUN_ATTEMPT:-}" ]]; then
  echo "PRIVATE_BACKUP_RUNNER_CONTEXT_MISSING" >&2
  exit 1
fi

private_workdir="$(mktemp -d "${RUNNER_TEMP}/fraldacycle-br-XXXXXXXX")"
chmod 700 "$private_workdir"
# GitHub-hosted runner disk is ephemeral, but rm is not a certified secure erase.
# A private runner and separately held recovery key are critical before real data.
trap 'rm -rf -- "$private_workdir"' EXIT

export FC_BACKUP_WORKDIR="$private_workdir"
export PGSSLROOTCERT="$private_workdir/supabase-ca.crt"
printf '%s\n' "$FC_DB_CA_PEM" > "$PGSSLROOTCERT"
chmod 600 "$PGSSLROOTCERT"
unset FC_DB_CA_PEM

backup_label="fc-br-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}-$(date -u +%Y%m%dT%H%M%SZ)"
export DATABASE_DUMP_PATH="$private_workdir/$backup_label.dump"
export RECOVERY_ENCRYPTED_PATH="$DATABASE_DUMP_PATH.fcenc"
export RECOVERY_ARCHIVE_APPROVED="ENCRYPT_OR_VERIFY"

# The dedicated preflight is executed from inside the uploader, but do it also
# BEFORE the PostgreSQL export so an incorrect Supabase project never gets dumped.
node --input-type=module -e '
  const { validateBackupProtectionFiles } = await import("./source/platform/tools/dropbox-encrypted-upload.mjs");
  const report = await validateBackupProtectionFiles(process.env);
  if (report.project !== "urbrtnenrsjvgqjhfhdj") process.exit(1);
'

mkdir -m 700 "$private_workdir/bin"
cat > "$private_workdir/bin/pg_dump" <<'PGDUMP_WRAPPER'
#!/usr/bin/env bash
set -Eeuo pipefail
: "${FC_BACKUP_WORKDIR:?}"
# pg_dump v17 inside the official PostgreSQL image; never pass passwords in args.
# The libpq PG* variables are inherited from the validated Node backup plan.
exec docker run --rm --network bridge --read-only   --tmpfs /tmp:rw,nosuid,noexec,size=64m   --security-opt no-new-privileges --cap-drop ALL   --user "$(id -u):$(id -g)"   --mount "type=bind,src=${FC_BACKUP_WORKDIR},dst=${FC_BACKUP_WORKDIR}"   --env PGHOST --env PGPORT --env PGUSER --env PGPASSWORD   --env PGDATABASE --env PGSSLMODE --env PGSSLROOTCERT   --entrypoint pg_dump postgres:17-alpine "$@"
PGDUMP_WRAPPER
chmod 700 "$private_workdir/bin/pg_dump"
cat > "$private_workdir/bin/psql" <<'PSQL_WRAPPER'
#!/usr/bin/env bash
set -Eeuo pipefail
: "${FC_BACKUP_WORKDIR:?}"
# Read-only inventory, no database URL/password on the process command line.
exec docker run --rm --network bridge --read-only \
  --tmpfs /tmp:rw,nosuid,noexec,size=64m \
  --security-opt no-new-privileges --cap-drop ALL \
  --user "$(id -u):$(id -g)" \
  --mount "type=bind,src=${FC_BACKUP_WORKDIR},dst=${FC_BACKUP_WORKDIR},readonly" \
  --env PGHOST --env PGPORT --env PGUSER --env PGPASSWORD \
  --env PGDATABASE --env PGSSLMODE --env PGSSLROOTCERT \
  --entrypoint psql postgres:17-alpine "$@"
PSQL_WRAPPER
chmod 700 "$private_workdir/bin/psql"
export PATH="$private_workdir/bin:$PATH"

# Block DB-only backups if Supabase Storage contains even a single bucket.
# pg_dump covers Storage metadata rows but NOT file bytes in object storage.
# The preflight uses SELECT EXISTS (no object names/data) over TLS verify-full.
node source/platform/tools/storage-binary-coverage-preflight.mjs

# No production switches, no application activation, no checkout of PR code.
node source/platform/database/recovery.js backup

# A successful pg_dump exit alone does NOT prove that Auth, Storage and app
# tables were included. Inspect the custom archive with PostgreSQL 17, offline.
# The container has no network, no database credentials and read-only access
# to the directory. The TOC is local, mode 0600, and removed before encryption.
docker run --rm --network none --read-only \
  --security-opt no-new-privileges --cap-drop ALL \
  --user "$(id -u):$(id -g)" \
  --mount "type=bind,src=${FC_BACKUP_WORKDIR},dst=${FC_BACKUP_WORKDIR},readonly" \
  --entrypoint pg_restore postgres:17-alpine --list "$DATABASE_DUMP_PATH" \
  > "$private_workdir/archive.toc"
node source/platform/tools/backup-toc-coverage.mjs "$private_workdir/archive.toc"
rm -f -- "$private_workdir/archive.toc"

# FC-345: close the gap between the initial preflight and a long pg_dump.
# A bucket/object created during export invalidates a DB-only backup.
node source/platform/tools/storage-binary-coverage-preflight.mjs

node source/platform/database/recovery-archive.js encrypt
node source/platform/database/recovery-archive.js verify

# Plaintext must never be uploaded; remove it from the private working directory
# as early as possible. Run only on an ephemeral runner, never a shared workstation.
rm -f -- "$DATABASE_DUMP_PATH" "$DATABASE_DUMP_PATH.sha256"

# FC-345: re-check just before sending, since encryption can also take time.
node source/platform/tools/storage-binary-coverage-preflight.mjs

# Upload only .dump.fcenc and its checksum, with Dropbox-returned content hash verified.
node source/platform/tools/dropbox-encrypted-upload.mjs

# FC-345: a new Storage object created during Dropbox upload must not result
# in a successful "complete backup" receipt. A failed postflight may leave a
# verified encrypted pair in Dropbox: it is NOT a complete disaster backup.
node source/platform/tools/storage-binary-coverage-preflight.mjs
echo "PRIVATE_BACKUP_FINISHED_ENCRYPTED_OFFSITE"
