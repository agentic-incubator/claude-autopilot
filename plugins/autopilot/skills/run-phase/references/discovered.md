# Discovered work — blockers & parking-lot

Read this when a phase turns up work that wasn't planned. The full rationale is
`docs/adr/0003-discovered-work-blockers-parking-lot.md`; this is the operational contract.

## Where it lives

`.autopilot/discovered/<feature_id>.jsonl` — **committed** (like `runs/<feature_id>.jsonl`, unlike the
git-ignored `queued/`, because a discovered _item_ is a durable record, not a parked pipeline). Created
lazily on the first item; repos without it behave exactly as before. Git is the authority; beads (if
present) mirrors each item as a `discovered-from` edge — a projection, never consulted for state.

## The record (one JSON line per item)

```jsonc
{
  "id": "blk-3a2f",                 // short stable handle (feature-unique); how status/plan reference it
  "kind": "blocker" | "parking-lot",
  "origin": { "feature_id": "<slug>", "phase": 3, "at": "<git HEAD commit time>" },
  "discovered_by": "gate" | "run-phase" | "reviewer" | "user",
  "note": "phase 3 needs a migration helper that doesn't exist",
  "blocks": 3,                      // ONLY for kind:blocker — the phase id it holds up
  "status": "open"                  // then append transitions (below), never mutate in place
}
```

Read `at` from git (`git log -1 --format=%cI`); never invent a clock value. Status changes are
**append-only** — add a transition line, don't edit the original:

```jsonc
{ "ref": "blk-3a2f", "status": "promoted" | "dismissed", "at": "<git time>" }
```

An item's **current status is its latest line**. This keeps the log replayable, like the run ledger.

## Which kind? (bias to parking-lot)

- **blocker** — record this **only** when the current phase _cannot make its DoD green_ without a
  prerequisite that doesn't yet exist. Concrete test: you cannot reach a green gate because something the
  phase depends on is missing. Set `blocks` to this phase's id.
- **parking-lot** — anything merely _noticed_ (a latent bug, an unrelated N+1, a missing test elsewhere).
  It never blocks and never enters the active graph.

When unsure, choose **parking-lot** — a mis-filed parking-lot item is still visible to a human in the
lot; a mis-filed blocker halts a phase for nothing.

## Recording rules

- **Dedup blockers (idempotent):** before appending a `blocker`, if an **open** blocker already exists for
  the same `blocks` phase with an equivalent `note`, skip — re-firings must not pile duplicates.
  Parking-lot items are not auto-deduped (a human curates the lot).
- **A blocker is a distinct stop reason.** It is _not_ a gate/CI failure: it consumes neither `fix_budget`
  nor the parallel `requeue_budget`. On a blocker, append the item, write the firing's ledger line with
  `"verdict":"BLOCKED"` (distinct from `FAILED`), and STOP — hand off (see run-phase Step 5/6).
- **Parking-lot never stops anything.** Append the item and continue the phase.
- **Commit discovered records** with the phase's work so they're durable (they ride to `base` like the
  ledger). beads mirror (optional): `bd create … --label <kind>` + a `discovered-from` edge to the origin
  unit; the git log stays authoritative.

## How it's actioned (elsewhere)

You only _record_ here. Acting on items is human-gated and lives in other skills:

- `/autopilot-status` surfaces open blockers (loud) + parking-lot (collapsed) — read-only.
- `/autopilot-plan` folds a blocker into the pipeline (new phase + `depends_on` edge), queues it, or
  dismisses it — and appends the status transition.
- `orchestrate` excludes a phase with an **open** blocker from the ready-set until it's promoted/dismissed,
  and stops-and-reports (never spins) if everything left is blocked/parked.
