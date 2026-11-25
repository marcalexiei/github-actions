import assert from 'node:assert/strict';
import type { ChildProcess } from 'node:child_process';
import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
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

const dir = mkdtempSync(path.join(tmpdir(), 'wait-for-installs-'));
after(() => {
  rmSync(dir, { recursive: true, force: true });
});

const tasks = ['pnpm', 'node'] as const;
type Task = (typeof tasks)[number];

/**
 * What a background install left behind; `running`: a process that finishes it shortly;
 * `gone`: no process and no status; `reused`: its pid now another process's.
 */
type Finished = { status: number; log: string } | 'running' | 'gone' | 'reused';

interface Result {
  status: number | null;
  stdout: string;
  path: string;
  env: string;
  output: string;
}

/** The work folder and the action folder. */
interface Folders {
  work: string;
  action: string;
}

let run = 0;
const others: Array<ChildProcess> = [];
after(() => {
  for (const other of others) {
    other.kill();
  }
});

/** Lays out an action folder with stub installs taking `seconds`, which write `<task>` lines to their step's files. */
function setup(seconds = 0): Folders {
  run += 1;
  const work = path.join(dir, `run-${run}`);
  const action = path.join(work, 'action');
  mkdirSync(path.join(work, 'temp'), { recursive: true });
  mkdirSync(action);
  for (const script of ['start-installs.sh', 'background-install.sh', 'wait-for-installs.sh']) {
    copyFileSync(path.join(import.meta.dirname, script), path.join(action, script));
  }
  for (const task of tasks) {
    const stub = path.join(action, `install-${task}.sh`);
    writeFileSync(
      stub,
      `#!/usr/bin/env bash
sleep ${seconds}
echo "installing ${task}"
echo "/${task}" >> "$GITHUB_PATH"; echo "${task.toUpperCase()}=1" >> "$GITHUB_ENV"; echo "${task}=done" >> "$GITHUB_OUTPUT"
`,
    );
    chmodSync(stub, 0o755);
  }
  return { work, action };
}

function runScript({ work, action }: Folders, script: string, bin?: string): Result {
  for (const file of ['path', 'env', 'output']) {
    writeFileSync(path.join(work, file), '');
  }
  const result = spawnSync('bash', [path.join(action, script)], {
    encoding: 'utf8',
    // Waiting on the wrong process would otherwise pass, only slowly.
    timeout: 10_000,
    env: {
      PATH: [bin, process.env['PATH']].filter(Boolean).join(path.delimiter),
      RUNNER_TEMP: path.join(work, 'temp'),
      GITHUB_ACTION_PATH: action,
      GITHUB_PATH: path.join(work, 'path'),
      GITHUB_ENV: path.join(work, 'env'),
      GITHUB_OUTPUT: path.join(work, 'output'),
    },
  });
  const read = (file: string): string => readFileSync(path.join(work, file), 'utf8');
  return {
    status: result.status,
    stdout: result.stdout,
    path: read('path'),
    env: read('env'),
    output: read('output'),
  };
}

/** Leaves each install's files as start-installs.sh's background process would. */
function wait(finished: Record<Task, Finished>, bin?: string): Result {
  const { work, action } = setup();
  for (const task of tasks) {
    const out = path.join(work, 'temp', `install-${task}`);
    mkdirSync(out);
    writeFileSync(path.join(out, 'path'), `/bg-${task}\n`);
    writeFileSync(path.join(out, 'env'), `BG_${task.toUpperCase()}=1\n`);
    writeFileSync(path.join(out, 'output'), `${task}=bg\n`);
    const state = finished[task];
    if (state === 'running') {
      // Named as start-installs.sh's background process is.
      const child = spawn(
        'bash',
        [
          '-c',
          `sleep 0.5; echo 'finished ${task}' > log; echo 0 > status`,
          'background-install.sh',
        ],
        {
          cwd: out,
          detached: true,
          stdio: 'ignore',
        },
      );
      child.unref();
      writeFileSync(path.join(out, 'pid'), String(child.pid));
    } else if (state === 'reused') {
      const other = spawn('sleep', ['60'], { stdio: 'ignore' });
      others.push(other);
      writeFileSync(path.join(out, 'pid'), String(other.pid));
    } else {
      // The pid of a process that has exited.
      writeFileSync(path.join(out, 'pid'), String(spawnSync('true').pid));
      if (state !== 'gone') {
        writeFileSync(path.join(out, 'log'), state.log);
        writeFileSync(path.join(out, 'status'), String(state.status));
      }
    }
  }
  return runScript({ work, action }, 'wait-for-installs.sh', bin);
}

