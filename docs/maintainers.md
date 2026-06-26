# Maintainer guide

How releases work for the claude-autopilot marketplace. For contribution mechanics, see
[`CONTRIBUTING.md`](../CONTRIBUTING.md).

## How users consume this marketplace

Claude Code installs plugins straight from git — there is no npm publish or build artifact:

```
/plugin marketplace add agentic-incubator/claude-autopilot
/plugin install autopilot
```

This has one important consequence: **whatever is on `main` is what users get.** A broken
manifest on `main` breaks installation for everyone immediately. That's why the manifest
validator and CI gate exist — they are the real "release infrastructure."

## Versioning policy

Semantic versioning, derived automatically from [Conventional Commit](https://www.conventionalcommits.org/)
messages (see "Releasing" below). The commit type drives the bump:

- **patch** (`0.4.0 → 0.4.1`) — `fix:` commits (wording fixes, clarifications, bug fixes).
- **minor** (`0.4.0 → 0.5.0`) — `feat:` commits (new capability, new skill/command, backward-
  compatible behavior change).
- **major** (`1.0.0 → 2.0.0`) — a `!` breaking-change marker (`feat!:`) or a `BREAKING CHANGE:`
  footer. While the plugin is pre-1.0, breaking changes bump the minor instead (configured via
  `bump-minor-pre-major`).

Three version fields are kept in lockstep automatically and must always agree (CI enforces it):

- `plugins/autopilot/.claude-plugin/plugin.json` → `version`
- `.claude-plugin/marketplace.json` → `metadata.version`
- `package.json` → `version`

## Releasing (automated via release-please)

Releases are driven by [release-please](https://github.com/googleapis/release-please), wired up in
`.github/workflows/release.yml` with `release-please-config.json` and
`.release-please-manifest.json`. **No manual version bumping or CHANGELOG editing.**

How it flows:

1. Land work on `main` as usual (PRs with Conventional Commit titles — see `CONTRIBUTING.md`).
   Because you squash-merge, the PR title becomes the commit release-please reads.
2. On every push to `main`, release-please opens (or updates) a **`chore: release X.Y.Z`** PR
   that bumps all three version fields and regenerates `CHANGELOG.md` from the commits since the
   last release.
3. When you're ready to ship, **merge that release PR**. release-please then creates the
   `vX.Y.Z` git tag and the GitHub Release with notes drawn from the CHANGELOG.

Because Claude Code installs from `main`, the version bump reaches users the moment the release
PR merges; the tag and GitHub Release are human-readable history that now genuinely exists (so
the CHANGELOG's `compare/` links resolve).

> **Note:** PRs that release-please opens with the default `GITHUB_TOKEN` do not themselves
> trigger the `pull_request` workflows in `ci.yml`. The release PR only bumps versions and the
> CHANGELOG, so this is low-risk; if you want full CI on release PRs, supply a PAT as the
> action's `token`.

To start a release manually (instead of waiting for the next push), re-run the **Release**
workflow from the Actions tab.

## What CI guarantees

| Workflow            | Gate                                                                            |
| ------------------- | ------------------------------------------------------------------------------- |
| `ci.yml` → validate | Manifests are valid JSON, versions agree, every referenced command/skill exists |
| `ci.yml` → check    | Prettier + markdownlint clean                                                   |
| `ci.yml` → audit    | No moderate-or-higher dependency advisories                                     |
| `link-check.yml`    | All markdown links resolve (weekly cron opens an issue on rot)                  |
| `release.yml`       | Maintains the release PR; tags + cuts the GitHub Release on merge               |

If you add a new check, wire it into both the relevant `package.json` script and `ci.yml` so
local and CI stay in sync.
