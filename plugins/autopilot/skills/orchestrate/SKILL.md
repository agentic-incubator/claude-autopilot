---
name: orchestrate
description: >-
  Drive an entire multi-phase autopilot feature to completion across many fresh contexts — the
  long-horizon outer loop that wraps run-phase. Use this when the user wants to run a whole feature
  pipeline unattended: "run the autopilot pipeline", "drive all the phases", "ship this feature
  autonomously", "kick off the remediation loop", or when re-firing a /loop that names this skill.
  Discovers which phase is next from git markers (no conversation memory needed, so it's resumable
  forever), runs one phase per firing, and in pr_ci mode branches -> opens a PR -> watches GitHub CI ->
  runs a bounded fix-loop -> squash-merges into the integration branch. Stack-agnostic; the only hard
  dependency is a GitHub repo whose CI runs on PRs into the base branch (autopilot:detect verifies this
  and scaffolds a gate workflow if it is missing). Trigger it whenever a repo has .autopilot/pipeline.yml and the
  user wants progress without babysitting.
---

# Orchestrate

You are the outer driver for a feature pipeline. `run-phase` does one phase; you decide **which** phase
runs, drive it to a durable resting point, and stop so the next firing picks up from there. Drive it
with the `/loop` skill in self-paced mode (no interval) so each firing gets a clean context — that's
what makes a 10-phase, multi-week feature finish without any single conversation holding it all.

You operate in one of two modes, set by `autonomy:` in `.autopilot/pipeline.yml`:

- **reviewed** — run one phase locally, land a `gate PASSED` marker, STOP for human inspection between
  phases. Lowest blast radius; a human sees every phase.
- **pr_ci** — fire-and-forget. Each phase ships as a branch → PR → green CI → squash-merge into the
  integration `base` branch. `trunk` is never merged autonomously; when all phases land you open one
  `base → trunk` PR and stop for a human decision.

Read the matching playbook in full before acting:

- reviewed → `references/mode-reviewed.md` (**always serial** — one phase per firing, regardless of
  `max_parallel`)
- pr_ci, `max_parallel: 1` (default) → `references/mode-pr-ci.md`
- pr_ci, `max_parallel > 1` → `references/mode-pr-ci-parallel.md` — keep several **independent** ready
  units in flight at once (each in its own git worktree + phase branch), but land every merge through a
  **single serialized, re-gated queue** so a stale-base conflict can never merge. Governed by
  `docs/adr/0002-parallel-ready-units-merge-queue.md`. `max_parallel: 1` collapses this to `mode-pr-ci.md`
  exactly, so parallelism is strictly opt-in.

All modes share the state model and invariants below.

## State lives outside the conversation

Never assume progress from memory — re-derive it every firing. This is why the loop survives context
resets, interruptions, and weeks of wall-clock:

| Tier                  | Holds                                      | Mechanism                                                                            |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------ |
| Durable               | which phase is done (authority)            | feature-scoped git `gate PASSED` markers — `(autopilot:<feature_id>): …`             |
| Durable               | replayable per-firing history              | `.autopilot/runs/<feature_id>.jsonl` session ledger (committed; works with no ruflo) |
| Durable               | decisions, gotchas (optional)              | ruflo memory `autopilot` namespace, if available                                     |
| Per-phase working set | the active phase's slice + its conventions | read on demand at phase start, discarded after                                       |
| Ephemeral             | one subagent's task                        | compact SendMessage results, never file dumps                                        |

Markers are the **authority** for "what phase is next"; the ledger is the human-readable audit trail of
how each phase got there. Both are scoped by `feature_id` so multiple features in one repo never
collide.

The load-bearing rule: **never load all phase _bodies_.** Each firing reads the top of `pipeline.yml`,
the cheap `(id, depends_on)` skeleton of every phase (needed to compute the ready-set — ids and edges
only, not goals/deliverables/DoD), plus the full entry for **only the current phase**. The durable tier
carries everything else as compact summaries.

## Every firing

