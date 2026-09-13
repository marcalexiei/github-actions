# marcalexiei Github Actions

Shared Github Actions utilities across marcalexiei account

> [!NOTE]
> For security, pin actions to a full commit SHA rather than a mutable ref like `@main`.
> The examples below are re-pinned after every release, so their SHA points at the latest version.
> You can also find it on the [release page](https://github.com/marcalexiei/github-actions/releases).

## Actions

### `setup-node-and-pnpm`

Usage example:

- Reading node version from `.npmrc`

  ```yml
  - name: Install Dependencies
    uses: marcalexiei/github-actions/setup-node-and-pnpm@e9655755a6dc0040e650a931ee5d958c7d7a9f22 # v2.3.1
  ```

- With Explicit Node.js version

  ```yml
  - name: Install Dependencies
    uses: marcalexiei/github-actions/setup-node-and-pnpm@e9655755a6dc0040e650a931ee5d958c7d7a9f22 # v2.3.1
    with:
      node-version: ${{ matrix.node }}
  ```

pnpm version should be set in the `packageManager` field inside `package.json`.

### `setup-github-app-user-bot`

> [!IMPORTANT]
> Grant the GitHub App only the minimum permissions required for your use case.
> Overly broad permissions increase the blast radius if the token is compromised.

```yml
- name: Setup release helper
  id: release-helper
  uses: marcalexiei/github-actions/setup-github-app-user-bot@e9655755a6dc0040e650a931ee5d958c7d7a9f22 # v2.3.1
  with:
    app-id: ${{ vars.RELEASE_HELPER_APP_ID }}
    private-key: ${{ secrets.RELEASE_HELPER_PRIVATE_KEY }}

- name: Configure git user for GitHub App
  run: |
    git config --global user.name '${BOT_NAME}'
    git config --global user.email '${BOT_EMAIL}'
  env:
    BOT_NAME: ${{ steps.release-helper.outputs.bot-name }}
    BOT_EMAIL: ${{ steps.release-helper.outputs.bot-email }}
```
