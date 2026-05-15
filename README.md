# marcalexiei Github Actions

Shared Github Actions utilities across marcalexiei account

> [!NOTE]
> For security, pin actions to a full commit SHA rather than a mutable ref like `@main`:
>
> ```yml
> uses: marcalexiei/github-actions/.github/actions/setup-node-and-pnpm@<commit-sha> # <version>
> ```
>
> You can find the latest commit SHA on the [release page](https://github.com/marcalexiei/github-actions/releases).

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

- name: Configure git user for GitHub App
  run: |
    git config --global user.name '${BOT_NAME}'
    git config --global user.email '${BOT_EMAIL}'
  env:
    BOT_NAME: ${{ steps.release-helper.outputs.bot-name }}
    BOT_EMAIL: ${{ steps.release-helper.outputs.bot-email }}
```
