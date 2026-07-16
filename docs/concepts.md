# 🧠 How it works (in plain English) + glossary

You don't need to understand any of this to use autopilot — [Getting started](getting-started.md)
gets you running without it. But if you want to know _why_ it can be trusted to work unattended for
days, here are the three ideas that make it tick, then a glossary that decodes every acronym.

---

## 1. 📒 It remembers in your project, not in the chat

A normal AI chat forgets. The conversation gets long, older messages fall out of view, and a few
sessions later neither you nor the AI remembers what "done" was supposed to mean.

autopilot sidesteps that entirely. Every time it finishes a phase, it writes a small permanent note
into your project's **git history** (your project's built-in record of every change). That note is
the official answer to "what's done and what's next."

So the next time autopilot runs, it doesn't try to _remember_ — it **looks**. It reads the notes in
your history and figures out the next unfinished phase from scratch. This is why you can stop on
Friday, come back in three weeks, and it picks up exactly where it left off. The chat can forget
everything; the project can't.

---

## 2. 🧩 It works one small phase at a time

Big features fail when an AI tries to hold the whole thing in its head at once — it drifts, loses the
plan, and produces a giant tangle nobody can review.

autopilot refuses to do that. It does **exactly one phase, then stops.** Each phase is small enough
to fit comfortably in a single fresh start, and small enough for _you_ to actually review. The next
phase begins with a clean slate that re-reads only what that phase needs. Lots of small, clean steps
beat one big muddy one.

When your feature comes with a stack of design documents (see the glossary for **ADR** and **DDD**),
autopilot reads them all **once** while planning, then records on each phase a short note of _which_
documents that phase has to respect. Later, each phase re-reads only its own slice — never the whole
stack. That's how a feature with a dozen design docs stays manageable.

