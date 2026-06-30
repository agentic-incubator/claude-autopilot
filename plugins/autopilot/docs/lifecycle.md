# Autopilot — pipeline lifecycle runbook

The exact, copy-pasteable command sequences for running **more than one** feature pipeline in a repo
over time: queue a follow-up while one is in flight, promote it when the active one finishes, retire a
completed plan without an archive, retrofit an old ledger, and recover a `base` branch GitHub deleted.

Every sequence here is **idempotent and resumable** — safe to re-run after an interruption. They assume
the [`feature_id`](WORKFLOW.md) slug from a plan's `pipeline.yml`. Substitute `<id>`, `<trunk>`, `<base>`.

## The lifecycle

```
plan ──► queued ──► (run active pipeline) ──► promote ──► run ──► retire
         (parked,                            (mv into                (overwrite =
          git-ignored)                        place + seed ledger)    retirement)
```

There is always **one active** `.autopilot/pipeline.yml`. Additional plans wait as parked files under
`.autopilot/queued/` until promoted. Nothing is ever moved to an `archive/` directory — a completed
plan survives in git history and as its own ledger's record 0.

| Location                              | Tracked?    | Role                                                     |
| ------------------------------------- | ----------- | -------------------------------------------------------- |
| `.autopilot/pipeline.yml`             | committed   | the single **active** plan                               |
| `.autopilot/queued/<id>.pipeline.yml` | git-ignored | **parked** plans, local until promoted                   |
| `.autopilot/runs/<id>.jsonl`          | committed   | per-feature ledger; record 0 is the `type:plan` snapshot |

