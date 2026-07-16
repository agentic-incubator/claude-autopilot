# ADR-0003 — Discovered work: provenance-stamped blockers & parking-lot

| Field         | Value                                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Status**    | Accepted                                                                                                          |
| **Date**      | 2026-07-16 (proposed) · 2026-07-16 (accepted)                                                                     |
| **Deciders**  | autopilot maintainers                                                                                             |
| **Governs**   | `skills/{plan,run-phase,orchestrate}`, `.autopilot/` layout, `/autopilot-status`                                  |
| **Builds on** | [ADR-0001](0001-dependency-aware-work-graph-beads-ruflo.md), [ADR-0002](0002-parallel-ready-units-merge-queue.md) |

## Context

Both prior ADRs left one thing explicitly deferred: **what autopilot does with work it _discovers_
mid-run.** An agent building a phase routinely finds work that wasn't planned — beads even has a
dedicated dependency type for it, `discovered-from` ("auto-created when AI discovers related work").

The reason it was deferred is that discovered work is really **two different things** with opposite
urgency, and conflating them is what made "auto-promote vs. queue" feel unsafe:

- **A blocker** — _in-scope_: the current phase genuinely cannot meet its Definition of Done without it
  (e.g. "phase 3 needs a migration helper that doesn't exist"). Parking it would **stall the phase**.
- **A tangent** — _out-of-scope_: something noticed in passing (a latent bug, an unrelated N+1, a missing
  test). Pulling it into the active graph would **creep the scope** of an integration PR nobody planned
  that way.

Today's behavior is the safe floor: an unrelated requirement becomes a separate **queued pipeline**
(git-ignored, human-promoted; see `plan` + `docs/lifecycle.md`). That is correct but coarse — it can't
express a blocker, and it loses _how_ the work was discovered.

## Decision

Record discovered work as **provenance-stamped items** split by **kind**, in a git-authoritative log.
Neither kind auto-starts anything; both preserve every existing invariant.

### 1. One committed log, one line per item

`.autopilot/discovered/<feature_id>.jsonl` — committed (like `runs/*.jsonl`, unlike the git-ignored
`queued/`, because a discovered _item_ is a durable record, not a parked pipeline that could confuse the
"which pipeline is active" grep). Each line:

```jsonc
{
  "id": "blk-3a2f",              // short stable handle — how status/plan reference this item
  "kind": "blocker" | "parking-lot",
  "origin": { "feature_id": "checkout-v2", "phase": 3, "at": "<git commit time>" },
  "discovered_by": "gate" | "run-phase" | "reviewer" | "user",
  "note": "phase 3 needs a migration helper that doesn't exist",
  "blocks": 3,                 // present ONLY for kind:blocker — the phase it holds up
  "status": "open" | "promoted" | "dismissed"
}
```

`origin` + `discovered_by` is the "how was this originated" provenance — the same fact beads records as a
`discovered-from` edge, but written to **git** (beads is a projection; see §5). `at` is read from git,
never invented.

### 2. Blocker — record, stop that unit, hand off (never self-certify)

When a phase discovers it cannot legitimately reach a green gate without prerequisite work, it appends a
`kind:blocker` line and **stops that unit** on the existing stop-and-hand-off path (a phase that can't
pass its gate never advances, never self-certifies — ADR-0001/§gate). The only thing new is that the
handoff now says _exactly what is missing and which phase it holds_, not a bare "gate failed."

- **In pr_ci parallel mode (`max_parallel > 1`): only the blocked unit halts.** Independent sibling slots
  keep running and merging through the queue (ADR-0002). One track's blocker never freezes the others.
- A blocker is **loud**: `/autopilot-status` leads with open blockers.

### 3. Parking-lot — record and keep going, passively

A `kind:parking-lot` item is written with provenance and **never blocks anything**. It does not enter the
active graph and does not stop any unit — it is a note for later. This is the "the autonomous agent may
note what it finds" behavior, made safe by putting it in the lot instead of the PR.

### 4. Promotion stays deliberate (unchanged philosophy)

- **parking-lot →** when a human chooses, it graduates into a **queued pipeline** (its own `feature_id`),
  then follows the existing promote lifecycle. Nothing auto-starts. Mark the item `status:"promoted"`.
- **blocker →** a human decides how to _action_ it (below). Human-gated — but now fully informed by the
  provenance.
