#!/usr/bin/env bash
# Sourced by install-node.sh and install-pnpm.sh.

# A stalled transfer aborts, which --retry retries, rather than hanging the job.
http_get() { curl -fsSL --retry 3 --connect-timeout 10 --speed-limit 1024 --speed-time 30 "$@"; }
