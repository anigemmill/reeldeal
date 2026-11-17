#!/usr/bin/env bash
# Read-only drift check: compares the live project's public columns and policies with the schema
# the first 7 migrations produce (supabase/checks/expected-20261116000003, built on a scratch
# database from the repo's own files). Runs inside a READ ONLY transaction; changes nothing.
# Refuses any database URL that doesn't name the Reeldeal project.
#   DATABASE_URL=... bash scripts/compare-live-schema.sh
set -euo pipefail
cd "$(dirname "$0")/.."
REF=jzshbaqfrrgsyiciuzfe
: "${DATABASE_URL:?set DATABASE_URL (owner, session pooler) for this run only}"
case "$DATABASE_URL" in *"$REF"*|*@127.0.0.1:*|*@localhost:*) ;; *) echo "DATABASE_URL does not name the Reeldeal project ($REF): not connecting" >&2; exit 2 ;; esac
exp=supabase/checks/expected-20261116000003
q() { psql "$DATABASE_URL" -AtF '|' -v ON_ERROR_STOP=1 -c 'set default_transaction_read_only = on' -c "$1"; }
q "select table_name, column_name, data_type, is_nullable, coalesce(column_default,'') from information_schema.columns where table_schema='public' order by table_name, ordinal_position" | sed 1d > /tmp/live-columns.txt
q "select tablename, policyname, cmd from pg_policies where schemaname='public' order by 1,2" | sed 1d > /tmp/live-policies.txt
status=0
for k in columns policies; do
  if diff -u "$exp/$k.txt" "/tmp/live-$k.txt" > "/tmp/drift-$k.diff"; then echo "✓ $k match the 7 applied migrations"; else echo "✗ $k differ (- expected, + live):"; cat "/tmp/drift-$k.diff"; status=1; fi
done
rm -f /tmp/live-columns.txt /tmp/live-policies.txt
exit $status