- Either kind may be `dismissed` (won't-do), which is itself a durable, auditable decision in the log.

### 4a. Actioning a blocker — through the existing commands, no new one

A blocker is not cleared by an imperative "unblock" command. It is **satisfied**, and the existing
dependency-aware ready-set (ADR-0001) re-includes the unit on its own. Crucially this maps onto the
**five commands autopilot already has** — `/autopilot-{init,plan,detect,run,status}` — because
"fold/queue/dismiss a blocker" is a **scope decision, which is `plan`'s job**, and resuming is just
`run` re-deriving state. `status` stays read-only (it surfaces and recommends; it never mutates).

The lifecycle the user sees after a `run-phase` stops on a blocker:

1. **`/autopilot-run` reports the stop** — the phase halted with the blocker id + provenance + a pointer
   to `/autopilot-status`.
2. **`/autopilot-status` (read-only) surfaces it loudly** — open blockers first (id, `blocks: N`,
   provenance), parking-lot collapsed below, each line ending with the one action: `→ /autopilot-plan`.
3. **`/autopilot-plan` performs the action** — it reads the open blockers and, for the one the user
   picks, does the git wiring **and** appends the status annotation (a scope decision is never
   autonomous; `plan` already owns scope + re-plan + queued authoring):
   - **Fold into this pipeline** (prerequisite is in-scope) → insert a new phase for it and add its id to
     the blocked phase's `depends_on:`; stamp the item `promoted`.
   - **Queue as its own concern** (prerequisite is separable) → author
     `.autopilot/queued/<id>.pipeline.yml` (parked because one pipeline is active); stamp `promoted`.
   - **Dismiss / re-scope** (it wasn't really needed) → correct the blocked phase's DoD; stamp
     `dismissed`.
4. **`/autopilot-run` resumes — no special command.** The next `orchestrate` firing re-derives the
   ready-set from git markers. Once the prerequisite phase carries a `gate PASSED` marker (fold) — or the
   blocked phase's `depends_on` is corrected (dismiss) — the blocked unit is simply **ready again** and
   runs. Satisfying the dependency _is_ the unblock; that is the whole point of git-derived state.

**Status annotations are append-only.** Each resolution appends a transition line
(`{"ref":"<item-id>","status":"promoted"|"dismissed","at":"<git time>"}`); the item's current status is
its latest line, and `/autopilot-status` stops showing it as open. The record is never mutated in place —
it stays replayable, like the run ledger.

So: **`status` to see, `plan` to action, `run` to resume.** The human makes the scope decision and `plan`
wires it into git; autopilot does the mechanical resume for free. Nothing about actioning a blocker
touches the gate, the merge queue, or the "one active pipeline" rule — and the command surface does not
grow.

### 5. beads is the projection, git is the authority

If beads is present, each discovered item mirrors as a bead with a **`discovered-from` edge** back to its
origin unit and a `blocker`/`parking-lot` label — a queryable view (`bd list --label blocker`). The log
is the source of truth; beads is never consulted to decide what's blocked or what's next. Absent beads,
nothing is lost (the log is plain git).

## Invariants (must hold)

Carried forward: git is the authority; everything reconstructable from the repo alone; the gate is
unfakeable (a blocker rides the never-self-certify stop path); **one active pipeline**; **one coherent
concern per integration PR**; `trunk` never autonomous.

New:

- **Discovered work never auto-starts and never mutates the active graph mid-run.** The ready-set and the
  parallel claim/merge machinery (ADR-0001/0002) keep operating over a fixed `pipeline.yml`; discovered
  items live _beside_ it, not _in_ it, until a human promotes one.
- **A blocker halts only its own unit** (in parallel mode); it is recorded, never silently worked around.
- **An open blocker removes its phase from the ready-set** until the blocker is promoted/dismissed — so
  `orchestrate` never re-runs a blocked unit in a tight loop. If every remaining unit is blocked (or
  parked), the loop **stops and reports "awaiting human," never spins** (the same discipline as the
  dependency-cycle guard in ADR-0001).
- **beads holds no authoritative discovered state** — projection only.
- **Recording a discovered item is always safe** (committed record, non-auto-starting), so an agent is
  never discouraged from noting what it finds.

## Degrade paths

| Condition          | Behavior                                                                               |
| ------------------ | -------------------------------------------------------------------------------------- |
| No beads           | The `discovered/*.jsonl` log is fully git-native; no view tooling, identical behavior. |
| `reviewed` mode    | A blocker stops the (single) unit for human inspection — same as any gated stop.       |
| No discovered work | The log simply doesn't exist; zero overhead.                                           |

## Resolved decisions (were open questions at Proposed)

- **Classification → bias to parking-lot; only an own-gate-blocker is a blocker.** An item is a
  `blocker` **only** when the current phase cannot make its Definition of Done green without a prerequisite
  that does not yet exist (a concrete, testable condition: run-phase can't reach a green gate because
  something it depends on is missing). Everything else — anything merely _noticed_ — is `parking-lot`.
  Rationale: a wrong "parking-lot" that was really a blocker only defers work a human still sees in the
  lot; a wrong "blocker" stops a phase early. Both are recoverable, and the bias keeps the loud, work-
  halting kind rare and high-signal.
- **`/autopilot-status` → open blockers first (loud), parking-lot collapsed, per feature.** Each open
  blocker renders `id · blocks: N · origin · note` and ends with `→ /autopilot-plan`. Read-only.
- **Dedup → idempotent per (kind, blocks, note).** Before appending a `blocker`, if an **open** blocker
  already exists for the same `blocks` phase with an equivalent note, skip it — re-firings never pile
  duplicates. Parking-lot items are not auto-deduped (cheap; a human curates the lot); the same tangent
  seen in two phases may legitimately be two items with two `origin`s.
- **`fix_budget` → untouched; a blocker is a distinct stop reason.** A blocker is _not_ a CI/gate failure,
  so it consumes neither `fix_budget` nor the parallel `requeue_budget`. run-phase records the firing's
  verdict as **`"BLOCKED"`** in the ledger (distinct from `FAILED`), and stops.
- **Retrofit → lazy.** `.autopilot/discovered/<feature_id>.jsonl` is created on the first item; repos
  without it behave exactly as before (zero overhead, nothing to migrate).

## Consequences

**Positive:** the deferred question is resolved without weakening scope discipline; blockers become
first-class and _loud_ instead of hiding inside a gate failure; discovered work carries its origin, so a
human decides with full context; parallel runs aren't frozen by one track's blocker.

**Negative / cost:** a new `.autopilot/` artifact + `status` view; a classification judgment the agent
must make (mitigated by biasing to the safe side); more ledger surface to keep consistent.

**Neutral:** promotion remains exactly as deliberate as today; the active pipeline and its integration PR
are untouched by anything in the lot.

## References

- [ADR-0001](0001-dependency-aware-work-graph-beads-ruflo.md), [ADR-0002](0002-parallel-ready-units-merge-queue.md)
  — the deferral this ADR closes.
- beads `discovered-from` dependency type (`bd` quickstart) — the projection surface.
- `skills/plan` queued-pipeline lifecycle + `docs/lifecycle.md` — where a promoted item lands.
