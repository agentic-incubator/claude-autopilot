# The Quality Gate — full reference

The gate is the heart of autopilot. It converts "the agent thinks the phase is done" into "verified
green checks." Read this when running Step 5 of `run-phase`, or when a gate result is ambiguous.

## Rendering the template

`templates/gate.md.tmpl` uses two namespaces:

- `{{commands.*}}` from `.autopilot/profile.yml`
- `{{phase.*}}` from the target entry in `.autopilot/pipeline.yml`

Resolve them, then run the checklist. An **empty command string means SKIP** — report it as
`skipped (no command configured)`, never as a pass. Silently treating an unconfigured check as green
is the one failure mode that quietly erodes trust in the whole pipeline.

## Tier 1 — Functional (every phase)

Run in this order so cheap checks fail fast before expensive ones:

| Check               | Source  | Notes                                                                                         |
| ------------------- | ------- | --------------------------------------------------------------------------------------------- |
| infra_up            | profile | Optional. Bring up db/services the tests need.                                                |
| format_check        | profile | Non-mutating. Fail = gate fail (don't auto-format and continue silently).                     |
| lint                | profile | Static analysis.                                                                              |
| build               | profile | Must compile/bundle.                                                                          |
| test                | profile | Primary suite.                                                                                |
| test_integration    | profile | Optional; may depend on infra_up.                                                             |
| test_frontend       | profile | Only if this phase touched UI.                                                                |
| audit               | profile | Optional dependency/vuln scan.                                                                |
| no-test-tampering   | —       | Diff-check: no pre-existing test deleted, `#[ignore]`'d, `.skip`'d, or commented out to pass. |
| security invariants | profile | Grep the diff against each `security_invariants:` line.                                       |

## Tier 2 — Definition of Done (every phase)

Each `definition_of_done:` line is a check, and the line's prefix says how to verify it:

- `cmd: <command>` → run it, paste passing output.
- `grep: <pattern>` → show the pattern is present.
- `grep:absent: <pattern>` → show the pattern does not appear in the new code.
- `prose: <claim>` → cite `file:line` where it's realized.

Every line must be ticked with evidence. An unticked DoD line fails the gate even if Tier 1 is green —
Tier 1 proves the project still works; Tier 2 proves _this phase_ did what it promised.

## Tier 3 — Adversarial review (every phase)

1. Spawn a reviewer subagent (a `reviewer`/`qe-code-reviewer` agent if available, else a general one)
   tasked to find gaps, untested branches, and silent shortcuts. Resolve each finding or record why
   it's out of scope.
2. Run `/code-review` on the diff; address correctness findings.

This is the floor that protects every phase even with zero accelerators installed.

## Tier 4 — Heavy adversarial passes (gated)

Run a Tier-4 pass only when **both** are true: the phase id is listed in `pipeline.risk_phases`, **and**
`accelerators.agentic_qe.available` is true. These are expensive and only worth it where the blast
radius is real (merge logic, anything that executes model-driven edits, auth/security surfaces):

- **mutation** — prove the suite actually kills bugs, not just covers lines. Score ≥ threshold.
- **pentest** ("No Exploit, No Report") — only report a vuln with a working exploit; covers the phase's
  attack surface (egress, secret handling, prompt injection if external content is involved).
- **chaos** — inject faults on the phase's failure paths; the system must degrade to a clean handoff,
  never a partial/corrupt state.

If `risk_phases` includes the phase but the accelerator is absent, note "heavy passes unavailable —
relying on Tier 3" and continue. Absence of an optional tool never fails the gate.

## The court — qe-court verdict on risk phases (gated, supersedes parts of Tier 4)

Convene when **all** hold: `accelerators.qe_court.available` is true, `pipeline.court` is not `off`,
and the phase qualifies (`court: auto` → phase id ∈ `risk_phases`; `court: all` → every phase).
qe-court (agentic-qe ≥ 3.13, its ADR-124) is an _orchestration skill_ — you convene it by following
its own protocol, never by reimplementing critics:

1. Read the court's `config.json` (under the aqe install's `.claude/skills/qe-court/`) for the
   prosecutor panel, per-role `routing`, and `overturnDepth`.
2. Spawn the prosecutors **in one message, in parallel, blind** (each files charges against the
   phase diff with its own probe set). Keep `security-scanner` and `mutation` seated — the court's
   own config warns that omitting them is how a false SHIP happens.
3. Kill round → jury (cross-vendor, writer ≠ juror) → three-valued verdict; if SHIP, the overturn
   round runs to `overturnDepth`.
4. Write the court record markdown to `.autopilot/court/<feature_id>/phase-<N>.md` — committed with
   the phase (same atomicity rule as the ledger), so the evidence is durable.

Map the verdict onto the gate's existing outcomes — the court invents **no new stop reason**:

| court verdict | gate meaning                                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **SHIP**      | court check green — counts like any other applicable check.                                                                  |
| **REMAND**    | gate **FAIL** — report the surviving charges verbatim as the fix list; the normal fix loop applies.                          |
| **BLOCK**     | gate **BLOCKED** — record a blocker (`discovered_by: "court"`, note = the fatal charge), ledger `"verdict":"BLOCKED"`, STOP. |

