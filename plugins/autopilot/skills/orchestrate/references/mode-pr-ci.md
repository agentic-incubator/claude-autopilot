# Mode: pr_ci (fire-and-forget via GitHub PR + CI)

Issue once and walk away. Each phase ships as its own branch → PR → green CI → squash-merge into the
long-running `base` integration branch. The durable state marker is the squash-merge commit on `base`,
so every firing re-derives the next phase from `base` history (plus any in-flight open PR) — no
conversation memory needed. `trunk` is never written autonomously; when all phases land, open one
`base → trunk` PR and STOP for a human decision. Lower blast radius than touching trunk: a bad phase
only ever affects `base`.

## Prerequisites (hard)

- `gh auth status` authenticated with push + PR + merge rights on the remote.
- CI **actually runs on PRs targeting `base`** — not merely present in `.github/workflows/`. A workflow
  scoped `on: pull_request: branches: [main]` (or `push`-only) fires NOTHING for a PR into `develop`,
  which makes "all checks green" vacuously true. `detect` must have verified base coverage (and, if it
  was missing, scaffolded an autopilot gate workflow or steered to `reviewed`). If you reach this mode
  and a phase PR shows zero checks, that is the gap — STOP at the STEP D guard, do not merge.
- `profile.ci.ci_is_merge_authority: true` — required PR checks green is the ONLY merge gate.
- Policy from `pipeline.yml`: `fix_budget` CI-fix iterations per PR, then STOP + handoff (PR left open).

Drive it with `/loop` self-paced so the in-phase CI wait can run a backgrounded `gh pr checks --watch`;
the harness re-invokes you when checks finish, so you idle without burning tokens.

## STEP A — Locate state (read-only)

```
0. Ensure base exists (idempotent):
   git rev-parse --verify <base> fails →
     git checkout <trunk> && git pull --ff-only && git checkout -b <base> && git push -u origin <base>
   else → git checkout <base> && git pull --ff-only
1. feature_id ← pipeline.yml.
   git log --oneline <base> | grep -E "\(autopilot:<feature_id>\): phase .* gate PASSED"
     → highest MERGED phase P → target N = P+1.   N past the last phase → STEP E (optimization PR).
   Phase branches are feature-scoped: `autopilot/<feature_id>/phase-N` (two features in one repo must
   not collide on `autopilot/phase-0`).
2. RESUME (ordered — covers every interruption window before merge):
   a. Open PR?   gh pr list --state open --head "autopilot/<feature_id>/phase-N"
        → exists → skip to STEP D and resume its CI/fix/merge cycle.
   b. Branch but no PR?  git ls-remote --exit-code --heads origin autopilot/<feature_id>/phase-N
        → exists → checkout it, inspect git log <base>..HEAD, push any local-only commits,
          then RESUME at STEP C.3 (local gate) → push → open PR. Do NOT recreate or restart.
   c. Neither → fresh phase: STEP C.1 creates the branch.
3. Recall (if ruflo): ruflo memory search -q "autopilot <feature_id> phase N" --smart -n autopilot.
```

## STEP B — Stand up help (optional)

If `accelerators.ruflo` is available, init a swarm and spawn researcher/coder/tester/reviewer
(run_in_background, peer-to-peer SendMessage) that report COMPACT verdicts only. If
`accelerators.agentic_qe` is available, `fleet_init` once so its checks are ready for the gate. If both
absent, do the work directly with focused subagents. Accelerators speed phases up; their absence never
blocks one. The exact commands + capability→step mapping are in the run-phase skill's
`references/accelerators.md` — `run-phase` (invoked at STEP C.2) drives them; you just ensure they're up.

## STEP C — Implement → branch → local gate → push → open PR

```
1. Branch (only if A.2.c said "fresh"): git checkout -b autopilot/<feature_id>/phase-N off fresh <base>.
2. Delegate implementation to the `run-phase` skill (TDD, conventions, security invariants).
   WIP discipline: commit + push frequently (feat/wip, scoped `(autopilot:<feature_id>)`) so the remote
   branch is the durable resume point — never leave meaningful work only in the working tree.
   Squash-merge collapses it later, so granular commits cost nothing downstream.
3. LOCAL PRE-PR GATE: run `run-phase`'s gate (Tiers 1–4 as applicable) and make it green BEFORE opening
   the PR. This catches failures before spending CI minutes. (run-phase appends the firing's ledger
   line; it rides to <base> with the squash-merge.)
4. git push -u origin autopilot/<feature_id>/phase-N
5. gh pr create --base <base> --head autopilot/<feature_id>/phase-N
     --title "feat(autopilot:<feature_id>): phase N — <short summary>"
     --body  "<deliverables · DoD evidence · accelerator signals · 'Automated phase-N run'>"
   Persist the PR URL (if ruflo):
     ruflo memory store -k autopilot-<feature_id>-phase-N-pr --value "<url>" -n autopilot.
```

