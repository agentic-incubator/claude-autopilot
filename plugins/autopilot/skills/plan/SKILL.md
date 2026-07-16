---
name: plan
description: >-
  Turn a feature goal or spec into an autopilot phase plan — .autopilot/pipeline.yml with ordered
  phases, each carrying concrete deliverables and a MACHINE-CHECKABLE Definition of Done. Use this at
  the START of any autopilot pipeline, or whenever the user says "plan this feature", "break this into
  phases", "set up the pipeline for X", "scope this spec into shippable chunks", or hands you a spec/PRD
  and wants it decomposed for autonomous execution. Produces the plan that run-phase and orchestrate
  consume. Stack-agnostic — it decomposes intent, not code. Trigger it even when the user just points
  at a spec file and asks how to break the work down.
---

# Plan

You convert a loose feature goal or spec into a phase plan that an autonomous loop can execute. The
output is `.autopilot/pipeline.yml`. The quality of this file decides whether the whole pipeline
succeeds — a vague Definition of Done can't be gated, so a misphrased plan is how an unattended run
either stalls or merges something wrong. Spend the effort here; it's the cheapest place to fix things.

## What good output looks like

A handful of **independently shippable** phases, ordered by dependency, where each phase:

- moves the feature from one working state to the next (never leaves the repo broken),
- names concrete deliverables (a module, an endpoint, a migration — not "improve X"),
- has a Definition of Done every line of which a gate can **verify without judgment**.

The DoD is the part that matters most. Prefer verifiable lines:

- `cmd: <command that must succeed>` — e.g. `cmd: npm test -- payments` passes.
- `grep: <pattern that must appear>` / `grep:absent: <pattern that must not>`.
- `prose: <claim>` only when there's genuinely no command/grep for it — and keep it pointed at a
  specific file/behavior so a reviewer can check it.

If a DoD line can't be made checkable, that's a signal the phase is under-specified — split it or
sharpen the acceptance criteria now, not mid-run.

## Process

1. **Read the whole design corpus.** Not just the `spec` — the full set the user has: PRD (the why and
   acceptance intent), any existing implementation/roadmap doc, the ADRs (decisions and constraints the
   build must honor), and the DDD docs (bounded contexts, aggregates, ubiquitous language). Fetch URLs.
   Planning is the ONE place that reads the corpus broadly — phases later read only their slice, so the
   decomposition has to encode which ADRs/aggregates each phase touches. If `ruflo` is available, also
   `ruflo memory search -q "<feature>" --smart -n autopilot` to recall prior decisions. As you read,
   record each phase's relevant `adrs:` and `ddd:` so `run-phase` can pull just those slices. Use the
   domain's ubiquitous language (from the DDD docs) in phase goals and deliverable names.
2. **Score spec readiness; enrich if it's thin.** Before decomposing, judge whether the corpus is
   _ready to be gated_: could each prospective phase's Definition of Done reduce to checkable
   `cmd:`/`grep:` lines (see "What good output looks like")? Score it — testable-criteria coverage,
   count of unresolved decisions, missing acceptance criteria. Use `agentic-qe`'s `requirements_validate`
   / `qe_requirements_quality-criteria` for the score when present (`profile.accelerators.agentic_qe`);
   otherwise apply that rubric inline. **If the spec scores low, enrich it before planning** — this is
   the cheapest place to fix it:
   Enrich on a degrade ladder — best tool available, never blocking:
   - **Best — dedicated skills.** When `deep-research` is available (`profile.accelerators.deep_research`),
     drive it scoped to the _specific gaps_ the score flagged, and write its **cited** brief to
     `.autopilot/research/<feature-id>.md` (durable git state — future phases read it as part of the
     corpus). When `clarity` is available, turn the brief + corpus into numbered, testable requirements
     that become DoD lines.
   - **Middle — ruflo.** When those skills are absent but `profile.accelerators.ruflo` is set, ruflo has
     no clarity/deep-research equivalent, but its `researcher` + SPARC `specification` agents and
     `hive-mind` consensus beat a cold inline pass: research the flagged gaps and draft numbered
     requirements, writing the result to `.autopilot/research/<feature-id>.md`. ruflo lacks citation and
     verification discipline, so label every claim **unverified** for the confirm step.
   - **Floor — inline.** With no research tooling, reason through the gaps yourself against the same
     rubric (and use `superpowers:brainstorming`, if present, to force the open decisions — see step 3).
     Enrichment degrades; it never blocks planning.
   - **Then stop and have the user confirm** the enriched requirements and their sources before they
     shape any phase. Synthesized research is evidence for a human decision, never auto-accepted as
     ground truth — the agent does not self-certify.
