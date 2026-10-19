---
title: "Plans are promises"
date: 2026-10-16
status: accepted
---

# Plans are promises

## Goal

**A plan can state each of its promises as clauses, plan every clause's signal and tests before the ADR, and close only when every clause is proved.**

Today a promise is one sentence with no parts, so a plan closes when any passing
row names it — a promise of five clauses with one tested reads as kept. After
this, a plan that opts in states the clauses in its brief, the registry keeps
them with the promise, the clause plan names each clause's signal and tests,
rows say which clause they prove, and closing refuses a clause nothing proves.
Plans written before clauses close as they do today.

## Y-Statement

**In the context of:**
`promise-core`'s primitive, revised 2026-10-16: a plan holds the promises it lands, each promise made of clauses — splits, limits, or another promise it rests on — each clause with a signal and tests, the clause plan written per promise before the ADR.

**Facing:**
no code concept of a clause anywhere; about sixty sites that know the test-plan document by name, several of them parity pins, while none reads its contents; two copies of the row-purpose reader that must agree; and over 150 promises and every archived plan that must keep validating.

**We decided for:**
clauses as an opt-in (`clauses: required` in the brief's frontmatter), stated as sub-entries under each promise in the brief, kept in the promise's registry file as a `clauses` list written by `indusk promises declare --clause`, held equal by the contract check; the clause plan as the existing `test-plan.md` in its existing place, with one section per promise and one per clause carrying a `Signal:` line, read by one new parser; a `clause: <promise>/<clause>` token in a row's `For` cell, in both readers, that also counts as naming the promise; and closing that, for a promise with clauses, wants a passing row per clause, a resting clause proved by its promise being in force.

**And against:**
a new file per promise or a renamed lifecycle position (sixty sites and their pins for a name, with no reader of the contents to justify it); clauses kept only in the brief (the promise outlives the plan, so its parts must live with it in the registry, where incidents and standing find them); a separate `clauses:` column on the trajectory (every reader of `For` would need a second cell); and making clauses mandatory at once (every open and archived plan would be refused).

**To achieve:**
a promise that closes only when each of its parts is proved, readable by `mark-first` (signals per clause) and `run-the-master` (rows that name clauses), with every existing reader of rows, promises and documents unchanged.

**Accepting:**
the document keeps the name "test plan" in the lifecycle and the cockpit until a later plan renames it; the plan page shows clauses only as text in the brief and the clause plan; and "promises that share code share a plan" is the planner's guidance, not a check.

**Because:**
the opt-in is the pattern every structural rule in the impl already uses (`trajectory`, `test_phases`, `test_purpose`), so older plans stand by construction; the brief's sub-bullets are already read and discarded, and the test plan's contents are read by nothing, so both gain a reader without any existing reader changing.

## Context

See [research.md](research.md) for the measurements and [brief.md](brief.md) for
the promise. The test plan ([test-plan.md](test-plan.md)) sets the target: A1–A16.

## Decision

1. **Opt-in.** A brief with `clauses: required` in its frontmatter is held to
   clauses: every promise it makes has at least one (A2). Without it, nothing
   about clauses is asked (A13).
2. **Clauses in the brief.** Under an entry of **This plan makes**, each
   sub-bullet `- **\`clause-name\`** (split|limit). sentence` or
   `- **\`clause-name\`** (rests on \`promise-name\`).` is a clause.
   `parseBriefContract` returns them on each `BriefMade` as `clauses`.
3. **Clauses in the registry.** A promise file may carry
   `clauses: [{ name, kind, statement?, rests_on? }]`, kind one of `split`,
   `limit`, `rests-on`. `indusk promises declare` takes repeatable
   `--clause "<name> (<kind>). <sentence>"` /
   `--clause "<name> (rests on <promise>)"` and writes them; a bad kind or a
   resting clause on a promise that does not exist is refused with nothing
   written (A3, A11). The registry reader validates the list.
4. **Brief and registry agree.** The contract check refuses an opted-in brief
   whose clauses differ from the registry's, naming the clause (A4).
5. **The clause plan.** For an opted-in plan, `test-plan.md` holds
   `## \`promise\`` sections each with `### \`clause\`` subsections, each
   carrying a `- Signal:` line. A new `lib/promises/clause-plan.ts` reads it;
   the contract check refuses a missing promise or clause section or a missing
   signal, naming it (A5, A6). It is checked only once the file exists, so a
   plan whose brief was just accepted is not refused for the document it has not
   written yet.
6. **Rows name clauses.** `clause: <promise>/<clause>` is a third token in the
   `For` cell, read by `parsePurpose` and its hook port alike (A14). The purpose
   gains `clauses: {promise, clause}[]`, and the promise is also pushed to
   `promises`, so every reader of `purpose.promises` lists the row (A15). The
   contract check and the save hook refuse a clause the promise does not have
   (A7). For an opted-in plan with an impl, every non-resting clause must be
   named by a row (A8).
7. **Closing.** `rowProofs` gains a per-clause half: a promise with clauses is
   proved when each split and limit clause has a passing row with a test file,
   and each resting clause's promise is `enforced` (A9, A11). The cleanup gate
   and confirm both read it; the refusal names the clause.
8. **The planner.** Step 3 tells the planner to group promises that share code
   into one plan and suggest separate plans under a master otherwise (A12);
   Step 4's brief template states clauses; Step 5 describes the clause plan
   (A10). The planning context file gains the rule.

## Alternatives Considered

### A clause-plan file per promise
Matches "each promise gets its clause plan" literally, but the lifecycle, the
workflow types, the admin and their parity pins all name one `test-plan`
document. One section per promise in one file says the same and costs one
reader.

### Clauses only in the brief
The brief belongs to a plan, which ends; the promise does not. Incidents and
standing read the registry, so the parts must be there.

### A `Clause` column on the trajectory
Every row reader would need a second cell; a token in `For` reaches all of them
through `purpose.promises`.

## Consequences

### Positive
- A promise of five clauses with one tested no longer closes.
- `mark-first` gets a named place for each clause's signal; `run-the-master` gets rows that say which clause they prove.

### Negative
- Two names for one document (test plan in the lifecycle, clause plan in prose) until a rename.
- A third token grammar in the `For` cell, in two copies.

### Risks
- The two `parsePurpose` copies drift — mitigated by A14 in the shared-modules test.
- A clause renamed in the brief and not in the registry — A4 refuses it at the contract check, which every `pnpm test` runs.

## Documentation Plan

### Pages
- Update: `apps/docs/src/guide/briefs.md` — promises stated as clauses, the opt-in.
- Update: `apps/docs/src/guide/test-trajectory.md` — the `clause:` token.
- Update: `apps/docs/src/reference/cli/promises.md` — `declare --clause`.
- Update: `apps/docs/src/reference/skills/plan.md` — the clause plan.

### Diagrams
- None — the shape is a list under a list.

### Changelog
- Added: promises stated as clauses — `clauses: required` in a brief, `declare --clause`, the clause plan, `clause:` rows, closing per clause.

### ADR in Docs
- Yes: `decisions/plans-are-promises.md`, published at close.

## References
- `.indusk/planning/promise-core/master.md`
- [brief.md](brief.md), [research.md](research.md), [test-plan.md](test-plan.md)
