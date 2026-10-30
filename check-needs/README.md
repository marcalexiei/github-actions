# `check-needs`

For a workflow's final gate job, the one a ruleset requires or Renovate waits on before automerging.
It fails unless every job in the gate's `needs` succeeded, counting each matrix leg on its own.

```yml
ci-ok:
  name: CI OK
  runs-on: ubuntu-24.04
  timeout-minutes: 1
  if: ${{ always() }}
  needs:
    - build-and-test
    - checks
  permissions:
    actions: read # required to list the run's jobs
    contents: read # required to read the workflow file
  steps:
    - name: Check needed jobs
      uses: marcalexiei/github-actions/check-needs@92c64c084d3479cff756151cb8163d03608f2acd # v2.4.2
      with:
        needs: ${{ toJSON(needs) }}
```

Why not just check `needs.*.result`?
When GitHub cannot find a runner for a matrix leg, it cancels that leg before it starts, yet still reports the whole matrix as `success` in `needs` ([reported to GitHub](https://github.com/orgs/community/discussions/211624)).
A gate reading only `needs` then goes green with a leg that never ran.
This action also reads the workflow file and the run's jobs through the API, and fails on any needed job, matrix legs included, that did not succeed.

- Jobs outside `needs` are never judged.
- A needed job that matches no job in the run fails the gate.
- A re-run judges the jobs of its own attempt, so "Re-run failed jobs" can clear a failed gate.
- A job that matches no job in the workflow file fails the gate, rather than go unchecked.
- A job a needed reusable workflow skips passes, as it does in `needs`.
- The gate must sit in the workflow file itself, not in a reusable workflow it calls.
- It needs `yq` and `jq`, which GitHub's Ubuntu runners ship, and no checkout.
