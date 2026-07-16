# ADR-0002 — Parallel execution of ready units (merge-queue-gated, conflict-as-requeue)

| Field         | Value                                                        |
| ------------- | ------------------------------------------------------------ |
| **Status**    | Accepted                                                     |
| **Date**      | 2026-07-15 (proposed) · 2026-07-15 (accepted)                |
| **Deciders**  | autopilot maintainers                                        |
| **Governs**   | `skills/orchestrate`, `templates/pipeline.yml`, `pr_ci` mode |
| **Builds on** | [ADR-0001](0001-dependency-aware-work-graph-beads-ruflo.md)  |

## Context

[ADR-0001](0001-dependency-aware-work-graph-beads-ruflo.md) makes autopilot compute a **ready-set** —
the units whose `depends_on` are all gate-PASSED — but v1 deliberately runs **one phase per firing**,
selecting the lowest-id ready unit. On a wide multi-track feature the ready-set routinely holds several
independent units (e.g. `{1,3,5}` across three bounded contexts), so there is real throughput left on
the table.

Exploiting it naively — fan out N branches, implement concurrently, merge whenever each is green — risks
**merge hell**: a pile of conflicting branches a human must reconcile by hand. Four specific tensions
make naive parallelism unsafe:

1. **No git-derivable "in flight" state.** The durable-state model is _marker = done, everything else
   re-derived_. A phase that is implemented-but-unmerged has no marker, so two concurrent drivers both
   compute the same ready-set and can both claim the same unit. Parallelism needs a **third state
   (claimed/in-flight)** that must itself stay reconstructable from the repo.
2. **Serial merges guarantee each gate runs against the state it lands on; parallel loses that.** Two
   units branched off the same `base` can each be green in isolation yet conflict once combined
   ("green alone, red together"). Serial execution re-derives the ready-set against the _new_ base after
   each merge; parallel does not, unless merges are re-gated.
