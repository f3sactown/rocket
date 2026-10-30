# Versioning and releases

Rocket uses [Semantic Versioning](https://semver.org). The whole repo shares one version, kept in
the root `package.json` (and mirrored into each workspace package).

## Current phase: alpha

| Phase   | Version looks like | Meaning                                          |
| ------- | ------------------ | ------------------------------------------------ |
| alpha   | `0.1.0-alpha.3`    | Still being built; not ready for outside testers |
| beta    | `0.1.0-beta.1`     | Feature-complete enough for others to test       |
| rc      | `0.1.0-rc.1`       | Release candidate                                |
| release | `0.1.0`, `1.0.0`   | Stable                                           |

While in alpha, every release bumps the trailing number: `0.1.0-alpha.1` → `0.1.0-alpha.2` → …

## Commit messages

Releases are generated from [Conventional Commits](https://www.conventionalcommits.org). Use these
prefixes on commits (or on PR titles when squash-merging):

| Prefix                                                       | Example                         | In changelog? |
| ------------------------------------------------------------ | ------------------------------- | ------------- |
| `feat:`                                                      | `feat: add Slack login`         | Features      |
| `fix:`                                                       | `fix: count FNGs in PAX total`  | Bug Fixes     |
| `perf:`                                                      | `perf: paginate backblast list` | Performance   |
| `docs:` `chore:` `ci:` `refactor:` `test:` `style:` `build:` | `chore: bump deps`              | No            |

Breaking changes use `feat!:` or a `BREAKING CHANGE:` footer.

## How a release happens

1. Changes are merged into `main`.
2. The **Release** workflow opens (or updates) a pull request titled
   `chore(main): release 0.1.0-alpha.N`, containing the version bump and the new `CHANGELOG.md`
   entry.
3. Merging that pull request tags the commit `v0.1.0-alpha.N` and publishes a GitHub Release,
   marked as a pre-release.

The running app shows its version in the footer, so you can always tell which release you're on.

## Changing phase

To move to the next phase, add a `Release-As:` footer to a commit on `main`, for example:

```
chore: start beta

Release-As: 0.1.0-beta.1
```

Then update `prerelease-type` in `release-please-config.json` to match (`beta`, `rc`). For the
first stable release, use `Release-As: 0.1.0` (or `1.0.0`) and set `"prerelease": false`.

## One-time GitHub setup

In the repository's **Settings → Actions → General**, enable **"Allow GitHub Actions to create and
approve pull requests"** so the Release workflow can open its release pull request.
