# Autopilot — workflow & effort, step by step

How a feature goes from spec to merged, and exactly where the optional power-ups plug in **only when
detected** — _execution_ accelerators (ruflo / agentic-qe (aqe)) during implement+gate, and _planning_
skills (superpowers / clarity / deep-research) during `plan`. Everything works without them; when
present, autopilot actively drives them.

## End-to-end flow

```mermaid
flowchart TD
    A([User: goal + spec]) --> INIT["/autopilot-init"]

    subgraph SETUP["One-time setup"]
        INIT --> PLAN["autopilot:plan<br/>reads FULL corpus: spec · PRD · ADR · DDD<br/>→ phases + machine-checkable DoD<br/>+ per-phase adrs/ddd slices"]
        PLAN --> DETECT["autopilot:detect<br/>probe stack + corpus + accelerators<br/>(global PATH & project footprint)"]
        DETECT --> CONFIRM{User confirms<br/>commands?}
        CONFIRM -->|edit| DETECT
        CONFIRM -->|ok| FILES[".autopilot/pipeline.yml<br/>.autopilot/profile.yml"]
    end

    FILES --> RUN["/autopilot-run  →  autopilot:orchestrate (under /loop)"]

    subgraph LOOP["Per firing — ONE phase, fresh context"]
        RUN --> STATE["Locate state:<br/>git grep '(autopilot:feature_id): … gate PASSED' → next phase N"]
        STATE --> DONE{N past<br/>last phase?}
        DONE -->|yes| OPT["Optimization pass<br/>→ integration PR (base→trunk)<br/>→ END loop"]
        DONE -->|no| ACC{Accelerators<br/>available?}
        ACC -->|ruflo| RUFLO["ruflo memory recall<br/>swarm init --v3-mode<br/>spawn researcher→architect→coder→tester→reviewer"]
        ACC -->|aqe| AQE["fleet_init once"]
        ACC -->|neither| SOLO["focused subagents (baseline)"]
        RUFLO --> RP
        AQE --> RP
        SOLO --> RP["autopilot:run-phase<br/>comprehend slice → TDD → integrate"]
        RP --> GATE["QUALITY GATE (templates/gate.md.tmpl)"]
        GATE --> VERDICT{All applicable<br/>checks green?}
        VERDICT -->|no| STOPF["Report failing check + output<br/>append FAILED ledger line<br/>leave work as-is → STOP (resume next firing)"]
        VERDICT -->|yes| MARK["commit '(autopilot:feature_id): phase N — gate PASSED'<br/>append ledger line (runs/feature_id.jsonl)<br/>persist summary (ruflo mem if present)"]
        MARK --> MODE{autonomy mode}
        MODE -->|reviewed| STOPR["STOP for human review"]
        MODE -->|pr_ci| PR["branch → PR → CI watch →<br/>fix-loop ≤ fix_budget → squash-merge into base"]
        PR --> STATE
    end
```

## The gate, expanded (where aqe layers in)

```mermaid
flowchart TD
    G([Gate for phase N]) --> T1["Tier 1 — Functional (every phase)<br/>infra · format · lint · build · test ·<br/>integration · audit · no-test-tampering · security-grep<br/>(all commands from profile.yml)"]
    T1 --> T2["Tier 2 — Definition of Done (every phase)<br/>each DoD line verified: cmd / grep / prose<br/>+ aqe coverage_analyze_sublinear (if aqe)"]
    T2 --> T3["Tier 3 — Adversarial review (every phase, the floor)<br/>reviewer subagent + /code-review"]
    T3 --> RISK{phase ∈ risk_phases<br/>AND aqe available?}
    RISK -->|no| V
    RISK -->|yes| T4["Tier 4 — Heavy passes (aqe fleet)<br/>mutation · pentest 'No Exploit No Report' · chaos"]
    T4 --> V{quality_assess<br/>go / no-go}
    V -->|green| PASS([gate PASSED])
    V -->|red| FAIL([gate FAILED → STOP])
```

## Comprehension: who reads what (the memory contract)

