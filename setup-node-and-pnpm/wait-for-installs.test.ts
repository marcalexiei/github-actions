import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
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

/** What a background install left behind, or `running`: a process that finishes it shortly. */
type Finished = { status: number; log: string } | 'running' | 'gone';

interface Result {
  status: number | null;
  stdout: string;
  path: string;
  env: string;
  output: string;
}

let run = 0;

/**
 * Lays out an action folder with stub installs, which write `<task>` lines to their step's files.
 * @returns the work folder and the action folder.
 */
function setup(): { work: string; action: string } {
  run += 1;
  const work = path.join(dir, `run-${run}`);
  const action = path.join(work, 'action');
  mkdirSync(path.join(work, 'temp'), { recursive: true });
  mkdirSync(action);
  for (const script of ['start-installs.sh', 'wait-for-installs.sh']) {
    copyFileSync(path.join(import.meta.dirname, script), path.join(action, script));
  }
  for (const task of tasks) {
    const stub = path.join(action, `install-${task}.sh`);
    writeFileSync(
      stub,
      `#!/usr/bin/env bash
echo "installing ${task}"
echo "/${task}" >> "$GITHUB_PATH"; echo "${task.toUpperCase()}=1" >> "$GITHUB_ENV"; echo "${task}=done" >> "$GITHUB_OUTPUT"
`,
    );
    chmodSync(stub, 0o755);
  }
  return { work, action };
}

function runScript(work: string, action: string, script: string): Result {
  for (const file of ['path', 'env', 'output']) {
    writeFileSync(path.join(work, file), '');
  }
  const result = spawnSync('bash', [path.join(action, script)], {
    encoding: 'utf8',
    env: {
      PATH: process.env['PATH'],
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
function wait(finished: Record<Task, Finished>): Result {
  const { work, action } = setup();
  for (const task of tasks) {
    const out = path.join(work, 'temp', `install-${task}`);
    mkdirSync(out);
    writeFileSync(path.join(out, 'path'), `/bg-${task}\n`);
    writeFileSync(path.join(out, 'env'), `BG_${task.toUpperCase()}=1\n`);
    writeFileSync(path.join(out, 'output'), `${task}=bg\n`);
    const state = finished[task];
    if (state === 'running') {
      const child = spawn(
        'bash',
        ['-c', `sleep 0.5; echo 'finished ${task}' > log; echo 0 > status`],
        {
          cwd: out,
          detached: true,
          stdio: 'ignore',
        },
      );
      child.unref();
      writeFileSync(path.join(out, 'pid'), String(child.pid));
    } else {
      // A pid no process has: the background process is gone.
      writeFileSync(path.join(out, 'pid'), '999999');
      if (state !== 'gone') {
        writeFileSync(path.join(out, 'log'), state.log);
        writeFileSync(path.join(out, 'status'), String(state.status));
      }
    }
  }
  return runScript(work, action, 'wait-for-installs.sh');
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

test('start-installs.sh runs each install in the background, for wait-for-installs.sh to apply', () => {
  const { work, action } = setup();
  const started = runScript(work, action, 'start-installs.sh');
  assert.equal(started.status, 0);
  assert.equal(started.path, '', 'the starting step gets nothing');
  const result = runScript(work, action, 'wait-for-installs.sh');
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'installing pnpm\ninstalling node\n');
  assert.equal(result.path, '/pnpm\n/node\n');
  assert.equal(result.env, 'PNPM=1\nNODE=1\n');
  assert.equal(result.output, 'pnpm=done\nnode=done\n');
});
