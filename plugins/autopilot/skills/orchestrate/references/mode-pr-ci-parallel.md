# Mode: pr_ci + parallel (several ready units at once, one gated merge at a time)

Read this **only** when `autonomy: pr_ci` AND `max_parallel > 1`. It changes exactly one thing about
`mode-pr-ci.md`: instead of driving one phase per firing, you keep up to `max_parallel` **independent**
ready units in flight concurrently — but every merge still goes through a **single serialized,
re-gated queue**, so merge hell is structurally impossible. Everything else in `mode-pr-ci.md` still
holds and is **not** repeated here:

- **STEP A.0 base lifecycle** (create/recreate `base`, never force-push) — unchanged, run it first.
- **STEP E** optimization PR + `base → trunk` handoff + next-lineage promotion — unchanged.
- The **anti-vacuous-green guard** (zero required checks = SKIPPED, never merge) — unchanged, applies to
  every phase PR here too.
- Prereqs (`gh` auth, base CI coverage, `ci_is_merge_authority`) — unchanged.

The governing design is `docs/adr/0002-parallel-ready-units-merge-queue.md`. Its core rule:
**parallelize the implementation; serialize the merge.**

## The two structures

- **Slots (≤ `max_parallel`).** Each slot implements one unit, concurrently, in its **own git worktree**
  under the git-ignored `.autopilot/worktrees/<feature_id>/phase-N/` and its own phase branch
  `autopilot/<feature_id>/phase-N`. Slots are the parallel part.
- **The merge queue (width 1).** When a slot's PR goes green it enters a FIFO queue by green-arrival.
  Exactly **one** merge is processed at a time: bring the PR branch up to current `base` → re-gate (CI)
  → merge, or re-queue. The queue is the serial part — this is what makes concurrent work safe to land.

## Claiming — the phase branch IS the claim

There is no separate lock. To take unit N, **push its phase branch to origin**:

```
git push origin <local-ref>:refs/heads/autopilot/<feature_id>/phase-N
```

The push is atomic: if the branch already exists (another driver/slot claimed it), your push is rejected
and you do **not** take that unit. The full set of in-flight claims is always recoverable from git:

```
git ls-remote --heads origin "autopilot/<feature_id>/phase-*"
```

So "what's in flight" needs no conversation memory and no beads — it's a `ls-remote`. (If beads is
present, mirror the claim with `bd update <unit> --claim` as a **projection only**; git stays the
authority.)

## STEP A′ — Locate state, then fill free slots (read-only, then claim)

```
0. Run mode-pr-ci.md STEP A.0 (ensure <base> exists locally + remote).
1. feature_id ← pipeline.yml. max_parallel, requeue_budget ← pipeline.yml.
2. DONE-SET   = git log --oneline <base> | grep "(autopilot:<feature_id>): phase .* gate PASSED".
   IN-FLIGHT  = git ls-remote --heads origin "autopilot/<feature_id>/phase-*"  → set of claimed ids.
   READY-SET  = phases with no PASSED marker, all depends_on in DONE-SET, AND not already IN-FLIGHT.
   (Same ready-set as SKILL.md; parallel mode just also subtracts the in-flight claims.)
3. TERMINATION / deadlock (unchanged in meaning):
   READY-SET ∅ and IN-FLIGHT ∅ and every phase PASSED → mode-pr-ci.md STEP E, then end the loop.
   READY-SET ∅ and IN-FLIGHT ∅ with phases left → depends_on cycle/unsatisfiable → STOP and report.
   READY-SET ∅ but IN-FLIGHT non-empty → nothing new to start; go manage the in-flight slots (STEP C′/D′).
4. ADMISSION — how many new units to dispatch this firing:
   free_slots = max_parallel − |IN-FLIGHT|.
   Candidates = READY-SET, ordered critical-path-first (longest downstream chain), then lowest id.
   Admit a candidate only if its `touches:` globs are DISJOINT from every already-admitted/in-flight
   unit's `touches:` (empty/unknown touches ⇒ treat as NOT disjoint → do not co-dispatch; it waits for a
   serial slot). This is advisory (the merge queue re-gate is the real guard) — err toward serializing.
5. CLAIM each admitted unit by pushing its phase branch (above). A rejected push = someone else took it;
   drop it from this firing.
```

## STEP B′ — Stand up help (optional)

Same as `mode-pr-ci.md` STEP B, **per slot**: if ruflo/aqe are available, each worktree's `run-phase`
drives them. Right-size — N concurrent swarms can be heavy; prefer fewer, or let only the critical-path
slot use the swarm.

## STEP C′ — Per slot: worktree → implement → local gate → push → open PR (concurrent)

For each claimed unit, in its own worktree (these run concurrently across slots):

```
1. WORKTREE: git worktree add .autopilot/worktrees/<feature_id>/phase-N \
              autopilot/<feature_id>/phase-N   (branch already pushed at claim time).
   Ensure .autopilot/worktrees/ is git-ignored (add it if missing, same idempotent pattern as queued/).
2. IMPLEMENT: delegate to `run-phase` inside that worktree (TDD, conventions, security invariants).
   Commit + push frequently to the phase branch — the remote branch is the durable resume point.
   - If `run-phase` returns **BLOCKED** (a missing prerequisite — ADR-0003): it has already recorded the
     blocker in `.autopilot/discovered/<feature_id>.jsonl`. **Release the claim** — delete the phase
     branch (origin + local) and its worktree — and do NOT open a PR. The open blocker keeps this unit out
     of the ready-set (SKILL.md step 1) until a human resolves it; the freed slot goes to another ready
     unit. Sibling slots are unaffected — a blocker halts only its own unit.
3. LOCAL PRE-PR GATE: run run-phase's gate green BEFORE opening the PR (saves CI minutes).
4. OPEN PR: gh pr create --base <base> --head autopilot/<feature_id>/phase-N
     --title "feat(autopilot:<feature_id>): phase N — <summary>" --body "<deliverables · DoD evidence>".
5. Hand this PR to the merge queue (STEP D′) when its CI is green. Then this slot is free for STEP A′.
```

