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
4. **Decompose into phases.** Find the natural seams: data model before the logic that uses it; a
   primitive before the feature built on it; the happy path before hardening. Each phase should be
   reviewable on its own and leave the build green. Set `depends_on:` where order is load-bearing.
5. **Mark the risky phases.** Put the ids of phases with real blast radius (merge/auth/security logic,
   anything that executes generated edits) into `risk_phases:` — that's where orchestrate runs the
   expensive adversarial passes. Keep it small; everything gets the Tier-3 review regardless.
6. **Pick the autonomy + branch model.** Default `autonomy: reviewed` (human checkpoint per phase) until
   the user has watched it work, then `pr_ci`. Confirm `trunk` and `base` branch names with the user if
   not obvious — `trunk` is never auto-merged, `base` is the integration branch.
7. **Write `.autopilot/pipeline.yml`** from `templates/pipeline.yml`, filling the top block from the
   user's answers and the `phases:` from your decomposition. Set `feature_id` to a short kebab-case slug
   derived from the goal (e.g. "Add multi-region replication" → `multi-region-replication`); it scopes
   every git marker, the session ledger, and the embedded plan snapshot (step 8), so make it unique among
   any other autopilot work in this repo. There is only ONE `.autopilot/pipeline.yml` — before
   overwriting it, check (from `.autopilot/runs/*.jsonl` and `(autopilot:<slug>):` markers in the repo)
   whose feature it currently describes:
   - **Refining a plan that hasn't shipped a phase yet** → keep the slug; overwrite freely.
   - **A fresh attempt at a feature** (a prior run you want to redo from a clean slate) → give it a NEW
     slug (e.g. `-v2`). Each attempt is its own lineage with its own ledger and plan snapshot — autopilot
     has no separate "run id," the slug _is_ the run identity. This is how autopilot models "run again":
     a new lineage, not a second run of the same plan.
   - **A different feature whose manifest is still present** → the current `pipeline.yml` belongs to a
     different `feature_id`. Tell the user it will be replaced (its plan survives in git history and as
     record 0 of its own ledger) and confirm before overwriting.
8. **Seed the ledger with the plan (record 0).** Append one JSON line to
   `.autopilot/runs/<feature_id>.jsonl` so the ledger stays interpretable even after `pipeline.yml` is
   later overwritten by another feature's plan:
   `{"type":"plan","feature_id":"<slug>","goal":"<goal>","trunk":"<trunk>","base":"<base>","autonomy":"<mode>","phases":[{"id":0,"goal":"…","definition_of_done":["…"]},…],"at":"<git HEAD commit time>"}`
   Capture enough of each phase (id, goal, DoD) that the firing history below it reads on its own. This is
   the ledger's first line; every later line is a firing record (schema in
   `run-phase/references/gate.md`). On a re-plan that keeps the slug, append a fresh `type:plan` line —
   the most recent one describes the current phases. Read `at` from git (`git log -1 --format=%cI`); never
   invent a clock value. Commit this line together with `pipeline.yml`.

## After writing

Show the user the phase list (ids, goals, deliverable counts) and a couple of sample DoD lines so they
can sanity-check the decomposition before any code is written — this is the last cheap moment to
re-shape the work. Then point them at `autopilot:detect` (or `/autopilot-init`, which chains both) to
build the stack profile, and finally `autopilot:orchestrate` to run it.

Don't over-plan: 3–8 phases is typical. A 20-phase plan usually means phases are too granular —
merge them. One giant phase usually means the DoD isn't decomposed enough — split it.
