#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_dir/frontend"
npm ci
npm run build
mkdir -p "$project_dir/backend/src/main/resources/static"
cp -r dist/. "$project_dir/backend/src/main/resources/static/"
cd "$project_dir/backend"
mvn --batch-mode verify
