# marcalexiei Github Actions

Shared Github Actions utilities across marcalexiei account

> [!NOTE]
> For security, pin actions to a full commit SHA rather than a mutable ref like `@main`.
> The examples in each action's README are re-pinned after every release, so their SHA points at the latest version.
> You can also find it on the [release page](https://github.com/marcalexiei/github-actions/releases).

## Actions

- [`setup-node-and-pnpm`](setup-node-and-pnpm/README.md): sets up pnpm and Node.js, and installs the dependencies with `node_modules` cached
- [`github-app-bot-identity`](github-app-bot-identity/README.md): the name and email a GitHub App bot commits as, optionally set as the git user
- [`pin-readme-version`](pin-readme-version/README.md): points the `uses:` lines in a README at the commit a release tag was cut from
- [`check-needs`](check-needs/README.md): a gate job that fails unless every needed job succeeded, counting each matrix leg on its own
- [`audit-github-actions`](audit-github-actions/README.md): runs zizmor and jactionlint, on a pull request only when the workflows changed
