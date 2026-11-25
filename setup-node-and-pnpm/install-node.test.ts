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

const dir = mkdtempSync(path.join(tmpdir(), 'install-node-'));
after(() => {
  rmSync(dir, { recursive: true, force: true });
});

const fakeBin = path.join(dir, 'bin');
mkdirSync(fakeBin);
// Serves $FAKE_INDEX, $FAKE_SUMS and $FAKE_ARCHIVE by URL, logging each; a URL ending in $FAKE_FAIL fails as a 404 would.
writeFileSync(
  path.join(fakeBin, 'curl'),
  `#!/usr/bin/env bash
url="\${*: -1}"
echo "$url" >> "$CURL_LOG"
echo "$*" >> "$CURL_CALLS"
[ -n "$FAKE_FAIL" ] && [[ "$url" == *"$FAKE_FAIL" ]] && exit 22
prev=''; for arg in "$@"; do [ "$prev" = -o ] && out="$arg"; prev="$arg"; done
case "$url" in
  */index.json) cat "$FAKE_INDEX" ;;
  */SHASUMS256.txt) cat "$FAKE_SUMS" ;;
  *) cp "$FAKE_ARCHIVE" "$out" ;;
esac
`,
);
chmodSync(path.join(fakeBin, 'curl'), 0o755);
// Git Bash's path converter, for the Windows branch: these paths need none.
writeFileSync(
  path.join(fakeBin, 'cygpath'),
  '#!/usr/bin/env bash\n[ "$1" = -w ] && shift\necho "$1"\n',
);
chmodSync(path.join(fakeBin, 'cygpath'), 0o755);
// Windows' tar.exe, under $SYSTEMROOT: logs its arguments and leaves a node.exe where -C points.
const systemRoot = path.join(dir, 'Windows');
mkdirSync(path.join(systemRoot, 'System32'), { recursive: true });
writeFileSync(
  path.join(systemRoot, 'System32', 'tar.exe'),
  '#!/usr/bin/env bash\nprintf "%s\\n" "$@" > "$TAR_LOG"\necho "not node" > "$4/node.exe"\n',
);
chmodSync(path.join(systemRoot, 'System32', 'tar.exe'), 0o755);

const archive = path.join(dir, 'node.tar.gz');
mkdirSync(path.join(dir, 'node-dist', 'bin'), { recursive: true });
writeFileSync(path.join(dir, 'node-dist', 'bin', 'node'), 'not node');
spawnSync('tar', ['-czf', archive, '-C', dir, 'node-dist']);
const sha256 = createHash('sha256').update(readFileSync(archive)).digest('hex');

const index = [{ version: 'v26.13.1' }, { version: 'v26.12.0' }, { version: 'v24.22.3' }];

interface Options {
  spec: string;
  os?: string;
  arch?: string;
  /** Lines of SHASUMS256.txt; defaults to the archive's real checksum. */
  sums?: Array<string>;
  /** Versions whose marker is already in the tool cache. */
  installed?: Array<string>;
  /** The end of a URL nodejs.org fails to serve. */
  fail?: string;
  /** What nodejs.org serves as index.json; defaults to `index`. */
  indexBody?: string;
}

interface Result {
  status: number | null;
  stdout: string;
  /** What the script wrote to GITHUB_OUTPUT. */
  output: string;
  /** Every URL the script fetched, in order. */
  urls: Array<string>;
  /** Each curl call's arguments, one line per call. */
  calls: Array<string>;
  toolCache: string;
  temp: string;
  /** The arguments Windows' tar.exe got, one per line. */
  tar: string;
}

let run = 0;

function install(options: Options): Result {
  run += 1;
  const work = path.join(dir, `run-${run}`);
  const toolCache = path.join(work, 'tool');
  mkdirSync(path.join(work, 'temp'), { recursive: true });
  for (const version of options.installed ?? []) {
    mkdirSync(path.join(toolCache, 'node', version, 'arm64'), { recursive: true });
    writeFileSync(path.join(toolCache, 'node', version, 'arm64.complete'), '');
  }
  writeFileSync(path.join(work, 'index.json'), options.indexBody ?? JSON.stringify(index));
  const sums = options.sums ?? [`${sha256}  node-v26.13.1-darwin-arm64.tar.gz`];
  writeFileSync(path.join(work, 'SHASUMS256.txt'), `${sums.join('\n')}\n`);

  const result = spawnSync('bash', [path.join(import.meta.dirname, 'install-node.sh')], {
    encoding: 'utf8',
    env: {
      PATH: [fakeBin, process.env['PATH']].join(path.delimiter),
      NODE_SPEC: options.spec,
      RUNNER_OS: options.os ?? 'macOS',
      RUNNER_ARCH: options.arch ?? 'ARM64',
      RUNNER_TEMP: path.join(work, 'temp'),
      RUNNER_TOOL_CACHE: toolCache,
      GITHUB_OUTPUT: path.join(work, 'output'),
      CURL_LOG: path.join(work, 'curl.log'),
      CURL_CALLS: path.join(work, 'curl-calls.log'),
      FAKE_INDEX: path.join(work, 'index.json'),
      FAKE_SUMS: path.join(work, 'SHASUMS256.txt'),
      FAKE_ARCHIVE: archive,
      FAKE_FAIL: options.fail ?? '',
      SYSTEMROOT: systemRoot,
      TAR_LOG: path.join(work, 'tar.log'),
    },
  });
  const read = (file: string): string => {
    const full = path.join(work, file);
    return existsSync(full) ? readFileSync(full, 'utf8') : '';
  };
  return {
    status: result.status,
    stdout: result.stdout,
    output: read('output'),
    urls: read('curl.log').trim().split('\n').filter(Boolean),
    calls: read('curl-calls.log').trim().split('\n').filter(Boolean),
    toolCache,
    temp: path.join(work, 'temp'),
    tar: read('tar.log'),
  };
}

