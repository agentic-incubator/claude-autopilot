---
name: run-phase
description: >-
  Implement exactly ONE phase of an autopilot feature pipeline and run its blocking quality gate,
  then STOP. Use this whenever you're driving a phased feature build defined in .autopilot/pipeline.yml
  — when the user says "run the next phase", "do phase N", "implement and gate this phase", or when the
  orchestrate loop delegates a single phase to you. Reads the phase slice + stack profile, implements
  with TDD, runs the gate (build/lint/test/security/DoD), and only commits a `gate PASSED` marker if
  every applicable check is green. Works for any language or framework because all stack-specific
  commands come from the profile, not this skill. Trigger it even if the user just names a phase
  number in a repo that has an .autopilot/ directory.
---

# Run Phase

You implement **one** phase of a feature pipeline, prove it with a quality gate, mark it done, and
stop. The next phase is someone else's run — keeping each phase in its own fresh context is what lets
arbitrarily large features finish without one conversation holding all the state.

The discipline below is deliberately strict in one place only: **the gate**. A phase advances solely
on real, green, machine-verified checks. Everything that makes autopilot safe to leave unattended
depends on that gate being honest, so never skip a check to force a pass and never trust your own
"looks done" — the commands are the verifier.

## Inputs (read these first, nothing else)

Load only what this phase needs — that's the memory contract that keeps long pipelines cheap:

1. `.autopilot/pipeline.yml` → read the top block (feature_id, goal, branches, autonomy, risk_phases)
   and **only
   the `phases:` entry for the target phase** (its goal, deliverables, definition_of_done, conventions).
   Do not read other phases' detail.
2. `.autopilot/profile.yml` → the commands, conventions, security invariants, and accelerator flags.
3. The spec section relevant to this phase (from `pipeline.goal`/`spec`), and the exemplar files named
   in `profile.conventions` so new code matches the house style.
4. **The design-corpus slice for this phase** — read only what this phase names, not the whole corpus:
   - the phase's `adrs:` from `pipeline.references.adr_dir` (the decisions this phase must honor),
   - the phase's `ddd:` aggregates from `pipeline.references.ddd_dir` (the domain model + ubiquitous
     language to use in names and boundaries),
   - the relevant section of `pipeline.references.prd` (acceptance intent) and any `extra:` doc the
     phase touches.
   This is the comprehension contract: a phase honors the ADRs/domain model it's scoped to, and reads
   only those slices so context stays small. If a phase names no slices, fall back to the spec section.

If `.autopilot/` is missing, the pipeline was never initialized — tell the user to run
`autopilot:plan` + `autopilot:detect` (or `/autopilot-init`) and stop.

## Which phase?

Determine the target phase in this order:
- Explicitly given (user said "phase 3", or the orchestrator passed one) → use it.
- Otherwise discover from git markers **scoped to this feature** (`feature_id` from `pipeline.yml`):
  the highest `feat(autopilot:<feature_id>): phase <N> complete — gate PASSED` commit is the last done
  phase; target = N+1. None found → phase 0.
  `git log --oneline | grep -E "\(autopilot:<feature_id>\): phase .* gate PASSED"`. Scoping by
  `feature_id` is what lets several features run in one repo without one's markers being mistaken for
  another's.

Refuse to start phase N (N>0) until phase N-1's `gate PASSED` marker exists, and honor any
`depends_on:` in the phase entry. Out-of-order phases break the resumability guarantee.

## Step 1 — Orient & resume (read-only)

Grep the repo for this phase's deliverables and build an **exists-vs-required** checklist. Only the
missing or incomplete work is in scope — re-running a half-finished phase must continue, not restart.
If accelerators.ruflo is available, recall prior decisions:
`ruflo memory search -q "autopilot phase <N>" --smart -n autopilot`.

## Step 1.5 — Stand up accelerators (only if present)