3. **Brainstorm if the scope is still ambiguous.** Even with a healthy score, use
   `superpowers:brainstorming` (when available) to surface unknowns and force decisions before they
   calcify into a bad plan.
4. **Decompose into phases + wire the work graph.** Find the natural seams: data model before the logic
   that uses it; a primitive before the feature built on it; the happy path before hardening. Each phase
   should be reviewable on its own and leave the build green.
   - **Set `depends_on:` to encode the graph, not just linear order.** This is what `orchestrate`'s
     dependency-aware ready-set walks: a phase runs once every id in its `depends_on` is gate-PASSED.
     For multi-track scope (a system of several bounded contexts), declare the _real_ cross-track edges —
     then an unblocked unit in one track can run ahead of a blocked one in another, instead of a false
     single line. Leave `depends_on` empty only when a phase truly has no prerequisites (empty-everywhere
     ⇒ plain linear order, exactly as before). Keep it a DAG — no cycles (orchestrate stops on one).
   - **Tag each phase's `track:`** with its bounded context for multi-track features (it groups the plan
     and, when beads is present, becomes the epic). Single-track plans leave it empty.
   - **Let ruflo build the first draft when available.** If `accelerators.ruflo` is set, drive its
     `planner` / `task-orchestrator` to propose the decomposition, dependency edges, critical path, and
     per-unit risk (its ReasoningBank recall from step 1 sharpens estimates/risk). You then _curate_ that
     into phases — you own the final graph; ruflo drafts it. Degrade: decompose inline as above.
   - **Keep the plan one coherent concern.** If you discover an _unrelated_ new requirement while scoping
     (or the user raises one mid-run), it becomes a **separate queued pipeline** — its own `feature_id`,
     its own integration PR — not a bolted-on phase here. A pipeline that tries to ship two unrelated
     concerns produces an integration PR no human can review cleanly. Queue it (step 7) and keep this plan
     focused.
5. **Mark the risky phases.** Put the ids of phases with real blast radius (merge/auth/security logic,
   anything that executes generated edits) into `risk_phases:` — that's where orchestrate runs the
   expensive adversarial passes. Keep it small; everything gets the Tier-3 review regardless.
6. **Pick the autonomy + branch model.** Default `autonomy: reviewed` (human checkpoint per phase) until
   the user has watched it work, then `pr_ci`. Confirm `trunk` and `base` branch names with the user if
   not obvious — `trunk` is never auto-merged, `base` is the integration branch.
