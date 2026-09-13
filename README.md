# marcalexiei Github Actions

Shared Github Actions utilities across marcalexiei account

> [!NOTE]
> For security, pin actions to a full commit SHA rather than a mutable ref like `@main`:
>
> ```yml
> uses: marcalexiei/github-actions/setup-node-and-pnpm@b24da7e3c0e4a66a97cb28e39499c37873a593b7 # v2.3.0
> ```
>
> You can find the latest commit SHA on the [release page](https://github.com/marcalexiei/github-actions/releases).

## Actions

### `setup-node-and-pnpm`

Usage example:

- Reading node version from `.npmrc`

  ```yml
  - name: Install Dependencies
    uses: marcalexiei/github-actions/setup-node-and-pnpm@b24da7e3c0e4a66a97cb28e39499c37873a593b7 # v2.3.0
  ```

- With Explicit Node.js version

  ```yml
  - name: Install Dependencies
    uses: marcalexiei/github-actions/setup-node-and-pnpm@b24da7e3c0e4a66a97cb28e39499c37873a593b7 # v2.3.0
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
  uses: marcalexiei/github-actions/setup-github-app-user-bot@b24da7e3c0e4a66a97cb28e39499c37873a593b7 # v2.3.0
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
