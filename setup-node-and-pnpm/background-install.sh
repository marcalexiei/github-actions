#!/usr/bin/env bash
# Runs install-$1.sh for start-installs.sh, writing its PATH, env and outputs into $2 for wait-for-installs.sh to apply.
set -uo pipefail

task="$1" out="$2"
: > "$out/path"
: > "$out/env"
: > "$out/output"
status=0
# A later step's files are not this step's.
GITHUB_PATH="$out/path" GITHUB_ENV="$out/env" GITHUB_OUTPUT="$out/output" \
  bash "$GITHUB_ACTION_PATH/install-$task.sh" > "$out/log" 2>&1 || status=$?
# Renamed into place: the waiting step reads it as soon as it exists.
echo "$status" > "$out/status.tmp"
mv "$out/status.tmp" "$out/status"
