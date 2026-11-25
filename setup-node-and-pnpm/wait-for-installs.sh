#!/usr/bin/env bash
# Waits for the installs start-installs.sh began, then applies the PATH, env and outputs each wrote for this step.
set -euo pipefail

failed=0
for task in pnpm node; do
  out="$RUNNER_TEMP/install-$task"
  while [ ! -f "$out/status" ] && kill -0 "$(cat "$out/pid")" 2> /dev/null; do sleep 0.1; done
  if [ ! -f "$out/status" ]; then
    echo "The $task install started by 'Resolve versions' did not finish; installing now."
    bash "$GITHUB_ACTION_PATH/install-$task.sh" || failed=1
    continue
  fi
  cat "$out/log"
  if [ "$(cat "$out/status")" != 0 ]; then
    failed=1
    continue
  fi
  cat "$out/path" >> "$GITHUB_PATH"
  cat "$out/env" >> "$GITHUB_ENV"
  cat "$out/output" >> "$GITHUB_OUTPUT"
done
exit "$failed"