And the phases aren't just a straight line. When you're building something big — say a system with a
dozen separate parts that depend on each other — the plan records which phase depends on which. Each
time it runs, autopilot looks at what's already finished and picks the next phase whose prerequisites are
all done. So a ready piece of one part can move ahead while an unrelated part is still waiting on
something else, instead of everything stalling behind a single queue. (For a simple feature with no such
links, this is just "do them in order" — exactly as you'd expect.)

---

## 3. ✅ The gate that can't be faked

Before any phase counts as "done," it has to pass a **gate** — a set of checks autopilot actually
runs (your tests, your build, a code review, and more). Two unbreakable rules make the gate
trustworthy:

1. **A skipped check is reported as skipped — never as a pass.** autopilot can't quietly wave work
   through by ignoring a test.
2. **A failing gate never advances.** If something's red, the phase stays unfinished until it's
   genuinely fixed.

In autonomous mode the bar goes one step higher: the deciding checks are the ones **GitHub** runs on
each pull request, not autopilot's own say-so. autopilot fixes its own failures for a few rounds, and
if it still can't get to green, it stops and asks you. It never merges work that wasn't actually
tested. (Full detail: [Autonomous runs](autonomous-runs.md).)

The deep, illustrated version of this whole flow lives in the design reference:
[`plugins/autopilot/docs/WORKFLOW.md`](../plugins/autopilot/docs/WORKFLOW.md).

---

## 📖 Glossary

Every acronym and bit of jargon, in one place. You can use autopilot without knowing most of these —
they're here for when you're curious.

| Term             | Plain-English meaning                                                                                                                                                                                                                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase**        | One small, self-contained step of the feature. autopilot does one per run and each leaves your project working.                                                                                                                                                                                                                        |
| **Gate**         | The set of checks a phase must pass to count as done — your tests, build, a code review, and more. Can't be faked.                                                                                                                                                                                                                     |
| **Spec**         | Short for "specification" — the document (or sentence) describing what you want built. The source of truth for the plan.                                                                                                                                                                                                               |
| **git**          | Your project's built-in history of every change. autopilot stores its progress notes here so nothing is lost.                                                                                                                                                                                                                          |
| **Branch**       | A safe, separate copy of your code where work happens without touching the main version. autopilot makes these for you.                                                                                                                                                                                                                |
| **Trunk**        | Your project's main, official branch (usually called `main`). autopilot **never** merges into it on its own — a human always does the final merge.                                                                                                                                                                                     |
| **Base**         | A long-lived "integration" branch where autopilot collects finished phases before the final hand-off to you.                                                                                                                                                                                                                           |
| **PR**           | "Pull request" — a proposal on GitHub to merge one branch's changes into another, with a description and a place for review. autopilot opens these for you.                                                                                                                                                                            |
| **CI**           | "Continuous integration" — automated checks GitHub runs on every pull request (typically your tests). In autonomous mode, CI is the authority that decides a merge.                                                                                                                                                                    |
| **Merge**        | Combining one branch's changes into another. autopilot merges finished phases into `base`; the final merge into `trunk` is always yours.                                                                                                                                                                                               |
| **TDD**          | "Test-driven development" — writing the test _before_ the code, so you always have proof the code does what's intended. autopilot builds every phase this way.                                                                                                                                                                         |
| **ADR**          | "Architecture Decision Record" — a short doc that records one design decision and why, e.g. _"all payment calls use idempotency keys."_ A rule the build must follow.                                                                                                                                                                  |
| **DDD**          | "Domain-Driven Design" — docs that define your system's shared vocabulary and building blocks, e.g. what an _Invoice_ or _Charge_ means and how they relate.                                                                                                                                                                           |
| **PRD**          | "Product Requirements Document" — the doc explaining _why_ a feature exists and what counts as acceptable.                                                                                                                                                                                                                             |
| **DoD**          | "Definition of Done" — the checkable conditions a phase must meet. autopilot writes these so a machine can verify them, not just guess.                                                                                                                                                                                                |
| **`gh`**         | GitHub's command-line tool, which autopilot uses to open pull requests and merge them. Needed only for autonomous mode.                                                                                                                                                                                                                |
| **Accelerator**  | An optional extra tool (ruflo, agentic-qe, beads) that makes autopilot faster, its checks deeper, or its work graph visible. Always optional — see [Power-ups](power-ups.md).                                                                                                                                                          |
| **Work graph**   | The map of which phases depend on which. autopilot runs the next phase whose prerequisites are all finished (the "ready set"), so independent work isn't stuck behind a single line.                                                                                                                                                   |
| **beads**        | An optional tool (`bd`) that shows the work graph as a queryable picture — what's ready, what's blocked. Just a view: your git history stays the real record. See [Power-ups](power-ups.md).                                                                                                                                           |
| **Parallel run** | Opt-in (`max_parallel` > 1, autonomous mode only): autopilot builds several independent ready phases at the same time, each in its own scratch copy of your repo, to finish a wide feature faster. Off by default.                                                                                                                     |
| **Merge queue**  | The safety valve for parallel runs: finished phases are merged **one at a time**, each re-tested against the latest code first — so two parallel branches can never quietly break each other. A branch that won't merge cleanly is simply rebuilt, never hand-untangled.                                                               |
| **Blocker**      | Work autopilot _discovers_ it needs but can't do — a phase can't finish because something it depends on doesn't exist yet. It records the blocker (with where it came from), stops that phase, and shows it in `/autopilot-status`. You resolve it with `/autopilot-plan`; the phase resumes on its own once the prerequisite is done. |
| **Parking-lot**  | Work autopilot _notices_ but that isn't needed now — an unrelated bug or improvement. It's jotted down (never acted on automatically, never slowing the current work) so you can pick it up later.                                                                                                                                     |
| **Queued plan**  | A follow-up feature you scoped while another is still running. autopilot parks it on your machine (it won't start it) until you promote it — so the active run is never disturbed.                                                                                                                                                     |
| **Promote**      | Turning a queued plan into the active one when the current feature finishes — a one-line step autopilot points you at. It never starts the next feature on its own.                                                                                                                                                                    |
| **Retire**       | What happens to a finished plan: the next plan simply replaces it. Nothing is archived or lost — the old plan stays in your project's history and its own logbook.                                                                                                                                                                     |

---

## What's next

- Ready to run your first feature? → [Getting started](getting-started.md)
- Want it hands-off across many sessions? → [Autonomous runs](autonomous-runs.md)
- Want the deep, diagrammed design? → [`WORKFLOW.md`](../plugins/autopilot/docs/WORKFLOW.md)
