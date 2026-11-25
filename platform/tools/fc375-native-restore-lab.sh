#!/usr/bin/env bash
# Only synthetic data, no hosted connection, no public artifact, no real key.
set -Eeuo pipefail
umask 077
test "${GITHUB_ACTIONS:-}" = true
test "${GITHUB_REPOSITORY:-}" = bonecodesign/FRALDAScycle
test "${NODE_ENV:-}" != production
workspace="$(realpath "${1:?workspace}")"
home="$(realpath "${2:?tools home}")"
runner="$(realpath "${RUNNER_TEMP:?}")"
[[ "$workspace" == "$runner"/fc373-native-* && "$home" == "$runner"/fc373-supabase-home ]]
test "$PWD" = "$workspace"
test ! -e supabase/.temp/project-ref
# Explicit loopback only, with the Native local development password.
# Ignore inherited PG environment (particularly service files and TLS).
while IFS= read -r variable; do unset "$variable"; done < <(compgen -v | grep '^PG' || true)
unset DATABASE_URL RESTORE_DATABASE_URL SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD
export PGHOST=127.0.0.1 PGUSER=postgres PGPASSWORD=postgres PGDATABASE=postgres PGSSLMODE=disable
export PGPORT="$(python3 -c 'import tomllib;print(tomllib.load(open("supabase/config.toml","rb"))["db"]["port"])')"
pgbin=''
while IFS= read -r path; do
  if [[ -x "$path" && -x "$(dirname "$path")/pg_restore" && -x "$(dirname "$path")/psql" ]]; then
    pgbin="$(dirname "$path")"; break
  fi
done < <(find "$home/cache/stack" -name pg_dump)
test -n "$pgbin"
export PATH="$pgbin:$PATH"
export LD_LIBRARY_PATH="$pgbin/../lib:$pgbin/../lib64"
pg_dump --version | grep -E ' 17\.' >/dev/null
psql_local() { psql -X -qAt -v ON_ERROR_STOP=1 "$@"; }
assert_local() {
  test "$(psql_local -c "SELECT current_setting('server_version_num')::int/10000=17 AND inet_server_addr() IN ('127.0.0.1'::inet,'::1'::inet)")" = t
}
managed_digest() {
  psql_local -c "SELECT md5(coalesce(string_agg(jsonb_build_array(n.nspname,c.relname,c.relkind,c.relrowsecurity,pg_get_userbyid(c.relowner))::text,E'\n' ORDER BY n.nspname,c.relname),'')) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('auth','storage') AND c.relkind IN ('r','p','v','m','S')"
}
assert_local
test "$(psql_local -c "SELECT to_regclass('public.fc375_fixture') IS NULL")" = t
psql_local <<'SQL'
CREATE TABLE public.fc375_fixture(id integer PRIMARY KEY, marker text NOT NULL);
INSERT INTO public.fc375_fixture VALUES (1,'synthetic-one'),(2,'synthetic-two');
ALTER TABLE public.fc375_fixture ENABLE ROW LEVEL SECURITY;
CREATE POLICY fc375_deny ON public.fc375_fixture FOR SELECT TO authenticated USING (false);
REVOKE ALL ON public.fc375_fixture FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.fc375_fixture TO authenticated;
SQL
expected="$(psql_local -c "SELECT md5(string_agg(id::text||':'||marker,',' ORDER BY id)) FROM public.fc375_fixture")"
# Match the actual custom archive flags used by the private backup runner.
export NODE_ENV=test
export RECOVERY_ARCHIVE_KEY_B64="$(openssl rand -base64 32)"
export DATABASE_DUMP_PATH="$workspace/fc375-synthetic.dump"
export RECOVERY_ENCRYPTED_PATH="$DATABASE_DUMP_PATH.fcenc"
export RECOVERY_DECRYPTED_PATH="$workspace/fc375-recovered.dump"
pg_dump --format=custom --compress=9 --no-owner --no-privileges --file="$DATABASE_DUMP_PATH" > "$workspace/dump.log" 2>&1
sha256sum "$DATABASE_DUMP_PATH" | cut -d ' ' -f 1 > "$DATABASE_DUMP_PATH.sha256"
export RECOVERY_ARCHIVE_APPROVED=ENCRYPT_OR_VERIFY
node "$GITHUB_WORKSPACE/platform/database/recovery-archive.js" encrypt >/dev/null
node "$GITHUB_WORKSPACE/platform/database/recovery-archive.js" verify >/dev/null
rm -f -- "$DATABASE_DUMP_PATH" "$DATABASE_DUMP_PATH.sha256"
export RECOVERY_ARCHIVE_APPROVED=ISOLATED_DECRYPT
node "$GITHUB_WORKSPACE/platform/database/recovery-archive.js" decrypt >/dev/null
unset RECOVERY_ARCHIVE_KEY_B64
pg_restore --list "$RECOVERY_DECRYPTED_PATH" > "$workspace/restore.toc"
# Select only the explicit synthetic table and its dependents; the complete
# dump is never applied over a managed schema. A real archive requires a
# separately reviewed TOC/reconciliation plan for all actual objects.
python3 - "$workspace" <<'PY'
import pathlib,re,sys
root=pathlib.Path(sys.argv[1])
lines=(root/'restore.toc').read_text().splitlines()
pattern=re.compile(r'^\d+;\s+\d+\s+\d+\s+(TABLE|TABLE DATA|CONSTRAINT|ROW SECURITY|POLICY)\s+public\s+fc375_fixture(?:\s|$)')
selected=[line for line in lines if pattern.match(line)]
assert any(' TABLE DATA public fc375_fixture ' in line for line in selected)
assert any(' POLICY public fc375_fixture ' in line for line in selected)
assert any(' ROW SECURITY public fc375_fixture ' in line for line in selected)
(root/'fixture.toc').write_text('\n'.join(selected)+'\n')
PY
echo "FC375_NATIVE_SYNTHETIC_ARCHIVE_AUTHENTICATED=PASS"
# Destroy the first runtime, then use an independently initialized local
# project directory (no hosted project ref and no copied database files).
supabase stack stop > "$workspace/source-stop.log" 2>&1
target="$workspace/target"
mkdir -m 700 "$target"
cd "$target"
cleanup_target() { supabase stack stop > "$workspace/target-stop.log" 2>&1 || true; }
trap cleanup_target EXIT
supabase init > "$workspace/target-init.log" 2>&1
python3 - <<'PY'
import pathlib,re,tomllib
p=pathlib.Path("supabase/config.toml")
s,n=re.subn(r'(?m)^major_version\s*=\s*\d+\s*$', 'major_version = 17',p.read_text())
assert n==1
p.write_text(s)
assert tomllib.loads(s)["db"]["major_version"]==17
PY
test ! -e supabase/.temp/project-ref
supabase stack start --runtime native > "$workspace/target-start.log" 2>&1
export PGPORT="$(python3 -c 'import tomllib;print(tomllib.load(open("supabase/config.toml","rb"))["db"]["port"])')"
assert_local
test "$(psql_local -c "SELECT to_regclass('public.fc375_fixture') IS NULL")" = t
test "$(psql_local -c "SELECT to_regclass('auth.users') IS NOT NULL AND to_regclass('storage.objects') IS NOT NULL")" = t
before="$(managed_digest)"
test "$(psql_local -c 'SELECT count(*) FROM auth.users')" = 0
test "$(psql_local -c 'SELECT count(*) FROM storage.objects')" = 0
pg_restore --exit-on-error --single-transaction --no-owner --no-privileges \
  --use-list="$workspace/fixture.toc" --dbname=postgres "$RECOVERY_DECRYPTED_PATH" > "$workspace/restore.log" 2>&1
