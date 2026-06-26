# 🛸 claude-autopilot

**Point Claude Code at a big feature. Walk away. Come back to shipped, tested code.**

claude-autopilot is an autonomous, **stack-agnostic feature pipeline** for
[Claude Code](https://claude.com/claude-code) — packaged as a one-command install. You give it a
goal and a spec; it breaks the work into phases, builds each one test-first behind a quality gate
that *can't be faked*, and ships them through GitHub PR → CI → merge. It works on **any language or
framework**, and it's **resumable forever** — stop today, fire it again in three weeks, and it picks
up exactly where it left off. 🔁

---

## 🤔 Why does this exist?

AI coding assistants are amazing at the next 50 lines. They're *terrible* at the next 50 **steps**.

Ask one to "add multi-region replication" or "migrate us to the new auth system" and you get a
confident burst of code, a few passing-ish tests, and then… drift. The context window fills up, the
plan evaporates, and three sessions later nobody — human or AI — remembers what "done" was supposed
to mean. You become a babysitter. 😮‍💨

**claude-autopilot fixes the part the chat window can't:** memory, discipline, and proof.

- 🧠 **It doesn't rely on memory.** The plan and progress live in your git history as durable
  markers — not in the conversation. The AI can forget everything and still know exactly what's next.
- ✅ **It can't lie about "done."** Every phase advances only when *machine-verified* checks pass.
  A skipped test is reported as skipped — never as a pass. A red build never gets waved through.
- 🚢 **It actually ships.** Real branches, real pull requests, real CI — the same workflow a senior
  engineer would use, run for you.
- 📒 **Every session is logged.** Each phase run appends to a committed `.autopilot/runs/` ledger —
  what passed, what was skipped, which PR, how many CI retries. Run it again next month and you have a
  complete, replayable history of how the feature was built.

---

## ✨ What it does for you

> Give it a feature. It returns reviewed, tested, merged commits — one phase at a time.

```
/autopilot-init  →  📋 plan (scope → phases)  +  🔎 detect (your stack → gate commands)   ← one-time setup
/autopilot-run   →  🔁 orchestrate loop: one phase per fresh context
                       reviewed  → implement → gate → ✅ "gate PASSED" marker → STOP for your review
                       pr_ci     → branch → PR → CI → bounded fix-loop → 🟢 squash-merge
                    …repeat until every phase lands → open one final PR → 🧍 STOP for a human
```

Two small files in **your** repo drive the whole thing:

- 📄 `.autopilot/pipeline.yml` — the few things you supply (goal, spec, branches, how much autonomy
  you want) plus the generated phase plan, where **every phase has a checkable Definition of Done.**
- 🛠️ `.autopilot/profile.yml` — your stack's build/test/lint commands and conventions, auto-detected
  then confirmed by you. The quality gate runs *these* — nothing about your stack is hard-coded.

Plus a `.autopilot/runs/<feature>.jsonl` ledger autopilot keeps as it works — your replayable session
log. Each feature gets a unique id, so you can run autopilot for many features in the same repo without
their histories ever getting tangled. 🧵

---

## 🌱 New to Git & GitHub? This is your senior engineer on call.

If you're a **vibe-coder** — you can describe what you want and read code, but branches, PRs, CI, and
"why is my main branch broken" still feel like dark magic — this is built for you. 💜

claude-autopilot runs the professional Git workflow *so you don't have to learn it under pressure:*

- 🌿 **It makes the branches.** You never have to remember `git checkout -b`.
- 🔀 **It opens the pull requests** and writes sensible descriptions.
- 🤖 **It waits for CI** (the automated checks GitHub runs) and **fixes its own failures** within a
  budget before asking for help.
- 🛡️ **It never touches `main` on its own.** Your default branch is sacred — a *human* always merges
  the final integration PR. You stay in control of the big green button. 🟢

You get to keep vibing on *what* to build. The plumbing of *how to ship it safely* is handled — and
because it's all standard Git/GitHub underneath, you're quietly learning the real workflow by watching
it happen, not by reading a 40-tab tutorial. 📚➡️🧘

---

## 🔂 Built for *repeatable* quality, not one-off luck

The whole point is that you can do this **again and again** and get the same disciplined result:

1. 📝 **Write a spec** (even a rough one — `plan` will sharpen it into phases).
2. 🚀 `/autopilot-init` → review the proposed phases, confirm the detected build/test commands.
3. 🏃 `/autopilot-run` → it drives one phase, stops, shows you the result.
4. 😌 Like what you see? Flip to autonomous mode and let it run the rest hands-free.
5. 🔁 Next feature? Same five steps. Same gate. Same quality floor. Every. Single. Time.

Because the quality gate is **machine-verified** and the same on every phase, "quality" stops being a
mood and becomes a guarantee. Test-driven development isn't a suggestion here — it's the rail the
whole pipeline rides on. 🛤️

---

## ⚡ Optional power-ups: a more solid foundation with ruflo & agentic-qe

claude-autopilot runs great on a **vanilla setup** — just Claude Code, `git`, and `gh`. Out of the
box, every phase is still gated by a reviewer pass plus `/code-review`. 🆗

But if you have [**ruflo**](https://github.com/ruvnet/ruflo) and
[**agentic-qe** (`aqe`)](https://github.com/proffesor-for-testing/agentic-qe) installed, autopilot
automatically detects them and levels up — no config required:

- 🧩 **ruflo → orchestration + memory.** Multi-agent swarms tackle a phase in parallel, and
  cross-session memory means lessons from phase 2 inform phase 9. The pipeline gets *faster* and
  *smarter the longer it runs*, instead of starting cold every context.
- 🔬 **agentic-qe → deeper proof.** Mutation testing (does your test suite actually catch bugs, or
  just run?), coverage analysis, plus pentest and chaos passes on your riskier phases. The gate goes
  from "tests pass" to "tests are *proven effective*." 🛡️

Think of it as three tiers: 🥉 **vanilla** (always works) → 🥈 **+ruflo** (faster, remembers) →
🥇 **+aqe** (harder to fool). Each tier degrades gracefully — if a tool isn't there, that phase
simply runs at the tier below. Nothing ever *blocks* on an accelerator being present. 🙌

---

## 📦 Install

```
/plugin marketplace add agentic-incubator/claude-autopilot
/plugin install autopilot
```

*(Developing locally? Add this repo's path as a local marketplace instead.)*

### 🗑️ Uninstall

```
/plugin uninstall autopilot
/plugin marketplace remove agentic-incubator/claude-autopilot
```

Removing the plugin doesn't touch your work — any `.autopilot/` files and the git markers in your
repos stay put. 👌

---

## 🏁 Quickstart

```
cd your-repo
/autopilot-init "Add multi-region replication to the storage layer (spec: docs/specs/replication.md)"

# 👀 review the proposed phases + confirm the detected build/test commands

/autopilot-run        # reviewed mode: drives one phase, then stops for you
```

When you trust it, set `autonomy: pr_ci` in `.autopilot/pipeline.yml` and wrap it in `/loop` for
hands-off, multi-session execution. 🌙 Go to sleep; wake up to merged phases.

---

## 💡 Use cases & sample sessions

### 1. 🧑‍🎨 The vibe-coder shipping a real feature

> *"I built a to-do app and now I want real user accounts. I've never opened a pull request."*

```
/autopilot-init "Add email/password auth with sessions and a logout button (spec: AUTH.md)"
# autopilot proposes: [schema → signup → login → session middleware → logout → UI wiring]
/autopilot-run    # watch it build the DB schema phase, write tests, show you a green gate
```

You review one bite-sized phase at a time. No "where do I even start" paralysis — and you never had
to type a `git` command. 🌿

### 2. 🏗️ The complex, multi-week migration

> *"Migrate our payments from the legacy gateway to the new one — without a 3,000-line mega-PR."*

```
/autopilot-init "Migrate billing to NewPay; keep LegacyPay behind a flag until cutover (spec: docs/migration.md)"
# set autonomy: pr_ci in .autopilot/pipeline.yml
/loop /autopilot-run    # 🔁 one phase → PR → CI → merge, repeat across many sessions
/autopilot-status       # 📊 check in anytime: done / next / in-flight PR + CI
```

Each phase is its own reviewable PR with its own green CI. Stop on Friday, resume Monday — the git
markers remember everything. 🗓️

### 3. 🧪 The quality-first team (with the power-ups on)

> *"Our coverage numbers lie. I want tests that actually catch regressions."*

```
# ruflo + aqe installed → autopilot auto-detects them
/autopilot-init "Add rate limiting to the public API (spec: RATE_LIMIT.md)"
/autopilot-run
# 🔬 risk phases now get mutation testing + a chaos pass on top of the standard gate
```

The gate won't go green until the test suite *demonstrably* kills mutants — not just runs. 💪

### 4. 🔭 Just checking status

```
/autopilot-status
# ✅ Phase 1 (schema) — merged
# ✅ Phase 2 (signup) — merged
# 🔄 Phase 3 (login) — PR #14 open, CI running…
# ⏭️ Next: session middleware
```

---

## 🧰 Commands

| Command | What it does |
|---|---|
| `/autopilot-init` | 🚀 Scope the feature into phases **+** detect your stack (plan → detect). |
| `/autopilot-plan` | 📋 (Re)generate the phase plan only. |
| `/autopilot-detect` | 🔎 (Re)detect + confirm your build/test/lint profile only. |
| `/autopilot-run` | 🏃 Drive the next phase (or a named one). |
| `/autopilot-status` | 📊 Show progress: done / next / in-flight PR + CI. |

Commands are thin wrappers — the real logic lives in four skills (`plan`, `detect`, `run-phase`,
`orchestrate`), so Claude can also invoke them automatically when the moment fits. 🪄

---

## ✅ Prerequisites

| You'll need | When |
|---|---|
| A git repo + GitHub remote, with `gh` logged in (push/PR/merge) | required for `pr_ci` (autonomous) mode |
| CI that runs your checks on the `base` branch | required for `pr_ci` mode |
| The `/loop` skill | for hands-off, long-horizon runs |
| `ruflo` / `agentic-qe` (`aqe`) | ✨ **optional** power-ups — absence degrades gracefully |

👉 `reviewed` mode works with **just a local git repo** — perfect for trying it out before you wire up
GitHub. And remember: `trunk` (your default branch, usually `main`) is *never* merged autonomously. A
human always merges the final integration PR. 🧍

---

## 🗂️ Layout

```
.claude-plugin/marketplace.json      # this repo is its own marketplace
plugins/autopilot/
  .claude-plugin/plugin.json
  skills/{plan,detect,run-phase,orchestrate}/SKILL.md
  commands/autopilot-{init,plan,detect,run,status}.md
  templates/{pipeline.yml,profile.yml,gate.md.tmpl}
```

Curious how the machinery works under the hood? See
[`plugins/autopilot/README.md`](plugins/autopilot/README.md) for the design rationale. 🔍

---

## 📜 License

MIT — see [LICENSE](LICENSE). Build something great. 💛
