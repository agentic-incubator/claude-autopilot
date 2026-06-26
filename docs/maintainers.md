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

Semantic versioning, applied to the **plugin** (`autopilot`):

- **patch** (`0.4.0 → 0.4.1`) — wording fixes, clarifications, non-behavioral edits.
- **minor** (`0.4.0 → 0.5.0`) — new capability, new skill/command, or a behavior change that
  is backward compatible for existing users.
- **major** (`0.x → 1.0.0`, then `1.0.0 → 2.0.0`) — a breaking change to how a user invokes
  autopilot, to `.autopilot/` template structure, or to the documented invariants.

Two versions must always agree (CI enforces this):

- `plugins/autopilot/.claude-plugin/plugin.json` → `version`
- `.claude-plugin/marketplace.json` → `metadata.version`

## Release checklist

1. Ensure `main` is green and `pnpm run check:all` passes locally.
2. Bump the version in **both** manifests (`plugin.json` and `marketplace.json`) — keep them
   identical.
3. Move the `## [Unreleased]` notes in [`CHANGELOG.md`](../CHANGELOG.md) into a new
   `## [X.Y.Z] - <date>` section, and update the link references at the bottom of the file.
   Leave a fresh empty `## [Unreleased]` heading.
4. Commit on a branch, open a PR, and let CI run (`validate`, `check`, `audit`, link-check).
5. Squash-merge to `main`.
6. Tag the release and push the tag:

   ```bash
   git tag -a v0.5.0 -m "autopilot 0.5.0"
   git push origin v0.5.0
   ```

7. Create a GitHub Release for the tag, pasting that version's CHANGELOG section as the notes:

   ```bash
   gh release create v0.5.0 --title "v0.5.0" --notes-from-tag
   ```

   (`--notes-from-tag` reuses the annotated tag message; or use `--notes-file` with the
   extracted CHANGELOG section.)

Tags and GitHub Releases are for humans tracking what changed — Claude Code installs from
`main`, not from a tagged artifact, so the tag is documentation, not a delivery mechanism.

## What CI guarantees

| Workflow            | Gate                                                                            |
| ------------------- | ------------------------------------------------------------------------------- |
| `ci.yml` → validate | Manifests are valid JSON, versions agree, every referenced command/skill exists |
| `ci.yml` → check    | Prettier + markdownlint clean                                                   |
| `ci.yml` → audit    | No moderate-or-higher dependency advisories                                     |
| `link-check.yml`    | All markdown links resolve (weekly cron opens an issue on rot)                  |

If you add a new check, wire it into both the relevant `package.json` script and `ci.yml` so
local and CI stay in sync.
