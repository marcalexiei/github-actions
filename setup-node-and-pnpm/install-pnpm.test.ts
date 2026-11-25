import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const dir = mkdtempSync(path.join(tmpdir(), 'install-pnpm-'));
after(() => {
  rmSync(dir, { recursive: true, force: true });
});

const fakeBin = path.join(dir, 'bin');
mkdirSync(fakeBin);
// Serves $FAKE_META for the metadata and $FAKE_TGZ for the tarball, logging each URL; fails without $FAKE_META.
writeFileSync(
  path.join(fakeBin, 'curl'),
  `#!/usr/bin/env bash
url="\${*: -1}"
echo "$url" >> "$CURL_LOG"
echo "$*" >> "$CURL_CALLS"
prev=''; for arg in "$@"; do [ "$prev" = -o ] && out="$arg"; prev="$arg"; done
case "$url" in
  *.tgz) cp "$FAKE_TGZ" "$out" ;;
  *) [ -f "$FAKE_META" ] && cat "$FAKE_META" || exit 22 ;;
esac
`,
);
chmodSync(path.join(fakeBin, 'curl'), 0o755);

const tgz = path.join(dir, 'pnpm.tgz');
mkdirSync(path.join(dir, 'package'));
writeFileSync(path.join(dir, 'package', 'pnpm'), 'not pnpm');
spawnSync('tar', ['-czf', tgz, '-C', dir, 'package']);
const integrity = `sha512-${createHash('sha512').update(readFileSync(tgz)).digest('base64')}`;

// A genuine npm signature, over @pnpm/exe.darwin-arm64@12.21.0's own integrity.
const npmSignature = {
  keyid: 'SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U',
  sig: 'MEYCIQC+CbyZkL4dvB/nHUNqy9ROwHFN/Jk48AE6z1UVyv9K5QIhAKAIQlfKGfkriiISVTjTsuXDxV85f+FT/alqYPjPTaWY',
};

interface Options {
  version?: string;
  os?: string;
  arch?: string;
  libc?: 'glibc' | 'musl';
  meta?: object;
}

interface Result {
  status: number | null;
  stdout: string;
  /** Every URL the script fetched, in order. */
  urls: Array<string>;
  /** Each curl call's arguments, one line per call. */
  calls: Array<string>;
  installed: boolean;
}

let run = 0;

function install(options: Options): Result {
  run += 1;
  const work = path.join(dir, `run-${run}`);
  mkdirSync(path.join(work, 'temp'), { recursive: true });
  const bin = path.join(work, 'bin');
  mkdirSync(bin);
  const ldd =
    options.libc === 'musl'
      ? 'echo "musl libc (x86_64)" >&2; exit 1'
      : 'echo "ldd (GNU libc) 2.39"';
  writeFileSync(path.join(bin, 'ldd'), `#!/usr/bin/env bash\n${ldd}\n`);
  chmodSync(path.join(bin, 'ldd'), 0o755);
  const meta = path.join(work, 'meta.json');
  if (options.meta) {
    writeFileSync(meta, JSON.stringify(options.meta));
  }

  const result = spawnSync('bash', [path.join(import.meta.dirname, 'install-pnpm.sh')], {
    encoding: 'utf8',
    env: {
      PATH: [bin, fakeBin, process.env['PATH']].join(path.delimiter),
      VERSION: options.version ?? '12.21.0',
      RUNNER_OS: options.os ?? 'Linux',
      RUNNER_ARCH: options.arch ?? 'X64',
      RUNNER_TEMP: path.join(work, 'temp'),
      RUNNER_TOOL_CACHE: path.join(work, 'tool'),
      GITHUB_PATH: path.join(work, 'path'),
      GITHUB_ENV: path.join(work, 'env'),
      CURL_LOG: path.join(work, 'curl.log'),
      CURL_CALLS: path.join(work, 'curl-calls.log'),
      FAKE_META: meta,
      FAKE_TGZ: tgz,
    },
  });
  const log = path.join(work, 'curl.log');
  const calls = path.join(work, 'curl-calls.log');
  return {
    status: result.status,
    stdout: result.stdout,
    urls: existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [],
    calls: existsSync(calls) ? readFileSync(calls, 'utf8').trim().split('\n') : [],
    installed: existsSync(path.join(work, 'tool', 'pnpm')),
  };
}

test('rejects pnpm older than 12 before downloading', () => {
  const result = install({ version: '11.9.0' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /pnpm version, 12 or later, is required \(got: 11\.9\.0\)/);
  assert.deepEqual(result.urls, []);
});

test('rejects a version with more after it before downloading', () => {
  const result = install({ version: '12.21.0\nPATH=/tmp' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /An exact pnpm version, 12 or later, is required/);
  assert.deepEqual(result.urls, []);
});

test('rejects a version that is not a number before downloading', () => {
  const result = install({ version: 'next' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /An exact pnpm version, 12 or later, is required \(got: next\)/);
  assert.deepEqual(result.urls, []);
});

test('rejects a platform pnpm ships no binary for', () => {
  const result = install({ os: 'Linux', arch: 'ARM' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /pnpm ships no binary for Linux-ARM/);
});

test('picks the musl binary when ldd is musl', () => {
  assert.deepEqual(install({ libc: 'musl' }).urls.toSorted(), [
    'https://registry.npmjs.org/@pnpm/exe.linux-x64-musl/12.21.0',
    'https://registry.npmjs.org/@pnpm/exe/12.21.0',
  ]);
});

test('picks the glibc binary when ldd is glibc', () => {
  assert.deepEqual(install({ libc: 'glibc' }).urls.toSorted(), [
    'https://registry.npmjs.org/@pnpm/exe.linux-x64/12.21.0',
    'https://registry.npmjs.org/@pnpm/exe/12.21.0',
  ]);
});

test('rejects a tarball that does not match the listed integrity', () => {
  const result = install({
    meta: {
      dist: {
        tarball: 'https://example.test/pnpm.tgz',
        integrity: 'sha512-AAAA',
        signatures: [npmSignature],
      },
    },
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /does not match the integrity the registry lists/);
  assert.equal(result.installed, false);
});

test('rejects a tarball npm did not sign', () => {
  const result = install({
    meta: {
      dist: { tarball: 'https://example.test/pnpm.tgz', integrity, signatures: [npmSignature] },
    },
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /@pnpm\/exe\.linux-x64@12\.21\.0 does not carry npm's signature/);
  assert.equal(result.installed, false);
});

test('rejects metadata without a signature from the pinned key', () => {
  const result = install({
    meta: { dist: { tarball: 'https://example.test/pnpm.tgz', integrity } },
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /does not carry npm's signature/);
  assert.equal(result.installed, false);
});

test('aborts a stalled transfer rather than waiting on it', () => {
  const result = install({});
  assert.equal(result.calls.length, 2);
  for (const call of result.calls) {
    assert.match(call, /--connect-timeout \d+ --speed-limit \d+ --speed-time \d+/);
  }
});