Check `profile.accelerators`. When `ruflo.available`, drive it rather than working solo: recall prior
decisions from memory, init a swarm, and spawn the right specialist agents for this phase. When
`agentic_qe.available`, init the QE fleet once so its checks are ready for the gate. When both are
absent, you do the work directly with focused subagents — that's the supported baseline, not a
degraded mode. The exact commands and the step-by-step mapping live in `references/accelerators.md` —
read it whenever either flag is true.

## Step 2 — Plan

If the phase has genuine design ambiguity, brainstorm first (use `superpowers:brainstorming`) — cheap
insurance against building the wrong thing under autonomy. Write a todo per deliverable / per DoD line.
Match `profile.conventions` exactly: new code should be indistinguishable from what's already there.
The plan must trace to the comprehension slice from the Inputs: every ADR constraint honored, domain
names taken from the DDD aggregates, acceptance intent from the PRD reflected in the DoD.

## Step 3 — Implement (TDD)

For each todo: RED (write the failing test that pins the behavior) → GREEN (minimal code) → REFACTOR.
TDD isn't ceremony here — under autonomous merge, the tests ARE the spec the gate enforces, so weak or
absent tests mean wrong merges. Seed edge/boundary cases deliberately (if agentic-qe is available, use
its test architect to generate the cases a human would forget).

Honor every `security_invariants:` line as you write, not just at the gate. If the work is naturally
parallel (e.g. several independent modules) and accelerators.ruflo is available, fan out subagents that
report **compact** results (decisions + file paths + test names), never file dumps — compact reporting
is what keeps the context small.

Commit frequently with clear messages so any interruption is recoverable from git — scope the type to
this feature: `feat(autopilot:<feature_id>): <deliverable>` for finished units,
`wip(autopilot:<feature_id>): <what>` for checkpoints.

## Step 4 — Integrate

Wire new modules into the project's module graph / DI / routes / job registry as the phase requires.
The build command must succeed before the gate runs.

## Step 5 — The gate (blocking)

Render `templates/gate.md.tmpl` with this phase + the profile, then run it top to bottom, pasting the
**actual output** of each command. See `references/gate.md` for the full tier breakdown and how to
handle skipped checks. In short: Tier 1 functional + Tier 2 DoD + Tier 3 adversarial review run every
phase; Tier 4 heavy passes run only when the phase id is in `risk_phases` AND the accelerator exists.

Aggregate into one verdict:
- **PASS** (every applicable check green) → Step 6.
- **FAIL** → report exactly which check failed with its output, leave the work uncommitted (or as-is on
  the branch), persist the blocker if ruflo is available, **append a `"verdict":"FAILED"` ledger line**
  (schema in `references/gate.md`), and STOP. The next run resumes at Step 1.

## Step 6 — Mark done, log the session & STOP

On PASS:
- Append one line to `.autopilot/runs/<feature_id>.jsonl` — the session ledger (schema + field meanings
  in `references/gate.md`). This is the replayable record of the run; it works with no ruflo installed.
- Commit `feat(autopilot:<feature_id>): phase <N> complete — gate PASSED`, **staging the new ledger line
  in the same commit** so marker and log are atomic (add a Co-Authored-By trailer only if the repo's
  `.claude/settings.json` enables attribution — don't add it by default).
- Persist a ≤12-line summary (what shipped · test counts · DoD evidence · gotchas for the next phase).
  With ruflo: `ruflo memory store -k autopilot-<feature_id>-phase-<N> --value "<summary>" -n autopilot`.
- Report the summary and STOP. Do **not** begin phase N+1 — that's the next run's job.

## Why "one phase, then stop" is non-negotiable

The whole system's resumability and memory-efficiency come from each phase being an isolated,
git-marked unit. Grinding multiple phases into one context defeats the design and is how long runs
drift and fail. One phase = one gate = one marker. End the turn.

For the precise gate checklist and edge cases, read `references/gate.md`.
