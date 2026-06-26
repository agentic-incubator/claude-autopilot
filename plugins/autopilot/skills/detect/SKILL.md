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

| Signal file | Ecosystem | Likely commands |
|---|---|---|
| `Makefile` / `justfile` | any | **prefer these** — read the targets; `make build/test/lint/format-check/audit` |
| `package.json` | Node/TS | read `scripts`: build/test/lint; pkg mgr from lockfile (pnpm/npm/yarn/bun) |
| `Cargo.toml` | Rust | `cargo build`, `cargo nextest run` or `cargo test`, `cargo clippy`, `cargo fmt --check`, `cargo audit` |
| `go.mod` | Go | `go build ./...`, `go test ./...`, `golangci-lint run`, `gofmt -l` |
| `pyproject.toml`/`setup.py`/`tox.ini` | Python | `pytest`, `ruff`/`flake8`, `black --check`, `mypy` |
| `pom.xml` / `build.gradle` | JVM | `mvn -q verify`/`gradle build`, `... test`, spotless/checkstyle |

Prefer a project's own task runner (Make/just/npm scripts) over raw tool invocations — it encodes the
flags the project actually wants and stays correct as the project evolves. In a monorepo, detect the
per-package or workspace-aware commands (e.g. `pnpm -r test`, `cargo` workspace, Nx/Turbo targets).

Also detect:
- **Integration tests** — a separate target/tag (`test-integration`, build tags, a compose file) and
  whatever brings their infra up (`infra_up`: `docker compose up -d`, `make docker-up`).
- **Frontend tests** — only if there's a separate UI package.
- **CI** — confirm `.github/workflows/` exists and runs on the intended `base` branch (pr_ci needs
  this). Note the required check names if discoverable.
- **Design corpus** — discover where the authoritative docs live and record them in `references:`
  (prd, plan, adr_dir, ddd_dir, extra). Look for `docs/specs`, `docs/architecture/adr`,
  `docs/architecture/ddd`, `docs/prd`/`PRD*`, RFCs, threat models. These let `plan` decompose with full
  context and let each phase read only its slice. Leave empty what doesn't exist.
- **Accelerators** — probe BOTH scopes: global (`ruflo`/`aqe` on PATH) and project (a `.ruflo/`
  directory, an `aqe init` footprint, project `.claude/` config). Set `accelerators.<tool>.available`
  and `scope` ("global"/"project") accordingly, and check `/code-review`. When present, autopilot will
  actively drive them (ruflo recall+swarms, aqe fleet) — see run-phase `references/accelerators.md`.
  These are optional; absence just means the gate uses its Tier-3 floor (reviewer subagent +
  /code-review) and you implement with focused subagents.
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

# Accelerators — global (PATH) and project (footprint)
command -v ruflo aqe 2>/dev/null                          # global scope
ls -d .ruflo .agentic-qe .claude 2>/dev/null              # project scope
ruflo --version 2>/dev/null; aqe --version 2>/dev/null

# CI (pr_ci mode needs this)
ls .github/workflows/*.yml 2>/dev/null && gh auth status 2>&1 | head -3
```

Map results into `profile.yml`: a found `make test` target → `commands.test: "make test"`; `ruflo` on
PATH → `accelerators.ruflo: { available: true, scope: "global" }`; a `.ruflo/` dir → `scope: "project"`;
found ADR/DDD dirs → `pipeline.references.adr_dir/ddd_dir`. So yes: **`autopilot:detect` (or
`/autopilot-detect`, or `/autopilot-init` which also plans) is the single skill/command that discovers
all of this and crafts both `.autopilot/` files for you** — you only confirm.

## Confirm

Present the proposed `profile.yml` to the user as a short table — command name → detected value — and
explicitly ask them to confirm or correct each, especially `test`, `build`, and `lint`. Call out any
you couldn't detect (left empty = skipped) and ask whether that's intended. Use the AskUserQuestion
tool for the high-stakes ones if it helps them react quickly. Only write the file after they've signed
off.

## Write

Write `.autopilot/profile.yml` from `templates/profile.yml` with the confirmed values. Empty commands
are legitimately skipped by the gate (and reported as skipped, never as passes). Then tell the user the
pipeline is ready — `autopilot:orchestrate` (or `/autopilot-run`) will drive it.

## Why detect-then-confirm beats either extreme

Pure auto-detection is fast but a silent misdetection corrupts every future gate. A hand-written
manifest is reliable but tedious and easy to get wrong without knowing the project's conventions.
Detect-then-confirm gives the user a correct-by-default draft they only have to *check*, which is both
faster and safer than writing it from scratch.
