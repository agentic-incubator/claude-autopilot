# 🛸 claude-autopilot

[![CI](https://github.com/agentic-incubator/claude-autopilot/actions/workflows/ci.yml/badge.svg)](https://github.com/agentic-incubator/claude-autopilot/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/agentic-incubator/claude-autopilot)](https://github.com/agentic-incubator/claude-autopilot/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Point Claude Code at a big feature. Walk away. Come back to shipped, tested code.**

claude-autopilot is an autonomous, **stack-agnostic feature pipeline** for
[Claude Code](https://claude.com/claude-code) — packaged as a one-command install. You give it a
goal and a spec; it breaks the work into small phases, builds each one test-first behind a quality
gate that _can't be faked_, and ships them through GitHub pull request → automated checks → merge. It
works on **any language or framework**, and it's **resumable forever** — stop today, fire it again in
three weeks, and it picks up exactly where it left off. 🔁

New to branches, pull requests, or CI? That's fine — this is built for you too, and every term is
explained in plain English in the [glossary](docs/concepts.md#-glossary).

---

## ⚡ The 60-second version

```
cd your-repo
/autopilot-init "Add multi-region replication to the storage layer (spec: docs/specs/replication.md)"

# 👀 review the proposed phases + confirm the detected build/test commands

/autopilot-run        # builds one phase, proves it with your tests, then stops for you
```

When you trust it, let it run a whole feature hands-off across many sessions →
[Autonomous runs](docs/autonomous-runs.md).

---

## 📚 Guides

Start with whichever fits you:

| Guide                                                     | Read it when                                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 🚀 [**Getting started**](docs/getting-started.md)         | You want your first feature built, step by step, no jargon.                             |
| 🧠 [**How it works + glossary**](docs/concepts.md)        | You want to understand _why_ it can be trusted — and what ADR, CI, PR, etc. mean.       |
| 💡 [**Use cases**](docs/use-cases.md)                     | You want real examples: a first feature, a multi-week migration, a quality-first team.  |
| 🌙 [**Autonomous runs**](docs/autonomous-runs.md)         | You want it hands-off — opening pull requests, waiting for CI, merging across sessions. |
| ⚡ [**Power-ups**](docs/power-ups.md)                     | You want faster runs and deeper, harder-to-fool checks (optional tools).                |
| 🔍 [**Design notes**](plugins/autopilot/docs/WORKFLOW.md) | You want the deep, diagrammed rationale under the hood.                                 |

---

## 🤔 Why it exists

AI coding assistants are amazing at the next 50 lines. They're _terrible_ at the next 50 **steps.**
Ask one to "migrate us to the new auth system" and you get a confident burst of code, a few
passing-ish tests, and then… drift. The context window fills up, the plan evaporates, and nobody
remembers what "done" meant.

claude-autopilot fixes the part the chat window can't — **memory, discipline, and proof:**

- 🧠 **It doesn't rely on memory.** The plan and progress live in your git history as durable
  markers, not in the conversation. The AI can forget everything and still know what's next.
- ✅ **It can't lie about "done."** Every phase advances only when _machine-verified_ checks pass. A
  skipped test is reported as skipped — never as a pass.
- 🚢 **It actually ships.** Real branches, real pull requests, real CI — the workflow a senior
  engineer would use, run for you.
- 📒 **Every session is logged.** Each run appends to a committed ledger you can replay months later.

The how-and-why behind each of these is in [How it works](docs/concepts.md).

---

## 📦 Install

```
/plugin marketplace add agentic-incubator/claude-autopilot
/plugin install autopilot
```

_(Developing locally? Add this repo's path as a local marketplace instead.)_

**Uninstall:**

```
/plugin uninstall autopilot
/plugin marketplace remove agentic-incubator/claude-autopilot
```

Removing the plugin doesn't touch your work — any `.autopilot/` files and git markers in your repos
stay put. 👌

---

## 🧰 Commands

| Command             | What it does                                                              |
| ------------------- | ------------------------------------------------------------------------- |
| `/autopilot-init`   | 🚀 Scope the feature into phases **+** detect your stack (plan → detect). |
| `/autopilot-plan`   | 📋 (Re)generate the phase plan only.                                      |
| `/autopilot-detect` | 🔎 (Re)detect + confirm your build/test/lint profile only.                |
| `/autopilot-run`    | 🏃 Drive the next phase (or a named one).                                 |
| `/autopilot-status` | 📊 Show progress: done / next / in-flight pull request + CI.              |

Commands are thin wrappers — the real logic lives in four skills (`plan`, `detect`, `run-phase`,
`orchestrate`), so Claude can also invoke them automatically when the moment fits. 🪄

---

## ✅ Prerequisites

`reviewed` mode (the default) needs only a **local git repo** — perfect for trying it out. Hands-off
`pr_ci` mode adds a **GitHub** repo with `gh` logged in and **CI on pull requests** (autopilot sets
that up for you if you don't have it). The optional **planning** (superpowers, clarity, deep-research)
and **execution** (ruflo, agentic-qe) power-ups are all detected automatically and degrade gracefully
when absent. Full details in
[Autonomous runs](docs/autonomous-runs.md#what-you-need-for-pr_ci-mode).

---

## 🗂️ Layout

```
.claude-plugin/marketplace.json      # this repo is its own marketplace
docs/                                # user guides (getting-started, concepts, use-cases, autonomous-runs, power-ups)
plugins/autopilot/
  .claude-plugin/plugin.json
  skills/{plan,detect,run-phase,orchestrate}/SKILL.md
  commands/autopilot-{init,plan,detect,run,status}.md
  templates/{pipeline.yml,profile.yml,gate.md.tmpl,ci-gate.yml.tmpl}
  docs/WORKFLOW.md                   # deep design rationale
```

---

## 📜 License

MIT — see [LICENSE](LICENSE). Build something great. 💛