7. **Pick the write target — active or queued.** Set `feature_id` to a short kebab-case slug derived
   from the goal (e.g. "Add multi-region replication" → `multi-region-replication`); it scopes every git
   marker, the session ledger, and the embedded plan snapshot (step 8), so make it unique among any other
   autopilot work in this repo. Then decide WHERE the plan lands, because there is only ONE active
   `.autopilot/pipeline.yml`:
   - **Is a pipeline currently in flight?** It is if `.autopilot/pipeline.yml` exists and its feature
     still has un-shipped phases — i.e. some phase lacks a `(autopilot:<that-id>): … gate PASSED` marker
     (`git log --oneline | grep "(autopilot:<that-id>): phase .* gate PASSED"` vs the phase count). If so,
     **park this plan** at `.autopilot/queued/<feature_id>.pipeline.yml` instead of overwriting — adding a
     queued plan must NEVER disturb the running one. Ensure the queued dir is git-ignored (parked plans
     stay local until promoted):
     `grep -qxF '.autopilot/queued/' .gitignore 2>/dev/null || echo '.autopilot/queued/' >> .gitignore`.
     Tell the user it's queued and point them at the promote step in `docs/lifecycle.md` for when the
     active pipeline finishes. **Skip step 8** for a queued plan — its ledger is seeded at promotion, not
     now (a parked, untracked plan must not write committed state).
   - **No pipeline in flight** → write the active `.autopilot/pipeline.yml` from `templates/pipeline.yml`,
     filling the top block from the user's answers and the `phases:` from your decomposition, then do
     step 8. Before overwriting an existing active manifest, check whose feature it describes:
     - **Refining a plan that hasn't shipped a phase yet** → keep the slug; overwrite freely.
     - **A fresh attempt at a feature** (a prior run you want to redo from a clean slate) → give it a NEW
       slug (e.g. `-v2`). Each attempt is its own lineage with its own ledger and plan snapshot — autopilot
       has no separate "run id," the slug _is_ the run identity. This is how autopilot models "run again":
       a new lineage, not a second run of the same plan.
     - **A completed/different feature whose manifest is still present** → **overwriting `pipeline.yml`
       _is_ the previous feature's retirement** — there is no `archive/` dir and nothing is lost. The
       retired plan survives in git history (`git log --follow -- .autopilot/pipeline.yml`) and as record 0
       of its own `.autopilot/runs/<old-id>.jsonl` ledger. Tell the user this and confirm before
       overwriting. (Full retire/read-back sequence: `docs/lifecycle.md`.)
8. **Seed the ledger with the plan (record 0).** _(Active plans only — a queued plan is seeded at
   promotion.)_ Append one JSON line to `.autopilot/runs/<feature_id>.jsonl` so the ledger stays
   interpretable even after `pipeline.yml` is later overwritten by another feature's plan:
   `{"type":"plan","feature_id":"<slug>","goal":"<goal>","trunk":"<trunk>","base":"<base>","autonomy":"<mode>","phases":[{"id":0,"goal":"…","definition_of_done":["…"]},…],"at":"<git HEAD commit time>"}`
   Capture enough of each phase (id, goal, DoD) that the firing history below it reads on its own. This is
   the ledger's first line; every later line is a firing record (schema in
   `run-phase/references/gate.md`). On a re-plan that keeps the slug, append a fresh `type:plan` line —
   the most recent one describes the current phases. Read `at` from git (`git log -1 --format=%cI`); never
   invent a clock value. Commit this line together with `pipeline.yml`. (Ledgers from before this record
   existed can be retrofitted — see `docs/lifecycle.md`.)
9. **Sync the work graph to beads — projection only, if available.** _(Active plans only; a queued plan
   syncs at promotion, never while parked.)_ When `profile.accelerators.beads` is set, mirror the plan
   into `bd` so the graph is queryable/visualizable (`bd ready`, `bd dep tree`): one **epic per `track:`**,
   one **issue per phase** (title = goal, `acceptance` = the machine-checkable DoD lines, `adrs:`/`ddd:`
   as labels), and a **`blocks` edge for each `depends_on`** edge. This is a **projection, never the
   source of truth** — `pipeline.yml` + git markers stay authoritative, the sync is **one way**
   (pipeline → beads), and everything must remain reconstructable from the repo with beads absent. If
   beads is unavailable, skip this entirely — the graph already lives in `pipeline.yml depends_on` and
   nothing downstream depends on the projection. See
   `docs/adr/0001-dependency-aware-work-graph-beads-ruflo.md`.

## After writing

Show the user the phase list (ids, goals, deliverable counts) and a couple of sample DoD lines so they
can sanity-check the decomposition before any code is written — this is the last cheap moment to
re-shape the work. Then point them at `autopilot:detect` (or `/autopilot-init`, which chains both) to
build the stack profile, and finally `autopilot:orchestrate` to run it.

Don't over-plan: 3–8 phases is typical. A 20-phase plan usually means phases are too granular —
merge them. One giant phase usually means the DoD isn't decomposed enough — split it.