1. **Locate state and pick the ready phase (read-only, cheap).** Read `feature_id` from `pipeline.yml`.
   In pr_ci mode ensure `base` exists and is current first (see the playbook). Then derive the target
   from the **dependency-aware ready-set** (the git-native work graph — see
   `docs/adr/0001-dependency-aware-work-graph-beads-ruflo.md`):
   - **Done-set** — grep markers **scoped to this feature** for _every_ PASSED phase (not just the
     highest): `git log --oneline | grep -E "\(autopilot:<feature_id>\): phase .* gate PASSED"`.
   - **Ready-set** — read only the cheap `(id, depends_on)` skeleton of the `phases:` list (NOT the
     phase bodies — that preserves the memory contract). A phase is **ready** when it has no PASSED
     marker AND every id in its `depends_on` is in the done-set. **Target N = the lowest-id ready phase.**
     - Empty `depends_on` on every phase ⇒ the ready-set is "all un-done phases" and lowest-id selection
       yields N = P+1 — **identical to a flat linear pipeline**. The graph only changes selection once
       deps are declared (then a later-id phase may run before an earlier one still blocked).
     - If `accelerators.beads` is set, `bd ready` should agree — use it as a cross-check/visualization,
       never as the authority. Reconcile **one way: sync bead status _from_ the markers**, never the
       reverse. Git markers decide.
     - In pr_ci **parallel** mode (`max_parallel > 1`) also subtract the **in-flight** set — the phase
       branches already claimed on origin (`git ls-remote --heads origin "autopilot/<feature_id>/phase-*"`)
       — and dispatch up to `max_parallel` ready units this firing instead of one. The parallel playbook
       (`references/mode-pr-ci-parallel.md`) owns that; here just know the ready-set is the same set minus
       what's already claimed.
   - **Termination / deadlock** — ready-set empty AND every phase PASSED (and, in parallel, nothing
     in-flight) → optimization pass (see playbook), then end the loop. Ready-set empty with un-done phases
     remaining and nothing in flight means a `depends_on` cycle or an unsatisfiable dependency: **stop and
     report it — never spin.**
2. **Resume check.** Before starting fresh, look for in-flight work for phase N (an open PR, a pushed
   branch, a half-done local tree) and resume it rather than restarting. The playbooks enumerate the
   exact interruption windows to check — covering them is what makes re-firing safe.
3. **Delegate the phase to `run-phase`** for target N, obeying its gate verbatim. Don't reimplement the
   gate here; `run-phase` is the single source of truth for what "done" means.
4. **Advance or hand off** per mode. `run-phase` already appended the firing's ledger line and (on
   PASS) the scoped marker; persist a compact summary, and STOP (or, in pr_ci, background the CI wait so
   you idle without burning tokens until checks finish).

## Invariants (all modes)

- **One phase per firing per lane.** In serial modes (reviewed, or pr_ci `max_parallel: 1`) that means
  one phase, full stop — never start phase N+1 in the firing that completed N. In pr_ci parallel
  (`max_parallel > 1`) it means one unit **per slot**, up to `max_parallel` concurrent slots — but a
  firing still never grinds one slot's phase into the next; each slot is its own fresh-context unit, and
  **merges are always serialized** (one at a time through the queue). Grinding phases into one context
  defeats the memory design.
- A phase advances **only** on a real green gate (reviewed) or green required CI checks (pr_ci). No
  skipped/ignored tests to force a pass. In parallel mode the merging unit is additionally **re-gated
  against the current `base`** before it lands (rebase → CI re-run → merge) — a green-against-stale-base
  result never merges.
- `trunk` is **never** merged autonomously — a human merges the final integration PR.
- **Never force-push** to `base` or `trunk`. Fix-loops and rebases push only to a **phase branch**
  (parallel mode may `--force-with-lease` a phase branch to land a rebase; `base`/`trunk` never).
- A merge conflict is **never hand-resolved** under autonomy — it re-queues the unit for a fresh
  re-implementation against the advanced base, and escalates to a human after `K = 2` conflict-requeues
  (pr_ci parallel only).
- The agent never self-certifies: in pr*ci, remote CI is the merge authority — and a PR that ran ZERO
  required checks is \_skipped*, never green. Never merge a check-less PR (that is self-certification by
  another name). Base CI coverage is a hard prereq for exactly this reason.
- Load only the current phase's slice; the durable tier carries the rest.

## Termination

The loop ends — omit the next `/loop` wakeup — only when every phase carries a `gate PASSED` marker, the
optimization pass is done, and (pr_ci) the `base → trunk` integration PR is open for human review. A
goal-driven loop, not a fixed count: it stops because the goal state is reached.

When you stop, if any **queued** plans are parked (`.autopilot/queued/*.pipeline.yml`), don't start
them — name the exact promote command (`docs/lifecycle.md`) so the human kicks off the next lineage
deliberately. One active pipeline at a time; promotion is never automatic.

Pick your mode, read its playbook, and drive exactly one phase.
