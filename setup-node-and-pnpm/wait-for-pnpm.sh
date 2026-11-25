#!/usr/bin/env bash
# Waits for the install that `Resolve versions` started, then applies the PATH and env it wrote for this step.
set -euo pipefail

status="$RUNNER_TEMP/pnpm.status"
while [ ! -f "$status" ] && kill -0 "$(cat "$RUNNER_TEMP/pnpm.pid")" 2> /dev/null; do sleep 0.1; done
if [ ! -f "$status" ]; then
  echo "The install started by 'Resolve versions' did not finish; installing now."
  exec bash "$GITHUB_ACTION_PATH/install-pnpm.sh"
fi
cat "$RUNNER_TEMP/pnpm.log"
[ "$(cat "$status")" = 0 ] || exit 1
cat "$RUNNER_TEMP/pnpm.path" >> "$GITHUB_PATH"
cat "$RUNNER_TEMP/pnpm.env" >> "$GITHUB_ENV"
