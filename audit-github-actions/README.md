# `audit-github-actions`

Runs [zizmor](https://github.com/zizmorcore/zizmor) and [jactionlint](https://github.com/jdx/jactionlint) on the repository.
On a pull request it skips both unless one of `paths` changed. On any other event it always runs them.

```yml
github-actions-audit:
  name: GitHub Actions audit
  runs-on: ubuntu-24.04
  timeout-minutes: 5
  permissions:
    contents: read # required to check out the repository
  steps:
    - name: Audit GitHub Actions
      uses: marcalexiei/github-actions/audit-github-actions@2434e1162adfdad5c72ba27c9a8fcc3ad232feb6 # v4.0.1
```

- Give it a job of its own: it checks out the repository itself, which wipes what earlier steps left in the workspace.
- It is meant for `push` and `pull_request`. On other events it audits the ref the event checks out, which for `pull_request_target` is the base branch.
- `paths` takes space-separated git pathspecs, `.github` by default, e.g. `.github */action.yml`.
- jactionlint reads `.github/jactionlint.yaml`, if present.
- jactionlint still runs when zizmor fails, so one run reports both.
