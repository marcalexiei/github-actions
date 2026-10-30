# `setup-node-and-pnpm`

Usage example:

- Reading node version from `.nvmrc`

  ```yml
  - name: Install Dependencies
    uses: marcalexiei/github-actions/setup-node-and-pnpm@4a51d6dfcaac0c263c6f2efd97249eafe0076721 # v2.5.0
  ```

- With Explicit Node.js version

  ```yml
  - name: Install Dependencies
    uses: marcalexiei/github-actions/setup-node-and-pnpm@4a51d6dfcaac0c263c6f2efd97249eafe0076721 # v2.5.0
    with:
      node-version: ${{ matrix.node }}
  ```

pnpm version should be set in the `packageManager` field inside `package.json`.

`node_modules` and the Node.js binary are cached.
When `node_modules` is restored, `pnpm install` is skipped (and so are the install lifecycle scripts) and the `cache-hit` output is `'true'`.

- `node_modules` is not cached on Windows runners.
- The Node.js binary is cached only for an exact version (`24.20.0`, not `24.20` or `24`) that the runner image does not already ship.
- Caches are saved only on the default branch, the one place every pull request can read them from.
- When parallel jobs share a lockfile, let one of them save the caches:

  ```yml
  - name: Install Dependencies
    uses: marcalexiei/github-actions/setup-node-and-pnpm@4a51d6dfcaac0c263c6f2efd97249eafe0076721 # v2.5.0
    with:
      save-cache: false
  ```
