# ADR-0001 — Dependency-aware work graph (beads projection + ruflo planning brain)

| Field        | Value                                                                            |
| ------------ | -------------------------------------------------------------------------------- |
| **Status**   | Accepted                                                                         |
| **Date**     | 2026-07-15                                                                       |
| **Deciders** | autopilot maintainers                                                            |
| **Governs**  | `skills/{plan,detect,orchestrate,run-phase}`, `templates/{pipeline,profile}.yml` |

## Context

autopilot decomposes a feature into an **ordered phase list** (`templates/pipeline.yml`) and re-derives
"what's next" by grepping the highest `gate PASSED` git marker — a **linear** walk, phase N → N+1.

That model under-serves genuinely multi-track scope. The motivating case is a system with a dozen
bounded contexts, dozens of ADRs, and cross-context dependencies (north-star: Keel — Rust + SvelteKit,
12 bounded contexts, 25 ADRs, ~46 Must requirements). There, the work is a **directed acyclic graph**,
not a line: phase _F_ in context A may be unblocked while phase _C_ in context B is still waiting on its
prerequisites. A strictly linear cursor either forces a false ordering or stalls behind an unrelated
blocker.

Two rUv tools map onto this problem, and autopilot already treats external tools as **optional, detected
accelerators** (see `profile.accelerators`, `docs/power-ups.md`):

- **beads (`bd`)** — a dependency-aware issue tracker: epics/issues/tasks with `blocks` / `related` /
  `parent-child` / `discovered-from` edges, `bd ready` = open ∧ unblocked. _Grounding note:_ the
  installed `bd` MCP plugin stores state in an **embedded Dolt database** (`.beads/embeddeddolt/`,
  synced via `bd dolt push/pull`), **not** human-readable git-tracked JSONL. That is decisive for the
  decision below.
