# 🌙 Autonomous runs — hands-off, across many sessions

Once you've watched autopilot build a few phases and you trust it, you can let it run a whole feature
**unattended**: it opens pull requests, waits for the automated checks, fixes its own failures, and
merges each finished phase — repeating until the whole feature is staged for your final sign-off. Go
to sleep; wake up to merged work.

New to terms like _pull request_, _CI_, _branch_, or _merge_? They're all decoded in the
[glossary](concepts.md#-glossary).

---

## The two modes

autopilot runs in one of two modes, set by one line (`autonomy:`) in `.autopilot/pipeline.yml`:

| Mode           | What happens                                                                                                                                 | Best for                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **`reviewed`** | Builds one phase **on your machine**, proves it with your tests, then **stops** for you to look. Needs only a local git project — no GitHub. | Your first runs; trying things out; staying close to every step. |
| **`pr_ci`**    | Fire-and-forget. Each phase becomes a branch → pull request → automated checks → auto-merge into the integration branch.                     | Long features you want built while you're away.                  |

`reviewed` is the default. Flip to `pr_ci` when you're ready to step back.

---

## How `/loop` and autopilot fit together

This is the combo from use case #2, explained:

- **`autopilot:orchestrate`** is the worker. It looks at your project history, finds the next
  unfinished phase, builds **exactly that one phase**, and **stops**. One phase per run — always.
- **`/loop`** is the driver. It re-runs orchestrate over and over, each time with a **fresh start**,
  until every phase is done. The fresh start each time is what keeps a long feature from overwhelming
  the AI's working memory.

You start it with one line:

```
/loop Invoke the autopilot:orchestrate skill — run the next phase, then stop.
```

Read it as: _"do the next phase, then start clean and do the one after, and keep going until the
feature is finished."_ Because progress is saved in your project's history (not the chat), you can
stop the loop any time and restart it later with the same line — it always resumes at the next
unfinished phase.

> The shorter form `/loop /autopilot-run` also works, but the line above is the recommended one: it's
> explicit about the "run one phase, then stop" contract that makes long runs safe.

---

## What a hands-off run does, end to end

In `pr_ci` mode, for each phase, autopilot:

1. Makes a **branch** (a safe, separate copy) for the phase.
2. Builds the phase test-first and opens a **pull request** with a clear description.
3. Waits for **CI** — GitHub's automated checks — to run on that pull request.
4. If checks fail, **fixes its own failures** for a few rounds (a budget you set, `fix_budget`).
5. When checks are green, **merges** the phase into the integration branch (`base`).
6. Moves to the next phase, fresh.

When every phase has landed, autopilot opens **one final pull request** from the integration branch
into your main branch — and **stops**. A human always makes that last merge. autopilot never merges
into your main branch on its own.

---

## What you need for `pr_ci` mode

| You'll need                                                                           | Why                                                       |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| A git project with a **GitHub** home, and `gh` (GitHub's command-line tool) logged in | So autopilot can push, open pull requests, and merge      |
| **CI** that runs your checks on pull requests into the integration branch             | This is the authority that decides each merge — see below |
| The `/loop` feature                                                                   | To re-run one phase after another, hands-off              |

### "I don't have any CI set up." — That's fine

Autonomous mode relies on GitHub running your tests on each pull request and only merging when
they're green. So it needs CI. **You don't have to set that up yourself.** During `/autopilot-init`
(or `/autopilot-detect`), if autopilot sees no CI, it **stops and offers** to:

- 🛠️ **Set it up for you** — autopilot writes a ready-to-go GitHub Actions workflow from the same
  test/build commands it just detected. You add one line: your language's setup step (e.g. Node, Go,
  Python) — or just tell autopilot your language and it fills it in. ✅
- 🧍 **Skip CI entirely** — switch to `reviewed` mode, where autopilot runs the checks locally and
  stops after each phase for you.

Either way, **autopilot never merges a pull request that wasn't actually tested.** If the checks
somehow didn't run at all, it treats that as _not done_, refuses to merge, and tells you exactly what
to do. A merge with zero checks would be the AI grading its own homework — and that's exactly what
the design forbids. 🛡️

---

## Safety rails (always on)

- 🛡️ **Your main branch is sacred.** It's never merged into automatically — a human always makes the
  final merge.
- ✅ **No faked passes.** A skipped check is reported as skipped; a red gate never advances.
- 🔒 **No risky history rewrites.** Fixes only ever go to the phase's own branch, never forced onto
  shared branches.
- 🧭 **Bounded self-fixing.** autopilot retries a failing check only up to your `fix_budget`, then
  hands off to you instead of thrashing forever.

---

## What's next

- Want the gentle first run before going hands-off? → [Getting started](getting-started.md)
- Why can it be trusted unattended? → [Concepts](concepts.md)
- Faster runs and deeper checks? → [Power-ups](power-ups.md)
