# Mode: reviewed (stop after each phase)

The default, lowest-blast-radius mode. Drive one phase locally, land a `gate PASSED` marker, and STOP
for the human to inspect before the next phase. No PRs, no autonomous merging — git markers are the
only state. Use this when you want a human checkpoint between phases, or before you trust the pipeline
enough for pr_ci.

## Prerequisites

- `pipeline.yml` and `profile.yml` exist (run `autopilot:plan` + `autopilot:detect` first).
- Whatever `profile.commands.infra_up` needs is available locally (the gate may need it).

## The firing

```
1. STATE   feature_id ← pipeline.yml.
           Done-set = git log --oneline | grep -E "\(autopilot:<feature_id>\): phase .* gate PASSED".
           Target N = lowest-id READY phase (no PASSED marker ∧ all depends_on in done-set) — the
             dependency-aware ready-set from SKILL.md "Every firing" step 1. Empty deps ⇒ N = P+1.
           Ready-set empty AND all phases done → OPTIMIZATION PASS (below), then end the loop;
             empty with phases left = dep cycle/unsatisfiable → stop and report, never spin.
2. RESUME  grep the repo for phase N's deliverables → exists-vs-required list.
           Only missing/incomplete work is in scope (a half-done phase continues, never restarts).
3. RUN     Invoke the `run-phase` skill for phase N. Obey its gate verbatim.
4. RESULT
   - PASS → run-phase has committed `feat(autopilot:<feature_id>): phase N complete — gate PASSED`
            (with the ledger line staged in that commit) and persisted the summary. Report it and STOP.
   - FAIL → run-phase reported the failing check, left work uncommitted, and logged a FAILED ledger
            line. Surface that and STOP. The next firing re-enters phase N at its resume check.
```

Each firing does exactly one phase. The `/loop` self-pacing re-fires with a fresh context; the git
marker tells the new context where to resume. Do not advance to N+1 in the same firing — that's the
whole point of the checkpoint.

## Optimization pass (only when every phase is gated)

When N is past the last phase:

- If `accelerators.ruflo` is available, `ruflo analyze boundaries <src dir>` to find refactor seams
  across the new code; otherwise scan the diff of all phases yourself for duplication and dead seams.
- Dedup, simplify, tighten hot paths. Run `/simplify` then `/code-review` on the result.
- Verify the full gate (all `profile.commands`) is green.
- Commit `chore(autopilot:<feature_id>): cross-phase optimization — gate PASSED` and append the final
  ledger line.
- If any queued plans exist (`ls .autopilot/queued/*.pipeline.yml`), don't auto-start them — tell the
  user the next one is parked and give the exact promote command from `docs/lifecycle.md`. Promotion is
  deliberate; each feature is its own lineage.
- Report completion and END THE LOOP (omit the next wakeup).

## Why no PRs here

reviewed mode trades automation for visibility: a human eyeballs each phase before the next begins, so
there's no need for CI to be the gatekeeper. When the human trusts the pipeline, switch `autonomy:` to
`pr_ci` and the same phases ship hands-off. The phase plan and gate don't change between modes — only
who/what authorizes advancing does.
