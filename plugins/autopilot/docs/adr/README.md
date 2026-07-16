# Architecture Decision Records

Load-bearing design decisions for autopilot, one per file, newest-relevant first. An ADR captures
_why_ a design is the way it is — the context, the decision, the invariants it must preserve, and the
consequences — so a future editor changes it deliberately, not by accident.

Format (lightweight [MADR](https://adr.github.io/madr/)): a metadata table (Status · Date · Deciders),
then **Context → Decision → Invariants → Degrade paths → Consequences → References**. Status is one of
`Proposed` · `Accepted` · `Superseded by ADR-NNNN`. Keep them concrete and short; link to the skills
and templates the decision governs.

| ADR                                                     | Status   | Summary                                                                                 |
| ------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| [0001](0001-dependency-aware-work-graph-beads-ruflo.md) | Accepted | Dependency-aware work graph: beads projection + ruflo planning brain, git-authoritative |