3. **The DAG models logical deps, not file-level contention.** `depends_on` encodes declared build/logic
   order. It does **not** say "phase 1 and phase 5 both edit `config`/DI/the lockfile." Serial execution
   hides that (each phase sees the prior's commits); parallel exposes coupling the graph never claimed.
4. **Reviewability/bisectability of the integration history.** Serial phases give `base` a clean linear
   narrative (0 → 1 → 2 …). Interleaving concurrent tracks muddies `git bisect` and "which phase did
   this," even though the final integration diff is identical.

The demand is throughput **without** ever presenting a human with a tangled merge to resolve.

## Decision

**Parallelize the implementation; serialize the merge.** Merge hell comes from two conflicting changes
_both landing without being re-tested against each other_ — so the merge is made a serialized, gated
step and can't produce that. Six mechanisms, together:

1. **Gated merge queue (the structural fix).** Units implement concurrently in isolated **git
   worktrees**, each gated green in isolation. Becoming green enters a **merge queue** that admits **one
   at a time**: rebase onto the _current_ `base` → re-run the required CI checks → merge only if green →
   next. The unit that actually merges is always re-tested against the real base it lands on, so
   "green alone, red together" is caught **before** the merge. Prior art: GitHub merge queues, Bors,
   Zuul. Bonus: the queue keeps `base` linear and bisectable, resolving tension 4.
2. **Touch-set admission control.** Each phase declares a `touches:` set (globs of files/areas it is
   expected to modify). Two ready units are dispatched concurrently **only if their touch-sets are
   disjoint**; overlap ⇒ run them serially. Conservative — when in doubt, serialize. Anything the
   estimate misses is still caught by the queue's rebase-and-re-gate (mechanism 1).
3. **Bounded concurrency.** `max_parallel: N` caps the fan-out (prefer critical-path units); a new unit
   starts only when a slot frees. Fewer concurrent branches ⇒ less drift ⇒ less conflict.
4. **Git-native claim lock.** A claim is recorded as durable git state (reconstructable from the repo —
   NOT in beads, which is only a projection) so no two drivers grab the same unit. This is the
   "third state" of tension 1. If beads is present, `bd`'s claim ops mirror it as a **projection only**;
   git remains the authority.
5. **Conflict ⇒ re-queue the phase, never hand-merge.** If a unit's in-queue rebase hits a conflict CI
   can't auto-resolve, autopilot **drops it back to not-started** and re-runs its implementation against
   the now-advanced `base`, TDD from current truth, in a fresh context. Re-doing one _small_ phase is
   cheaper, safer, and more reviewable than resolving a tangled merge — and it fits autopilot's model
   (git is truth, phases are small, contexts are fresh). **The worst case degrades to "a small phase is
   redone" — bounded and visible — not "a human resolves a merge."**
6. **Scoped to `pr_ci`, opt-in, off by default.** The merge queue _is_ the mechanism, so parallelism
   ships only where base/PR/CI machinery already exists. **`reviewed` mode stays strictly serial** (no
   worktree juggling, no human reviewing N-at-once). Unset/`max_parallel: 1` ⇒ byte-for-byte v1 serial.

## Invariants (must hold — from ADR-0001, plus new ones this ADR adds)

Carried forward: git is the authority; everything reconstructable from the repo alone; the gate is
unfakeable (skipped ≠ pass, red never advances); one coherent concern per **integration** PR; `trunk`
never merged autonomously.

New:

- **The merging unit is always re-gated against the exact base it lands on** (no vacuous green from a
  stale base).
- **A merge conflict never requires human resolution** — it re-queues as a phase redo.
- **`reviewed` mode is always serial.** Parallelism is a `pr_ci`-only capability.
- **`max_parallel` unset (or 1) is identical to ADR-0001 serial**, which is identical to pre-graph
  linear. Parallelism is strictly additive and opt-in.
- **The claim lock is git-native and reconstructable.** beads never holds authoritative claim state.

## Degrade paths

| Condition                    | Behavior                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `max_parallel` unset / `1`   | Exactly ADR-0001 serial execution (which is exactly pre-graph linear).           |
| `reviewed` autonomy          | Serial always — this ADR does not apply.                                         |
| No beads                     | Claims + queue use git-native state; nothing lost.                               |
| beads present                | `bd` mirrors claims/queue as a **projection** only; git stays authoritative.     |
| Touch-sets absent/unreliable | Fall back to `max_parallel: 1` for the affected units, or rely on queue re-gate. |

## Resolved decisions (were open questions at Proposed)

- **Claim representation → the phase branch _is_ the claim.** Claiming unit N means pushing its phase
  branch `autopilot/<feature_id>/phase-N` to origin; the push is atomic, so a second driver racing for
  the same unit loses (`push` rejected — branch already exists) and moves on. No separate lock artifact.
  In-flight units are enumerable with `git ls-remote --heads origin "autopilot/<feature_id>/*"`, so the
  claim set is fully reconstructable from git. **Orphan recovery:** a phase branch with no open PR and no
  new commits for a stale interval (and whose phase has no PASSED marker) is reclaimable — delete it and
  re-dispatch. beads, if present, mirrors claims as a projection only; it never holds authority.
- **Touch-sets → optional, author-declared, advisory.** `touches:` globs on a phase gate _co-dispatch_
  only (two ready units run concurrently only if disjoint; empty/unknown ⇒ don't co-dispatch). Not
  enforced against the actual diff in v1 — the merge-queue re-gate is the real safety net, so a missed
  overlap costs at most a re-queue, never a bad merge.
- **Re-gate × `fix_budget` → a separate `requeue_budget` (default 2).** An in-queue rebase/re-gate
  failure caused by a _sibling's_ merge is not the phase's own bug, so it draws from `requeue_budget`,
  not `fix_budget`. Exhausting it drops the unit to not-started for a fresh re-implementation.
- **Fairness/starvation → FIFO merge queue by green-arrival; dispatch prefers the critical path.** A unit
  that fails re-gate re-queues (freeing the queue head) rather than blocking it; a unit re-queued **twice**
  (`K = 2`) escalates to a human instead of looping.
- **Ledger schema → append-only, extended.** Firing records gain `parallel_slot` and `claim` (the phase
  branch); a new `"type":"requeue"` record logs each drop-and-redo. Lines interleave by `at` and stay
  self-describing, so the run remains replayable; git markers remain the authority.
- **Worktree lifecycle → one git worktree per slot under git-ignored `.autopilot/worktrees/<feature_id>/
phase-N`.** Created at dispatch, removed on merge or re-queue; each firing prunes worktrees whose phase
  branch is gone or whose phase is now PASSED. Disk is bounded by `max_parallel`.

## Consequences

**Positive:** real throughput on wide graphs; merge hell **structurally prevented** (not untangled);
`base` stays linear/bisectable via the queue; the failure mode a human sees is at worst a bounded phase
redo.

**Negative / cost:** genuine orchestration complexity (a merge queue, worktree management, a re-gate
loop); a new piece of mutable claim state to keep git-reconstructable; touch-sets to author and
maintain; more failure modes to test (crashed-driver claim recovery, starvation, re-queue loops).

**Neutral:** the integration `base → trunk` PR and its human review are unchanged; parallelism lives
entirely below that line.

## References

- [ADR-0001](0001-dependency-aware-work-graph-beads-ruflo.md) — the ready-set this ADR schedules over.
- Prior art: GitHub merge queues, Bors (`bors-ng`), Zuul — serialized, re-gated merge trains.
- beads (`bd`) claim/update ops — used here only as an optional projection of git-native claim state.