`.autopilot/queued/` is git-ignored on purpose: a follow-up you scoped today shouldn't enter the repo's
history (or another machine's checkout) until you deliberately promote it. `autopilot:plan` adds the
ignore line when it first parks a plan:

```bash
grep -qxF '.autopilot/queued/' .gitignore 2>/dev/null || echo '.autopilot/queued/' >> .gitignore
```

## Queue a follow-up while a pipeline is in flight

`autopilot:plan` does this for you — when an active `pipeline.yml` still has un-shipped phases, it
writes the new plan to `.autopilot/queued/<id>.pipeline.yml` instead of overwriting, and does **not**
seed a committed ledger (the ledger is seeded at promotion). Adding a queued plan touches only an
untracked file, so it never disturbs the running pipeline. Discover what's parked:

```bash
ls .autopilot/queued/*.pipeline.yml 2>/dev/null
```

> **Scope coherence.** A queued pipeline is the right home for an _unrelated_ new requirement you
> discover mid-run — keep each pipeline (and its integration PR) one coherent concern, rather than
> bolting an off-topic phase onto the active plan.

## Promote a queued pipeline

Run when the active pipeline has finished (its integration PR is open/merged) and you want to start the
queued one. Plain `mv` works because the source is git-ignored/untracked, so the move turns it into a
normal tracked file. Read `<id>` from the queued plan's `feature_id`.

```bash
ID=<id>; SRC=.autopilot/queued/$ID.pipeline.yml; DST=.autopilot/pipeline.yml; LEDGER=.autopilot/runs/$ID.jsonl

# (a) Move queued → active. Idempotent: skip if the active plan is already this feature.
if [ -f "$SRC" ]; then
  grep -q "feature_id: \"$ID\"" "$DST" 2>/dev/null || mv "$SRC" "$DST"
fi

# (b) Seed the ledger with the 0.7.0 plan record (record 0). Idempotent: skip if one already exists.
#     `at` is read from git so it stays deterministic/replayable — never invent a clock value.
#     Use HEAD time (as plan step 8 does): the just-`mv`'d pipeline.yml is uncommitted here, so its own
#     file history would still point at the PREVIOUS feature — HEAD is the right, replayable stamp.
mkdir -p .autopilot/runs
if [ ! -s "$LEDGER" ] || ! grep -q '"type":"plan"' "$LEDGER"; then
  AT=$(git log -1 --format=%cI)
  # Build the plan record from the now-active pipeline.yml (id/goal/trunk/base/autonomy + phase id/goal/DoD).
  # (Construct the JSON line as autopilot:plan does in its step 8, then prepend it.)
  printf '%s\n' "$PLAN_RECORD_JSON" | cat - "$LEDGER" 2>/dev/null > "$LEDGER.tmp" && mv "$LEDGER.tmp" "$LEDGER"
fi

# (c) Commit the promotion atomically.
git add "$DST" "$LEDGER" .gitignore
git commit -m "chore(autopilot:$ID): promote queued pipeline"
```

`$PLAN_RECORD_JSON` is the same `{"type":"plan","feature_id":…,"goal":…,"trunk":…,"base":…,
"autonomy":…,"phases":[{"id":0,"goal":…,"definition_of_done":[…]},…],"at":"<AT>"}` line that
`autopilot:plan` writes (see plan SKILL.md step 8). Then run `/autopilot-run` to drive the now-active
pipeline.

**Resumability.** If a previous promotion was interrupted, re-running is safe: step (a) skips when the
plan is already active, step (b) skips when record 0 is present, and step (c) is a no-op when there's
nothing to commit.

## Retire a completed pipeline (no archive)

When a feature is done, **overwriting `.autopilot/pipeline.yml` with the next plan is the retirement**
— there is nothing to move or delete. Promotion (above) overwrites it for you. The retired plan is not
lost; it survives two ways:

- **git history** — `git log --follow -p -- .autopilot/pipeline.yml` shows every plan the file has held.
- **its own ledger record 0** — `.autopilot/runs/<old-id>.jsonl` keeps the `type:plan` snapshot plus
  every firing, even though `pipeline.yml` now describes a different feature.

Read a retired plan back:

```bash
# The plan snapshot (phases + DoD) for a finished feature:
head -1 .autopilot/runs/<old-id>.jsonl | python3 -m json.tool
# The exact pipeline.yml that shipped it:
git log --oneline --follow -- .autopilot/pipeline.yml      # find the commit, then:
git show <commit>:.autopilot/pipeline.yml
```

Because each feature has its own `feature_id`-scoped ledger and markers, retiring one never erases
another's history.

## Retrofit an old ledger (pre-0.7.0)

Ledgers written before 0.7.0 lack the `type:plan` record 0. Reconstruct it from the committed
`pipeline.yml` so the history is self-describing again. **Idempotent** — skip if a `type:plan` line
already exists.

```bash
ID=<id>; LEDGER=.autopilot/runs/$ID.jsonl
if [ -f "$LEDGER" ] && ! grep -q '"type":"plan"' "$LEDGER"; then
  # `at` = when pipeline.yml was last committed (NOT now) so the record reflects the plan's real age.
  AT=$(git log -1 --format=%cI -- .autopilot/pipeline.yml)
  # Build $PLAN_RECORD_JSON from .autopilot/pipeline.yml (feature_id/goal/trunk/base/autonomy + phases),
  # stamping "at":"$AT", then prepend it as the new first line:
  printf '%s\n' "$PLAN_RECORD_JSON" | cat - "$LEDGER" > "$LEDGER.tmp" && mv "$LEDGER.tmp" "$LEDGER"
  git add "$LEDGER"
  git commit -m "chore(autopilot:$ID): retrofit ledger record 0 from pipeline.yml"
fi
```

Only the most recent `pipeline.yml` is reconstructable this way; if the file has already been
overwritten by a later feature, recover the original from `git show <commit>:.autopilot/pipeline.yml`
first (see Retire, above) and build the record from that.

## Recreate a `base` branch GitHub deleted

After the `base → trunk` integration PR merges, GitHub's "automatically delete head branch" setting can
remove `base` from the remote. The next `pr_ci` firing must recreate it from refreshed `trunk` —
**preserving any local working changes, including untracked queued plans** — and push it as a **normal
new branch**, never a force-push (the never-force-push-`base` invariant still holds; a fresh branch has
no history to overwrite).

```bash
TRUNK=<trunk>; BASE=<base>

if ! git ls-remote --exit-code --heads origin "$BASE" >/dev/null 2>&1; then
  # base is gone on the remote (deleted after the integration merge).
  git stash push -u -m "autopilot-base-recreate"   # -u carries untracked .autopilot/queued/* along
  STASHED=$?                                        # (git stash exits non-zero / prints "No local changes" if clean)
  git checkout "$TRUNK" && git pull --ff-only
  git branch -f "$BASE" "$TRUNK"                    # recreate base at the refreshed trunk
  git checkout "$BASE"
  git push -u origin "$BASE"                        # NEW-branch push — NOT --force
  git stash list | grep -q autopilot-base-recreate && git stash pop
fi
```

This is a new-branch push, so it cannot rewrite remote history — it satisfies the same invariant that
forbids `git push --force` to `base`/`trunk`. If `base` still exists remotely, the normal path applies:
`git checkout "$BASE" && git pull --ff-only`.

## See also

- [`WORKFLOW.md`](WORKFLOW.md) — the end-to-end flow and where accelerators plug in.
- `skills/plan/SKILL.md` — how plan decides active-vs-queued and seeds the ledger.
- `skills/orchestrate/references/mode-pr-ci.md` — STEP A's base-branch handling at runtime.