const ok: Finished = { status: 0, log: 'ok\n' };

test('applies what each install wrote for this step, and prints its log', () => {
  const result = wait({
    pnpm: { status: 0, log: 'pnpm log\n' },
    node: { status: 0, log: 'node log\n' },
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'pnpm log\nnode log\n');
  assert.equal(result.path, '/bg-pnpm\n/bg-node\n');
  assert.equal(result.env, 'BG_PNPM=1\nBG_NODE=1\n');
  assert.equal(result.output, 'pnpm=bg\nnode=bg\n');
});

test('fails when an install failed, printing its log and applying nothing of it', () => {
  const result = wait({ pnpm: { status: 1, log: '::error::no pnpm\n' }, node: ok });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /::error::no pnpm/);
  assert.equal(result.path, '/bg-node\n');
});

test('waits for an install still running', () => {
  const result = wait({ pnpm: 'running', node: ok });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /finished pnpm/);
  assert.equal(result.path, '/bg-pnpm\n/bg-node\n');
});

test('installs in its own step when the background process is gone', () => {
  const result = wait({ pnpm: ok, node: 'gone' });
  assert.equal(result.status, 0);
  assert.match(
    result.stdout,
    /The node install started by 'Resolve versions' did not finish; installing now\.\ninstalling node/,
  );
  assert.equal(result.path, '/bg-pnpm\n/node\n');
  assert.equal(result.output, 'pnpm=bg\nnode=done\n');
});

test('installs in its own step when the pid now belongs to another process', () => {
  const result = wait({ pnpm: 'reused', node: ok });
  assert.equal(result.status, 0);
  assert.match(
    result.stdout,
    /The pnpm install started by 'Resolve versions' did not finish; installing now\.\ninstalling pnpm/,
  );
  assert.equal(result.path, '/pnpm\n/bg-node\n');
});

test(
  'trusts a live pid when no command line can be read',
  { skip: existsSync('/proc') && 'reads /proc here, never ps' },
  () => {
    const bin = path.join(dir, 'no-ps');
    mkdirSync(bin, { recursive: true });
    writeFileSync(path.join(bin, 'ps'), '#!/usr/bin/env bash\nexit 1\n');
    chmodSync(path.join(bin, 'ps'), 0o755);
    const result = wait({ pnpm: 'running', node: ok }, bin);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /finished pnpm/);
  },
);

test('start-installs.sh runs each install in the background, for wait-for-installs.sh to apply', () => {
  const { work, action } = setup();
  const started = runScript({ work, action }, 'start-installs.sh');
  assert.equal(started.status, 0);
  assert.equal(started.path, '', 'the starting step gets nothing');
  const result = runScript({ work, action }, 'wait-for-installs.sh');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'installing pnpm\ninstalling node\n');
  assert.equal(result.path, '/pnpm\n/node\n');
  assert.equal(result.env, 'PNPM=1\nNODE=1\n');
  assert.equal(result.output, 'pnpm=done\nnode=done\n');
});

test('start-installs.sh drops what an earlier run of the action left', () => {
  // Still installing when the wait starts, so only a stale status could end it early.
  const { work, action } = setup(0.5);
  const stale = path.join(work, 'temp', 'install-pnpm');
  mkdirSync(stale);
  writeFileSync(path.join(stale, 'status'), '0');
  writeFileSync(path.join(stale, 'log'), 'stale\n');
  writeFileSync(path.join(stale, 'output'), 'pnpm=stale\n');
  runScript({ work, action }, 'start-installs.sh');
  const result = runScript({ work, action }, 'wait-for-installs.sh');
  assert.equal(result.stdout, 'installing pnpm\ninstalling node\n');
  assert.equal(result.output, 'pnpm=done\nnode=done\n');
});
