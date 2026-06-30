# autopilot — design notes

autopilot's core idea is to turn **the plan and the stack-specific commands into data**, so the same
pipeline machinery runs unchanged on any repo. Nothing about a given language or framework is baked
into the plugin; it all lives in two files in the target repo's `.autopilot/` directory.

## The abstraction boundary

Everything stack-specific is externalized into the target repo's `.autopilot/` files. The plugin
itself stays neutral:

| Stack-specific concern                   | How autopilot externalizes it                              |
| ---------------------------------------- | ---------------------------------------------------------- |
| Build / test / lint commands in the gate | `{{commands.*}}` resolved from `profile.yml`               |
| Language/framework conventions           | `conventions:` free-text in `profile.yml`                  |
| The phase plan                           | generated `phases:` in `pipeline.yml`                      |
| Acceleration tooling                     | capability-detected accelerators; graceful Tier-3 fallback |
| Security invariants                      | `security_invariants:` list (universal defaults)           |

Everything else — git markers as durable state, one-phase-per-context, reviewed/pr_ci modes, the
fix-budget handoff, the final `base → trunk` PR — is stack-neutral by design.

## Durable state & replay

Two artifacts make a run reconstructable from the repo alone, both scoped by `feature_id` (a slug in
`pipeline.yml`) so repeated runs in one repo never collide:

- **Git `gate PASSED` markers** — `(autopilot:<feature_id>): phase N complete — gate PASSED` commits.
  The **authority** for "what phase is next," re-derived by grep every firing. Scoping by `feature_id`
  fixes the multi-run hazard where a second feature's marker grep would otherwise match the first's.
- **Session ledger** — `.autopilot/runs/<feature_id>.jsonl`. Its first line is a plan snapshot (written
  by `plan`, so the history stays interpretable even after `pipeline.yml` is overwritten by the next
  feature); every line after is one firing (phase, verdict, skipped checks, ci_attempts, PR,
  accelerators, timestamp), committed alongside the marker. It's the replayable audit trail — including
  FAILED attempts, which never leave a marker — and it works on a vanilla repo with no ruflo.
  `/autopilot-status` reads it; ruflo memory, when present, is an optional richer layer on top, never a
  requirement.

## The four skills

| Skill         | Job                                           |
| ------------- | --------------------------------------------- |
| `plan`        | spec → phases with machine-checkable DoD      |
| `detect`      | probe stack → confirm → `profile.yml`         |
| `run-phase`   | implement one phase + run the gate, then stop |
| `orchestrate` | the long-horizon loop (reviewed / pr_ci)      |

`run-phase` and `orchestrate` use progressive disclosure: the SKILL.md holds the discipline, and the
details (full gate tiers, each mode's playbook) live in `references/` loaded only when needed — so a
firing reads only what that step requires, mirroring the runtime memory contract.

## Why the gate is the strict part

Autopilot can be left unattended only because advancement is gated on **machine-verified** checks, not
the agent's self-assessment. Two rules make this safe:

1. A skipped check is reported as _skipped_, never as a pass.
2. A red gate is never waved through — the phase doesn't advance.

In `pr_ci` mode the merge authority moves one step further out: required GitHub CI checks, not the local
gate, decide a merge. The agent diagnoses and fixes within a bounded `fix_budget`, then hands off.

This only works if CI actually runs on the phase PRs. `detect` verifies that the repo's CI fires on PRs
into `base` and — if it's missing (no workflow, or one scoped only to `trunk`) — offers to scaffold a
base-targeted gate workflow from the detected commands, or to fall back to `reviewed` mode. As a backstop,
the loop treats a PR with **zero** required checks as _skipped_, never green: it refuses to merge and
hands off. A check-less merge would be self-certification, which rule 1 above forbids.

## Accelerators are optional by design

Two classes share one contract — detected when present, driven at the right step, degraded to a vanilla
floor when absent (absence never blocks a phase):

- **Execution** — `ruflo` (swarm + cross-session memory) and `agentic-qe` (mutation/pentest/chaos/
  coverage) make phases faster and the heavy `risk_phases` passes possible. Floor: a reviewer subagent
  plus `/code-review` + native coverage.
- **Planning** — the `superpowers:brainstorming`, `clarity`, and `deep-research` skills sharpen a thin
  spec before it's decomposed (`plan` step 1.5: score readiness → cited research → testable
  requirements). Floor: inline brainstorm/rubric.

This is what lets the plugin run on a vanilla repo with nothing but Claude Code, git, and `gh`.
