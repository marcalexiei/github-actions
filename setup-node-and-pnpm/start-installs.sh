#!/usr/bin/env bash
# Starts pnpm's and Node.js's installs in the background; wait-for-installs.sh waits for them in a later step.
set -euo pipefail

for task in pnpm node; do
  out="$RUNNER_TEMP/install-$task"
  # An earlier run of the action in this job left its status behind.
  rm -rf "$out"
  mkdir -p "$out"
  # A script of its own, not a subshell: wait-for-installs.sh knows it by name in the pid's command line.
  bash "$GITHUB_ACTION_PATH/background-install.sh" "$task" "$out" > /dev/null 2>&1 &
  echo "$!" > "$out/pid"
done
