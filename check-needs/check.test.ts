import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

interface Report {
  judged: Array<RunJob>;
  errors: Array<string>;
}

interface RunJob {
  name: string;
  conclusion: string | null;
  run_attempt?: number;
  status?: string;
}

const dir = mkdtempSync(path.join(tmpdir(), 'check-needs-'));
after(() => {
  rmSync(dir, { recursive: true, force: true });
});

function check(
  workflowJobs: Record<string, { name?: string; uses?: string }>,
  runJobs: Array<RunJob>,
  needs: Array<string>,
): { judged: Array<string>; errors: Array<string> } {
  const workflow = path.join(dir, 'workflow.json');
  writeFileSync(workflow, JSON.stringify(workflowJobs));
  const pages = [{ jobs: runJobs.map((job) => ({ run_attempt: 1, ...job })) }];
  const result = spawnSync(
    'jq',
    ['-c', '-f', path.join(import.meta.dirname, 'check.jq'), '--slurpfile', 'workflow', workflow],
    {
      input: JSON.stringify(pages),
      encoding: 'utf8',
      env: {
        ...process.env,
        NEEDS: JSON.stringify(Object.fromEntries(needs.map((key) => [key, { result: 'success' }]))),
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout) as Report;
  return {
    judged: report.judged.map((job) => `${job.name}: ${String(job.conclusion)}`).toSorted(),
    errors: report.errors,
  };
}

const workflow = {
  'build-and-test': { name: 'Build and test ${{ matrix.node }} on ${{ matrix.os }}' },
  docs: { name: 'Docs site' },
  'ci-ok': { name: 'CI OK' },
};

test('fails on a matrix leg cancelled before a runner picked it up', () => {
  const { errors } = check(
    workflow,
    [
      { name: 'Build and test 24 on macos-26', conclusion: 'success' },
      { name: 'Build and test 26 on macos-26', conclusion: 'cancelled' },
      { name: 'Docs site', conclusion: 'success' },
    ],
    ['build-and-test', 'docs'],
  );
  assert.deepEqual(errors, ['Build and test 26 on macos-26: cancelled']);
});

test('passes when every leg succeeded', () => {
  const { judged, errors } = check(
    workflow,
    [
      { name: 'Build and test 24 on macos-26', conclusion: 'success' },
      { name: 'Build and test 26 on macos-26', conclusion: 'success' },
      { name: 'Docs site', conclusion: 'success' },
      { name: 'CI OK', conclusion: null, status: 'in_progress' },
    ],
    ['build-and-test', 'docs'],
  );
  assert.deepEqual(judged, [
    'Build and test 24 on macos-26: success',
    'Build and test 26 on macos-26: success',
    'Docs site: success',
  ]);
  assert.deepEqual(errors, []);
});

test('judges a job by its latest attempt', () => {
  const { errors } = check(
    workflow,
    [
      { name: 'Build and test 26 on macos-26', conclusion: 'cancelled', run_attempt: 1 },
      { name: 'Build and test 26 on macos-26', conclusion: 'success', run_attempt: 2 },
    ],
    ['build-and-test'],
  );
  assert.deepEqual(errors, []);
});

test('never judges a job outside needs', () => {
  const { judged, errors } = check(
    workflow,
    [
      { name: 'Build and test 26 on macos-26', conclusion: 'cancelled' },
      { name: 'Docs site', conclusion: 'success' },
    ],
    ['docs'],
  );
  assert.deepEqual(judged, ['Docs site: success']);
  assert.deepEqual(errors, []);
});

test('fails closed on a needed job missing from the run', () => {
  const { errors } = check(
    workflow,
    [{ name: 'Docs site', conclusion: 'success' }],
    ['docs', 'build-and-test', 'lint'],
  );
  assert.deepEqual(errors, [
    'build-and-test matched no job in the run',
    'lint matched no job in the run',
  ]);
});

test('matches an unnamed job by its key, with or without matrix values', () => {
  const { judged } = check(
    { test: {}, 'test-e2e': {} },
    [
      { name: 'test', conclusion: 'success' },
      { name: 'test (ubuntu, 24)', conclusion: 'success' },
      { name: 'test-e2e', conclusion: 'success' },
    ],
    ['test'],
  );
  assert.deepEqual(judged, ['test (ubuntu, 24): success', 'test: success']);
});

test('matches a name that GitHub appends matrix values to', () => {
  const { judged } = check(
    { lint: { name: 'Lint' } },
    [{ name: 'Lint (ubuntu)', conclusion: 'success' }],
    ['lint'],
  );
  assert.deepEqual(judged, ['Lint (ubuntu): success']);
});

test('matches the jobs of a reusable workflow', () => {
  const { judged } = check(
    { deploy: { name: 'Deploy', uses: './.github/workflows/deploy.yml' } },
    [
      { name: 'Deploy / build', conclusion: 'success' },
      { name: 'Deploy (prod) / publish', conclusion: 'success' },
    ],
    ['deploy'],
  );
  assert.deepEqual(judged, ['Deploy (prod) / publish: success', 'Deploy / build: success']);
});

test('matches regex metacharacters in a name literally', () => {
  const { judged, errors } = check(
    { build: { name: 'Build [x] (${{ matrix.target }}) +1' } },
    [
      { name: 'Build [x] (web) +1', conclusion: 'success' },
      { name: 'Build x (web) 1', conclusion: 'failure' },
    ],
    ['build'],
  );
  assert.deepEqual(judged, ['Build [x] (web) +1: success']);
  assert.deepEqual(errors, []);
});

test('matches an expression containing braces', () => {
  const { judged } = check(
    { fmt: { name: "Format ${{ format('{0}', matrix.dir) }}" } },
    [{ name: 'Format src', conclusion: 'success' }],
    ['fmt'],
  );
  assert.deepEqual(judged, ['Format src: success']);
});

test('gives a run job to the most literal name, so a templated one never claims the gate', () => {
  const { judged, errors } = check(
    { any: { name: '${{ matrix.name }}' }, 'ci-ok': { name: 'CI OK' } },
    [
      { name: 'alpha', conclusion: 'success' },
      { name: 'CI OK', conclusion: null, status: 'in_progress' },
    ],
    ['any'],
  );
  assert.deepEqual(judged, ['alpha: success']);
  assert.deepEqual(errors, []);
});
