#!/usr/bin/env bash
# Starts pnpm's and Node.js's installs in the background; wait-for-installs.sh waits for them in a later step.
set -euo pipefail

for task in pnpm node; do
  out="$RUNNER_TEMP/install-$task"
  # An earlier run of the action in this job left its status behind.
  rm -rf "$out"
  mkdir -p "$out"
  : > "$out/path"
  : > "$out/env"
  : > "$out/output"
  # A later step's files are not this step's: each install writes to its own, which wait-for-installs.sh applies.
  (
    status=0
    GITHUB_PATH="$out/path" GITHUB_ENV="$out/env" GITHUB_OUTPUT="$out/output" \
      bash "$GITHUB_ACTION_PATH/install-$task.sh" > "$out/log" 2>&1 || status=$?
    # Renamed into place: the waiting step reads it as soon as it exists.
    echo "$status" > "$out/status.tmp"
    mv "$out/status.tmp" "$out/status"
  ) > /dev/null 2>&1 &
  echo "$!" > "$out/pid"
done
