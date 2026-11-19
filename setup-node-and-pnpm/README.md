# `setup-node-and-pnpm`

Usage example:

- Reading node version from `.nvmrc`

  ```yml
  - name: Install Dependencies
    uses: marcalexiei/github-actions/setup-node-and-pnpm@0ac3ea042e173813ebc7b086c174705c5bfc0fb6 # v2.6.2
  ```

- With Explicit Node.js version

  ```yml
  - name: Install Dependencies
    uses: marcalexiei/github-actions/setup-node-and-pnpm@0ac3ea042e173813ebc7b086c174705c5bfc0fb6 # v2.6.2
    with:
      node-version: ${{ matrix.node }}
  ```

pnpm version should be set in the `packageManager` field inside `package.json`.

With pnpm 12 or later on Linux, macOS and Windows, pnpm is downloaded from the npm registry and checked against its integrity. Otherwise `pnpm/action-setup` installs it.

`node_modules` and the Node.js binary are cached together.
When `node_modules` is restored, `pnpm install` is skipped (and so are the install lifecycle scripts) and the `cache-hit` output is `'true'`.
After a lockfile change, the last `node_modules` saved for the same Node.js and pnpm versions is restored instead, and `pnpm install` only adds what changed.

- `node_modules` is not cached on Windows runners.
- The Node.js binary is cached only for an exact version (`24.20.0`, not `24.20` or `24`) that the runner image does not already ship.
- Caches are saved only on the default branch, the one place every pull request can read them from.
- When parallel jobs share a lockfile, let one of them save the caches:

  ```yml
  - name: Install Dependencies
    uses: marcalexiei/github-actions/setup-node-and-pnpm@0ac3ea042e173813ebc7b086c174705c5bfc0fb6 # v2.6.2
    with:
      save-cache: false
  ```
