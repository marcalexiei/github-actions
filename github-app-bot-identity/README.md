# `github-app-bot-identity`

Looks up the name and email a GitHub App bot commits as, and optionally sets them as the git user.
Create the token itself with [`actions/create-github-app-token`](https://github.com/actions/create-github-app-token), which takes the `permission-*` inputs to scope it.

```yml
- name: Create GitHub App token
  id: app-token
  uses: actions/create-github-app-token@f418cff399f7aef4c2f0ad47e25ca7a6abbdd6fc # v3.4.0
  with:
    client-id: ${{ vars.RELEASE_HELPER_CLIENT_ID }}
    private-key: ${{ secrets.RELEASE_HELPER_PRIVATE_KEY }}
    permission-contents: write

- name: Commit as the GitHub App bot
  uses: marcalexiei/github-actions/github-app-bot-identity@7d232a08434641e4df36f5921d4308a2bba23f9c # v3.0.0
  with:
    app-slug: ${{ steps.app-token.outputs.app-slug }}
    token: ${{ steps.app-token.outputs.token }}
    configure-git: true
```

- Outputs `name` (`<slug>[bot]`), `email` (`<id>+<slug>[bot]@users.noreply.github.com`) and `id`.
- `configure-git: true` sets them as the global `user.name` and `user.email`.
- The lookup reads a public endpoint, so any `token` works: the app token, or `github.token` even under `permissions: {}`.
- Commits made through the API, like release-please or `peter-evans/create-pull-request` with `sign-commits`, are attributed to the app already and need no identity.
