#!/usr/bin/env node
// Executable proof of the dependency-aware ready-set (ADR-0001). The algorithm itself lives as prose
// in skills/orchestrate/SKILL.md; this is a runnable MODEL of it that asserts the three properties the
// design promises, over a deliberately multi-track sample graph. No external deps; plain Node (>=22).
//
// It proves, and fails loudly if any breaks:
//   A. Parallelizable ready units    — a cross-track graph surfaces >1 ready unit at once.
//   B. Resumability / statelessness  — the next unit is a pure function of the done-set (git markers),
//                                       so recomputing from the repo alone always agrees; a full walk
//                                       respects every dependency and terminates covering all phases.
//   C. Identical-when-flat           — an empty-deps plan selects 0,1,2,… exactly (today's linear walk),
//                                       which is also the behavior when beads AND ruflo are both absent.
//   D. Deadlock/cycle guard          — an unsatisfiable graph yields an empty ready-set with work left,
//                                       which orchestrate reports instead of spinning.

const problems = [];
const check = (cond, msg) => {
  if (!cond) problems.push(msg);
};

// ── The model: exactly the ADR-0001 / SKILL.md rule ──────────────────────────
// ready(P) ≡ P not in done-set ∧ every id in P.depends_on ∈ done-set. select = lowest-id ready.
const readySet = (phases, done) =>
  phases
    .filter((p) => !done.has(p.id) && (p.depends_on ?? []).every((d) => done.has(d)))
    .map((p) => p.id)
    .sort((a, b) => a - b);

const select = (phases, done) => {
  const r = readySet(phases, done);
  return r.length ? r[0] : null;
};

// Drive the loop the way orchestrate does: recompute from the done-set each firing (never from memory),
// mark the selected phase done, repeat. Returns the selection order + a per-step dependency check.
function walk(phases) {
  const done = new Set();
  const order = [];
  let depsAlwaysSatisfied = true;
  for (let guard = 0; guard <= phases.length; guard++) {
    const n = select(phases, done);
    if (n === null) break;
    const phase = phases.find((p) => p.id === n);
    if (!(phase.depends_on ?? []).every((d) => done.has(d))) depsAlwaysSatisfied = false;
    order.push(n);
    done.add(n);
  }
  return { order, done, depsAlwaysSatisfied };
}

// ── Fixture: a realistic multi-track feature (3 bounded contexts + a core integration) ───────────────
// core:0 → {auth:1→2, billing:3→4, notif:5} → core:6 (integration depends on all three tracks)
const multiTrack = [
  { id: 0, track: "core", depends_on: [] },
  { id: 1, track: "auth", depends_on: [0] },
  { id: 2, track: "auth", depends_on: [1] },
  { id: 3, track: "billing", depends_on: [0] },
  { id: 4, track: "billing", depends_on: [3] },
  { id: 5, track: "notif", depends_on: [0] },
  { id: 6, track: "core", depends_on: [2, 4, 5] },
];

// ── Proof A: parallelizable ready units ──────────────────────────────────────
// After only phase 0 is done, all three tracks unblock at once.
const afterZero = readySet(multiTrack, new Set([0]));
check(
  afterZero.length >= 2,
  `A: expected >1 ready unit after phase 0, got [${afterZero.join(", ")}]`,
);
check(
  JSON.stringify(afterZero) === JSON.stringify([1, 3, 5]),
  `A: expected parallel ready set [1, 3, 5] across tracks, got [${afterZero.join(", ")}]`,
);

// ── Proof B: resumability / statelessness ────────────────────────────────────
const run = walk(multiTrack);
check(run.depsAlwaysSatisfied, "B: a phase was selected before its depends_on were all done");
check(
  run.order.length === multiTrack.length,
  `B: walk did not cover all phases (covered ${run.order.length}/${multiTrack.length})`,
);
check(run.order[run.order.length - 1] === 6, "B: integration phase 6 must be last (depends on all)");
// Statelessness: the next pick depends ONLY on the done-set, not on how we got there. Reconstruct an
// arbitrary mid-run state from markers alone and confirm the pick matches the full walk's pick there.
const midDone = new Set([0, 1, 3]); // e.g. resumed after a crash, markers say 0,1,3 are done
// ready = {2 (dep 1✓), 4 (dep 3✓), 5 (dep 0✓)} → lowest-id = 2, purely from the done-set.
check(
  select(multiTrack, midDone) === 2,
  `B: recompute-from-markers disagreed; expected next=2 from done{0,1,3}, got ${select(multiTrack, midDone)}`,
);

// ── Proof C: identical-when-flat (== today's linear walk, == both-accelerators-absent) ───────────────
const flat = Array.from({ length: 6 }, (_, id) => ({ id, depends_on: [] }));
const flatOrder = walk(flat).order;
check(
  JSON.stringify(flatOrder) === JSON.stringify([0, 1, 2, 3, 4, 5]),
  `C: flat plan must select 0..n-1 (linear N+1), got [${flatOrder.join(", ")}]`,
);

// ── Proof D: deadlock/cycle guard ────────────────────────────────────────────
const cyclic = [
  { id: 0, depends_on: [1] },
  { id: 1, depends_on: [0] },
];
const cyclicReady = readySet(cyclic, new Set());
check(
  cyclicReady.length === 0,
  `D: a dependency cycle must yield an empty ready-set, got [${cyclicReady.join(", ")}]`,
);
// "empty ready-set with phases left" is the signal orchestrate stops on (never spins).
check(
  walk(cyclic).order.length < cyclic.length,
  "D: cyclic graph must fail to cover all phases (the deadlock orchestrate reports)",
);

// ── Report ───────────────────────────────────────────────────────────────────
if (problems.length) {
  console.error(`✗ ready-set proof FAILED (${problems.length}):\n`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("✓ ready-set proof passed — A parallel · B resumable · C flat==linear · D deadlock-guarded.");
