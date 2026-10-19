#!/usr/bin/env bash
set -euo pipefail
container="${1:?I need the Compose database container ID.}"
archive="${2:?I need a new backup-file path.}"
if [[ ! "$container" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]]; then echo 'I need a valid container ID or name.' >&2; exit 1; fi
if [[ -e "$archive" || -L "$archive" ]]; then echo 'I will not overwrite an existing backup path.' >&2; exit 1; fi
umask 077
partial="$(mktemp "${archive}.partial.XXXXXX")"
trap 'rm -f -- "$partial"' EXIT
# I publish the archive only after pg_dump and the archive-header check succeed.
docker exec "$container" pg_dump --username=capitalscope --dbname=capitalscope --format=custom --no-owner --no-acl >"$partial"
docker exec -i "$container" pg_restore --list <"$partial" >/dev/null
ln -- "$partial" "$archive"
echo 'I created a PostgreSQL backup without overwriting an existing file.'
