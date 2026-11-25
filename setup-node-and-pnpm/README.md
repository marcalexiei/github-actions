# `setup-node-and-pnpm`

Usage example:

- Reading node version from `.nvmrc`

  ```yml
  - name: Install Dependencies
    uses: marcalexiei/github-actions/setup-node-and-pnpm@2434e1162adfdad5c72ba27c9a8fcc3ad232feb6 # v4.0.1
  ```

- With Explicit Node.js version

  ```yml
  - name: Install Dependencies
    uses: marcalexiei/github-actions/setup-node-and-pnpm@2434e1162adfdad5c72ba27c9a8fcc3ad232feb6 # v4.0.1
    with:
      node-version: ${{ matrix.node }}
  ```

pnpm version should be set in the `packageManager` field inside `package.json`.

pnpm 12 or later, as an exact version, is required. Its native binary and bundled node-gyp are downloaded from the npm registry and checked against npm's signature.

Node.js is downloaded from nodejs.org and checked against its `SHASUMS256.txt`, unless the runner image already ships that version.
A major or minor (`24`, `24.20`) resolves to its latest release, as `actions/setup-node` resolves it; any other range is left to `actions/setup-node`.
Both download while `node_modules` restores.

`node_modules` is cached.
When `node_modules` is restored, `pnpm install` is skipped (and so are the install lifecycle scripts) and the `cache-hit` output is `'true'`.
After a lockfile change, the last `node_modules` saved for the same Node.js and pnpm versions is restored instead, and `pnpm install` only adds what changed.

- `node_modules` is not cached on Windows runners.
- Caches are saved only on the default branch, the one place every pull request can read them from.
- When parallel jobs share a lockfile, let one of them save the caches:

  ```yml
  - name: Install Dependencies
    uses: marcalexiei/github-actions/setup-node-and-pnpm@2434e1162adfdad5c72ba27c9a8fcc3ad232feb6 # v4.0.1
    with:
      save-cache: false
  ```