- **ruflo** — a planning/orchestration layer. Its `planner` agent
  (`ruflo/.claude/agents/core/planner.md`) already emits a plan with `dependencies`, `critical_path`,
  `risks`, and `success_criteria`; its `task-orchestrator` does parallel/sequential/adaptive
  decomposition and dynamic re-planning; its memory + ReasoningBank recall how similar past units went.
  (The v3 planner's GNN/HNSW niceties are design-intent, not confirmed shipped — we do **not** depend on
  them.) [ADR-038 "Sublinear GOAP for roadmap optimization"](https://github.com/ruvnet/ruview) is
  **Proposed**, not shipped; we borrow its framing — next action selected from _observable world-state_
  — as conceptual inspiration only.

The constraint: adding graph awareness must not weaken autopilot's load-bearing invariants — git is the
authority for "done/next", the gate cannot be faked, accelerators are optional, and a repo with **neither
beads nor ruflo must behave exactly as today**.

## Decision

Layer graph awareness **under** autopilot's existing machinery, in three tiers that degrade cleanly.

### 1. Git stays the authority; beads is a one-way projection

`pipeline.yml` + git `gate PASSED` markers + the `.autopilot/runs/<feature_id>.jsonl` ledger remain the
**single source of truth**. The bead graph is a **projection**, regenerable from that truth and synced
**one way only: markers → beads, never beads → markers.** Rationale:

- The "everything is reconstructable from the repo alone" invariant must hold. Because `bd` persists to a
  Dolt store (not plain git text), making beads canonical would move authority into a non-git,
  non-human-readable store and break that invariant. As a projection, beads can be absent, stale, or
  rebuilt with zero effect on correctness.
- It keeps the accelerator contract honest: with beads absent, nothing about the pipeline's meaning
  changes — only a queryable/visualizable view is missing.

### 2. Dependency-aware ready-set is the git-native core (works with zero accelerators)

The flat-list limitation lives in `orchestrate`'s _state derivation_, not the schema: `pipeline.yml`
phases already carry `depends_on:`. So the load-bearing change is small and needs no external tool.

`orchestrate` replaces linear "target N = highest PASSED + 1" with a **ready-set**:

```
ready(P)  ≡  P has no `gate PASSED` marker
             ∧ every id in P.depends_on has a `gate PASSED` marker
select    =  the ready phase with the lowest id          # deterministic
```

- **Legacy plans stay byte-for-byte identical.** With empty `depends_on` on every phase, the ready-set is
  "all un-PASSED phases" and lowest-id selection yields phase 0, then 1, then 2 … — exactly today's walk.
  Graph behavior **only activates when the plan declares `depends_on`/tracks**; it is strictly additive.
- **v1 selects one unit per firing.** "One phase per firing / fresh context" is preserved: the ready-set
  changes _which_ unblocked unit runs, not _how many_. True parallel fan-out (multiple ready units at
  once, via worktrees/multiple loops) is explicitly **out of scope for v1** — it interacts with the
  "one coherent concern per integration PR" invariant and is deferred to a follow-on ADR.
- This is a deterministic, degenerate GOAP: preconditions = deps PASSED; no search/cost function, so no
  A\* and no dependence on the Proposed ADR-038.

### 3. Unit-of-work taxonomy

| Layer          | autopilot                        | beads projection   | Machine-checkable tie                       |
| -------------- | -------------------------------- | ------------------ | ------------------------------------------- |
| track/context  | new optional `track:` on a phase | epic               | —                                           |
| unit           | a phase (`id`, `goal`)           | issue              | `depends_on:` → `blocks` edges              |
| acceptance     | a `definition_of_done` line      | issue `acceptance` | each line stays `cmd:` / `grep:` / `prose:` |
| constraint ref | phase `adrs:` / `ddd:`           | issue labels       | slice the phase reads & honors              |

Success criteria stay exactly as strong as today: a bead's acceptance **mirrors** the phase DoD; it never
replaces the gate. The gate reads the DoD from `pipeline.yml`, not from beads.

### 4. ruflo's role — plan and run, never the gate

- **plan time:** when `accelerators.ruflo` is set, drive its `planner` / `task-orchestrator` to build the
  graph (decomposition, `depends_on`, critical path, risk) and its memory/ReasoningBank to recall how
  similar past units went (estimate/risk signal). Output is still `pipeline.yml` (+ optional bead sync).
- **run time:** the swarm implements each unit (already specified in
  `run-phase/references/accelerators.md`). Memory is keyed `autopilot-<feature_id>-<unit_id>`, where
  `unit_id` is the phase id (and the bead id when beads is present).
- **gate:** **no role.** ruflo and beads never influence pass/fail. A red gate never advances; a skipped
  check is reported skipped. This is non-negotiable.

### 5. detect + status reconciliation

`detect` gains a beads probe mirroring ruflo: `bd` on PATH → `scope: global`; a `.beads/` dir →
`scope: project`; recorded as `accelerators.beads: { available, scope }` and shown in the confirm step.

Three status views can exist — git markers, `bd` status, the JSONL ledger. **Git markers win, always.**
Reconciliation is one-way: on each firing, if beads is present, sync bead status _from_ the markers.
beads is never consulted to decide what is done or next.

## Invariants (preserved — an edit that weakens one is a bug)

1. **Git is the authority** for done/next; everything is reconstructable from the repo alone. beads/ruflo
   are projections/accelerators.
2. **Accelerators are optional and detected.** With neither beads nor ruflo, autopilot behaves exactly as
   today (linear-equivalent). A missing accelerator never changes correctness or the gate verdict.
3. **The gate cannot be faked** — skipped ≠ pass, red never advances, `pr_ci` keeps GitHub CI as merge
   authority. Unchanged in meaning.
4. **One coherent concern per integration PR**; one unit per firing in v1.
5. **`trunk` is never merged autonomously.**
6. **Backward compatible** — existing pipelines/ledgers keep working; this ADR adds, never rewrites.

## Degrade paths

| Capability             | + ruflo & beads                                         | + beads only                               | Floor (neither)                                     |
| ---------------------- | ------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------- |
| Build the graph (plan) | planner/task-orchestrator + ReasoningBank estimate/risk | author writes `depends_on`/`track` by hand | author writes `depends_on`/`track` by hand          |
| Store/query the graph  | bead epics/issues/tasks + `bd ready` cross-check        | bead epics/issues/tasks + `bd ready`       | `pipeline.yml depends_on` (the graph _is_ the YAML) |
| Choose next unit       | ready-set (git) + `bd ready` agree; ruflo may advise    | ready-set (git), `bd ready` as a view      | ready-set computed from `depends_on` + markers      |
| Implement a unit       | ruflo swarm                                             | focused subagents                          | focused subagents                                   |
| Cross-session recall   | ruflo memory keyed by unit/bead id                      | JSONL ledger                               | JSONL ledger                                        |

Correctness is identical across every column; only planning depth, execution speed, and view richness
change.

## Consequences

**Positive:** multi-track features get dependency-correct sequencing; parallelizable units are _visible_
(even if v1 runs them one-at-a-time); the change is additive and legacy-identical; no new hard dependency.

**Negative / cost:** `orchestrate`'s next-phase logic gains a (small) graph computation; a new optional
sync step; docs/schema surface grows. The v1 line ("select one, don't fan out") means the parallelism is
_surfaced but not yet exploited_ — deliberately, to protect the one-concern-per-PR invariant until a
follow-on designs safe concurrent execution.

**Deferred (follow-on ADR):** true parallel execution of multiple ready units (git worktrees / multiple
`/loop` drivers / bead claim-locking), and whether `discovered-from` work auto-promotes vs. stays queued.

## References

- autopilot: `skills/{plan,detect,orchestrate,run-phase}/SKILL.md`, `templates/{pipeline,profile}.yml`,
  `docs/power-ups.md`, `plugins/autopilot/docs/WORKFLOW.md`.
- ruflo (real source): `ruflo/.claude/agents/core/planner.md` (plan YAML: dependencies/critical_path/
  risks/success_criteria), `ruflo/v3/@claude-flow/neural/src/reasoning-bank.js` (RETRIEVE/JUDGE/DISTILL/
  CONSOLIDATE, degrades without AgentDB).
- beads: `bd` MCP `beads://quickstart` (epic/issue/task, dep types, `bd ready`, embedded Dolt store).
- AgentDB Goalie (hierarchical goal→subgoal trees + causal edges): `agentdb/simulation/scenarios/…/
goalie-integration.md` — conceptual kin to the taxonomy.
- ADR-038 "Sublinear GOAP for roadmap optimization" (ruview) — **Proposed**, cited as inspiration only.
