# `pin-readme-version`

For a workflow that runs on a published release.
It points the `uses:` lines in a README at the commit the release tag was cut from, written as `@<sha> # <tag>`, so an example is pinned the way it should be copied.

```yml
- name: Checkout
  uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  with:
    ref: main # a release event checks out the tag
    persist-credentials: false

- name: Pin the examples
  uses: marcalexiei/github-actions/pin-readme-version@92c64c084d3479cff756151cb8163d03608f2acd # v2.4.2
  with:
    tag: ${{ github.event.release.tag_name }}
```

- `files` takes space-separated files or globs, `README.md` by default.
- It matches `@v0`, `@<sha>` and `@<sha> # vX.Y.Z` alike, with or without a path after the repository.
- It only rewrites the files: commit them, or open a pull request, in a later step.
