# 💡 Use cases & sample sessions

Four ways people use autopilot, from a first-timer's feature to a months-long migration. Each shows
the exact commands and what they do for you. New to the jargon? Keep
[Concepts & glossary](concepts.md#-glossary) open in another tab.

---

## 1. 🧑‍🎨 The vibe-coder shipping a real feature

> _"I built a to-do app and now I want real user accounts. I've never opened a pull request."_

```
/autopilot-init "Add email/password auth with sessions and a logout button (spec: AUTH.md)"
# autopilot proposes: [schema → signup → login → session middleware → logout → UI wiring]
/autopilot-run    # builds the first phase, writes its tests, shows you a green check
```

You review one bite-sized phase at a time. No "where do I even start" paralysis — and you never had
to type a `git` command. This is the path the [Getting started](getting-started.md) guide walks
through in full. 🌿

---

## 2. 🏗️ The big, multi-week project with lots of design docs

> _"Migrate our payments from the legacy gateway to the new one — without one giant, risky change."_

Big features usually come with a folder of background docs — a spec, maybe a product brief, and notes
your team wrote about _how_ things should be built. Two common kinds (you don't need to know these
terms — autopilot handles them either way):

- 📐 **ADR** ("Architecture Decision Record") — a short note recording a decision and why, e.g.
  _"every payment call uses an idempotency key."_ A rule the build must follow.
- 🧩 **DDD docs** ("Domain-Driven Design") — your shared vocabulary and building blocks, e.g. what an
  _Invoice_ or a _Charge_ means and how they relate.

**The point: if you have design docs, autopilot reads them so every phase respects them — you just
point it at the folder.**

**Step 1 — set it up.** Give your one-line goal and your main spec:

```
/autopilot-init "Migrate billing to NewPay; keep the old gateway behind a switch until cutover (spec: docs/migration.md)"
```

autopilot scans your project for design docs and lists what it found in its settings file
(`.autopilot/pipeline.yml`). It then breaks the work into small, shippable **phases**, and on each
phase records _which_ design docs that phase must respect — so later, each phase reads only its own
slice, never the whole stack. It shows you the phase list; skim it and fix anything that looks off.
When you're ready to let it run hands-off, change one line to `autonomy: pr_ci`.

**Step 2 — let it run, one phase at a time, across days.**

```
/loop Invoke the autopilot:orchestrate skill — run the next phase, then stop.
```

Read this as: _"do the next phase, then start fresh and do the one after that, and keep going."_ Each
phase becomes its own **pull request** (a reviewable proposal on GitHub) with its own green tests
before it merges — no single giant change. Because it works one phase at a time with a clean start
each time, even a project with a dozen design docs never overwhelms it. Full details:
[Autonomous runs](autonomous-runs.md).

**Step 3 — check in whenever.**

```
/autopilot-status     # 📊 what's done · what's next · which pull request is mid-flight
```

Progress lives in your project's history, not the chat. Stop on Friday, run the same `/loop` line
Monday — it picks up the next unfinished phase automatically. 🗓️

**Thought of the _next_ migration mid-run?** Scope it now — autopilot **queues** it on your machine
without disturbing the run in flight, and prompts you to promote it once this one finishes. Keep each
migration its own pipeline (one coherent pull request), not phases bolted onto this one. See
[Autonomous runs](autonomous-runs.md#lining-up-the-next-feature).

---

## 3. 🧪 The quality-first team (with the power-ups on)

> _"Our coverage numbers lie. I want tests that actually catch regressions."_

```
# with the optional ruflo + agentic-qe tools installed, autopilot auto-detects them
/autopilot-init "Add rate limiting to the public API (spec: RATE_LIMIT.md)"
/autopilot-run
# 🔬 risky phases now get extra checks: mutation testing + a resilience pass, on top of the standard gate
```

With the optional [power-ups](power-ups.md) installed, the gate won't go green until the test suite
_demonstrably_ catches injected bugs — not just runs. Without them, autopilot still runs its standard
gate; the power-ups only ever add depth, never block you. 💪

---

## 4. 🔭 Just checking status

```
/autopilot-status
# ✅ Phase 1 (schema) — merged
# ✅ Phase 2 (signup) — merged
# 🔄 Phase 3 (login) — pull request #14 open, CI running…
# ⏭️ Next: session middleware
```

Works any time, in a fresh session, even weeks later — because the status is read straight from your
project's history.

---

## What's next

- New here? → [Getting started](getting-started.md)
- Want the hands-off setup behind use case #2? → [Autonomous runs](autonomous-runs.md)
- What do the optional tools add? → [Power-ups](power-ups.md)
