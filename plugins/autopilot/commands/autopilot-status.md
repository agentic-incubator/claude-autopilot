---
description: Show autopilot pipeline progress — which phases are gate-PASSED, what's next, and any in-flight branch/PR.
---

Report the current state of the autopilot pipeline without changing anything. Derive everything from
durable sources (git + GitHub + the session ledger), not memory:

1. If `.autopilot/pipeline.yml` exists, read `feature_id` and list its phases (id + goal). Otherwise say
   the pipeline isn't initialized and point to `/autopilot-init`.
2. `git log --oneline | grep -E "\(autopilot:<feature_id>\): phase .* gate PASSED"` → which phases are
   complete (scoped to this feature so other runs in the repo don't bleed in). The highest is the last
   done phase P; the next target is P+1 (or 0 if none, or "all phases complete" if past the last).
3. Read `.autopilot/runs/<feature_id>.jsonl` (if present). Its **first line is the plan record**
   (`type:plan`) — use it for the phase list if `pipeline.yml` is missing or now describes a different
   feature. Every other line is a firing record: one session (phase · verdict · skipped checks ·
   ci_attempts · PR · accelerators · timestamp). Use those to show how each phase landed, surface any
   FAILED attempts, and date the last activity.
4. In `pr_ci` mode also check in-flight work for the next phase:
   - `gh pr list --state open --head "autopilot/<feature_id>/phase-<N>"` → any open PR + its CI status
     (`gh pr checks <pr>`).
   - `git ls-remote --heads origin "autopilot/<feature_id>/phase-<N>"` → a pushed branch without a PR.
   - On the open PR, count `fix(autopilot:<feature_id>): ci attempt` commits to show fix-budget consumed.

Present a compact summary: a phase table (done / next / pending) with each phase's last verdict from the
ledger, the active mode, recent session history, and any open PR with its CI state and remaining fix
budget. End with the single command to advance (`/autopilot-run`).
