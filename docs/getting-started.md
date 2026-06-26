# 🚀 Getting started — your first feature, step by step

This is the gentle on-ramp. No prior knowledge of branches, pull requests, or CI assumed — if any
of those words are new, that's fine, and [Concepts & glossary](concepts.md) explains every one of
them in plain English.

The promise: you describe a feature, and autopilot builds it **one small, reviewable piece at a
time** — writing the tests first, checking its own work, and stopping to show you each piece before
moving on. You stay in control the whole way.

---

## Before you start

You only need two things for this first run:

1. **A code project** that's tracked with **git** (if you've ever run `git init` or cloned a repo,
   you're set).
2. **Claude Code** with the autopilot plugin installed — see [Install](../README.md#-install).

That's it. This first walkthrough uses **reviewed mode**, which runs everything on your own machine
and stops after each step for you to look. It does **not** need GitHub, CI, or any extra tools. When
you're ready to let it run unattended, [Autonomous runs](autonomous-runs.md) takes it further.

---

## Step 1 — Set it up

Open Claude Code inside your project and run:

```
/autopilot-init "Add email/password login with a logout button (spec: AUTH.md)"
```

Read that command as: *"Get ready to build this feature; here's a one-line description, and the
details are in the file `AUTH.md`."* The `spec:` part is optional — if you don't have a written spec
yet, just describe the feature in the sentence and autopilot will ask you questions to fill the gaps.

**What this does for you:** autopilot reads your description (and any docs you point it at), then
breaks the feature into a short list of **phases** — small, self-contained steps that each leave your
project working. For example, login might become:

```
schema → signup → login → keep-you-signed-in → logout → wire up the buttons
```

It also takes a quick look at your project to figure out how to run your tests and build, and asks
you to confirm it got that right. (Those test/build commands are what it uses later to *prove* each
phase works — so a few seconds confirming them here is worth it.)

You end up with two small files in your project, under a new `.autopilot/` folder. You can read and
edit them like any other file; nothing is hidden.

---

## Step 2 — Look at the plan

autopilot shows you the list of phases it came up with. **Skim it.** This is the cheapest moment to
steer:

- A phase looks too big? Ask autopilot to split it.
- Something's in the wrong order? Tell it.
- Missing a step? Add it.

Nothing has been built yet — you're just agreeing on the map before the trip.

---

## Step 3 — Build the first phase

```
/autopilot-run
```

**What this does for you:** autopilot picks the first unfinished phase, writes the tests for it,
writes the code to make those tests pass, double-checks its own work, and then **stops**. It shows
you what it did and a green check that the tests really passed.

Crucially, it can't fake that green check. If a test was skipped, it tells you it was skipped — it
never pretends a skip is a pass. (Why that matters: [Concepts](concepts.md).)

You review the one small piece. Happy? Run `/autopilot-run` again for the next phase. Each run is one
bite-sized step you can actually understand.

---

## Step 4 — Check in any time

```
/autopilot-status
```

Shows you what's done, what's next, and (later, in autonomous mode) anything in flight:

```
✅ Phase 1 (schema) — done
✅ Phase 2 (signup) — done
⏭️  Next: login
```

Your progress is saved **in your project's history**, not in the chat. So you can close everything,
come back next week, run `/autopilot-status`, and pick up exactly where you left off.

---

## What's next

- Curious *how* it never loses its place or fakes a result? → [Concepts & glossary](concepts.md)
- Want it to run a whole feature unattended (open pull requests, wait for CI, merge)? →
  [Autonomous runs](autonomous-runs.md)
- Want to see bigger, real-world examples? → [Use cases](use-cases.md)
