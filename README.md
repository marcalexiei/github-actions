# marcalexiei Github Actions

Shared Github Actions utilities across marcalexiei account

## Actions

### `setup-node-and-pnpm`

Usage example:

- Reading node version from `.npmrc`

  ```yml
  - name: Install Dependencies
    uses: marcalexiei/github-actions/.github/actions/setup-node-and-pnpm@main
  ```

- With Explicit Node.js version

  ```yml
  - name: Install Dependencies
    uses: marcalexiei/github-actions/.github/actions/setup-node-and-pnpm@main
    with:
      node-version: ${{ matrix.node }}
  ```

### `setup-github-app-user-bot`

```yml
- name: Setup release helper
  id: release-helper
  uses: marcalexiei/github-actions/.github/actions/setup-github-app-user-bot@main      
  with:
    app-id: ${{ vars.RELEASE_HELPER_APP_ID }}
    private-key: ${{ secrets.RELEASE_HELPER_PRIVATE_KEY }}
```
