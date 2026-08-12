---
title: "Test phases as structure — giving the first discipline a home"
date: 2026-08-11
status: complete
---

# Test phases as structure — Research

## Question

InDusk's central discipline is **write the tests first, and justify any test you defer**. The justification is enforced. The writing is not — because "tests first" was built as an *attribute of a trajectory row* (`Writable at: Phase N`) rather than a *stage of the plan*, and an attribute has no moment to be checked at.

The question: **what does it cost to make test authoring a real phase, and what does that change about the impl document?**

This research does not re-derive the design — that was settled in conversation (2026-08-11) and is recorded in the brief. It measures the blast radius and surfaces what the design has to survive.

## Findings

### 1. The rule is followed 59% of the time, and nothing notices the other 41%

Across all 52 impls on disk, trajectory rows by `Writable at`:

| Writable at | Rows | Share |
|---|---|---|
| **Phase 0** | 260 | **59%** |
| Phase 1 | 80 | 18% |
| Phase 2 | 38 | 9% |
| Phase 3 | 32 | 7% |
| Phase 4 | 21 | 5% |
| Phase 5 | 13 | 3% |

**184 rows — 41% — defer authoring past Phase 0.** Each is supposed to carry a `### Trajectory Rationale` entry justifying the deferral, and `validate-impl-structure.js` enforces that the entry exists.

So the exception path is guarded and measured. The default path — the 260 Phase 0 rows — has no enforcement moment at all (finding 3).

**Confidence: high.** Counted from the files, not recalled.

### 2. `Phase 0` is already taken, and it means something else

Seven impls use `### Phase 0`, plus one `### Phase 0.5`. Their titles:

- Skill Cleanup (from audit)
- Allow A-prefix trajectory IDs
- Config + Planning Migration
- Rename judge → evaluator
- Scaffold + reference task
- Skill Audit
- **Baseline measurement scripts (red tripwires)**
- *(Phase 0.5)* Skill Cleanup (from audit)

**Six of eight are prerequisite build work discovered late** — exactly the informal usage the design constraint named. Only one ("Baseline measurement scripts") is test authoring.

This rules out `Phase 0` as the name for a test-authoring stage. It is in active use for something else, in 13% of impls, and overloading it would make the two indistinguishable to both readers and parsers.

**Confidence: high.**

### 3. Gate A cannot fire on Phase 0, by construction

`check-gates.js` enforces test-first authoring with an exact match:

```js
row.writableAt === advancingPhase
```

`advancingPhase` is derived from ticking an implementation item inside `### Phase N`, so it is always ≥ 1. **A `Writable at: Phase 0` row therefore never matches, and is never enforced.**

Observed live: in `lifecycle-rebalance`, rows T13–T17 were `Writable at: Phase 0` and were authored at the start of **Phase 5**, four phases late. Nothing objected. A3 and A9 were also Phase 0 and were authored during Phase 1 — correct by accident, not by enforcement.

The exact match also misses drift in the other direction: a row `Writable at: Phase 2` still `planned` while Phase 5 closes is a violation today that nothing reports.

**Confidence: high.** Read from `check-gates.js:327`, and confirmed against a plan's own history.

### 4. The phase heading is parsed in six non-test files

Occurrences of a `Phase`-matching pattern per file (excluding tests):

| File | Occurrences | Role |
|---|---|---|
| `hooks/validate-impl-structure.js` | 32 | write-time structure validation |
| `hooks/check-gates.js` | 23 | phase-transition enforcement |
| `lib/trajectory/validator.ts` | 20 | trajectory rules |
| `hooks/gate-reminder.js` | 12 | advisory nudge |
| `lib/impl-parser.ts` | 9 | canonical parse |
| `lib/trajectory/state-ops.ts` | 3 | row state rewriting |
| `lib/trajectory/parser.ts` | 2 | trajectory table parse |
| `lib/shape/impl-blocks.ts` | 1 | Craft's block scan |

The specific heading regex `^###\s+Phase\s+(\d+)` appears in **`impl-parser.ts`, `check-gates.js`, `gate-reminder.js`, `validate-impl-structure.js` (×2), `trajectory/validator.ts`, and `shape/impl-blocks.ts`** — seven occurrences, six files.