test('resolves a major to its latest release and installs it where actions/setup-node looks', () => {
  const result = install({ spec: '26' });
  assert.equal(result.status, 0);
  assert.equal(result.output, 'node-version=26.13.1\n');
  assert.deepEqual(result.urls.toSorted(), [
    'https://nodejs.org/dist/index.json',
    'https://nodejs.org/dist/v26.13.1/SHASUMS256.txt',
    'https://nodejs.org/dist/v26.13.1/node-v26.13.1-darwin-arm64.tar.gz',
  ]);
  const installed = path.join(result.toolCache, 'node', '26.13.1');
  assert.equal(readFileSync(path.join(installed, 'arm64', 'bin', 'node'), 'utf8'), 'not node');
  assert.ok(existsSync(path.join(installed, 'arm64.complete')));
});

test('resolves a minor to its latest patch', () => {
  assert.equal(
    install({ spec: 'v26.12', installed: ['26.12.0'] }).output,
    'node-version=26.12.0\n',
  );
});

test('downloads nothing when the runner already has the version', () => {
  const result = install({ spec: '26.13.1', installed: ['26.13.1'] });
  assert.equal(result.status, 0);
  assert.equal(result.output, 'node-version=26.13.1\n');
  assert.deepEqual(result.urls, []);
});

test('leaves any other range to actions/setup-node', () => {
  const result = install({ spec: 'lts/*' });
  assert.equal(result.status, 0);
  assert.equal(result.output, 'node-version=lts/*\n');
  assert.deepEqual(result.urls, []);
});

test('leaves a major with no release to actions/setup-node', () => {
  const result = install({ spec: '99' });
  assert.equal(result.status, 0);
  assert.equal(result.output, 'node-version=99\n');
  assert.deepEqual(result.urls, ['https://nodejs.org/dist/index.json']);
});

test('leaves a platform it has no build for to actions/setup-node', () => {
  const result = install({ spec: '26.13.1', os: 'Linux', arch: 'ARM' });
  assert.equal(result.status, 0);
  assert.equal(result.output, 'node-version=26.13.1\n');
  assert.deepEqual(result.urls, []);
});

test('rejects an archive that does not match its checksum', () => {
  const result = install({
    spec: '26.13.1',
    sums: [`${'0'.repeat(64)}  node-v26.13.1-darwin-arm64.tar.gz`],
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /node-v26\.13\.1-darwin-arm64\.tar\.gz does not match the checksum/);
  assert.equal(existsSync(path.join(result.toolCache, 'node', '26.13.1', 'arm64.complete')), false);
});

test('rejects an archive SHASUMS256.txt does not list', () => {
  const result = install({ spec: '26.13.1', sums: [`${sha256}  node-v26.13.1-linux-x64.tar.gz`] });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /does not match the checksum/);
  assert.equal(existsSync(path.join(result.toolCache, 'node', '26.13.1', 'arm64.complete')), false);
});

test("unpacks the zip with Windows' own tar on Windows", () => {
  const result = install({
    spec: '26.13.1',
    os: 'Windows',
    arch: 'X64',
    sums: [`${sha256}  node-v26.13.1-win-x64.zip`],
  });
  assert.equal(result.status, 0);
  const installed = path.join(result.toolCache, 'node', '26.13.1', 'x64');
  const [flag, zip, ...rest] = result.tar.trim().split('\n');
  assert.equal(flag, '-xf');
  assert.equal(path.dirname(path.dirname(zip ?? '')), result.temp);
  assert.equal(path.basename(zip ?? ''), 'node-v26.13.1-win-x64.zip');
  assert.deepEqual(rest, ['-C', installed, '--strip-components', '1']);
  assert.equal(readFileSync(path.join(installed, 'node.exe'), 'utf8'), 'not node\n');
  assert.ok(existsSync(`${installed}.complete`));
});

for (const [what, fail] of [
  ['index.json', '/index.json'],
  ['the archive', '.tar.gz'],
  ['SHASUMS256.txt', '/SHASUMS256.txt'],
] as const) {
  test(`leaves the install to actions/setup-node when nodejs.org fails to serve ${what}`, () => {
    const result = install({ spec: '26', fail });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /::warning::.*; actions\/setup-node installs Node\.js instead\./);
    assert.equal(result.output, 'node-version=26\n');
    assert.equal(
      existsSync(path.join(result.toolCache, 'node', '26.13.1', 'arm64.complete')),
      false,
    );
  });
}

test('leaves the install to actions/setup-node when index.json is not JSON', () => {
  const result = install({ spec: '26', indexBody: '<html>Blocked</html>' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /::warning::nodejs\.org's index\.json is not JSON/);
  assert.equal(result.output, 'node-version=26\n');
});

test('aborts a stalled transfer rather than waiting on it', () => {
  const result = install({ spec: '26' });
  assert.equal(result.calls.length, 3);
  for (const call of result.calls) {
    assert.match(call, /--connect-timeout \d+ --speed-limit \d+ --speed-time \d+/);
  }
});
