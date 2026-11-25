#!/usr/bin/env bash
# Installs pnpm $VERSION's native binary and bundled node-gyp into the runner's tool cache, checked against npm's signature.
set -euo pipefail

# The regex first: `-lt` on a non-number errors, which `if` reads as false.
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] || [ "${VERSION%%.*}" -lt 12 ]; then
  echo "::error::An exact pnpm version, 12 or later, is required (got: $VERSION)."
  exit 1
fi

ext=''
case "$RUNNER_OS-$RUNNER_ARCH" in
  Linux-X64) platform=linux-x64 ;;
  Linux-ARM64) platform=linux-arm64 ;;
  macOS-X64) platform=darwin-x64 ;;
  macOS-ARM64) platform=darwin-arm64 ;;
  Windows-X64) platform=win32-x64 ext=.exe ;;
  Windows-ARM64) platform=win32-arm64 ext=.exe ;;
  *)
    echo "::error::pnpm ships no binary for $RUNNER_OS-$RUNNER_ARCH."
    exit 1
    ;;
esac
# musl's ldd exits 1 on `--version`, which pipefail would turn into "not musl".
if [ "$RUNNER_OS" = Linux ] && [[ "$(ldd --version 2>&1 || true)" == *musl* ]]; then platform+=-musl; fi

# npm's signing key, from registry.npmjs.org/-/npm/v1/keys: pinned, so the registry cannot vouch for itself.
keyid='SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U'
key='MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEY6Ya7W++7aUPzvMTrezH6Ycx3c+HOKYCcNGybJZSCJq/fd7Qa8uuAKtdIkUQtQiEKERhAmE5lMMJhP8OkDOa2g=='
# Its own folder: a second install of the same version would write the same names.
tmp="$(mktemp -d "$RUNNER_TEMP/pnpm.XXXXXX")"
printf -- '-----BEGIN PUBLIC KEY-----\n%s\n-----END PUBLIC KEY-----\n' "$key" > "$tmp/npm-key.pem"

source "$(dirname "${BASH_SOURCE[0]}")/http-get.sh"

# Downloads $1@$VERSION to $2, checked against the integrity npm signed.
fetch() {
  local package="$1" tgz="$2" meta integrity
  meta="$(http_get "https://registry.npmjs.org/$package/$VERSION")"
  http_get -o "$tgz" "$(jq -r .dist.tarball <<< "$meta")"
  integrity="$(jq -r .dist.integrity <<< "$meta")"
  if [ "sha512-$(openssl dgst -sha512 -binary "$tgz" | openssl base64 -A)" != "$integrity" ]; then
    echo "::error::$package@$VERSION does not match the integrity the registry lists."
    exit 1
  fi
  jq -r --arg keyid "$keyid" '.dist.signatures[]? | select(.keyid == $keyid) | .sig' <<< "$meta" \
    | openssl base64 -d -A > "$tgz.sig"
  if ! printf '%s' "$package@$VERSION:$integrity" \
    | openssl dgst -sha256 -verify "$tmp/npm-key.pem" -signature "$tgz.sig" > /dev/null 2>&1; then
    echo "::error::$package@$VERSION does not carry npm's signature."
    exit 1
  fi
}

fetch "@pnpm/exe.$platform" "$tmp/pnpm.tgz" &
binary=$!
# Only the wrapper ships `dist/node-gyp-bin`, which pnpm puts on PATH for build scripts.
fetch @pnpm/exe "$tmp/pnpm-dist.tgz" &
dist=$!
wait "$binary"
wait "$dist"

# node_modules records its store, under PNPM_HOME: moving it needs a new deps key in action.yml.
dir="$RUNNER_TOOL_CACHE/pnpm/$VERSION/$platform"
# `bin`: where `pnpm add -g` links, which refuses to run unless it is on PATH.
mkdir -p "$dir/bin"
untar() {
  # Windows' own tar: Git Bash's takes 1.6s over the binary, and reads a path's `D:` as a remote host.
  if [ "$RUNNER_OS" = Windows ]; then
    "$(cygpath "$SYSTEMROOT")/System32/tar.exe" -xzf "$(cygpath -w "$1")" -C "$(cygpath -w "$dir")" --strip-components 1 "$2"
    return
  fi
  tar -xzf "$1" -C "$dir" --strip-components=1 "$2"
}
untar "$tmp/pnpm.tgz" "package/pnpm$ext"
untar "$tmp/pnpm-dist.tgz" package/dist
# Like pnpm's own install: the binary acts on the name it runs as.
for name in pn pnpx pnx; do ln -f "$dir/pnpm$ext" "$dir/$name$ext"; done
printf '%s\n' "$dir" "$dir/bin" >> "$GITHUB_PATH"
echo "PNPM_HOME=$dir" >> "$GITHUB_ENV"
