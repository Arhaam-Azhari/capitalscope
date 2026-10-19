#!/usr/bin/env bash
set -euo pipefail
archive="${1:?I need a PostgreSQL backup-file path.}"
container="${2:?I need the empty target database container ID.}"
if [[ ! "$container" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]]; then echo 'I need a valid container ID or name.' >&2; exit 1; fi
if [[ ! -f "$archive" || ! -s "$archive" ]]; then echo 'I need a nonempty backup file.' >&2; exit 1; fi
relations="$(docker exec "$container" psql --username=capitalscope --dbname=capitalscope --tuples-only --no-align --set=ON_ERROR_STOP=1 --command="SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND c.relkind IN ('r','p','v','m','S','f');")"
if [[ "$relations" != 0 ]]; then echo 'I restore only into a database with no user tables, views, or sequences.' >&2; exit 1; fi
docker exec -i "$container" pg_restore --list <"$archive" >/dev/null
# I keep the application stopped and restore the empty target in one transaction.
docker exec -i "$container" pg_restore --username=capitalscope --dbname=capitalscope --no-owner --no-privileges --single-transaction --exit-on-error <"$archive"
echo 'I restored the PostgreSQL archive into the empty target database.'
