# Contributing to claude-autopilot

This repo **is a Claude Code marketplace** that ships one plugin, `autopilot`. There is no
application code or runtime — the deliverable is **prompt content**: skill `SKILL.md` files,
slash-command `.md` files, and the YAML/markdown templates scaffolded into a user's repo.
"Correctness" means the instructions are unambiguous, the design invariants hold, and the
manifests stay valid.

For the design rationale, read [`README.md`](README.md), [`plugins/autopilot/README.md`](plugins/autopilot/README.md),
and [`CLAUDE.md`](CLAUDE.md). Maintainers cutting a release should read [`docs/maintainers.md`](docs/maintainers.md).

## Repository layout

```
.claude-plugin/marketplace.json        # marketplace manifest (this repo is its own marketplace)
plugins/autopilot/
  .claude-plugin/plugin.json           # plugin manifest (name, version, keywords)
  commands/autopilot-*.md              # thin slash-command wrappers
  skills/{plan,detect,run-phase,orchestrate}/SKILL.md   # the real logic
  templates/                           # scaffolded verbatim into a target repo's .autopilot/
docs/                                  # user-facing guides
scripts/validate-manifests.mjs         # structural-invariant checker (runs in CI)
```

## The invariants — do not break these

These are the load-bearing ideas of the design. An edit that weakens one is a bug:

1. **Git markers are the durable state.** "What's next" is re-derived from the repo, never
   from conversation memory. One phase per fresh context.
2. **The agent never self-certifies.** Advancement is gated on machine-verified checks; a
   skipped check is reported as skipped, never as a pass.
3. **In `pr_ci` mode, GitHub CI is the merge authority** — not the local gate.
4. **Nothing stack-specific is hard-coded.** Build/test/lint/audit commands come from the
   target repo's `.autopilot/profile.yml`.
5. **`trunk` (default `main`) is never merged autonomously** — a human merges the final PR.
6. **Accelerators are optional** and must degrade gracefully when absent.

## Authoring conventions

- Skills use standard frontmatter (`name`, `description`) + a markdown body. The `name` must
  match the directory; keep the `description` trigger conditions precise.
- Keep skill bodies lean; push detail into `references/` and load on demand.
- Slash commands stay thin — delegate to the skill, don't duplicate its logic.
- Templates are copied verbatim into a user's repo; keep `{{...}}` placeholders and comments
  self-explanatory.
- Match the voice already in the skills: imperative, concrete, no filler.

## Local checks

Install dev dependencies once, then run the checks before opening a PR:

```bash
pnpm install
pnpm run check        # validate manifests + Prettier + markdownlint
pnpm run fix          # auto-fix formatting and lint issues
pnpm run link-check   # verify markdown links resolve (needs network)
```

`pnpm run validate` runs the manifest checker on its own (plain Node, no install needed). It
enforces: valid JSON manifests, agreeing versions, every README-referenced command exists,
and every skill directory has a `SKILL.md` whose frontmatter `name` matches the directory.
`pnpm run proof` runs `scripts/verify-ready-set.mjs`, an executable proof of the dependency-aware
ready-set (ADR-0001); both run inside `pnpm run check`.

CI runs the same checks on every pull request — `validate`, `check`, a security `audit`, and a
markdown link check.

## Pull requests

1. Fork and branch from `main` (never commit to `main` directly).
2. Make your change and run `pnpm run check` (and `pnpm run fix` if needed).
3. Open a PR with a clear description and link any related issues.

### Commit / PR titles drive the changelog

`CHANGELOG.md` and version bumps are generated automatically by
[release-please](https://github.com/googleapis/release-please) — **don't edit the changelog or
bump versions by hand.** It reads [Conventional Commit](https://www.conventionalcommits.org/)
messages, and since PRs are squash-merged, **your PR title becomes that commit**, so it must
follow the convention:

| Prefix                                  | Use for                          | Version effect (pre-1.0) |
| --------------------------------------- | -------------------------------- | ------------------------ |
| `feat:`                                 | a new skill, command, capability | minor bump               |
| `fix:`                                  | a bug or wording/clarity fix     | patch bump               |
| `docs:`, `chore:`, `ci:`, `refactor:`   | non-shipping changes             | no release               |
| `feat!:` or a `BREAKING CHANGE:` footer | a breaking change                | minor bump while pre-1.0 |

Example PR titles: `feat: add a verify skill`, `fix(detect): handle missing package.json`,
`docs: clarify the pr_ci handoff`.

See [`docs/maintainers.md`](docs/maintainers.md) for how a release is actually cut.
