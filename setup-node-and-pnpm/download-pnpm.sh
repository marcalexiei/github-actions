#!/usr/bin/env bash
# Usage: download-pnpm.sh <package> <version> <dir>
# Writes the registry metadata to <dir>/meta.json and the tarball to <dir>/pnpm.tgz.
set -euo pipefail

mkdir -p "$3"
curl -fsSL --retry 3 -o "$3/meta.json" "https://registry.npmjs.org/$1/$2"
curl -fsSL --retry 3 -o "$3/pnpm.tgz" "$(jq -r .dist.tarball "$3/meta.json")"
