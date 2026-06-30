---
name: detect
description: >-
  Probe a repo's tech stack and produce .autopilot/profile.yml — the build/test/lint/audit commands,
  house conventions, CI setup, and available accelerators that autopilot's quality gate runs against.
  Use this when setting up an autopilot pipeline on a new repo, or when the user says "detect the
  stack", "figure out the build/test commands", "set up the autopilot profile", or the gate is running
  the wrong commands. Detects then ASKS THE USER TO CONFIRM, because a wrong test command would let a
  broken phase pass the gate. Works for any ecosystem (Node, Rust, Go, Python, Java/JVM, Make/just,
  monorepos). Trigger it right after autopilot:plan, before orchestrate.
---

# Detect

You build the stack profile the gate depends on. The gate is only as trustworthy as these commands, so
your job is two halves: **detect accurately**, then **make the user confirm**. Detection is a
convenience that gets them 90% there; the confirm step is the safety check that keeps the gate honest.
Never skip the confirm — an autonomous pipeline merging on a misdetected `test` command is the failure
mode this whole step exists to prevent.

## Detect

Probe the repo for the build system and derive candidate commands. Common signals:

| Signal file                           | Ecosystem | Likely commands                                                                                        |
| ------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| `Makefile` / `justfile`               | any       | **prefer these** — read the targets; `make build/test/lint/format-check/audit`                         |
| `package.json`                        | Node/TS   | read `scripts`: build/test/lint; pkg mgr from lockfile (pnpm/npm/yarn/bun)                             |
| `Cargo.toml`                          | Rust      | `cargo build`, `cargo nextest run` or `cargo test`, `cargo clippy`, `cargo fmt --check`, `cargo audit` |
| `go.mod`                              | Go        | `go build ./...`, `go test ./...`, `golangci-lint run`, `gofmt -l`                                     |
| `pyproject.toml`/`setup.py`/`tox.ini` | Python    | `pytest`, `ruff`/`flake8`, `black --check`, `mypy`                                                     |
| `pom.xml` / `build.gradle`            | JVM       | `mvn -q verify`/`gradle build`, `... test`, spotless/checkstyle                                        |

Prefer a project's own task runner (Make/just/npm scripts) over raw tool invocations — it encodes the
flags the project actually wants and stays correct as the project evolves. In a monorepo, detect the
per-package or workspace-aware commands (e.g. `pnpm -r test`, `cargo` workspace, Nx/Turbo targets).

Also detect:

- **Integration tests** — a separate target/tag (`test-integration`, build tags, a compose file) and
  whatever brings their infra up (`infra_up`: `docker compose up -d`, `make docker-up`).
- **Frontend tests** — only if there's a separate UI package.
- **CI** — for `pr_ci` mode, it is not enough that `.github/workflows/` exists; CI must actually fire on
  PRs **targeting `base`**. Read each workflow's `on:` triggers and classify base coverage into one of:
  - **covered** — an `on: pull_request` with no `branches:` filter, or one whose filter includes `base`.
  - **trunk-only** — triggers are scoped to `trunk` (e.g. `pull_request: branches: [main]`, or `push`-only).
    A phase PR into `base` would run NOTHING, so "all checks green" is vacuously true — the silent
    self-certification this whole design forbids.
  - **none** — no workflows at all.

  Record the verdict and the required check names (if discoverable) under `ci:`. Only **covered** is safe
  for `pr_ci`; **trunk-only** and **none** trigger the remediation step below.

- **Design corpus** — discover where the authoritative docs live and record them in `references:`
  (prd, plan, adr_dir, ddd_dir, extra). Look for `docs/specs`, `docs/architecture/adr`,
  `docs/architecture/ddd`, `docs/prd`/`PRD*`, RFCs, threat models. These let `plan` decompose with full
  context and let each phase read only its slice. Leave empty what doesn't exist.
