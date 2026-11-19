# `setup-github-app-user-bot`

> [!IMPORTANT]
> Grant the GitHub App only the minimum permissions required for your use case.
> Overly broad permissions increase the blast radius if the token is compromised.

```yml
- name: Setup release helper
  id: release-helper
  uses: marcalexiei/github-actions/setup-github-app-user-bot@b67181d953e3679fdcd89cb2c1c3a2d25ba87e42 # v2.6.0
  with:
    app-id: ${{ vars.RELEASE_HELPER_APP_ID }}
    private-key: ${{ secrets.RELEASE_HELPER_PRIVATE_KEY }}

- name: Configure git user for GitHub App
  run: |
    git config --global user.name "${BOT_NAME}"
    git config --global user.email "${BOT_EMAIL}"
  env:
    BOT_NAME: ${{ steps.release-helper.outputs.bot-name }}
    BOT_EMAIL: ${{ steps.release-helper.outputs.bot-email }}
```
