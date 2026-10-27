#!/usr/bin/env bash
set -euo pipefail

if [[ "${GITHUB_ACTIONS:-}" != true || "${RUNNER_OS:-}" != Linux ]]; then
  echo 'I use this setup only on Linux GitHub Actions runners. For local setup, I use npx playwright install --with-deps --only-shell chromium from frontend.' >&2
  exit 1
fi
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_dir/frontend"

# I give stalled package downloads a bounded retry without replacing the runner's existing APT settings.
apt_settings="$(sudo mktemp /etc/apt/apt.conf.d/99capitalscope-ci-XXXXXX)"
cleanup() { sudo rm -f -- "$apt_settings"; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
sudo tee "$apt_settings" >/dev/null <<'APT'
Acquire::Retries "2";
Acquire::http::Timeout "30";
Acquire::https::Timeout "30";
APT
npx --no-install playwright install-deps chromium
