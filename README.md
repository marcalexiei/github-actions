# marcalexiei Github Actions

Shared Github Actions utilities across marcalexiei account

> [!NOTE]
> For security, pin actions to a full commit SHA rather than a mutable ref like `@main`.
> The examples in each action's README are re-pinned after every release, so their SHA points at the latest version.
> You can also find it on the [release page](https://github.com/marcalexiei/github-actions/releases).

## Actions

- [`setup-node-and-pnpm`](setup-node-and-pnpm/README.md): sets up pnpm and Node.js, and installs the dependencies with `node_modules` cached
- [`setup-github-app-user-bot`](setup-github-app-user-bot/README.md): a GitHub App token, and the bot's name and email to commit as
- [`pin-readme-version`](pin-readme-version/README.md): points the `uses:` lines in a README at the commit a release tag was cut from
