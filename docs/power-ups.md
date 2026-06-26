# ⚡ Optional power-ups — faster runs, deeper proof

autopilot runs great on a **plain setup** — just Claude Code, git, and (for autonomous mode) GitHub's
`gh` tool. Out of the box, every phase is still checked by a code-review pass plus an automated review
command. You never need anything else. 🆗

But if you have two optional tools installed, autopilot **detects them automatically** and levels up —
no configuration required. If they're not there, nothing breaks; that phase simply runs at the level
below. Accelerators change _speed and depth_, never whether a phase passes.

---

## The two tools

### 🧩 ruflo — orchestration + memory

[ruflo](https://github.com/ruvnet/ruflo) lets autopilot:

- **Work a phase with a team of agents in parallel** instead of one at a time — phases finish faster.
- **Remember across sessions** — lessons from phase 2 inform phase 9. The pipeline gets _smarter the
  longer it runs_ instead of starting cold every time.

### 🔬 agentic-qe (`aqe`) — deeper proof

[agentic-qe](https://github.com/proffesor-for-testing/agentic-qe) makes the quality gate harder to
fool:

- **Mutation testing** — deliberately introduces small bugs to check your tests actually _catch_ them
  (not just run). It's the difference between "tests pass" and "tests are proven effective."
- **Coverage analysis** — finds the parts of your code no test touches.
- **Security and resilience passes** — applied to your riskier phases.

---

## Three tiers, each degrades gracefully

| Tier                | Setup                    | What you get                                                                |
| ------------------- | ------------------------ | --------------------------------------------------------------------------- |
| 🥉 **Vanilla**      | Claude Code + git + `gh` | Always works. Every phase gated by a reviewer pass + automated code review. |
| 🥈 **+ ruflo**      | add ruflo                | Faster (parallel agents) and remembers across sessions.                     |
| 🥇 **+ agentic-qe** | add ruflo + aqe          | Hardest to fool — mutation testing and resilience passes on risky phases.   |

If a tool isn't installed, that phase simply runs at the tier below. **Nothing ever blocks on an
accelerator being present** — the vanilla floor runs everywhere, every time.

The full breakdown of exactly what each tool changes at each step lives in the design reference:
[`plugins/autopilot/docs/WORKFLOW.md`](../plugins/autopilot/docs/WORKFLOW.md).

---

## What's next

- New here? → [Getting started](getting-started.md)
- How the gate works (and why it can't be faked)? → [Concepts](concepts.md)
- See the quality-first team in action? → [Use cases](use-cases.md)
