# ADR-0004 — qe-court: an adversarial verdict on top of the gate

|          |                       |
| -------- | --------------------- |
| Status   | Accepted              |
| Date     | 2026-07-24            |
| Deciders | autopilot maintainers |

## Context

The gate's Tiers 1–2 are mechanical (commands, DoD greps) and trustworthy, but its adversarial layer
is not vendor-diverse: Tier 3 is one reviewer subagent plus `/code-review`, run by the **same model
family that wrote the phase**. An unattended pipeline whose writer grades its own homework has a
structural blind spot — a plausible-but-wrong phase can sail through every mechanical check and a
same-vendor review.

agentic-qe ≥ 3.13 ships **qe-court** (its ADR-124): an orchestration skill that convenes blind,
parallel prosecutors from **≥ 2 distinct LLM vendors** (devils-advocate, brutal-honesty, sherlock,
security-scanner, mutation, codex-review), kills weak charges with blind refuters, has a cross-vendor
two-gate jury rule a three-valued verdict — **SHIP / REMAND / BLOCK** — and forces any SHIP to survive
an escalating overturn round. It emits a signed court record and names the human as final judge. Its
enforced invariants (writer ≠ juror, ≥ 2 vendors, blind filing, asymmetric overturn) attack exactly
the self-grading gap.

## Decision

Integrate qe-court as an **optional accelerator** (`profile.accelerators.qe_court`) under the standard
contract — detect → drive → degrade, absence never fails the gate — convened at **two seats**:

1. **The risk-phase gate** (run-phase Step 5). When `pipeline.court: auto` (default) the court convenes
   on `risk_phases` (`all` = every phase, `off` = never). It **subsumes** Tier 4's standalone mutation
   and pentest passes — its seated prosecutors run them — while chaos (no prosecutor equivalent) stays
   standalone and Tier 3 remains the unconditional floor everywhere.
2. **The integration PR** (orchestrate STEP E). Before the `base → trunk` PR, the court sits on the
   full integration diff; the court record rides in the PR body. The human who merges trunk _is_ the
   court's final judge.

The verdict maps onto the gate's **existing** outcome vocabulary — the court invents no new stop
reason:

| court verdict | gate outcome                                                         |
| ------------- | -------------------------------------------------------------------- |
| SHIP          | court check green                                                    |
| REMAND        | FAIL — surviving charges are the fix list for the existing fix loop  |
| BLOCK         | BLOCKED — a blocker record (`discovered_by: "court"`), distinct stop |

Detection requires three things at once: `agentic_qe.available`, the court skill footprint, and
**`vendors ≥ 2`** (Claude + codex-on-PATH / a metered key / cognitum). The reachable-vendor count is
recorded in `accelerators.qe_court.vendors` even when it disqualifies availability.

## Invariants

- **Absence never fails the gate.** No aqe, no court skill, one vendor, or `court: off` → the
  Tier-3/Tier-4 floor exactly as before, reported as skipped with the reason — never a silent pass.
- **No sham panels.** A single reachable vendor means the court does not convene: convening would
  violate the court's own anti-collusion invariant and launder a same-vendor opinion as a jury.
- **The court is never the merge authority.** In pr_ci, remote CI merges phase PRs; `trunk` stays
  human-gated. At the integration seat the verdict only changes what evidence the human sees
  (REMAND → one bounded fix-and-reconvene; BLOCK → a `[BLOCKED by qe-court]` title) — it never merges,
  blocks, or closes a PR mechanically.
- **No new stop reasons.** SHIP/REMAND/BLOCK land on PASS/FAIL/BLOCKED; the blocker path reuses
  `references/discovered.md` unchanged, so the ready-set proofs (`scripts/verify-ready-set.mjs` E–H)
  and merge-queue proofs (`scripts/verify-parallel-merge-queue.mjs`) hold with zero model changes.
- **Durable evidence.** Court records commit to `.autopilot/court/<feature_id>/` and each convening
  appends a `"type":"court"` ledger line — same atomicity rules as the run ledger.

## Degrade paths

| Condition                  | Behavior                                                         |
| -------------------------- | ---------------------------------------------------------------- |
| aqe or court skill absent  | Tier 4 as configured; Tier 3 floor; `court: skipped`             |
| `vendors < 2`              | `court: skipped (single vendor — the panel needs ≥2)`            |
| `pipeline.court: off`      | `court: skipped (off by pipeline)` — the metered-spend hard stop |
| court errors mid-convening | report it, fall back to Tier 4 standalone passes for this firing |

## Consequences

- Risk phases and the integration handoff get a genuinely independent, cross-vendor verdict; a
  REMAND arrives with reproduced charges (a better fix list than raw CI logs).
- Court runs cost real model calls (routing may include metered tiers); aqe's provider layer
  (its ADR-123) applies budget caps and receipts, and `court: off` caps spend at zero.
- The court's flywheel (reproduced charges → patterns, overturned SHIPs → judge training) accrues to
  the aqe install, hardening future verdicts for every project on the machine.

## References

- agentic-qe `.claude/skills/qe-court/{SKILL.md, config.json, schemas/output.json}` (ADR-124; trust
  tier 3, evals green as of 2026-07-18)
- `skills/run-phase/references/gate.md` — "The court" (protocol + verdict mapping + ledger record)
- `skills/run-phase/references/accelerators.md` — drive table + degrade ladder
- `skills/orchestrate/references/mode-pr-ci.md` STEP E — the integration seat
- `templates/{profile.yml, pipeline.yml, gate.md.tmpl}` — the knobs and the rendered checklist
- ADR-0002 (merge queue — untouched), ADR-0003 (blockers — reused verbatim)
