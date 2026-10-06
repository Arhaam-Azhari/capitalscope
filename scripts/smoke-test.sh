#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
smoke_dir="$(mktemp -d)"
server_pid=""
cleanup() {
  if [[ -n "$server_pid" ]]; then kill "$server_pid" 2>/dev/null || true; fi
  rm -rf "$smoke_dir"
}
trap cleanup EXIT
PORT=8096 SEC_USER_AGENT='' java -jar "$project_dir/backend/target/capitalscope-0.1.0.jar" >"$smoke_dir/server.log" 2>&1 &
server_pid=$!
ready=false
for attempt in {1..30}; do
  if curl --fail --silent http://127.0.0.1:8096/api/universe >"$smoke_dir/universe.json"; then ready=true; break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then cat "$smoke_dir/server.log"; exit 1; fi
curl --fail --silent http://127.0.0.1:8096/ >"$smoke_dir/page.html"
curl --fail --silent http://127.0.0.1:8096/api/examples/financials >"$smoke_dir/example.json"
curl --fail --silent -X POST http://127.0.0.1:8096/api/valuations/dcf \
  -H 'Content-Type: application/json' \
  -d '{"baseFreeCashFlow":100,"growthRate":0,"discountRate":0.1,"terminalGrowthRate":0,"years":5,"netDebt":100,"sharesOutstanding":10}' \
  >"$smoke_dir/valuation.json"
node --input-type=module - "$smoke_dir" <<'JS'
import fs from 'node:fs';
const dir = process.argv[2];
const read = name => JSON.parse(fs.readFileSync(`${dir}/${name}.json`, 'utf8'));
if (read('universe').count !== 50) throw new Error('The universe is incomplete.');
if (read('example').dataMode !== 'example') throw new Error('The example is not labeled.');
if (Math.abs(read('valuation').valuePerShare - 90) > 1e-8) throw new Error('The packaged valuation result is wrong.');
const html = fs.readFileSync(`${dir}/page.html`, 'utf8');
const asset = html.match(/src="([^\"]+\.js)"/)?.[1];
if (!html.includes('CapitalScope') || !asset) throw new Error('The dashboard was not packaged.');
const response = await fetch(`http://127.0.0.1:8096${asset}`);
if (!response.ok || !(await response.text()).length) throw new Error('The frontend bundle cannot be served.');
console.log('Packaged dashboard, catalog, example, and valuation checks passed.');
JS
