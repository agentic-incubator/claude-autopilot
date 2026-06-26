---
description: Drive the autopilot pipeline — run phases to completion (reviewed = one phase then stop; pr_ci = fire-and-forget via PR/CI).
argument-hint: "[phase number] (optional; defaults to the next ungated phase)"
---

Optional explicit phase to run: $ARGUMENTS

Drive the autopilot feature pipeline defined in `.autopilot/pipeline.yml`.

- If `.autopilot/pipeline.yml` or `.autopilot/profile.yml` is missing, tell the user to run
  `/autopilot-init` first, and stop.
- If a phase number was given above, run just that phase via the `autopilot:run-phase` skill.
- Otherwise invoke the `autopilot:orchestrate` skill to discover the next ungated phase from git
  markers and drive it per the pipeline's `autonomy:` mode.

For true long-horizon, fresh-context-per-phase execution, recommend the user wrap this in the loop
skill so each phase runs in a clean context and the pipeline resumes across sessions:

```
/loop Invoke the autopilot:orchestrate skill — run the next phase of the pipeline in .autopilot/, then stop.
```

In `reviewed` mode this stops after one gated phase for inspection. In `pr_ci` mode it runs unattended:
branch → PR → CI → bounded fix-loop → squash-merge into `base`, repeating until all phases land, then
opens one `base → trunk` PR and stops for a human. `trunk` is never merged autonomously.