This is the same fan-out that caused the `lifecycle-rebalance` ADR to reject a new gate type ("gate vocabulary is closed in four independent places"). The phase heading is worse than the gate vocabulary, and no single-definition test covers it — despite `shared-resolution.test.ts` and `shared-definitions.test.ts` existing precisely to pin rules like this.

**Confidence: high.**

### 5. Backward compatibility has a cheap answer

52 impls contain `### Phase N` headings; 50 have a Phase 1. A naive rename to `### Build Phase N` would require migrating all of them.

An optional prefix avoids it entirely:

```js
/^###\s+(?:Build\s+)?Phase\s+(\d+)/
```

Both `### Phase 1` and `### Build Phase 1` parse as build phase 1. **No impl needs migrating**, no version flag, no new-impls-only split. `### Test Phase N` is a genuinely new heading and needs real handling — but only in the files that must distinguish the two kinds (the validator, `check-gates`, `impl-parser`). The remaining sites keep matching build phases exactly as before.

**Confidence: high** on the regex; **moderate** on "only three files need the new heading" — that depends on whether `gate-reminder`, `state-ops` and `impl-blocks` must treat a test phase differently, which the impl will have to settle per-file.

### 6. Two homes for the same fact, today

The deferral justification currently lives in `### Trajectory Rationale`, a subsection under the trajectory table, justifying a *column value*. The design moves it into Test Phase 1, where the authoring decision is actually made.

If both survive, the same fact has two homes and they can disagree — the failure mode this codebase already has three named lessons about (`one-resolution-function-per-shared-relationship`, `structural-single-definition-test-for-must-agree-invariants`, and the `resolveImplPath` gotcha). The Trajectory Rationale should be **absorbed, not supplemented**.

**Confidence: high** on the risk; the migration path for the 184 existing rationale entries is an open question.

### 7. There is an existing gate item that wants to be the test phase's gate

Phase Verification blocks routinely contain a hand-written line of the form:

> `A4, A6, A7, A10 still red (Phase 3), A9 still red (Phase 4) — confirm each fails on its own assertion, not an import error`

This is the check that authored tests are red **for the right reason** — the thing that separates a live tripwire from a test that fails because a file does not exist. It is currently a convention people remember to write, not structure.

A test phase has an obvious gate: *the rows it authors exist, run, and fail on their own assertion.* That promotes an ad-hoc habit into an enforced one.

**Confidence: high** that the pattern exists; sampled from `lifecycle-rebalance` and consistent with the trajectory guide's framing.

## Open Questions

- **What do the trajectory columns become?** `Writable at: Phase N` conflates two namespaces once build and test phases both exist. Candidate: `Written in: Test Phase N` / `Passes at: Build Phase N`. Renaming a column touches the parser, the validator, and 52 impls — unless the same optional-prefix trick applies.
- **Does a test phase carry the four gates?** Verification is answerable (rows authored and red for the right reason). Context and Document look like noise on an authoring phase. If it carries fewer gates than a build phase, the "all or none" rule needs restating at the right level.
- **How is "justify Test Phase N in Test Phase 1" checked?** Mechanically simple (for each `### Test Phase N`, N>1, require a referencing entry in Test Phase 1), but the entry's *shape* has to be pinned or the validator can only check for a mention.
- **What happens to the 184 existing Trajectory Rationale entries** if that section is absorbed into Test Phase 1? Archived impls are read-only history; active plans are not.
- **Does `Phase 0` stay legal for prereq build work?** Six impls use it that way. If build phases become `Build Phase N`, is `Build Phase 0` allowed, and does the ordering rule (test phase first) conflict with it?

## Sources

- `.indusk/planning/*/impl.md` + `archive/*/impl.md` — 52 files; the 444-row `Writable at` census and the `### Phase 0` usage survey
- `apps/indusk-mcp/hooks/check-gates.js:327` — Gate A's exact-match enforcement
- `apps/indusk-mcp/hooks/validate-impl-structure.js` — Trajectory Rationale enforcement
- `.indusk/planning/archive/lifecycle-rebalance/` — the gate-vocabulary blast-radius finding, and T13–T17 as the observed Phase 0 drift
- Design conversation, 2026-08-11 — the test-phase/build-phase split and the justify-in-Test-Phase-1 rule
