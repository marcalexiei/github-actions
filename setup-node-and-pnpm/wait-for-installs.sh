#!/usr/bin/env bash
# Waits for the installs start-installs.sh began, then applies the PATH, env and outputs each wrote for this step.
set -euo pipefail

# Whether the install in $1 still runs: once it is gone, its pid can belong to any other process.
running() {
  local pid command
  pid="$(cat "$1/pid" 2> /dev/null)" || return 1
  if [ -r "/proc/$pid/cmdline" ]; then
    command="$(tr '\0' ' ' < "/proc/$pid/cmdline")"
  else
    command="$(ps -o command= -p "$pid" 2> /dev/null)" || return 1
  fi
  [[ "$command" == *start-installs.sh* ]]
}

failed=0
for task in pnpm node; do
  out="$RUNNER_TEMP/install-$task"
  while [ ! -f "$out/status" ] && running "$out"; do sleep 0.1; done
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