test "$(psql_local -c "SELECT md5(string_agg(id::text||':'||marker,',' ORDER BY id)) FROM public.fc375_fixture")" = "$expected"
# The chosen backup format omits privileges; reconcile explicitly and ONLY
# on the fixture table. Never copy these grants onto real FraldaCycle tables.
psql_local -c "REVOKE ALL ON public.fc375_fixture FROM PUBLIC,anon,authenticated,service_role; GRANT SELECT ON public.fc375_fixture TO authenticated;"
test "$(psql_local -c "SELECT has_table_privilege('authenticated','public.fc375_fixture','SELECT') AND NOT has_table_privilege('anon','public.fc375_fixture','SELECT')")" = t
test "$(psql_local -c "SET ROLE authenticated; SELECT count(*) FROM public.fc375_fixture;")" = 0
test "$(psql_local -c "SELECT relrowsecurity FROM pg_class WHERE oid='public.fc375_fixture'::regclass")" = t
test "$(managed_digest)" = "$before"
test "$(psql_local -c 'SELECT count(*) FROM auth.users')" = 0
test "$(psql_local -c 'SELECT count(*) FROM storage.objects')" = 0
echo "FC375_NATIVE_SELECTIVE_RESTORE_ROWS_RLS_ACL=PASS"
echo "FC375_NATIVE_MANAGED_RELATIONS_UNCHANGED=PASS"
supabase stack stop > "$workspace/target-stop.log" 2>&1
trap - EXIT
rm -f -- "$RECOVERY_DECRYPTED_PATH" "$RECOVERY_DECRYPTED_PATH.sha256" "$RECOVERY_ENCRYPTED_PATH" "$RECOVERY_ENCRYPTED_PATH.sha256"
echo "FC375_NATIVE_SYNTHETIC_ONLY=PASS"
