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