Because `/loop` is self-paced, you don't block a slot waiting on CI: background `gh pr checks --watch`
and let the harness re-invoke you; a firing may advance several slots.

## STEP D′ — The serialized merge queue (width 1 — the safety core)

Never merge two PRs concurrently. Process the queue head only; hold an implicit **merge token** (one
merge in flight at a time — enforce by only ever operating on a single PR in STEP D′ per firing).

```
Pick the queue head = the green PR with the earliest CI-green time still unmerged.
R = count of "rebase(autopilot:<feature_id>): requeue attempt" commits on its branch (durable counter).

1. FRESHEN AGAINST CURRENT BASE (this is what defeats "green alone, red together"):
   git fetch origin; if the branch is behind <base>:
     rebase the phase branch onto origin/<base>  (or `gh pr update-branch`).
     - CLEAN rebase → force-push-with-lease TO THE PHASE BRANCH ONLY (never base/trunk); its CI re-runs
       against the new base. Go to 2.
     - CONFLICT the rebase can't auto-resolve → this is the merge-hell case, handled by re-queue:
         R+1 > requeue_budget → CONFLICT-REQUEUE (below).
         else: commit nothing to merge; record "rebase … requeue attempt #<R+1>"; drop this PR back to
               the tail of the queue and process the next head. (A sibling merged first; retry later.)
   If already up to date → go to 2.
2. RE-GATE: wait for required checks on the (possibly rebased) branch — the anti-vacuous-green guard from
   mode-pr-ci.md STEP D applies verbatim (zero checks = SKIPPED, never merge; leave PR open; STOP+report).
   - GREEN → gh pr merge <pr> --squash --delete-branch
       (subject "feat(autopilot:<feature_id>): phase N complete — gate PASSED").
       git worktree remove .autopilot/worktrees/<feature_id>/phase-N. Slot freed. Next queue head.
   - RED → treat as mode-pr-ci.md STEP D "ANY CHECK RED": fix on THIS branch within `fix_budget`
       (separate from requeue_budget); fix_budget exhausted → STOP that PR (leave open) + handoff, and
       continue managing other slots. A red re-gate does NOT block the queue: move to the next head and
       come back to this one after a fix push.

CONFLICT-REQUEUE (requeue_budget exhausted on rebase conflict):
   The unit cannot be cleanly rebased onto the advanced base. Do NOT hand-resolve.
   a. Delete the phase branch (origin + local) and its worktree → releases the claim.
   b. Append a ledger record: {"type":"requeue","phase":N,"reason":"rebase-conflict",...}.
   c. The phase returns to not-started (no PASSED marker) → the ready-set will re-dispatch it in a fresh
      worktree against the NOW-current base, re-implemented from truth (run-phase resumes/redoes it).
   d. ESCALATION: if this unit has already been conflict-requeued K=2 times (count "type":"requeue"
      ledger records for phase N), STOP and hand off to a human — do not loop. Report the two siblings
      that keep colliding (a hint their `touches:` overlap and they should be serialized / merged).
```

## Resume — every interruption window (parallel adds a few)

Re-derive on each firing; never assume. Beyond `mode-pr-ci.md` STEP A.2:

```
For each id in IN-FLIGHT (git ls-remote):
  - PR merged already? (grep base markers) → prune its worktree; it's done.
  - PR open + green + unmerged → it belongs in the merge queue (STEP D′).
  - PR open + red → resume its fix-loop (STEP D′ RED branch), respecting fix_budget.
  - Branch exists, NO PR → resume STEP C′ from the local gate (as mode-pr-ci.md A.2.b), in its worktree
    (recreate the worktree from the branch if the dir is gone: git worktree add … <existing-branch>).
  - Branch exists but STALE (no PR, no new commits for a long interval, no PASSED marker) → orphaned by a
    dead driver: delete branch + worktree (release claim); the ready-set re-dispatches it.
Prune any worktree under .autopilot/worktrees/<feature_id>/ whose phase is PASSED or whose branch is gone.
```

## Invariants specific to pr_ci + parallel

- **Merges are serialized (queue width 1); implementations are parallel.** Two PRs never merge
  concurrently, so no un-re-tested combination ever lands.
- **The merging unit is always re-gated against the exact `base` it lands on** (rebase → CI re-run →
  merge). A PR green against a stale base is re-gated before merge, never merged on the stale result.
- **A rebase conflict is never hand-resolved** — it re-queues as a fresh re-implementation, and escalates
  to a human after `K = 2` conflict-requeues.
- **Force-push only ever touches a phase branch** (to land a rebase). `base` and `trunk` are never
  force-pushed.
- **Claims are git-native** (`ls-remote` of phase branches); the in-flight set is reconstructable with no
  memory and no beads. beads mirrors claims as a projection only.
- **`max_parallel: 1` collapses this file to `mode-pr-ci.md` exactly** — one slot, no queue contention,
  identical behavior. Parallelism is strictly additive.
- Everything from `mode-pr-ci.md`'s invariants (one phase = one branch = one PR = one marker; advance
  only on green required checks; zero checks = skipped; `trunk` never autonomous) still holds per unit.