```mermaid
flowchart LR
    subgraph CORPUS["Design corpus (in target repo)"]
        SPEC[spec]; PRD[PRD]; ADR[ADRs]; DDD[DDD]
    end
    PLAN["autopilot:plan<br/>(reads corpus BROADLY — once)"] -->|writes per-phase<br/>adrs/ddd slices| PIPE[(pipeline.yml)]
    CORPUS --> PLAN
    PIPE --> RP["autopilot:run-phase<br/>(reads only THIS phase's slice)"]
    ADR -.only named ADRs.-> RP
    DDD -.only named aggregates.-> RP
    PRD -.relevant section.-> RP
    RP -->|compact summary| MEM[("ruflo memory<br/>namespace: autopilot")]
    MEM -.recall on later phases.-> RP
```

## Artifacts & replay (what each run leaves behind)

Every run is reconstructable from the target repo alone — no conversation memory, and (except where
noted) no ruflo. Everything is scoped by `feature_id`, so running autopilot repeatedly in one repo keeps
each feature's state cleanly separate.

| Artifact                       | Where                                                                   | Role                                                                                                                                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `gate PASSED` markers          | git commits, `(autopilot:<feature_id>): phase N complete — gate PASSED` | **Authority** for "what phase is next" — re-derived by grep every firing                                                                                                                                           |
| Session ledger                 | `.autopilot/runs/<feature_id>.jsonl` (committed)                        | **Replayable history** — first line is the plan snapshot (`type:plan`), then one JSON line per firing (phase · verdict · skipped · ci_attempts · PR · accelerators · timestamp), pass or fail. Works with no ruflo |
| `pipeline.yml` / `profile.yml` | `.autopilot/` (committed)                                               | The plan + stack profile — editable, re-runnable                                                                                                                                                                   |
| Branches / PRs (pr_ci)         | GitHub: `autopilot/<feature_id>/phase-N`, the integration PR            | In-flight resume points                                                                                                                                                                                            |
| Phase summaries                | ruflo memory `autopilot` namespace — **only if ruflo present**          | Optional richer recall on later phases                                                                                                                                                                             |

The ledger is the human-readable companion to the markers: markers answer _where are we_, the ledger
answers _how did each phase get there_ — including FAILED attempts, which never leave a marker. To
audit or replay a run, read `.autopilot/runs/<feature_id>.jsonl`; `/autopilot-status` summarizes it.

## Effort summary

| Stage                 | Without accelerators (baseline)                    | With ruflo                            | With aqe                                            |
| --------------------- | -------------------------------------------------- | ------------------------------------- | --------------------------------------------------- |
| Plan                  | read corpus, score readiness, decompose, write DoD | + memory recall of prior decisions    | + `requirements_validate` scores/makes DoD testable |
| Detect                | probe stack/corpus, confirm                        | (records ruflo scope)                 | (records aqe scope)                                 |
| Implement             | TDD with focused subagents                         | hierarchical-mesh swarm, peer-to-peer | seed RED with `qe-test-architect`                   |
| Gate T1–T3            | commands + reviewer subagent + /code-review        | swarm reviewer                        | coverage_analyze_sublinear                          |
| Gate T4 (risk_phases) | — (relies on T3 floor)                             | —                                     | mutation · pentest · chaos                          |
| Advance               | git marker (+ optional PR/CI)                      | persist summary to memory             | persist QE signals to memory                        |

**Planning skills (Plan stage only).** When the spec scores thin, `plan` step 2 enriches on a degrade
ladder before decomposing: **best** — `deep-research` produces a **cited** brief (saved to
`.autopilot/research/<feature_id>.md`) and `clarity` turns it into numbered testable requirements;
**middle** — when those are absent but `ruflo` is present, its `researcher` + SPARC `specification`
agents and `hive-mind` consensus draft requirements (no citation discipline, so claims are flagged
unverified); **floor** — `superpowers:brainstorming` or an inline rubric. The user confirms before
phases are shaped. Like the execution accelerators, these change how sharp the spec is — never whether a
phase can pass.

The invariant across every column: **a red gate never advances, and a missing accelerator never fails
the gate** — accelerators change speed and depth, not the pass/fail meaning.
