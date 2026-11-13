#!/usr/bin/env bash
# Starts a local PostgreSQL 16 server for development at .data/postgres (port 54329).
# Usage: scripts/db-local.sh start|stop|url
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
DATA=.data/postgres
PORT=54329
case "${1:-start}" in
  start)
    if [ ! -d "$DATA" ]; then
      mkdir -p .data
      "$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null
    fi
    "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=localhost" -l "$DATA/server.log" -w start >/dev/null
    "$PGBIN/psql" -h localhost -p $PORT -U postgres -tc "select 1 from pg_database where datname = 'reeldeal'" | grep -q 1 || "$PGBIN/createdb" -h localhost -p $PORT -U postgres reeldeal
    echo "postgres://postgres@localhost:$PORT/reeldeal"
    ;;
  stop) "$PGBIN/pg_ctl" -D "$DATA" -m fast stop ;;
  url) echo "postgres://postgres@localhost:$PORT/reeldeal" ;;
  *) echo "usage: $0 start|stop|url" >&2; exit 1 ;;
esac
