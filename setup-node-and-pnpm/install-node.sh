#!/usr/bin/env bash
# Installs Node.js $NODE_SPEC into the runner's tool cache, where actions/setup-node finds it, checked against nodejs.org's SHASUMS256.txt.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/http-get.sh"

finish() {
  echo "node-version=$1" >> "$GITHUB_OUTPUT"
  exit 0
}

# An unreachable nodejs.org is no reason to fail: actions/setup-node downloads from GitHub.
fall_back() {
  echo "::warning::$1; actions/setup-node installs Node.js instead."
  finish "$NODE_SPEC"
}

version="${NODE_SPEC#v}"
# A major or minor resolves to its latest release; any other range is left to actions/setup-node.
if [[ "$version" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
  index="$(http_get https://nodejs.org/dist/index.json)" || fall_back "Could not fetch nodejs.org's index.json"
  version="$(jq -r --arg prefix "v$version." 'first(.[] | select(.version | startswith($prefix))) | .version | ltrimstr("v")' <<< "$index")" \
    || fall_back "nodejs.org's index.json is not JSON"
fi
if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then finish "$NODE_SPEC"; fi

# `arch`: the directory name actions/setup-node looks up, Node.js's own `process.arch`.
case "$RUNNER_OS-$RUNNER_ARCH" in
  Linux-X64) dist=linux-x64 arch=x64 ext=tar.gz ;;
  Linux-ARM64) dist=linux-arm64 arch=arm64 ext=tar.gz ;;
  macOS-X64) dist=darwin-x64 arch=x64 ext=tar.gz ;;
  macOS-ARM64) dist=darwin-arm64 arch=arm64 ext=tar.gz ;;
  Windows-X64) dist=win-x64 arch=x64 ext=zip ;;
  Windows-ARM64) dist=win-arm64 arch=arm64 ext=zip ;;
  *) finish "$version" ;;
esac
dir="$RUNNER_TOOL_CACHE/node/$version/$arch"
# The marker actions/setup-node checks: the runner image may already ship this version.
if [ -f "$dir.complete" ]; then finish "$version"; fi

file="node-v$version-$dist.$ext"
url="https://nodejs.org/dist/v$version"
# Its own folder: a second install of the same version would write the same names.
tmp="$(mktemp -d "$RUNNER_TEMP/node.XXXXXX")"
http_get -o "$tmp/$file" "$url/$file" &
download=$!
sums="$(http_get "$url/SHASUMS256.txt")" || sums=''
wait "$download" || fall_back "Could not download $file from nodejs.org"
[ -n "$sums" ] || fall_back "Could not fetch SHASUMS256.txt from nodejs.org"
expected="$(awk -v file="$file" '$2 == file { print $1 }' <<< "$sums")"
if [ -z "$expected" ] || [ "$(openssl dgst -sha256 -r "$tmp/$file" | cut -c1-64)" != "$expected" ]; then
  echo "::error::$file does not match the checksum in nodejs.org's SHASUMS256.txt."
  exit 1
fi

mkdir -p "$dir"
if [ "$ext" = zip ]; then
  # Windows' own tar reads zip files; Git Bash's GNU tar does not.
  "$(cygpath "$SYSTEMROOT")/System32/tar.exe" -xf "$(cygpath -w "$tmp/$file")" -C "$(cygpath -w "$dir")" --strip-components 1
else
  tar -xzf "$tmp/$file" -C "$dir" --strip-components 1
fi
touch "$dir.complete"
finish "$version"
