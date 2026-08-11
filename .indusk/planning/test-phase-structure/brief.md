---
title: "Test phases as structure — giving the first discipline a home"
date: 2026-08-11
status: accepted
---

# Test phases as structure — Brief

## Problem

**Write the tests first** is InDusk's central discipline, and it is the only one with no home in the impl document.

Every other discipline is legible as a section with checkboxes — Verification, Context, Document, Falsification, Cleanup. Test authoring is a *column value* on a trajectory row (`Writable at: Phase N`), which means:

- **The default is unenforced.** 59% of all rows (260 of 444) are `Writable at: Phase 0`, and `check-gates`' Gate A matches `row.writableAt === advancingPhase`, where `advancingPhase` is never 0. Those rows are never checked. Observed: `lifecycle-rebalance`'s T13–T17 were Phase 0 rows authored four phases late, silently.
- **Only the exception is guarded.** The 41% that defer must carry a `Trajectory Rationale` entry, and the validator enforces it. We built the machinery for deviating from the rule and none for following it.
- **You cannot read an impl and see that tests came first.** You reconstruct it from a column.

This is the same shape as the Craft problem in `lifecycle-rebalance`: a discipline that exists as data or behavior while everything around it exists as structure. Applied to the one thing that is supposed to come first.

## Proposed Direction

**Make test authoring a phase.** Two kinds of phase, two independent sequences:

```markdown
### Test Phase 1: Author the trajectory
### Build Phase 1: …
### Build Phase 2: …
### Test Phase 2: T7 against the parser   ← justified in Test Phase 1
### Build Phase 3: …
```

Five rules:

1. **Phases are build phases.** That is what the word has always meant here; the name just becomes explicit.
2. **Test Phase 1 is mandatory and comes first.** It authors every test that can be authored, and it is where the plan's testing decisions are recorded.
3. **Additional test phases are legal, and each requires an explicit justification entry in Test Phase 1.** Test Phase 1 is the register: everything pinned down up front, plus an accounting of everything that could not be, with reasons and where it landed.
4. **A test phase carries one gate — Verification — with fixed content:** the rows it authors exist, run, and **fail on their own assertion, not on a missing import.** This is not an exemption from the all-or-none rule; it is a second phase *kind* with its own declared gate set. Build phases keep Verification / Context / Document. An authoring phase changes nothing about how the project works and ships nothing user-facing, so those two gates would be noise.
5. **`Trajectory Rationale` is absorbed, not supplemented.** The deferral justification moves into Test Phase 1. One home for the fact, not two.
6. **A deferral may carry the test it is deferring**, as a code block in its Test Phase 1 entry. This is what makes "justify the deferral" mean something: the thinking happens up front, in the phase built for it, and a reader can see exactly what will be asserted rather than taking a promise. The later test phase's job becomes *"uncomment T7 and confirm it now fails on its own assertion"* — smaller and sharper than "write a test." Drift can't hide, because uncommenting either compiles into a real red or doesn't.

7. **Test Phase 1 does not close until its deferrals have been reviewed.** Reading the deferred test bodies — *will this compile at the phase it names, and does it assert what it claims?* — is the checkpoint before any build phase opens. This is the compensating control for the one thing that cannot be automated (a red that is really a load failure), and it is deliberately a **human-judgment gate**: a pause point under autopilot, not something an executor self-approves. Its evidence is durable, because the code block stays in the impl where anyone can re-read it, unlike runner output that vanishes with the run.

**Deferring means deferring.** The rule is not "author something that technically appears red." A test whose file cannot load has not been authored — it is an absent test wearing a failure's clothes, and it protects nothing until its import resolves. The justification exists so that the honest answer ("this cannot be a real test yet") is a first-class outcome rather than a thing to work around.

**Backward compatibility comes free.** Making the prefix optional — `/^###\s+(?:Build\s+)?Phase\s+(\d+)/` — means all 52 existing impls keep parsing unchanged. No migration, no version flag, no new-impls-only split.

