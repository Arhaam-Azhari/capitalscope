#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
image="${1:-capitalscope:container-check}"
if [[ ! "$image" =~ ^[a-zA-Z0-9._/:@-]+$ ]]; then echo 'I need a valid local image name.' >&2; exit 1; fi
check_dir="$(mktemp -d)"
check_id="capitalscope-check-${RANDOM}-${RANDOM}"
container_name="$check_id-app"
volume_name="$check_id-data"
restore_db="$check_id-restore-db"
restore_app="$check_id-restored-app"
restore_volume="$check_id-restored-data"
restore_network="$check_id-restore-network"
printf 'services:\n  app:\n    image: %s\n' "$image" >"$check_dir/image.yml"
compose() {
  DATABASE_PASSWORD='container-check-only-password' SEC_USER_AGENT='' ALPHA_VANTAGE_API_KEY='' \
    docker compose --project-name "$check_id" --file "$project_dir/compose.yml" --file "$check_dir/image.yml" "$@"
}
cleanup() {
  local status=$?
  if [[ "$status" != 0 ]]; then
    docker logs --tail 80 "$restore_app" 2>/dev/null || true
    docker logs --tail 80 "$restore_db" 2>/dev/null || true
    docker logs --tail 80 "$container_name" 2>/dev/null || true
    compose logs --tail 80 2>/dev/null || true
  fi
  docker rm --force "$restore_app" "$restore_db" >/dev/null 2>&1 || true
  docker volume rm "$restore_volume" >/dev/null 2>&1 || true
  docker network rm "$restore_network" >/dev/null 2>&1 || true
  docker rm --force "$container_name" >/dev/null 2>&1 || true
  docker volume rm "$volume_name" >/dev/null 2>&1 || true
  compose down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$check_dir"
  return "$status"
}
trap cleanup EXIT
wait_for() {
  for attempt in {1..60}; do
    if curl --fail --silent "$1/api/universe" >/dev/null; then return; fi
    sleep 1
  done
  echo "I could not start the container at $1." >&2
  return 1
}
start_standalone() {
  docker run --detach --name "$container_name" --publish 127.0.0.1:8098:8080 \
    --env SEC_USER_AGENT= --env ALPHA_VANTAGE_API_KEY= --volume "$volume_name:/app/data" "$image" >/dev/null
  wait_for http://127.0.0.1:8098
  [[ "$(docker exec "$container_name" id -u)" == 10001 ]]
}
# I recreate the app against the same named H2 volume to check the non-root data path.
start_standalone
node "$project_dir/scripts/check-container.mjs" http://127.0.0.1:8098 "$check_dir/h2.json" create
docker stop "$container_name" >/dev/null
docker rm "$container_name" >/dev/null
start_standalone
node "$project_dir/scripts/check-container.mjs" http://127.0.0.1:8098 "$check_dir/h2.json" verify
docker stop "$container_name" >/dev/null
docker rm "$container_name" >/dev/null
# I exercise the real Compose/PostgreSQL configuration without rebuilding the image.
compose up --detach --no-build
wait_for http://127.0.0.1:8080
node "$project_dir/scripts/check-container.mjs" http://127.0.0.1:8080 "$check_dir/postgres.json" create
compose down
compose up --detach --no-build
wait_for http://127.0.0.1:8080
node "$project_dir/scripts/check-container.mjs" http://127.0.0.1:8080 "$check_dir/postgres.json" verify
echo 'I passed standalone H2 and Compose/PostgreSQL container persistence checks.'
# I restore a real pg_dump archive into a separate empty PostgreSQL volume.
source_db="$(compose ps --quiet db)"
bash "$project_dir/scripts/backup-postgres.sh" "$source_db" "$check_dir/saved.dump"
if bash "$project_dir/scripts/backup-postgres.sh" "$source_db" "$check_dir/saved.dump"; then echo 'My backup overwrite guard failed.' >&2; exit 1; fi
if bash "$project_dir/scripts/restore-postgres.sh" "$check_dir/saved.dump" "$source_db"; then echo 'My nonempty-database restore guard failed.' >&2; exit 1; fi
node "$project_dir/scripts/check-container.mjs" http://127.0.0.1:8080 "$check_dir/postgres.json" verify
docker network create "$restore_network" >/dev/null
docker run --detach --name "$restore_db" --network "$restore_network" --volume "$restore_volume:/var/lib/postgresql/data" \
  --env POSTGRES_DB=capitalscope --env POSTGRES_USER=capitalscope --env POSTGRES_PASSWORD=container-check-only-password postgres:17 >/dev/null
ready=false
for attempt in {1..60}; do
  if docker exec "$restore_db" pg_isready --host=127.0.0.1 --username=capitalscope --dbname=capitalscope >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]]
bash "$project_dir/scripts/restore-postgres.sh" "$check_dir/saved.dump" "$restore_db"
docker run --detach --name "$restore_app" --network "$restore_network" --publish 127.0.0.1:8099:8080 \
  --env "DATABASE_URL=jdbc:postgresql://$restore_db:5432/capitalscope" --env DATABASE_USER=capitalscope \
  --env DATABASE_PASSWORD=container-check-only-password --env SEC_USER_AGENT= --env ALPHA_VANTAGE_API_KEY= "$image" >/dev/null
wait_for http://127.0.0.1:8099
node "$project_dir/scripts/check-container.mjs" http://127.0.0.1:8099 "$check_dir/postgres.json" verify
echo 'I passed PostgreSQL backup/restore with the same portfolio, research revisions, and valuation.'
