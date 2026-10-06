#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT
compiler=(java --module jdk.compiler/com.sun.tools.javac.Main)
if command -v javac >/dev/null 2>&1; then compiler=(javac); fi
"${compiler[@]}" -d "$test_dir" \
  "$project_dir/backend/src/main/java/com/capitalscope/DcfCalculator.java" \
  "$project_dir/backend/src/test/java/com/capitalscope/DcfChecks.java"
java -cp "$test_dir" com.capitalscope.DcfChecks