- **Accelerators** — two classes, same contract (record availability → drive when present → degrade
  to a floor when absent):
  - **Execution** (`ruflo`, `agentic-qe`) — probe BOTH scopes: global (`ruflo`/`aqe` on PATH) and
    project (a `.ruflo/` directory, an `aqe init` footprint, project `.claude/` config). Set
    `accelerators.<tool>.available` and `scope` ("global"/"project"). When present, autopilot drives
    them (ruflo recall+swarms, aqe fleet) — see run-phase `references/accelerators.md`. Absence just
    means the gate uses its Tier-3 floor (reviewer subagent + /code-review) and you implement with
    focused subagents.
  - **Planning** (`superpowers`/brainstorming, `clarity`, `deep-research`) — these are Claude Code
    **skills**, not on PATH. Note their availability from the **active skill set** (what you, the
    running agent, can invoke), optionally corroborated by a `~/.claude/plugins` install footprint.
    Set `accelerators.<tool>.available` with `scope: "skill"`. When present, `plan` uses them to score
    spec readiness and enrich a thin spec; absence degrades to inline brainstorm/rubric. Never a gate
    failure.
  - Always check `/code-review` (the Tier-3 floor, assumed present).
- **Conventions** — skim a few representative source files and summarize the house style (layering,
  naming, where tests live) into `conventions:` so new code matches.

## Concrete probes (run these)

Detection is real and scriptable — run these and read the results, don't guess:

```bash
# Build system / commands
ls Makefile justfile package.json Cargo.toml go.mod pyproject.toml pom.xml build.gradle 2>/dev/null
[ -f Makefile ] && grep -E '^[a-zA-Z0-9_-]+:' Makefile | sed 's/:.*//'   # available make targets
[ -f package.json ] && node -e "console.log(Object.keys(require('./package.json').scripts||{}))"

# Design corpus
ls -d docs/specs docs/prd docs/architecture/adr docs/architecture/ddd 2>/dev/null
find docs -maxdepth 3 -iregex '.*\(adr\|ddd\|prd\|spec\|rfc\|threat\).*' -type f 2>/dev/null | head -40

# Execution accelerators — global (PATH) and project (footprint)
command -v ruflo aqe 2>/dev/null                          # global scope
ls -d .ruflo .agentic-qe .claude 2>/dev/null              # project scope
ruflo --version 2>/dev/null; aqe --version 2>/dev/null

# Planning accelerators are SKILLS, not on PATH — judge availability from your own active skill set
# (can you invoke `superpowers:brainstorming`, `clarity`, `deep-research`?). Optional footprint check:
ls -d ~/.claude/plugins 2>/dev/null && ls ~/.claude/plugins 2>/dev/null | grep -Ei 'superpower|clarity|deep-research'

# CI (pr_ci mode needs this) — does anything run on PRs into <base>?
ls .github/workflows/*.yml .github/workflows/*.yaml 2>/dev/null && gh auth status 2>&1 | head -3
# Inspect triggers: an unfiltered `pull_request` covers any base; a `branches:` filter must list <base>.
grep -nE 'pull_request|push|branches' .github/workflows/*.y*ml 2>/dev/null
```

Read the `on:` block, don't just grep for the words — a `pull_request:` with a `branches:` filter that
omits `<base>` is **trunk-only**, not covered.

Map results into `profile.yml`: a found `make test` target → `commands.test: "make test"`; `ruflo` on
PATH → `accelerators.ruflo: { available: true, scope: "global" }`; a `.ruflo/` dir → `scope: "project"`;
a `clarity` skill you can invoke → `accelerators.clarity: { available: true, scope: "skill" }` (same
for `superpowers`/`deep_research`); found ADR/DDD dirs → `pipeline.references.adr_dir/ddd_dir`. So yes:
**`autopilot:detect` (or
`/autopilot-detect`, or `/autopilot-init` which also plans) is the single skill/command that discovers
all of this and crafts both `.autopilot/` files for you** — you only confirm.

## Confirm

