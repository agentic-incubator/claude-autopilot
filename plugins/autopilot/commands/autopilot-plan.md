---
description: Decompose a feature goal or spec into an autopilot phase plan (.autopilot/pipeline.yml).
argument-hint: "[goal or spec path]"
---

The user's feature goal / spec (ask if empty): $ARGUMENTS

Invoke the `autopilot:plan` skill to turn this into `.autopilot/pipeline.yml` — ordered, independently
shippable phases, each with concrete deliverables and a machine-checkable Definition of Done. When
done, show the phase list for sign-off and point the user at `/autopilot-detect` next.
