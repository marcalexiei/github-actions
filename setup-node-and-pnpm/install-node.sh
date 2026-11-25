#!/usr/bin/env bash
# Installs Node.js $NODE_SPEC into the runner's tool cache, where actions/setup-node finds it, checked against nodejs.org's SHASUMS256.txt.
set -euo pipefail

version="${NODE_SPEC#v}"
# A major or minor resolves to its latest release, as actions/setup-node resolves it; any other range is left to it.
if [[ "$version" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
  version="$(curl -fsSL --retry 3 https://nodejs.org/dist/index.json \
    | jq -r --arg prefix "v$version." 'first(.[] | select(.version | startswith($prefix))) | .version | ltrimstr("v")')"
fi
if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "node-version=$NODE_SPEC" >> "$GITHUB_OUTPUT"
  exit 0
fi
echo "node-version=$version" >> "$GITHUB_OUTPUT"

# `arch`: the directory name actions/setup-node looks up, Node.js's own `process.arch`.
case "$RUNNER_OS-$RUNNER_ARCH" in
  Linux-X64) dist=linux-x64 arch=x64 ext=tar.gz ;;
  Linux-ARM64) dist=linux-arm64 arch=arm64 ext=tar.gz ;;
  macOS-X64) dist=darwin-x64 arch=x64 ext=tar.gz ;;
  macOS-ARM64) dist=darwin-arm64 arch=arm64 ext=tar.gz ;;
  Windows-X64) dist=win-x64 arch=x64 ext=zip ;;
  Windows-ARM64) dist=win-arm64 arch=arm64 ext=zip ;;
  *) exit 0 ;;
esac
dir="$RUNNER_TOOL_CACHE/node/$version/$arch"
# The marker actions/setup-node checks: the runner image may already ship this version.
if [ -f "$dir.complete" ]; then exit 0; fi

file="node-v$version-$dist.$ext"
url="https://nodejs.org/dist/v$version"
curl -fsSL --retry 3 -o "$RUNNER_TEMP/$file" "$url/$file" &
download=$!
sums="$(curl -fsSL --retry 3 "$url/SHASUMS256.txt")"
wait "$download"
expected="$(awk -v file="$file" '$2 == file { print $1 }' <<< "$sums")"
if [ -z "$expected" ] || [ "$(openssl dgst -sha256 -r "$RUNNER_TEMP/$file" | cut -c1-64)" != "$expected" ]; then
  echo "::error::$file does not match the checksum in nodejs.org's SHASUMS256.txt."
  exit 1
fi

mkdir -p "$dir"
if [ "$ext" = zip ]; then
  # Windows' own tar reads zip files; Git Bash's GNU tar does not.
  "$(cygpath "$SYSTEMROOT")/System32/tar.exe" -xf "$(cygpath -w "$RUNNER_TEMP/$file")" -C "$(cygpath -w "$dir")" --strip-components 1
else
  tar -xzf "$RUNNER_TEMP/$file" -C "$dir" --strip-components 1
fi
touch "$dir.complete"
