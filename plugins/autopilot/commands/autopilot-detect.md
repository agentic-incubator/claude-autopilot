---
description: Detect this repo's build/test/lint commands and write the autopilot stack profile (.autopilot/profile.yml).
---

Invoke the `autopilot:detect` skill to probe the current repository's tech stack, propose the
build/test/lint/audit commands, CI setup, conventions, and available accelerators, and then have the
user confirm them before writing `.autopilot/profile.yml`. The confirm step is mandatory — a wrong test
command would let a broken phase pass the gate.
