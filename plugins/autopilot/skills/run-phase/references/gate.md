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

## Verdict logic

```
applicable = Tier1 + Tier2 + Tier3 + (Tier4 if phase in risk_phases and agentic_qe available)
PASS  ⇔ every applicable, non-skipped check is green
FAIL  ⇔ any applicable check is red
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

- `verdict` — `"PASSED"` or `"FAILED"`. On FAILED, `failed` lists the red check names and `marker` is
  `null`.
- `skipped` — checks reported skipped (empty command), so a reader sees what was _not_ verified.
- `ci_attempts` — count of `ci attempt` commits on the phase branch (pr_ci); `0` in reviewed mode.
- `pr` — phase PR URL in pr_ci, else `null`.
- `accelerators` — which were actually active this firing (`[]` on a vanilla run).
- `marker` — short SHA of the `gate PASSED` commit (PASS), else `null`.
- `at` — ISO-8601 from the commit you just made (`git log -1 --format=%cI`); on FAIL, the current HEAD
  commit time. Never invent a clock value — read it from git so it stays deterministic and replayable.
- `summary` — ≤200 chars; mirrors the ≤12-line summary you persist.

Append, don't rewrite — the file is append-only history. On PASS, stage the new ledger line **in the
same commit as the marker** so they're atomic. On FAIL (no marker commit), commit the ledger line alone
as `chore(autopilot:<feature_id>): ledger — phase <N> FAILED` so the failed attempt is still durable.
