# Driving ruflo & agentic-qe (when present)

Read this when `profile.accelerators.ruflo.available` or `agentic_qe.available` is true. These tools
are _force multipliers_, never prerequisites — the baseline (focused subagents + `/code-review` +
native coverage) is fully supported. The point of detecting them is to **actively drive** them at the
right step, not merely note they exist.

Detection (done by `autopilot:detect`): `ruflo` / `aqe` on PATH = global; a project `.ruflo/` or an
`aqe init` footprint in the repo = project scope. Either scope counts as available.

## ruflo — comprehension recall, swarms, cross-session memory

| Step                   | What to drive                                                                    | Command(s)                                                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inputs / comprehension | Recall prior decisions about this phase + house gotchas before reading docs cold | `ruflo memory search -q "autopilot phase <N>" --smart -n autopilot` ; `... -q "<feature> gotchas conventions" --smart -n autopilot`                                   |
| Step 1.5               | Stand up the swarm topology                                                      | `ruflo swarm init --v3-mode` (hierarchical-mesh, hybrid memory + HNSW)                                                                                                |
| Step 1.5               | Pick the agent for a sub-task                                                    | `ruflo route "<task description>"`                                                                                                                                    |
| Step 2–3               | Spawn specialists for parallel work, peer-to-peer SendMessage, run_in_background | researcher → architect → coder(s) → tester → reviewer; right-size to the phase. Agents return COMPACT results (decisions + file paths + test names), never file dumps |
| Step 6 (PASS)          | Persist the durable summary for future-phase recall                              | `ruflo memory store -k autopilot-phase-<N> --value "<≤12-line summary>" -n autopilot`                                                                                 |
| Optimization pass      | Find refactor seams across phases                                                | `ruflo analyze boundaries <src dir>`                                                                                                                                  |

The swarm reads the SAME comprehension slice (the phase's ADRs/DDD/PRD): the researcher ingests it and
SendMessages findings to the architect, who designs within the ADR constraints. Compact reporting is
what keeps the long-horizon context small.

## agentic-qe (aqe) — measured quality layered on the gate

Call `fleet_init({ topology:"hierarchical", maxAgents:15, memoryBackend:"hybrid" })` ONCE per phase
(Step 1.5), then reuse across the gate. Map capabilities to gate tiers — lightweight checks every
phase, expensive adversarial passes only on `risk_phases`:

| Gate tier      | aqe capability                                                                   | Runs                                                             |
| -------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| pre-impl       | `requirements_validate`                                                          | every phase — make the DoD testable before coding                |
| Step 3 (RED)   | `qe-test-architect` / `test_generate_enhanced`                                   | every phase — seed edge/boundary cases                           |
| Tier 2         | `coverage_analyze_sublinear`                                                     | every phase — risk-weighted gaps = 0 on changed files            |
| Tier 4         | `qe-mutation-tester`                                                             | `risk_phases` — prove the suite kills bugs                       |
| Tier 4         | `security_scan_comprehensive` + `qe-pentest-validator` ("No Exploit, No Report") | `risk_phases` — SAST/secrets/deps + working-exploit validation   |
| Tier 4         | `qe-chaos-engineer`                                                              | `risk_phases` with fault paths — must degrade to a clean handoff |
| Tier 1/verdict | `quality_assess`                                                                 | every phase — aggregate the tiers into one go/no-go              |

Persist QE signals to durable memory so they feed future phases and any strategy-learning pass:
`memory_store({ namespace:"autopilot-qe", persist:true, key:"phase-<N>-signals",
  value:"<coverage % · mutation score · exploits-found · flaky tests · chaos verdicts>" })`.

## Both absent

Do the work directly: a couple of focused subagents for parallel implementation/testing, the Tier-3
reviewer subagent + `/code-review` for adversarial review, and the language's native coverage tool for
Tier 2. The gate's pass/fail meaning is identical — accelerators change _how thoroughly and how fast_
you reach the verdict, never _whether a red gate can advance_.
