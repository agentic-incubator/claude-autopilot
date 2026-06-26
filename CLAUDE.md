# claude-autopilot

This repo **is a Claude Code marketplace** that ships one plugin, `autopilot`. There is no
application code, build step, or test runner — the deliverable is **prompt content**: skill
`SKILL.md` files, slash-command `.md` files, and YAML/markdown templates. "Correctness" here means
the instructions are unambiguous, the invariants below hold, and the manifests stay valid.

## What autopilot does

An autonomous, stack-agnostic feature pipeline. Given a feature goal + spec, it decomposes the work
into phases, implements each under a blocking quality gate (TDD), and ships them through
GitHub PR → CI → squash-merge — across many fresh contexts, resumable forever, for any tech stack.
Durable state lives in **git markers**, not the conversation. See `README.md` for the user-facing
overview and `plugins/autopilot/README.md` for the design rationale.

## Repository layout

```
.claude-plugin/marketplace.json        # marketplace manifest (this repo is its own marketplace)
plugins/autopilot/
  .claude-plugin/plugin.json           # plugin manifest (name, version, keywords)
  commands/autopilot-{init,plan,detect,run,status}.md   # thin slash-command wrappers
  skills/{plan,detect,run-phase,orchestrate}/SKILL.md   # the real logic
    run-phase/references/{gate,accelerators}.md          # progressive disclosure
    orchestrate/references/{mode-pr-ci,mode-reviewed}.md
  templates/{pipeline.yml,profile.yml,gate.md.tmpl}     # scaffolded into a target repo's .autopilot/
  templates/ci-gate.yml.tmpl                            # scaffolded to .github/workflows/ when base CI is missing
  docs/WORKFLOW.md
README.md   LICENSE (MIT)
```

Everything else in the working tree (`.claude/`, `.claude-flow/`, `.swarm/`, `.agentic-qe/`,
`.mcp.json`, `*.db`) is local tooling state and is git-ignored — **not** part of the plugin.

## The four skills

| Skill         | Job                                                               |
| ------------- | ----------------------------------------------------------------- |
| `plan`        | spec → phases, each with a machine-checkable Definition of Done   |
| `detect`      | probe the target stack → confirm → write `.autopilot/profile.yml` |
| `run-phase`   | implement one phase + run the gate, then stop                     |
| `orchestrate` | the long-horizon loop (`reviewed` / `pr_ci` modes)                |

Commands are thin wrappers; the logic lives in the skills so Claude can also invoke them
automatically when context fits. `run-phase` and `orchestrate` use progressive disclosure — the
`SKILL.md` holds the discipline, and `references/` files load only when that step needs them.

## Invariants — do not break these when editing

These are the load-bearing ideas of the design. Edits that weaken them are bugs:

1. **Git markers are the durable state.** "What's next" is re-derived from the repo (e.g.
   `grep "gate PASSED"`), never from conversation memory. One phase per fresh context.
2. **The agent never self-certifies.** Advancement is gated on machine-verified checks. A skipped
   check is reported as _skipped_, never as a pass; a red gate is never waved through.
3. **In `pr_ci` mode, GitHub CI is the merge authority** — not the local gate. The agent fixes within
   a bounded `fix_budget`, then hands off.
4. **Nothing stack-specific is hard-coded in the plugin.** Build/test/lint/audit commands,
   conventions, and CI come from the target repo's `.autopilot/profile.yml` (`{{commands.*}}`).
5. **`trunk` (default `main`) is never merged autonomously** — a human always merges the final
   integration PR.
6. **Accelerators are optional.** External tools that speed up phases must degrade gracefully; their
   absence never blocks a phase. The floor — a reviewer subagent plus `/code-review` — runs on a
   vanilla repo with nothing but Claude Code, git, and `gh`.

## Authoring conventions

- Skills follow the standard format: YAML frontmatter (`name`, `description`) + markdown body. Keep
  the trigger conditions in `description` precise — that text decides when the skill fires.
- Keep skill bodies lean; push detail into `references/` and load on demand (progressive disclosure).
- Slash commands stay thin — delegate to the skill, don't duplicate its logic.
- Templates are scaffolded verbatim into a user's `.autopilot/`; keep placeholders (`{{...}}`) and
  comments self-explanatory, since the user edits these by hand.
- Match the voice already in the skills: imperative, concrete, no filler.

## Validation

These checks are automated and run in CI on every PR (see `.github/workflows/`). Run them
locally before committing:

- `pnpm run validate` — `scripts/validate-manifests.mjs` (plain Node, no install) checks that
  the manifests are valid JSON, versions agree, every `README.md` command reference has a
  matching `commands/*.md`, and every `skills/*/` directory has a `SKILL.md` whose frontmatter
  `name` matches the directory and carries a `description`.
- `pnpm run check` — `validate` + Prettier + markdownlint.
- `pnpm run link-check` — verifies markdown links resolve (needs network).

Versioning and `CHANGELOG.md` are **automated** by release-please — do not hand-bump versions or
edit the changelog. Version bumps flow from Conventional Commit messages (and since PRs are
squash-merged, the PR title is what counts). See `docs/maintainers.md` for how releases are cut
and `CONTRIBUTING.md` for the commit-title convention.

## Git

- Branch before committing; never commit on `main` directly without being asked.
- Never auto-commit or push without an explicit request.
- Do not commit the git-ignored local-state directories listed above.