When the court convenes, it **subsumes** Tier 4's standalone mutation and pentest passes (its seated
prosecutors run them — running both would double-spend); Tier-4 passes with no prosecutor equivalent
(chaos) still run standalone. Tier 3 remains the unconditional floor on every phase — the court sits
above it, never replaces it. Degrade honestly: accelerator absent → Tier 4 exactly as above; skill
present but only one vendor reachable → report `court: skipped (single vendor — the panel needs ≥2)`,
never a silent pass. Cost note: the court's default routing may include metered tiers; aqe's provider
layer (its ADR-123) applies budget caps and receipts to every call.

## Verdict logic

```
court_on   = qe_court available and pipeline.court ≠ off
            and (phase in risk_phases or pipeline.court == all)
applicable = Tier1 + Tier2 + Tier3
           + (court if court_on)
           + (Tier4 if phase in risk_phases and agentic_qe available;
              minus mutation/pentest when the court convened — its prosecutors ran them)
PASS  ⇔ every applicable, non-skipped check is green   (court: SHIP)
FAIL  ⇔ any applicable check is red                    (court: REMAND — charges are the fix list)
BLOCKED ⇐ the court returned BLOCK (a fatal charge survived — see references/discovered.md)
```

On PASS: commit the feature-scoped marker, persist the summary, append the ledger line, STOP.
On FAIL: report the failing check(s) verbatim with output, leave the tree as-is, append the ledger
line, STOP. Do not "mostly pass." A red gate that gets waved through is how an unattended pipeline
ships a regression.

## The session ledger (replayable run history)

Every firing — pass or fail — appends **exactly one** line to `.autopilot/runs/<feature_id>.jsonl`
(`feature_id` from `pipeline.yml`). This is the durable, human-readable record of every session, and it
works on a vanilla repo with no ruflo. The git markers stay the authority for "what phase is next"; the
ledger is the audit trail of how each phase got there.

The ledger's **first line is the plan record** (`{"type":"plan", …, "phases":[…]}`), written by
`autopilot:plan` (for an active plan) or at **promotion** (for a plan that was queued — see
`docs/lifecycle.md`). It snapshots the phase set so the history stays interpretable even if
`pipeline.yml` is later overwritten by another feature's plan. The plan record is the only line carrying
`"type":"plan"`; **every other line is a firing record** — skip the plan line when summarizing firings.

> **Retrofitting a legacy ledger.** Ledgers written before record 0 existed (pre-0.7.0) have no
> `type:plan` line. Reconstruct one from the committed `pipeline.yml` and prepend it, reading `at` from
> git so it reflects the plan's real age (`git log -1 --format=%cI -- .autopilot/pipeline.yml`, **not**
> the current clock). The operation is **idempotent** — skip if a `type:plan` line is already present.
> Exact sequence in `docs/lifecycle.md`.

Firing records, one JSON object per line, schema:

```json
{
  "phase": 2,
  "mode": "pr_ci",
  "verdict": "PASSED",
  "skipped": ["audit", "frontend"],
  "failed": [],
  "ci_attempts": 1,
  "pr": "https://github.com/owner/repo/pull/14",
  "accelerators": ["ruflo", "agentic_qe"],
  "marker": "a1b2c3d",
  "at": "2026-06-26T14:07:00-07:00",
  "summary": "PolicyResolver + 12 tests; DoD 3/3 green."
}
```

- `verdict` — `"PASSED"`, `"FAILED"`, or `"BLOCKED"`. On FAILED, `failed` lists the red check names and
  `marker` is `null`. `"BLOCKED"` is a _distinct_ stop reason (a missing prerequisite, not a red check —
  see `references/discovered.md`): `marker` is `null`, and it consumes no `fix_budget`/`requeue_budget`.
- `skipped` — checks reported skipped (empty command), so a reader sees what was _not_ verified.
- `ci_attempts` — count of `ci attempt` commits on the phase branch (pr_ci); `0` in reviewed mode.
- `pr` — phase PR URL in pr_ci, else `null`.
- `accelerators` — which were actually active this firing (`[]` on a vanilla run).
- `marker` — short SHA of the `gate PASSED` commit (PASS), else `null`.
- `at` — ISO-8601 from the commit you just made (`git log -1 --format=%cI`); on FAIL, the current HEAD
  commit time. Never invent a clock value — read it from git so it stays deterministic and replayable.
- `summary` — ≤200 chars; mirrors the ≤12-line summary you persist.

When the court convened, append **one additional** `"type":"court"` line right after the firing record
(field names mirror qe-court's own `schemas/output.json`):

```json
{
  "type": "court",
  "phase": 2,
  "verdict": "SHIP",
  "charges_surviving": 0,
  "overturn_rounds": 2,
  "vendors": 2,
  "record": ".autopilot/court/<feature_id>/phase-2.md",
  "at": "2026-06-26T14:07:00-07:00"
}
```

`verdict` is `"SHIP"`, `"REMAND"`, or `"BLOCK"`; `record` points at the committed court-record
markdown. For the integration-PR court (orchestrate STEP E), `phase` is the string `"integration"`.

Append, don't rewrite — the file is append-only history. On PASS, stage the new ledger line **in the
same commit as the marker** so they're atomic. On FAIL (no marker commit), commit the ledger line alone
as `chore(autopilot:<feature_id>): ledger — phase <N> FAILED` so the failed attempt is still durable.
