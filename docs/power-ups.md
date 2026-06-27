# ⚡ Optional power-ups — sharper specs, faster runs, deeper proof

autopilot runs great on a **plain setup** — just Claude Code, git, and (for autonomous mode) GitHub's
`gh` tool. Out of the box, every phase is still checked by a code-review pass plus an automated review
command, and a vague spec still gets brainstormed into shape. You never need anything else. 🆗

But autopilot also looks for a handful of optional tools. **The contract is the same for every one of
them:** if it's installed, autopilot detects it automatically and levels up — no configuration. If it's
not there, nothing breaks; that step simply runs at the level below. Power-ups change _how sharp, how
fast, and how thoroughly_ you reach a result — **never** whether a phase passes.

They come in two groups, by the job they help with.

---

## 🧭 Planning & spec quality

These fire while autopilot is turning your goal into a phase plan. A weak spec is the cheapest thing to
fix _before_ any code is written — these make that fix grounded instead of guessed. autopilot matches
them **by skill name**, so any skill registered under the name below (from a marketplace, a plugin, or
your own `~/.claude/skills/`) counts as "installed."

### 🧠 superpowers — structured brainstorming

[superpowers](https://github.com/obra/superpowers-marketplace) is a plugin of disciplined workflow
skills. autopilot uses its **brainstorming** skill to surface unknowns and force decisions when a goal
is ambiguous, before they calcify into a bad plan.

- **Install:** two quick lines, right inside Claude Code. First point Claude Code at the catalog it
  lives in, then install it: `/plugin marketplace add anthropics/claude-plugins-official`, then
  `/plugin install superpowers`. No restart needed. (Prefer the author's own catalog? Use
  `/plugin marketplace add obra/superpowers-marketplace` instead, then the same install line.)
- **What it adds:** ambiguous goals get interrogated up front, so phases start from decisions instead of
  guesses. It's also the **floor** for spec enrichment when the two tools below aren't installed.

### 📐 clarity — reference material → testable requirements

`clarity` is a skill that reads your reference material — repos, URLs, PRDs, ADRs, DDD docs — and emits
**structured specs with numbered, testable requirements**.

- **Install:** clarity is a free, open-source skill (MIT-licensed, by FrancyJGLisboa). You add it by
  copying its project into your personal skills folder — one line in your terminal:
  `git clone https://github.com/francyjglisboa/clarity.git ~/.claude/skills/clarity`. Claude Code picks
  it up automatically the next time it starts, and autopilot finds it by the name `clarity`. (No
  marketplace needed — it's just files in a folder.)
- **What it adds:** turns fuzzy docs into numbered requirements autopilot can convert straight into
  machine-checkable Definition-of-Done lines — the difference between a phase a gate can verify and one
  it can't.

### 🔎 deep-research — grounded, cited research

`deep-research` is a skill that fans out web searches, fetches sources, **adversarially verifies
claims**, and synthesizes a **cited** report.

- **Install:** good news — there's nothing to install. `deep-research` comes built into Claude Code.
  Type `/deep-research` to check it's there; if it isn't, updating Claude Code to the latest version
  brings it in. (It needs internet access to actually search the web.)
- **What it adds:** when your spec scores thin, autopilot scopes a research pass to the exact gaps and
  writes a cited brief to `.autopilot/research/<feature>.md` — durable, reviewable evidence that
  sharpens the spec. You confirm the findings before they shape any phase; research is evidence for your
  decision, never auto-accepted as fact.

---

## ⚡ Execution speed & proof

These fire while autopilot is implementing and gating each phase.

### 🧩 ruflo — orchestration + memory

[ruflo](https://github.com/ruvnet/ruflo) lets autopilot:

- **Work a phase with a team of agents in parallel** instead of one at a time — phases finish faster.
- **Remember across sessions** — lessons from phase 2 inform phase 9. The pipeline gets _smarter the
  longer it runs_ instead of starting cold every time.

- **Install:** ruflo is a command-line tool, so you'll need [Node.js](https://nodejs.org) first. Then
  one line installs it for your whole machine: `npm install -g ruflo`. autopilot spots it
  automatically — whether it's installed globally (on your PATH) or set up just for one project (a
  `.ruflo/` folder). More in the [ruflo repo](https://github.com/ruvnet/ruflo).

### 🔬 agentic-qe (`aqe`) — deeper proof

[agentic-qe](https://github.com/proffesor-for-testing/agentic-qe) makes the quality gate harder to
fool:

- **Mutation testing** — deliberately introduces small bugs to check your tests actually _catch_ them
  (not just run). The difference between "tests pass" and "tests are proven effective."
- **Coverage analysis** — finds the parts of your code no test touches.
- **Security and resilience passes** — applied to your riskier phases.
- **Requirements validation** — also used during planning to _score_ how testable your spec is.

- **Install:** another command-line tool, so [Node.js](https://nodejs.org) first. Install it once with
  `npm install -g agentic-qe`, then run `aqe init` inside the repo you're working in to switch it on
  there. autopilot detects `aqe` automatically — on your PATH, or by the footprint `aqe init` leaves
  behind. More in the [agentic-qe repo](https://github.com/proffesor-for-testing/agentic-qe).

---

## How they stack — each degrades gracefully

| Step                  | Vanilla floor (always works)                     | + planning power-ups                                                    | + execution power-ups                                        |
| --------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Plan a weak spec**  | Brainstorm + inline rubric sharpen the spec      | `clarity` + `deep-research` give cited, numbered, testable requirements | —                                                            |
| **Implement a phase** | One focused agent at a time                      | —                                                                       | `ruflo` runs a parallel agent team + recalls past phases     |
| **Gate a phase**      | Reviewer pass + `/code-review` + native coverage | —                                                                       | `aqe` adds mutation/coverage; pentest + chaos on risk phases |

If a tool isn't installed, that step simply runs at the level to its left. **Nothing ever blocks on a
power-up being present** — the vanilla floor runs everywhere, every time, and a missing power-up never
turns a red result green.

The full breakdown of exactly what each tool changes at each step lives in the design reference:
[`plugins/autopilot/docs/WORKFLOW.md`](../plugins/autopilot/docs/WORKFLOW.md).

---

## What's next

- New here? → [Getting started](getting-started.md)
- How the gate works (and why it can't be faked)? → [Concepts](concepts.md)
- See the quality-first team in action? → [Use cases](use-cases.md)