Present the proposed `profile.yml` to the user as a short table — command name → detected value — and
explicitly ask them to confirm or correct each, especially `test`, `build`, and `lint`. Call out any
you couldn't detect (left empty = skipped) and ask whether that's intended. Use the AskUserQuestion
tool for the high-stakes ones if it helps them react quickly. Only write the file after they've signed
off.

## Remediate missing base CI (pr_ci only)

Only runs when `autonomy: pr_ci` AND base coverage came back **trunk-only** or **none**. `reviewed` mode
uses the local gate as authority, so it needs nothing here. When the gap exists, **stop and tell the user
in plain words** — never silently proceed into a mode whose merge authority won't run. Assume the reader
may be new to CI; lead with the consequence, not the jargon.

Say it like this (adapt the specifics):

> ⚠️ **Autonomous (`pr_ci`) mode needs GitHub to run your tests on each phase's pull request — and right
> now it won't.** {none → "This repo has no GitHub Actions workflow at all." | trunk-only → "Your CI only
> runs on `main`, but autopilot opens phase PRs into `<base>`, so nothing would test them."} Without that,
> autopilot can't trust a PR enough to merge it. Here's how to fix it — pick one:

Then offer the choice with **AskUserQuestion**, using these plain labels (recommended first):

1. **"Set up CI for me (recommended)"** — Scaffold `.github/workflows/autopilot-gate.yml` from
   `templates/ci-gate.yml.tmpl`, resolving `{{commands.*}}` from the profile and `{{pipeline.base}}` as the
   PR target. It builds real, base-scoped CI from the commands the user just confirmed — nothing
   stack-specific is invented. Commit it on its own branch/commit so they can read it first. **Then tell
   them the one thing they must do:** "I've added the workflow, but I left the toolchain setup blank
   because I can't know your language — open `.github/workflows/autopilot-gate.yml` and add your setup step
   (e.g. `actions/setup-node`), or tell me your language and I'll fill it in."
2. **"Add my base branch to the existing CI"** — Only offer for **trunk-only**: add `<base>` to the
   workflow's `pull_request.branches` filter (a one-line edit). Show the exact diff and ask before saving.
3. **"Just review each phase yourself (no CI needed)"** — Switch `autonomy: reviewed` in `pipeline.yml`.
   Zero touch to `.github/`; the local gate becomes the authority and the user inspects each phase. The
   safe fallback if they don't want autopilot writing CI.

After acting, state the result and the next command in one line (e.g. "✅ CI workflow added on branch
`add-autopilot-ci` — review it, merge it, then run `/autopilot-run`."). Do NOT leave `pr_ci` selected with
**none**/**trunk-only** coverage unremediated: the orchestrate STEP D guard will refuse to merge a
check-less PR, so the loop would just stall at phase 0. Resolving it here is the difference between "it
works" and "it silently does nothing."

## Write

Write `.autopilot/profile.yml` from `templates/profile.yml` with the confirmed values. Empty commands
are legitimately skipped by the gate (and reported as skipped, never as passes). Ensure the queued-plan
directory is git-ignored so parked follow-up pipelines stay local until promoted (idempotent, harmless
if `plan` already added it):
`grep -qxF '.autopilot/queued/' .gitignore 2>/dev/null || echo '.autopilot/queued/' >> .gitignore`.
Then tell the user the pipeline is ready — `autopilot:orchestrate` (or `/autopilot-run`) will drive it.

> **Note (pr_ci base lifecycle).** In `pr_ci` mode, if GitHub deletes `base` after the integration PR
> merges ("auto-delete head branch"), `orchestrate` recreates it from refreshed `trunk` and re-pushes it
> as a new branch — so your base-coverage verdict above still governs the recreated branch. That's a
> runtime concern handled in `orchestrate/references/mode-pr-ci.md`; nothing to configure here.

## Why detect-then-confirm beats either extreme

Pure auto-detection is fast but a silent misdetection corrupts every future gate. A hand-written
manifest is reliable but tedious and easy to get wrong without knowing the project's conventions.
Detect-then-confirm gives the user a correct-by-default draft they only have to _check_, which is both
faster and safer than writing it from scratch.