**And the enabler comes first.** The phase-heading regex is currently copied across **seven places in six files**, with no single-definition test — worse fan-out than the gate vocabulary that caused the last structural change to be routed around entirely. Adding a heading kind to seven copies is how this plan fails. Consolidating to one definition is Phase 1, and it is an elegance win on its own.

## Context

Full survey in [research.md](research.md). The design was settled in conversation on 2026-08-11; the research measured what it has to survive.

Load-bearing findings:

- **`Phase 0` is genuinely taken.** Seven impls use it (plus one `Phase 0.5`), and six of eight are prerequisite build work discovered late — not test authoring. It stays legal for that; test authoring gets its own heading rather than overloading it.
- **There is already a gate item that wants to be the test phase's gate.** Verification blocks routinely contain a hand-written *"confirm each fails on its own assertion, not an import error."* Today it is a habit; this makes it structure.
- **Gate A misses drift in both directions.** The exact match also fails to notice a `Writable at: Phase 2` row still `planned` while Phase 5 closes.

## Scope

### In Scope

- **One definition of the phase heading**, replacing seven copies, pinned by a structural single-definition test.
- `### Test Phase N` as a parsed, validated heading kind, alongside build phases.
- Optional `Build ` prefix so every existing impl keeps working untouched.
- Test Phase 1 required for new impls (`trajectory: required` already gates by frontmatter — same mechanism).
- The justify-in-Test-Phase-1 rule for any Test Phase N where N > 1, validated structurally.
- The test phase's Verification gate, with red-for-the-right-reason as its fixed content.
- Gate A corrected: authoring is enforced against test phases, and drift from earlier phases is caught.
- `Trajectory Rationale` absorbed into Test Phase 1 for new impls; legacy section still parsed.
- Updates to `/planner` (authors the new shape), `/work` (executes a test phase), and the trajectory guide.
- **Correcting `/work`'s `.skip()` advice.** It currently says: *"If the test cannot yet run against a compiled symbol, use `.skip()` with a comment naming the unlock phase."* That does not work for the case it targets — module resolution happens before test collection, so a file with an unresolvable import fails to load no matter how many of its tests are skipped. `.skip()` is correct when the symbol exists and the behavior does not; a commented body in the Test Phase 1 deferral is correct when the symbol does not exist. The guidance must say which is which.
- The **real-red / fake-red distinction** written down in the trajectory guide, with the boundary-crossing rule: a test that reaches its subject over HTTP, a CLI, a query, or the filesystem produces a real red on day one (404 *is* the failure); a test that `import`s its subject cannot. Test Phase 1 therefore fills naturally with boundary tests, and static-import unit tests are the usual deferrals.

### Out of Scope

- **Migrating the 52 existing impls.** Backward compatibility instead — they are correct as written.
- **Renaming the trajectory columns.** `Writable at` becomes able to hold `Test Phase N`; a rename to `Written in` is a nice-to-have, deferred.
- **Craft's missing home.** The same class of problem, a separate decision.
- **The documentation capture/compose split.** The rebalance's other slice.
- **Elegance as a check.** It has no slot anywhere; that is its own question.

## Success Criteria

- Reading any new impl, you can see the tests were authored first, without reconstructing it from a column.
- A plan that defers a test to a later test phase cannot be written without saying why, in Test Phase 1.
- Ticking a build-phase implementation item while a preceding test phase has unauthored rows is refused.
- A test authored but green on arrival — or red for a missing import rather than its own assertion — is caught at the test phase's gate.
- All 52 existing impls parse and validate unchanged, with no edits.
- The phase heading has exactly one definition, asserted by a test.

## Depends On

- Nothing. The `lifecycle-rebalance` work is closed and archived; this builds on its research but needs none of its code.

## Blocks

- **Craft's home** — whatever answer that gets should use the same structural vocabulary this plan establishes.
- **The minimum-viable-lifecycle question** — this settles one discipline's home; that asks how many disciplines earn one.

## Notes

- The blast radius here is the same one that caused `lifecycle-rebalance` to reject a new gate type. The difference is the optional-prefix trick, which was not on the table then and removes the migration cost entirely. If that trick does not survive contact with the validator, the plan should stop and reconsider rather than start migrating 52 files.
