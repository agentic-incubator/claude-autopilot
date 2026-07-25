# AGENTS.md

Instructions for AI coding agents (OpenAI Codex, and any tool that reads the
[AGENTS.md](https://agents.md) convention) working in this repository.

**The canonical agent instructions live in [`CLAUDE.md`](CLAUDE.md).** Read that file first —
everything below is a summary; where they disagree, `CLAUDE.md` wins.

## What this repo is

A **Claude Code plugin marketplace** that ships one plugin, `autopilot` — an autonomous,
stack-agnostic feature pipeline. There is **no application code, build step, or test runner**.
The deliverable is prompt content: skill `SKILL.md` files, slash-command `.md` files, and
YAML/markdown templates under `plugins/autopilot/`.

## Working here

- Read `CLAUDE.md` for the repository layout, the four skills, and the design invariants
  that must not be weakened by edits.
- Validate locally before committing (Node ≥ 22, pnpm):

  ```bash
  pnpm install
  pnpm run check   # validate manifests + behavioral proofs + prettier + markdownlint
  ```

- Versioning and `CHANGELOG.md` are automated by release-please — never hand-bump versions
  or edit the changelog. PRs are squash-merged; the PR title must be a Conventional Commit
  (see `CONTRIBUTING.md` and `docs/maintainers.md`).
- Branch before committing; never commit directly to `main` and never push without an
  explicit request.