## STEP D — CI monitor → bounded fix-loop → merge (the autonomous core)

```
A = count of `fix(autopilot:<feature_id>): ci attempt` commits on this branch
    (git log <base>..HEAD --grep "ci attempt" --oneline | wc -l)  — the durable attempt counter.
1. WAIT FOR CI in the background: gh pr checks <pr> --watch --fail-fast.
   Long-running; the harness re-invokes you on exit. Do NOT busy-poll.
2. On exit, FIRST assert checks actually exist (the anti-vacuous-green guard):
   `gh pr checks <pr>` lists ZERO checks (or "no checks reported") →
       CI did not run on this PR. This is SKIPPED, not GREEN — never a pass (invariants #2/#3).
       STOP THE LOOP. Leave the PR OPEN. Do NOT merge. Report it to the user in plain words + the fix:
       "⛔ Stopped: GitHub ran no checks on PR <url> (into `<base>`), so I can't safely merge it —
        autonomous mode needs CI on your phase PRs and this repo doesn't have it yet. Two ways forward:
        (1) run `/autopilot-detect` and pick **Set up CI for me**, or (2) set `autonomy: reviewed` in
        `.autopilot/pipeline.yml` to review each phase yourself. I've left PR <url> open." END.
   Otherwise classify the (non-empty) result:
   - ALL REQUIRED CHECKS GREEN →
       gh pr merge <pr> --squash --delete-branch
         (squash subject = "feat(autopilot:<feature_id>): phase N complete — gate PASSED").
       Do NOT re-run the local gate — CI is the merge authority and already passed.
       git checkout <base> && git pull --ff-only.
       Persist the phase summary (+ accelerator signals) to the durable tier if ruflo is available.
       Loop back to STEP A for phase N+1.
   - ANY CHECK RED →
       a. A ≥ fix_budget → STOP THE WHOLE LOOP. Leave the PR OPEN. Write a handoff note (failing
          checks + last logs + everything tried). Report the blocker and END. Do not merge or advance.
       b. A < fix_budget → DIAGNOSE & FIX ON THIS BRANCH ONLY:
          gh pr checks <pr> → failed names; gh run view <run-id> --log-failed → logs.
          Classify, fix (use subagents), re-run the relevant local gate slice to confirm locally.
          Commit "fix(autopilot:<feature_id>): ci attempt #<A+1> — <root cause>"; git push. Back to D.1.
          A increments automatically via the commit grep — the counter is durable across firings.
```

## STEP E — Optimization PR, then hand off (only when N past the last phase)

```
1. Same branch→local-gate→push→PR→CI→merge cycle on autopilot/<feature_id>/optimization
   (base = <base>): refactor seams (ruflo analyze boundaries if available), /simplify, /code-review;
   squash-merge into <base> with subject
   "chore(autopilot:<feature_id>): cross-phase optimization — gate PASSED".
2. FINAL HANDOFF — do NOT merge <trunk>. Open the integration PR:
   gh pr create --base <trunk> --head <base>
     --title "feat(autopilot): <feature> — full feature (all phases)"
     --body  "<per-phase summary table · all gate markers · accelerator signals · 'Ready for human
              review; do NOT auto-merge'>"
   Report the integration PR URL and END THE LOOP. The human decides whether to merge into <trunk>.
```

## Invariants specific to pr_ci

- UNATTENDED: never wait for human input DURING a phase. The only stop conditions are GOAL reached
  (integration PR opened, human-gated) or fix_budget exhausted on a phase PR (handoff, PR left open).
- One phase = one branch = one PR = one squash-merge marker on `base`.
- A phase advances ONLY after its PR is green and merged into `base`. Never merge a red or
  required-missing PR.
- ZERO checks on a phase PR is SKIPPED, never green. A PR that ran no required checks must never be
  merged — that would be the agent self-certifying. This is the load-bearing reason base CI coverage is
  a hard prereq, not a nicety.
- State = `base` merge markers + open-PR list (+ ruflo memory) — re-derived every firing, never assumed.
