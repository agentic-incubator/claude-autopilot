---
description: Initialize an autopilot pipeline in this repo — scope the feature into phases, then detect the stack. Runs plan then detect.
argument-hint: "[goal or spec path] (optional; you'll be asked if omitted)"
---

Set up a fresh autopilot feature pipeline in the current repository, end to end.

The user's feature goal / spec (may be empty — ask if so): $ARGUMENTS

Do both setup steps in order:

1. **Plan.** Invoke the `autopilot:plan` skill to decompose the goal/spec into
   `.autopilot/pipeline.yml` (ordered phases with machine-checkable Definitions of Done). If the goal
   or spec wasn't provided above, ask the user for it first. Confirm the branch model (`trunk`/`base`)
   and autonomy mode while you're there.

2. **Detect.** Then invoke the `autopilot:detect` skill to probe the stack and produce
   `.autopilot/profile.yml`. Present the detected commands and have the user confirm them before
   writing — the gate's trustworthiness depends on these being right.

When both files exist and are confirmed, show the user the phase list and tell them how to run it:
`/autopilot-run` (or invoke `autopilot:orchestrate` under `/loop`). Do not start implementing phases —
init only scaffolds the pipeline.
