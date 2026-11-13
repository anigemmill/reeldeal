#!/usr/bin/env bash
# Starts a local PostgreSQL server for development and tests at .data/postgres (port 54329).
# Usage: scripts/db-local.sh start|stop|url
# When run as root, the server runs as the unprivileged "postgres" system user (initdb refuses root).
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
DATA="$PWD/.data/postgres"
PORT=54329
URL="postgres://postgres@localhost:$PORT/reeldeal"

as_owner() {
  if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi
}

case "${1:-start}" in
  start)
    if [ ! -d "$DATA" ]; then
      mkdir -p "$DATA"
      [ "$(id -u)" = "0" ] && chown postgres:postgres "$DATA"
      as_owner "$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null
    fi
    if ! as_owner "$PGBIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
      as_owner "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=localhost" -l "$DATA/server.log" -w start >/dev/null
    fi
    "$PGBIN/psql" -h localhost -p $PORT -U postgres -tAc "select 1 from pg_database where datname = 'reeldeal'" | grep -q 1 \
      || "$PGBIN/createdb" -h localhost -p $PORT -U postgres reeldeal
    echo "$URL"
    ;;
  stop) as_owner "$PGBIN/pg_ctl" -D "$DATA" -m fast stop ;;
  url) echo "$URL" ;;
  *) echo "usage: $0 start|stop|url" >&2; exit 1 ;;
esac
